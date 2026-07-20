import { useEffect, useState } from 'react';
import {
  DefaultStylePanel,
  DefaultStylePanelContent,
  DefaultSizeStyle,
  STROKE_SIZES,
  TldrawUiSlider,
  useEditor,
  useRelevantStyles,
  type Editor,
  type TLUiStylePanelProps,
} from 'tldraw';

// tldraw only ships four stroke sizes (s/m/l/xl = 2/3.5/5/10px), which makes the
// pen jump between widths. Real stroke width is STROKE_SIZES[size] * shape.scale,
// so we drive a fine-grained slider by picking the nearest base size and setting
// `scale` to hit the exact width — giving continuous control instead of 4 steps.
const SIZES = ['s', 'm', 'l', 'xl'] as const;
type SizeName = (typeof SIZES)[number];

// 24 steps from hairline to thick. Small increments at the thin end (where a
// 0.5px change is visible) and larger ones at the top.
const WIDTHS = [
  1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75,
  4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 11, 12,
] as const;
const DEFAULT_INDEX = WIDTHS.indexOf(3.5); // tldraw's own default ('m')

/** Split a target width into the base size + scale that reproduce it. */
function widthToStyle(width: number): { size: SizeName; scale: number } {
  // Pick the base whose scale lands nearest 1 — keeps dashes and arrowheads,
  // which also key off size, looking proportionate.
  let best: SizeName = 'm';
  let bestDelta = Infinity;
  for (const s of SIZES) {
    const delta = Math.abs(Math.log(width / STROKE_SIZES[s]));
    if (delta < bestDelta) { bestDelta = delta; best = s; }
  }
  return { size: best, scale: width / STROKE_SIZES[best] };
}

/** Apply the chosen width to new shapes and to anything selected. */
function applyWidth(editor: Editor, width: number) {
  const { size, scale } = widthToStyle(width);
  editor.markHistoryStoppingPoint('change pen width');
  editor.run(() => {
    editor.setStyleForNextShapes(DefaultSizeStyle, size);
    editor.setStyleForSelectedShapes(DefaultSizeStyle, size);
    // `scale` is a regular prop, not a style, so selected shapes are updated
    // directly. Only shapes that actually have a scale prop are touched.
    const updates = editor
      .getSelectedShapes()
      .filter((s) => 'scale' in (s.props as Record<string, unknown>))
      .map((s) => ({ id: s.id, type: s.type, props: { scale } }));
    if (updates.length) editor.updateShapes(updates);
  });
}

function PenWidthSlider() {
  const editor = useEditor();
  const styles = useRelevantStyles();
  const sizeStyle = styles?.get(DefaultSizeStyle);
  const [index, setIndex] = useState(DEFAULT_INDEX);

  // New shapes carry the current width: `scale` can't be set via
  // setStyleForNextShapes, so stamp it on as each shape is created.
  useEffect(() => {
    if (!editor) return;
    return editor.sideEffects.registerBeforeCreateHandler('shape', (shape, source) => {
      if (source !== 'user') return shape;
      const props = shape.props as Record<string, unknown>;
      if (!('scale' in props)) return shape;
      const { scale } = widthToStyle(WIDTHS[index]);
      return { ...shape, props: { ...props, scale } };
    });
  }, [editor, index]);

  // Only show when the current tool/selection actually has a size style.
  if (!sizeStyle) return null;

  return (
    <div className="wb-pen-width">
      <span className="wb-pen-width__label">Pen width</span>
      <TldrawUiSlider
        data-testid="wb.pen-width"
        label="Pen width"
        title={`Pen width — ${WIDTHS[index]}px`}
        min={0}
        steps={WIDTHS.length - 1}
        value={sizeStyle.type === 'shared' ? index : null}
        onValueChange={(v) => {
          const next = Math.min(Math.max(v, 0), WIDTHS.length - 1);
          setIndex(next);
          applyWidth(editor, WIDTHS[next]);
        }}
        onHistoryMark={(id) => editor.markHistoryStoppingPoint(id)}
      />
    </div>
  );
}

/** Style panel with the pen-width slider on top, then the rest of tldraw's
 *  default controls (color, opacity, fill, dash). */
export function WhiteboardStylePanel(props: TLUiStylePanelProps) {
  const styles = useRelevantStyles();
  return (
    <DefaultStylePanel {...props}>
      <PenWidthSlider />
      <DefaultStylePanelContent styles={styles} />
    </DefaultStylePanel>
  );
}
