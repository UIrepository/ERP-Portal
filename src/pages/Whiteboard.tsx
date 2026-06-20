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
  getSnapshot,
  loadSnapshot,
  Box,
} from 'tldraw';
import 'tldraw/tldraw.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, rgb } from 'pdf-lib';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronLeft, ChevronRight, CloudUpload, Download, EyeOff, FileStack, ImagePlus, Loader2, LogOut, Palette, PenLine, Plus, Save, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadBlobToCloudinary } from '@/lib/cloudinary';
import { WhiteboardStylePanel } from '@/components/whiteboard/WhiteboardStylePanel';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Swap tldraw's default style panel for ours (pen-width slider instead of the
// S/M/L size buttons), and remove the zoom/minimap control — the board is a
// fixed "slide" view with no zooming. Module-level for a stable reference.
const WB_COMPONENTS = { StylePanel: WhiteboardStylePanel, NavigationPanel: null };

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

// Default "slide" size for blank whiteboard pages — 16:9 widescreen, the same
// proportions PowerPoint/Google Slides use. The slide fills the screen and
// exports edge-to-edge as a 16:9 page (what you write is what you get).
const BLANK_PAGE_W = 1920;
const BLANK_PAGE_H = 1080; // 16:9
const EXPORT_SCALE = 1.5;

// Each exported PDF page is sized to its own content (no letterboxing): the
// longest side is normalised to this many points (1pt = 1/72"). 960pt = 13.33"
// — the width of a standard PowerPoint 16:9 slide, so a blank board exports as
// a normal 13.33"×7.5" widescreen PDF page.
const PDF_LONG_SIDE_PT = 960;

// Ray-casting point-in-polygon test (page-space) for the freehand lasso select.
const pointInPolygon = (pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const Whiteboard = () => {
  const { scheduleId, fileId } = useParams<{ scheduleId?: string; fileId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // "File mode" = a general-purpose teacher whiteboard (not a class). Saved as a
  // workspace file (cloud snapshot + thumbnail), never tied to a batch/subject.
  const fileMode = !!fileId;
  const fileContentUrlRef = useRef<string | null>(null);
  const fileLoadedRef = useRef(false);

  // Leave the whiteboard. When it was opened in its own browser tab,
  // window.close() works; in the installed PWA (navigated in-place, no tab to
  // close) we fall back to returning to the dashboard.
  const handleExit = useCallback(() => {
    window.close();
    setTimeout(() => navigate('/'), 100);
  }, [navigate]);

  const [editor, setEditor] = useState<Editor | null>(null);
  // Screen-space rectangle of the current blank page, used to paint the slate
  // "sheet" behind the canvas. null on PDF-imported pages (the image is the
  // page) or before the camera is positioned.
  const [sheetRect, setSheetRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // null = still checking; true/false = server's verdict on whether this user
  // may open this class's whiteboard.
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);
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
  // Freehand "lasso" select — draw a loop to select whatever it encircles.
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoScreenPath, setLassoScreenPath] = useState('');
  const lassoPtsRef = useRef<{ x: number; y: number }[]>([]);
  const lassoDrawingRef = useRef(false);

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

  // The locked camera doesn't re-fit on its own, so on a window resize re-fit
  // the page and re-align the slate sheet behind it.
  useEffect(() => {
    if (!editor) return;
    const onResize = () => requestAnimationFrame(() => focusPage(editor));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // focusPage is stable enough for this purpose; only re-bind when editor changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Authorization gate: only the staff in charge of this class may open the
  // whiteboard — admins/managers, or the teacher assigned to this schedule's
  // batch+subject. Enforced server-side (can_open_whiteboard RPC); the client
  // just reflects the verdict so unauthorized users never see the board.
  useEffect(() => {
    if (authLoading) return;
    if (fileMode) return; // file mode is gated by the file-load effect below
    if (!user || !scheduleId) {
      setAccessAllowed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('can_open_whiteboard', {
        p_schedule_id: scheduleId,
      });
      if (cancelled) return;
      setAccessAllowed(error ? false : data === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, scheduleId, authLoading, fileMode]);

  // File mode: load the file's row. RLS only returns it to the owner (teacher)
  // or an admin, so a readable row IS the access check. Also sets the title and
  // remembers the cloud snapshot URL for loading.
  useEffect(() => {
    if (authLoading) return;
    if (!fileId) return;
    if (!user) {
      setAccessAllowed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('whiteboard_files')
        .select('id, title, content_url')
        .eq('id', fileId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setAccessAllowed(false);
        return;
      }
      setTitle(data.title);
      fileContentUrlRef.current = data.content_url;
      document.title = `Whiteboard — ${data.title}`;
      setAccessAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId, user, authLoading]);

  // File mode: once the editor is ready and we have access, if this device has
  // no local copy yet, pull the saved snapshot from Cloudinary. If local already
  // has content (resume / unsaved edits), we keep that and don't overwrite.
  useEffect(() => {
    if (!editor || !fileMode || accessAllowed !== true || fileLoadedRef.current) return;
    fileLoadedRef.current = true;
    const pages = editor.getPages();
    const totalShapes = pages.reduce((acc, p) => acc + editor.getPageShapeIds(p.id).size, 0);
    if (totalShapes > 0 || pages.length > 1) {
      setStartMode('blank'); // local copy exists — use it
      return;
    }
    if (!fileContentUrlRef.current) return; // brand-new empty file → show the chooser
    (async () => {
      setBusy(true);
      setBusyLabel('Loading whiteboard…');
      try {
        const res = await fetch(fileContentUrlRef.current!, { cache: 'no-store' });
        const snap = await res.json();
        loadSnapshot(editor.store, snap);
        setStartMode('blank');
        focusPage(editor);
      } catch (e) {
        console.error('load whiteboard snapshot failed', e);
        toast.error('Could not load this whiteboard');
      } finally {
        setBusy(false);
        setBusyLabel('');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, fileMode, accessAllowed]);

  const handleMount = useCallback((ed: Editor) => {
    setEditor(ed);
    ed.user.updateUserPreferences({ colorScheme: 'dark' });
    setPageCount(ed.getPages().length);
    setCurrentPage(1);
    // Start on the pen, not tldraw's default Select tool — otherwise dragging
    // on the board just draws a selection box and the teacher sees "the pen
    // doesn't work". They can still switch tools from the toolbar.
    ed.setCurrentTool('draw');

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
    // Fit + lock the camera to the current page (fixed "slide" view).
    focusPage(ed);

    ed.store.listen(() => {
      const ps = ed.getPages();
      setPageCount(ps.length);
      const idx = ps.findIndex((p) => p.id === ed.getCurrentPageId());
      if (idx >= 0) setCurrentPage(idx + 1);
    });

    // The Select tool IS the free-select: whenever it's active with nothing
    // selected, the lasso overlay is armed. Picking up a selection (or another
    // tool) disarms it so the teacher can move/resize normally.
    ed.store.listen(
      () => {
        const armed = ed.getCurrentToolId() === 'select' && ed.getSelectedShapeIds().length === 0;
        setLassoActive(armed);
      },
      { scope: 'session' },
    );

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
        focusPage(editor);
        editor.setCurrentTool('draw');
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

  // The drawable bounds of the current page. A PDF-imported page uses its
  // locked background image's box. A blank page fills the WHOLE screen — its
  // box matches the viewport's aspect ratio so the slide covers the entire
  // writing area edge-to-edge (no wasted dark margins on the sides).
  const currentPageBox = (ed: Editor): Box => {
    const shapes = ed.getCurrentPageShapes();
    const pageBg = shapes.find(
      (s): s is TLImageShape => s.type === 'image' && s.isLocked && s.x === 0 && s.y === 0,
    );
    if (pageBg) return new Box(0, 0, pageBg.props.w, pageBg.props.h);
    const vp = ed.getViewportScreenBounds();
    const ratio = vp.height > 0 && vp.width > 0 ? vp.height / vp.width : BLANK_PAGE_H / BLANK_PAGE_W;
    return new Box(0, 0, BLANK_PAGE_W, Math.round(BLANK_PAGE_W * ratio));
  };

  // Recompute the screen rectangle for the slate "sheet" we paint behind the
  // canvas, from the (now fixed) camera. Cleared on PDF-imported pages, where
  // the imported image already shows the page.
  const updateSheetRect = (ed: Editor) => {
    const shapes = ed.getCurrentPageShapes();
    const hasImageBg = shapes.some(
      (s) => s.type === 'image' && s.isLocked && s.x === 0 && s.y === 0,
    );
    if (hasImageBg) {
      setSheetRect(null);
      return;
    }
    const box = currentPageBox(ed);
    const tl = ed.pageToViewport({ x: 0, y: 0 });
    const br = ed.pageToViewport({ x: box.w, y: box.h });
    setSheetRect({ left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y });
  };

  // Position the camera for the current page.
  //  • PDF-imported page → fit the page, but allow zooming IN to annotate fine
  //    detail. Zoom-OUT is floored at "whole page fits" (the current limit) so
  //    the teacher can't shrink the page below full view, and panning is kept
  //    inside the page.
  //  • Blank page → fixed full-screen slide: no zoom, no pan (resize content
  //    with the Select tool instead).
  const focusPage = (ed: Editor) => {
    const shapes = ed.getCurrentPageShapes();
    const pageBg = shapes.find(
      (s): s is TLImageShape => s.type === 'image' && s.isLocked && s.x === 0 && s.y === 0,
    );
    const box = currentPageBox(ed);

    if (pageBg) {
      const vp = ed.getViewportScreenBounds();
      const fit = Math.min(vp.width / box.w, vp.height / box.h);
      const minZoom = Math.max(0.02, fit); // can't zoom out past whole-page fit
      ed.setCameraOptions({
        isLocked: false,
        panSpeed: 1,
        zoomSpeed: 1,
        wheelBehavior: 'pan',
        // Absolute zoom levels (baseZoom 'default' = 1.0 is 100%). Step 0 is the
        // whole-page fit, which becomes the hard zoom-OUT floor.
        zoomSteps: [1, 1.5, 2, 3, 4, 6, 8].map((m) => minZoom * m),
        constraints: {
          bounds: { x: 0, y: 0, w: box.w, h: box.h },
          padding: { x: 0, y: 0 },
          origin: { x: 0.5, y: 0.5 },
          initialZoom: 'fit-max',
          baseZoom: 'default',
          behavior: 'contain',
        },
      });
      ed.zoomToBounds(box, { inset: 0 });
    } else {
      ed.setCameraOptions({ isLocked: false });
      // inset 0 so a blank page fills the entire screen with no margin.
      ed.zoomToBounds(box, { inset: 0, force: true });
      ed.setCameraOptions({ isLocked: true, wheelBehavior: 'none', panSpeed: 0, zoomSpeed: 0 });
    }
    updateSheetRect(ed);
  };

  // ---- Freehand lasso select -------------------------------------------------
  // A transparent overlay captures the drag, we trace the loop, then select
  // every shape whose centre falls inside it and hand off to the Select tool
  // so the teacher can move/resize the selection.
  const onLassoDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editor) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lassoDrawingRef.current = true;
    lassoPtsRef.current = [{ x: e.clientX, y: e.clientY }];
    setLassoScreenPath(`${e.clientX},${e.clientY}`);
  };
  const onLassoMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lassoDrawingRef.current) return;
    lassoPtsRef.current.push({ x: e.clientX, y: e.clientY });
    setLassoScreenPath((prev) => `${prev} ${e.clientX},${e.clientY}`);
  };
  const onLassoUp = () => {
    if (!editor || !lassoDrawingRef.current) return;
    lassoDrawingRef.current = false;
    const pts = lassoPtsRef.current;
    setLassoScreenPath('');
    const shapes = editor.getCurrentPageShapes();
    // A tap (barely moved) → select the topmost shape under the point, or clear.
    if (pts.length < 3) {
      const pp = editor.screenToPage(pts[0] ?? { x: 0, y: 0 });
      const hits = shapes.filter((s) => {
        const b = editor.getShapePageBounds(s.id);
        return !!b && pp.x >= b.minX && pp.x <= b.maxX && pp.y >= b.minY && pp.y <= b.maxY;
      });
      if (hits.length) editor.select(hits[hits.length - 1].id);
      else editor.selectNone();
      return;
    }
    // A loop → select every shape whose centre falls inside it.
    const poly = pts.map((p) => editor.screenToPage({ x: p.x, y: p.y }));
    const ids = shapes
      .filter((s) => {
        const b = editor.getShapePageBounds(s.id);
        return b ? pointInPolygon({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }, poly) : false;
      })
      .map((s) => s.id);
    if (ids.length) editor.select(...ids);
    else editor.selectNone();
    // The session listener disarms the lasso now that a selection exists.
  };

  const startBlank = () => {
    setStartMode('blank');
    if (editor) {
      focusPage(editor);
      editor.setCurrentTool('draw');
    }
  };

  const addBlankPage = () => {
    if (!editor) return;
    editor.createPage({ name: `Page ${editor.getPages().length + 1}` });
    const last = editor.getPages()[editor.getPages().length - 1];
    editor.setCurrentPage(last.id);
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

      // Export the same region the teacher was drawing on: the imported PDF
      // image for imported pages, or the full-screen slide box for blank pages.
      const shapes = editor.getCurrentPageShapes();
      const pageBg = shapes.find(
        (s): s is TLImageShape => s.type === 'image' && s.isLocked && s.x === 0 && s.y === 0,
      );
      // For a PDF page, export the UNION of the page image and every annotation
      // (getCurrentPageBounds = bounding box of all shapes) so notes drawn in the
      // margins — common with portrait PDFs in the landscape frame — aren't
      // clipped. Blank pages keep their fixed full-screen slide box.
      const bounds = pageBg
        ? editor.getCurrentPageBounds() ?? new Box(0, 0, pageBg.props.w, pageBg.props.h)
        : currentPageBox(editor);

      const ids = shapes.map((s) => s.id);

      // A page with nothing drawn on it — emit a blank sheet matching the slide
      // shape rather than asking tldraw to export zero shapes.
      if (ids.length === 0) {
        const w = PDF_LONG_SIDE_PT;
        const h = PDF_LONG_SIDE_PT * (bounds.h / bounds.w);
        const page = pdfDoc.addPage([w, h]);
        page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.06, 0.06, 0.07) });
        continue;
      }

      const blob = await exportToBlob({
        editor,
        ids,
        format: 'png',
        opts: { background: true, darkMode: !pageBg, bounds, padding: 0, scale: EXPORT_SCALE },
      });

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = await pdfDoc.embedPng(bytes);

      // Size the PDF page to the content's own aspect ratio (no letterboxing),
      // normalising the longest side to a normal document size. A blank 16:9
      // board becomes a 13.33"×7.5" widescreen page — exactly what you drew.
      const ptScale = PDF_LONG_SIDE_PT / Math.max(img.width, img.height);
      const pageW = img.width * ptScale;
      const pageH = img.height * ptScale;
      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
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

  // A small PNG preview of the first page, for the history card.
  const makeThumbnail = async (ed: Editor): Promise<Blob | null> => {
    const first = ed.getPages()[0];
    if (!first) return null;
    ed.setCurrentPage(first.id);
    const shapes = ed.getCurrentPageShapes();
    if (shapes.length === 0) return null;
    const pageBg = shapes.find(
      (s): s is TLImageShape => s.type === 'image' && s.isLocked && s.x === 0 && s.y === 0,
    );
    const bounds = pageBg ? ed.getCurrentPageBounds() ?? currentPageBox(ed) : currentPageBox(ed);
    try {
      return await exportToBlob({
        editor: ed,
        ids: shapes.map((s) => s.id),
        format: 'png',
        opts: { background: true, darkMode: !pageBg, bounds, padding: 0, scale: 0.35 },
      });
    } catch {
      return null;
    }
  };

  // File mode: persist the whole editable board (snapshot + thumbnail) to
  // Cloudinary and update the file row. This is the "workspace save" — separate
  // from the PDF download. Never touches any batch/subject.
  const saveToCloud = async () => {
    if (!editor || !fileId) return;
    setBusy(true);
    setBusyLabel('Saving whiteboard…');
    const startedFrom = editor.getCurrentPageId();
    try {
      const snap = getSnapshot(editor.store);
      const snapBlob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
      const { url: contentUrl, publicId: contentPid } = await uploadBlobToCloudinary(snapBlob, {
        folder: 'whiteboards',
        resourceType: 'raw',
        fileName: `wb-${fileId}.json`,
      });

      let thumbUrl: string | null = null;
      let thumbPid: string | null = null;
      const thumbBlob = await makeThumbnail(editor);
      editor.setCurrentPage(startedFrom);
      if (thumbBlob) {
        try {
          const up = await uploadBlobToCloudinary(thumbBlob, {
            folder: 'whiteboard_thumbs',
            resourceType: 'image',
            fileName: `thumb-${fileId}.png`,
          });
          thumbUrl = up.url;
          thumbPid = up.publicId;
        } catch { /* thumbnail is best-effort */ }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: any = { content_url: contentUrl, content_public_id: contentPid };
      if (thumbUrl) {
        patch.thumbnail_url = thumbUrl;
        patch.thumbnail_public_id = thumbPid;
      }
      const { error } = await supabase.from('whiteboard_files').update(patch).eq('id', fileId);
      if (error) throw error;
      fileContentUrlRef.current = contentUrl;
      toast.success('Whiteboard saved');
    } catch (e) {
      console.error('saveToCloud failed', e);
      toast.error('Could not save the whiteboard');
    } finally {
      editor.setCurrentPage(startedFrom);
      setBusy(false);
      setBusyLabel('');
    }
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

  // Still verifying authorization.
  if (accessAllowed === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Not the teacher in charge / not an admin or manager.
  if (!accessAllowed) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/15">
          <EyeOff className="h-6 w-6 text-rose-300" />
        </div>
        <div>
          <p className="text-base font-semibold">This whiteboard is restricted</p>
          <p className="mt-1 max-w-sm text-sm text-white/60">
            Only the teacher in charge of this class — and admins — can open it.
          </p>
        </div>
        <Button
          variant="ghost"
          className="border border-white/10 bg-white/5 hover:bg-white/15"
          onClick={() => navigate('/')}
        >
          Go back
        </Button>
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
        /* Make tldraw's own background transparent so the slate "sheet" we
           paint behind the canvas shows through, with strokes drawn on top. */
        .wb-canvas .tl-background { background: transparent !important; }
        .wb-canvas.wb-offset .tlui-layout__top { padding-top: 52px; }
        .wb-canvas.wb-hide-style .tlui-style-panel__wrapper { display: none !important; }
        /* Pen width is shown as a slider (below), so hide tldraw's S/M/L size buttons. */
        .wb-canvas .tlui-style-panel [data-testid="style.size"] { display: none !important; }
        .wb-pen-width {
          display: flex; flex-direction: column; gap: 2px;
          padding: 4px 4px 8px; margin-bottom: 2px;
          border-bottom: 1px solid var(--color-divider, rgba(255,255,255,0.1));
        }
        .wb-pen-width__label {
          font-size: 12px; font-weight: 500; color: var(--color-text-1, #fff);
          opacity: 0.7; padding: 0 4px;
        }
      `}</style>

      {/* Canvas — fills the whole viewport so collapsing chrome reclaims real estate.
          The dark workspace ("void") colour lives here; tldraw's own background is
          transparent so the slate sheet below shows through. */}
      <div
        className={cn(
          'absolute inset-0 wb-canvas',
          !chromeHidden && 'wb-offset',
          // Keep the style panel (colour / pen width / fill) available even when
          // auto-focus hides the header — only the explicit toggle hides it.
          stylePanelHidden && 'wb-hide-style',
        )}
        style={{ background: '#060608' }}
      >
        {/* Slate "sheet" — the slide surface, painted behind the transparent
            tldraw canvas. Non-interactive so it never blocks drawing/selecting. */}
        {sheetRect && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-[3px]"
            style={{
              left: sheetRect.left,
              top: sheetRect.top,
              width: sheetRect.width,
              height: sheetRect.height,
              background: '#15171c',
              boxShadow: '0 10px 50px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          />
        )}
        <Tldraw
          onMount={handleMount}
          inferDarkMode
          components={WB_COMPONENTS}
          persistenceKey={fileId ? `wb-file-${fileId}` : scheduleId ? `wb-${scheduleId}` : undefined}
        />
      </div>

      {/* Freehand lasso-select overlay — armed automatically whenever the Select
          tool is active with nothing selected. Captures the drag, traces the
          loop (open path — no start↔end line), and selects whatever it
          encircles. Inset above the bottom toolbar so tools stay reachable. */}
      {lassoActive && startMode !== 'choose' && (
        <div
          className="absolute inset-x-0 top-0 bottom-16 z-[15] cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={onLassoDown}
          onPointerMove={onLassoMove}
          onPointerUp={onLassoUp}
          onPointerCancel={onLassoUp}
        >
          <svg className="absolute inset-0 h-full w-full pointer-events-none">
            {lassoScreenPath && (
              <polyline
                points={lassoScreenPath}
                fill="rgba(217,70,239,0.10)"
                stroke="#e879f9"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>
      )}

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
              {scheduleCtx ? `${scheduleCtx.subject} — ${scheduleCtx.batch}` : fileMode ? title || 'Whiteboard' : 'Whiteboard'}
            </div>
            <div className="text-[11px] text-white/60 truncate">
              {scheduleCtx
                ? `${scheduleCtx.start_time?.slice(0, 5)} – ${scheduleCtx.end_time?.slice(0, 5)}`
                : fileMode ? 'General whiteboard' : 'No class context'}
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
          {fileMode && (
            <Button
              size="sm"
              className="h-8 bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500 hover:border-emerald-400 transition-colors"
              onClick={saveToCloud}
              disabled={busy || startMode === 'choose'}
              title="Save this whiteboard to your history"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 bg-fuchsia-600 text-white border border-fuchsia-500 hover:bg-fuchsia-500 hover:border-fuchsia-400 transition-colors"
            onClick={() => setSaveOpen(true)}
            disabled={busy || startMode === 'choose'}
          >
            {fileMode ? <Download className="h-3.5 w-3.5 mr-1.5" /> : <CloudUpload className="h-3.5 w-3.5 mr-1.5" />}
            {fileMode ? 'Download PDF' : 'End & Save'}
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
            onClick={() => { setChromeHidden(true); setStylePanelHidden(true); }}
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
            <DialogTitle>{fileMode ? 'Download whiteboard PDF' : 'End class & save whiteboard'}</DialogTitle>
            <DialogDescription>
              Exports all {pageCount} page{pageCount === 1 ? '' : 's'} as a single PDF{fileMode ? ' to this device' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wb-title">PDF name</Label>
              <Input id="wb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kinematics — 2026-05-17" />
            </div>

            {scheduleCtx && (
              <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-fuchsia-600"
                  checked={postToNotes}
                  onChange={(e) => setPostToNotes(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-medium text-slate-900">Upload to Drive &amp; add to Notes</span>
                  <span className="block text-xs text-slate-500">
                    Saves to Google Drive and posts to {scheduleCtx.batch} — {scheduleCtx.subject}. Students see it in References.
                  </span>
                </span>
              </label>
            )}

            {!fileMode && (
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
            )}
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
