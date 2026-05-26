import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Tldraw,
  Editor,
  AssetRecordType,
  TLAssetId,
  exportToBlob,
  createShapeId,
  TLPageId,
  TLImageShape,
  getHashForString,
  Box,
} from 'tldraw';
import 'tldraw/tldraw.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronLeft, ChevronRight, CloudUpload, EyeOff, FileStack, ImagePlus, Loader2, LogOut, Palette, PenLine, Plus, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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

// Default "slide" size for blank whiteboard pages — 16:9 at a comfortable
// resolution. Exports are pinned to this box (or the PDF image's box on
// imported pages) so every page in the final PDF has the same dimensions.
const BLANK_PAGE_W = 1920;
const BLANK_PAGE_H = 1080;
const EXPORT_SCALE = 1.5;

const Whiteboard = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Leave the whiteboard. When it was opened in its own browser tab,
  // window.close() works; in the installed PWA (navigated in-place, no tab to
  // close) we fall back to returning to the dashboard.
  const handleExit = useCallback(() => {
    window.close();
    setTimeout(() => navigate('/'), 100);
  }, [navigate]);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [startMode, setStartMode] = useState<StartMode>('choose');
  const [scheduleCtx, setScheduleCtx] = useState<ScheduleContext | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [navVisible, setNavVisible] = useState(true);
  const [postToNotes, setPostToNotes] = useState(true);
  const [alsoDownload, setAlsoDownload] = useState(false);
  const [stylePanelHidden, setStylePanelHidden] = useState(false);
  // Focus mode — hide all chrome (header, navigator, style panel) at once.
  const [chromeHidden, setChromeHidden] = useState(false);

  const showAllChrome = () => {
    setChromeHidden(false);
    setNavVisible(true);
    setStylePanelHidden(false);
  };
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

    // Resume detection: if this device already has a persisted session
    // (more than one page, or any shapes anywhere), skip the start chooser.
    const pages = ed.getPages();
    const totalShapes = pages.reduce(
      (acc, p) => acc + ed.getPageShapeIds(p.id).size,
      0,
    );
    if (totalShapes > 0 || pages.length > 1) {
      setStartMode('blank');
    }

    ed.store.listen(() => {
      const ps = ed.getPages();
      setPageCount(ps.length);
      const idx = ps.findIndex((p) => p.id === ed.getCurrentPageId());
      if (idx >= 0) setCurrentPage(idx + 1);
    });

    // Auto-enter focus mode the moment the teacher starts drawing/writing —
    // a pointer-down on the canvas with any content tool (pen, text, shapes,
    // etc.) hides all chrome. Non-drawing tools (select/hand/zoom/eraser)
    // are ignored so the toolbar stays put while they're just navigating.
    const NON_DRAWING = new Set(['select', 'hand', 'zoom', 'eraser']);
    ed.on('event', (info) => {
      if (
        info.type === 'pointer' &&
        info.name === 'pointer_down' &&
        !NON_DRAWING.has(ed.getCurrentToolId())
      ) {
        setChromeHidden(true);
      }
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

  // Re-center / zoom the current page to its canonical bounds — so flipping
  // between pages always lands the teacher on the slide area, even if they
  // scrolled away on a previous visit to that page.
  const focusPage = (ed: Editor) => {
    const shapes = ed.getCurrentPageShapes();
    const pageBg = shapes.find(
      (s): s is TLImageShape => s.type === 'image' && s.isLocked && s.x === 0 && s.y === 0,
    );
    const bounds = pageBg
      ? new Box(0, 0, pageBg.props.w, pageBg.props.h)
      : new Box(0, 0, BLANK_PAGE_W, BLANK_PAGE_H);
    ed.zoomToBounds(bounds, { animation: { duration: 220 }, inset: 24 });
  };

  // Drop a faint locked rectangle at (0,0,BLANK_PAGE_W,BLANK_PAGE_H) so the
  // teacher can see where the exported slide actually ends. Strokes drawn
  // outside this rectangle get clipped on export.
  const ensureFrameOnCurrentPage = (ed: Editor) => {
    const shapes = ed.getCurrentPageShapes();
    const alreadyHasFrame = shapes.some(
      (s) =>
        s.type === 'geo' &&
        s.isLocked &&
        s.x === 0 &&
        s.y === 0 &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s as any).props?.w === BLANK_PAGE_W &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s as any).props?.h === BLANK_PAGE_H,
    );
    if (alreadyHasFrame) return;
    ed.createShape({
      id: createShapeId(),
      type: 'geo',
      x: 0,
      y: 0,
      isLocked: true,
      opacity: 0.45,
      props: {
        geo: 'rectangle',
        w: BLANK_PAGE_W,
        h: BLANK_PAGE_H,
        color: 'white',
        fill: 'none',
        dash: 'solid',
        size: 'm',
      },
    });
  };

  const startBlank = () => {
    setStartMode('blank');
    if (editor) {
      ensureFrameOnCurrentPage(editor);
      focusPage(editor);
    }
  };

  const addBlankPage = () => {
    if (!editor) return;
    editor.createPage({ name: `Page ${editor.getPages().length + 1}` });
    const last = editor.getPages()[editor.getPages().length - 1];
    editor.setCurrentPage(last.id);
    ensureFrameOnCurrentPage(editor);
    focusPage(editor);
  };

  const goToPrev = () => {
    if (!editor) return;
    const pages = editor.getPages();
    const idx = pages.findIndex((p) => p.id === editor.getCurrentPageId());
    if (idx > 0) {
      editor.setCurrentPage(pages[idx - 1].id);
      focusPage(editor);
    }
  };

  const goToNext = () => {
    if (!editor) return;
    const pages = editor.getPages();
    const idx = pages.findIndex((p) => p.id === editor.getCurrentPageId());
    if (idx >= 0 && idx < pages.length - 1) {
      editor.setCurrentPage(pages[idx + 1].id);
      focusPage(editor);
    }
  };

  // Render every page into a single uniform-sized PDF and return its bytes.
  const buildPdfBytes = async (): Promise<Uint8Array> => {
    if (!editor) throw new Error('Editor not ready');
    const pages = editor.getPages();
    const pdfDoc = await PDFDocument.create();
    const startedFrom = editor.getCurrentPageId();
    for (let i = 0; i < pages.length; i++) {
      setBusyLabel(`Rendering page ${i + 1} of ${pages.length}…`);
      const p = pages[i];
      editor.setCurrentPage(p.id);

      // Pin the export to a fixed rectangle so every page in the final
      // PDF has uniform dimensions. PDF-imported pages reuse the locked
      // image's bounds; blank pages use the default 16:9 slide.
      const shapes = editor.getCurrentPageShapes();
      const pageBg = shapes.find(
        (s): s is TLImageShape => s.type === 'image' && s.isLocked && s.x === 0 && s.y === 0,
      );
      const bounds = pageBg
        ? new Box(0, 0, pageBg.props.w, pageBg.props.h)
        : new Box(0, 0, BLANK_PAGE_W, BLANK_PAGE_H);

      const ids = shapes.map((s) => s.id);
      const blob = await exportToBlob({
        editor,
        ids,
        format: 'png',
        opts: { background: true, darkMode: !pageBg, bounds, padding: 0, scale: EXPORT_SCALE },
      });

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = await pdfDoc.embedPng(bytes);
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    editor.setCurrentPage(startedFrom);
    return pdfDoc.save();
  };

  const downloadBytes = (bytes: Uint8Array, fileName: string) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary);
  };

  const exportPdf = async () => {
    if (!editor) return;
    setBusy(true);
    setBusyLabel('Building PDF…');
    try {
      const safeTitle =
        (title || 'whiteboard').replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'whiteboard';
      const bytes = await buildPdfBytes();
      const wantsDrive = postToNotes && !!scheduleCtx;

      if (wantsDrive) {
        setBusyLabel('Uploading to Drive & Notes…');
        const { data, error } = await supabase.functions.invoke('upload-whiteboard-pdf', {
          body: {
            scheduleId,
            title: title || safeTitle,
            pdfBase64: bytesToBase64(bytes),
            postToNotes: true,
          },
        });

        if (error || !data?.success) {
          console.error('upload-whiteboard-pdf failed:', error, data);
          downloadBytes(bytes, `${safeTitle}.pdf`);
          toast.error('Could not save to Drive/Notes — downloaded a copy instead.');
          setSaveOpen(false);
          return;
        }

        if (data.noteInserted === false) {
          toast.error('Uploaded to Drive, but attaching to Notes failed. Link is in your Drive.');
        } else {
          toast.success(`Saved to Notes for ${scheduleCtx!.batch} — ${scheduleCtx!.subject}`);
        }
      }

      if (alsoDownload || !wantsDrive) {
        downloadBytes(bytes, `${safeTitle}.pdf`);
        if (!wantsDrive) toast.success('PDF downloaded');
      }

      setSaveOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save whiteboard');
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
    <div className="h-screen w-screen relative bg-slate-950 text-white overflow-hidden">
      <input ref={pdfInputRef} type="file" accept="application/pdf" hidden onChange={onPdfChosen} />
      <input ref={insertPdfInputRef} type="file" accept="application/pdf" hidden onChange={onInsertPdfChosen} />
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={onImageChosen} />

      {/* Scoped CSS: shift tldraw's top UI below our header so the style
          panel never sits under the Insert/Save buttons; allow hiding it. */}
      <style>{`
        .wb-canvas.wb-offset .tlui-layout__top { padding-top: 52px; }
        .wb-canvas.wb-hide-style .tlui-style-panel__wrapper { display: none !important; }
      `}</style>

      {/* Canvas — fills the whole viewport so collapsing chrome reclaims real estate */}
      <div
        className={cn(
          'absolute inset-0 wb-canvas',
          !chromeHidden && 'wb-offset',
          (stylePanelHidden || chromeHidden) && 'wb-hide-style',
        )}
      >
        <Tldraw
          onMount={handleMount}
          inferDarkMode
          persistenceKey={scheduleId ? `wb-${scheduleId}` : undefined}
        />
      </div>

      {/* Top header (overlay, slides up on collapse) */}
      <header
        className={cn(
          'absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-2 bg-gradient-to-r from-fuchsia-900 via-purple-900 to-indigo-900 border-b border-white/10 shadow-lg transition-transform duration-300',
          chromeHidden && '-translate-y-full',
        )}
      >
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
            <FileStack className="h-3.5 w-3.5 mr-1.5" />
            Insert PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 bg-white/5 text-white/90 border border-white/10 hover:bg-white/20 hover:text-white hover:border-white/30 transition-colors"
            onClick={() => imageInputRef.current?.click()}
            disabled={busy || startMode === 'choose'}
          >
            <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
            Insert image
          </Button>
          <Button
            size="sm"
            className="h-8 bg-fuchsia-600 text-white border border-fuchsia-500 hover:bg-fuchsia-500 hover:border-fuchsia-400 transition-colors"
            onClick={() => setSaveOpen(true)}
            disabled={busy || startMode === 'choose'}
          >
            <CloudUpload className="h-3.5 w-3.5 mr-1.5" />
            End & Save
          </Button>
          <button
            type="button"
            onClick={() => setStylePanelHidden((v) => !v)}
            title={stylePanelHidden ? 'Show color & size tools' : 'Hide color & size tools'}
            className={cn(
              'ml-1 h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors',
              stylePanelHidden
                ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/15 hover:text-white'
                : 'bg-fuchsia-500/30 border-fuchsia-400/40 text-white hover:bg-fuchsia-500/50',
            )}
          >
            <Palette className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setChromeHidden(true)}
            title="Focus mode — hide everything"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleExit}
            title="Exit whiteboard"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-white/80 hover:bg-rose-500/30 hover:border-rose-400/40 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Focus-mode restore tab — single control to bring all chrome back */}
      {chromeHidden && (
        <button
          type="button"
          onClick={showAllChrome}
          title="Show all controls"
          className="absolute top-2 left-1/2 -translate-x-1/2 z-40 h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900/90 backdrop-blur border border-white/15 text-white/90 hover:bg-slate-800 hover:text-white shadow-lg transition-colors"
        >
          <ChevronDown className="h-4 w-4" />
          <span className="text-xs font-medium">Show controls</span>
        </button>
      )}

      {/* Bottom-right page navigator (collapsible) */}
      {startMode !== 'choose' && navVisible && !chromeHidden && (
        <div className="absolute bottom-16 right-4 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 shadow-lg transition-all">
          <button
            type="button"
            onClick={goToPrev}
            disabled={busy || currentPage <= 1}
            title="Previous page"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-white/15 mx-1" />
          <button
            type="button"
            onClick={addBlankPage}
            disabled={busy}
            title="Add blank page"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-fuchsia-200 hover:text-white hover:bg-fuchsia-600/40 transition-colors disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setNavVisible(false)}
            title="Hide page navigator"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigator peek tab — shows when nav is collapsed */}
      {startMode !== 'choose' && !navVisible && !chromeHidden && (
        <button
          type="button"
          onClick={() => setNavVisible(true)}
          title="Show page navigator"
          className="absolute bottom-16 right-4 z-20 h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900/90 backdrop-blur border border-white/15 text-white/85 hover:bg-slate-800 hover:text-white shadow-lg transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-xs font-medium tabular-nums">{currentPage}/{pageCount}</span>
        </button>
      )}

      {startMode === 'choose' && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-white text-slate-900 border border-slate-200 rounded-lg p-7 max-w-2xl w-full mx-4 shadow-2xl">
            <h2 className="text-lg font-semibold mb-1">Start the whiteboard</h2>
            <p className="text-sm text-slate-500 mb-6">
              {scheduleCtx ? `${scheduleCtx.subject} — ${scheduleCtx.batch}` : 'Pick how you want to begin'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={startBlank}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-md border border-slate-200 bg-slate-50 hover:bg-fuchsia-50 hover:border-fuchsia-200 transition"
              >
                <Square className="h-8 w-8 text-fuchsia-600" />
                <div className="text-sm font-medium text-slate-900">Blank board</div>
                <div className="text-[11px] text-slate-500 text-center">Draw on empty pages, add more anytime</div>
              </button>
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-md border border-slate-200 bg-slate-50 hover:bg-fuchsia-50 hover:border-fuchsia-200 transition"
              >
                <FileStack className="h-8 w-8 text-fuchsia-600" />
                <div className="text-sm font-medium text-slate-900">Import PDF / Slides</div>
                <div className="text-[11px] text-slate-500 text-center">Each PDF page becomes an annotated page</div>
              </button>
            </div>
            <div className="mt-6 text-[11px] text-slate-400 text-center">
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

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End class & save whiteboard</DialogTitle>
            <DialogDescription>
              Exports all {pageCount} page{pageCount === 1 ? '' : 's'} as a single PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wb-title">PDF name</Label>
              <Input id="wb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kinematics — 2026-05-17" />
            </div>

            <label className={cn(
              'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
              scheduleCtx ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-100 opacity-60 cursor-not-allowed',
            )}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-fuchsia-600"
                checked={postToNotes && !!scheduleCtx}
                disabled={!scheduleCtx}
                onChange={(e) => setPostToNotes(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-900">Upload to Drive &amp; add to Notes</span>
                <span className="block text-xs text-slate-500">
                  {scheduleCtx
                    ? `Saves to Google Drive and posts to ${scheduleCtx.batch} — ${scheduleCtx.subject}. Students see it in References.`
                    : 'Unavailable — this whiteboard has no class context.'}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-fuchsia-600"
                checked={alsoDownload}
                onChange={(e) => setAlsoDownload(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-900">Also download a copy</span>
                <span className="block text-xs text-slate-500">Saves the PDF to this device as well.</span>
              </span>
            </label>
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
