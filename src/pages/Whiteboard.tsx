import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Tldraw,
  Editor,
  AssetRecordType,
  TLAssetId,
  exportToBlob,
  createShapeId,
  TLPageId,
  getHashForString,
} from 'tldraw';
import 'tldraw/tldraw.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Loader2, PenLine, Plus, Save, Square } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type StartMode = 'choose' | 'blank' | 'pdf';

interface ScheduleContext {
  id: string;
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  date?: string | null;
}

// PDF render quality vs IndexedDB size. 1.5x is crisp enough for handwriting
// overlay; JPEG quality 0.85 keeps a typical A4 page under ~250KB so a
// 50-page deck stays well within browser storage limits.
const PDF_RENDER_SCALE = 1.5;
const PDF_JPEG_QUALITY = 0.85;

const Whiteboard = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [startMode, setStartMode] = useState<StartMode>('choose');
  const [scheduleCtx, setScheduleCtx] = useState<ScheduleContext | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const insertPdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!scheduleId) return;
    (async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, subject, batch, start_time, end_time, date')
        .eq('id', scheduleId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error('Could not load class info');
        return;
      }
      if (data) {
        setScheduleCtx(data as ScheduleContext);
        const dateStr = data.date ?? new Date().toISOString().slice(0, 10);
        setTitle(`${data.subject} — ${dateStr}`);
        document.title = `Whiteboard — ${data.subject}`;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleId]);

  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    ed.user.updateUserPreferences({ colorScheme: 'dark' });
    setPageCount(ed.getPages().length);
    setCurrentPage(1);
    ed.store.listen(() => {
      const pages = ed.getPages();
      setPageCount(pages.length);
      const idx = pages.findIndex((p) => p.id === ed.getCurrentPageId());
      if (idx >= 0) setCurrentPage(idx + 1);
    });
  }, []);

  // Render one PDF page to a data URL. We deliberately avoid
  // URL.createObjectURL/blob: URLs because tldraw's asset validator rejects
  // them (they die on page refresh, so persistence breaks). Data URLs are
  // self-contained and survive an IndexedDB reload.
  const renderPdfPageToDataUrl = async (pdf: pdfjsLib.PDFDocumentProxy, pageIndex: number) => {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    // White background so JPEG (which has no alpha) shows correctly
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const src = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
    return { src, width: viewport.width, height: viewport.height };
  };

  const placeImageOnPage = async (
    ed: Editor,
    pageId: TLPageId,
    src: string,
    width: number,
    height: number,
    locked: boolean,
  ) => {
    ed.setCurrentPage(pageId);
    const assetId: TLAssetId = AssetRecordType.createId(getHashForString(`${pageId}-${Date.now()}-${Math.random()}`));
    ed.createAssets([
      {
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: 'page.jpg',
          src,
          w: width,
          h: height,
          mimeType: 'image/jpeg',
          isAnimated: false,
        },
        meta: {},
      },
    ]);
    const shapeId = createShapeId();
    ed.createShape({
      id: shapeId,
      type: 'image',
      x: 0,
      y: 0,
      props: { assetId, w: width, h: height },
      isLocked: locked,
    });
    if (locked) {
      ed.zoomToFit();
    }
  };

  const importPdf = useCallback(
    async (file: File, mode: 'replace' | 'append') => {
      if (!editor) return;
      setBusy(true);
      setBusyLabel('Importing PDF…');
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

        if (mode === 'replace') {
          const pages = editor.getPages();
          for (const p of pages.slice(1)) editor.deletePage(p.id);
          editor.setCurrentPage(pages[0].id);
          editor.selectAll();
          editor.deleteShapes(editor.getSelectedShapeIds());
        }

        for (let i = 1; i <= pdf.numPages; i++) {
          setBusyLabel(`Importing page ${i} of ${pdf.numPages}…`);
          const { src, width, height } = await renderPdfPageToDataUrl(pdf, i);
          let pageId: TLPageId;
          if (mode === 'replace' && i === 1) {
            pageId = editor.getPages()[0].id;
            editor.renamePage(pageId, `Page 1`);
          } else {
            editor.createPage({ name: `Page ${editor.getPages().length + 1}` });
            pageId = editor.getPages()[editor.getPages().length - 1].id;
          }
          await placeImageOnPage(editor, pageId, src, width, height, true);
        }

        editor.setCurrentPage(editor.getPages()[0].id);
        editor.zoomToFit();
        toast.success(`Imported ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''}`);
      } catch (e) {
        console.error(e);
        toast.error('Failed to import PDF');
      } finally {
        setBusy(false);
        setBusyLabel('');
      }
    },
    [editor],
  );

  const onPdfChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setStartMode('pdf');
    await importPdf(f, 'replace');
  };

  const onInsertPdfChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    await importPdf(f, 'append');
  };

  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !editor) return;
    setBusy(true);
    setBusyLabel('Inserting image…');
    try {
      const screenCenter = editor.getViewportScreenCenter();
      const pageCenter = editor.screenToPage(screenCenter);
      await editor.putExternalContent({
        type: 'files',
        files: [f],
        point: pageCenter,
        ignoreParent: false,
      });
      toast.success('Image inserted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to insert image');
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const startBlank = () => {
    setStartMode('blank');
  };

  const addBlankPage = () => {
    if (!editor) return;
    editor.createPage({ name: `Page ${editor.getPages().length + 1}` });
    const last = editor.getPages()[editor.getPages().length - 1];
    editor.setCurrentPage(last.id);
  };

  const goToPrev = () => {
    if (!editor) return;
    const pages = editor.getPages();
    const idx = pages.findIndex((p) => p.id === editor.getCurrentPageId());
    if (idx > 0) editor.setCurrentPage(pages[idx - 1].id);
  };

  const goToNext = () => {
    if (!editor) return;
    const pages = editor.getPages();
    const idx = pages.findIndex((p) => p.id === editor.getCurrentPageId());
    if (idx >= 0 && idx < pages.length - 1) editor.setCurrentPage(pages[idx + 1].id);
  };

  const exportPdf = async () => {
    if (!editor) return;
    setBusy(true);
    setBusyLabel('Building PDF…');
    try {
      const pages = editor.getPages();
      const pdfDoc = await PDFDocument.create();
      const startedFrom = editor.getCurrentPageId();
      for (let i = 0; i < pages.length; i++) {
        setBusyLabel(`Rendering page ${i + 1} of ${pages.length}…`);
        const p = pages[i];
        editor.setCurrentPage(p.id);
        const ids = Array.from(editor.getCurrentPageShapeIds());
        let blob: Blob;
        if (ids.length > 0) {
          blob = await exportToBlob({ editor, ids, format: 'png', opts: { background: true, padding: 0, scale: 2 } });
        } else {
          const c = document.createElement('canvas');
          c.width = 1240;
          c.height = 1754;
          const cx = c.getContext('2d');
          if (cx) {
            cx.fillStyle = '#ffffff';
            cx.fillRect(0, 0, c.width, c.height);
          }
          blob = await new Promise<Blob>((resolve, reject) =>
            c.toBlob((b) => (b ? resolve(b) : reject(new Error('blank toBlob failed'))), 'image/png')!,
          );
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await pdfDoc.embedPng(bytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      editor.setCurrentPage(startedFrom);

      const safeTitle = (title || 'whiteboard').replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'whiteboard';
      const bytes = await pdfDoc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF saved');
      setSaveOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to export PDF');
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
        <p>You must be signed in to use the whiteboard.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      <input ref={pdfInputRef} type="file" accept="application/pdf" hidden onChange={onPdfChosen} />
      <input ref={insertPdfInputRef} type="file" accept="application/pdf" hidden onChange={onInsertPdfChosen} />
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={onImageChosen} />

      <header className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-fuchsia-900 via-purple-900 to-indigo-900 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <PenLine className="h-5 w-5 text-fuchsia-200 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {scheduleCtx ? `${scheduleCtx.subject} — ${scheduleCtx.batch}` : 'Whiteboard'}
            </div>
            <div className="text-[11px] text-white/60 truncate">
              {scheduleCtx ? `${scheduleCtx.start_time?.slice(0, 5)} – ${scheduleCtx.end_time?.slice(0, 5)}` : 'No class context'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 bg-white/5 text-white/90 border border-white/10 hover:bg-white/20 hover:text-white hover:border-white/30 transition-colors"
            onClick={() => insertPdfInputRef.current?.click()}
            disabled={busy || startMode === 'choose'}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Insert PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 bg-white/5 text-white/90 border border-white/10 hover:bg-white/20 hover:text-white hover:border-white/30 transition-colors"
            onClick={() => imageInputRef.current?.click()}
            disabled={busy || startMode === 'choose'}
          >
            <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
            Insert image
          </Button>
          <Button
            size="sm"
            className="h-8 bg-fuchsia-600 text-white border border-fuchsia-500 hover:bg-fuchsia-500 hover:border-fuchsia-400 transition-colors"
            onClick={() => setSaveOpen(true)}
            disabled={busy || startMode === 'choose'}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            End & Save
          </Button>
        </div>
      </header>

      <div className="flex-1 relative">
        <Tldraw
          onMount={handleMount}
          inferDarkMode
          persistenceKey={scheduleId ? `wb-${scheduleId}` : undefined}
        />

        {/* Bottom-center page navigator (PW-style) */}
        {startMode !== 'choose' && (
          <div className="absolute bottom-16 right-4 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-white/10 rounded-full px-2 py-1.5 shadow-lg">
            <button
              type="button"
              onClick={goToPrev}
              disabled={busy || currentPage <= 1}
              title="Previous page"
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-white/90 tabular-nums px-2 min-w-[64px] text-center">
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={goToNext}
              disabled={busy || currentPage >= pageCount}
              title="Next page"
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-white/15 mx-1" />
            <button
              type="button"
              onClick={addBlankPage}
              disabled={busy}
              title="Add blank page"
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-fuchsia-200 hover:text-white hover:bg-fuchsia-600/40 transition-colors disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {startMode === 'choose' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
              <h2 className="text-lg font-semibold mb-1">Start the whiteboard</h2>
              <p className="text-sm text-white/60 mb-6">
                {scheduleCtx ? `${scheduleCtx.subject} — ${scheduleCtx.batch}` : 'Pick how you want to begin'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startBlank}
                  className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  <Square className="h-8 w-8 text-fuchsia-300" />
                  <div className="text-sm font-medium">Blank board</div>
                  <div className="text-[11px] text-white/50 text-center">Draw on empty pages, add more anytime</div>
                </button>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  <FileText className="h-8 w-8 text-fuchsia-300" />
                  <div className="text-sm font-medium">Import PDF / Slides</div>
                  <div className="text-[11px] text-white/50 text-center">Each PDF page becomes an annotated page</div>
                </button>
              </div>
              <div className="mt-6 text-[11px] text-white/40 text-center">
                Resume picks up automatically — your strokes are saved on this device.
              </div>
            </div>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="bg-slate-900 border border-white/10 rounded-xl px-6 py-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-fuchsia-300" />
              <span className="text-sm">{busyLabel || 'Working…'}</span>
            </div>
          </div>
        )}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End class & save whiteboard</DialogTitle>
            <DialogDescription>
              Exports all {pageCount} page{pageCount === 1 ? '' : 's'} as a single PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wb-title">PDF name</Label>
              <Input id="wb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kinematics — 2026-05-17" />
            </div>
            <div className="text-xs text-slate-500">
              Drive upload + auto-attach to Notes will be added next. For now the PDF downloads to your device.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={exportPdf} disabled={busy} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Whiteboard;
