import {
  DefaultStylePanel,
  DefaultStylePanelContent,
  DefaultSizeStyle,
  TldrawUiSlider,
  useEditor,
  useRelevantStyles,
  type TLUiStylePanelProps,
} from 'tldraw';

// tldraw's stroke size is a 4-step style. We surface it as a continuous-looking
// slider (like the opacity meter) instead of the default S/M/L/XL buttons, which
// the native size control is hidden for via CSS in Whiteboard.tsx.
const SIZES = ['s', 'm', 'l', 'xl'] as const;

function PenWidthSlider() {
  const editor = useEditor();
  const styles = useRelevantStyles();
  const sizeStyle = styles?.get(DefaultSizeStyle);

  // Only show when the current tool/selection actually has a size style.
  if (!sizeStyle) return null;

  const value =
    sizeStyle.type === 'shared'
      ? Math.max(0, SIZES.indexOf(sizeStyle.value as (typeof SIZES)[number]))
      : null; // 'mixed' selection -> empty thumb

  return (
    <div className="wb-pen-width">
      <span className="wb-pen-width__label">Pen width</span>
      <TldrawUiSlider
        data-testid="wb.pen-width"
        label="Pen width"
        title="Pen width"
        min={0}
        steps={SIZES.length - 1}
        value={value}
        onValueChange={(v) => {
          const size = SIZES[v] ?? 'm';
          editor.markHistoryStoppingPoint('change pen width');
          editor.run(() => {
            editor.setStyleForNextShapes(DefaultSizeStyle, size);
            editor.setStyleForSelectedShapes(DefaultSizeStyle, size);
          });
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
