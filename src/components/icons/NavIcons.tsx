// Bespoke bottom-nav glyphs — drawn in-house (not a stock icon set) with sharp
// corners (square caps, miter joins) so the bar reads as custom, not generic.
// Stroke uses currentColor, so the parent's text color drives active/inactive.

interface NavIconProps {
  className?: string;
  strokeWidth?: number;
}

const svgBase = (strokeWidth: number) =>
  ({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'square',
    strokeLinejoin: 'miter',
  }) as const;

/** Home — sharp gable roof, square body, doorway. */
export const HomeNavIcon = ({ className, strokeWidth = 2 }: NavIconProps) => (
  <svg className={className} {...svgBase(strokeWidth)}>
    <path d="M3 11 L12 3.5 L21 11" />
    <path d="M5.5 9.3 V20.5 H18.5 V9.3" />
    <path d="M10 20.5 V14 H14 V20.5" />
  </svg>
);

/** Schedule — calendar with binding tabs and a marked day. */
export const ScheduleNavIcon = ({ className, strokeWidth = 2 }: NavIconProps) => (
  <svg className={className} {...svgBase(strokeWidth)}>
    <path d="M4 5.5 H20 V20.5 H4 Z" />
    <path d="M4 9.5 H20" />
    <path d="M8 3 V7" />
    <path d="M16 3 V7" />
    <path d="M8 13 H10.5" />
    <path d="M13.5 13 H16" />
    <path d="M8 16.5 H10.5" />
  </svg>
);

/** Feedback — speech bubble with a sharp tail and message lines. */
export const FeedbackNavIcon = ({ className, strokeWidth = 2 }: NavIconProps) => (
  <svg className={className} {...svgBase(strokeWidth)}>
    <path d="M4 4.5 H20 V16 H10.5 L6 20.5 V16 H4 Z" />
    <path d="M8 8.5 H16" />
    <path d="M8 12 H13" />
  </svg>
);

/** Exams — answer sheet with folded corner and a graded checkmark. */
export const ExamsNavIcon = ({ className, strokeWidth = 2 }: NavIconProps) => (
  <svg className={className} {...svgBase(strokeWidth)}>
    <path d="M6 3 H14 L18 7 V21 H6 Z" />
    <path d="M14 3 V7 H18" />
    <path d="M9 13.5 L11 15.5 L15 11.5" />
  </svg>
);
