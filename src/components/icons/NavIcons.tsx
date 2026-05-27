// Bespoke bottom-nav glyphs — drawn in-house (not a stock icon set). Each has
// two states, PW-style: a sharp grey OUTLINE when inactive, and a solid FILLED
// silhouette (brand violet via currentColor) when active. Switching outline ->
// filled is the standard way to signal the selected tab.

interface NavIconProps {
  className?: string;
  filled?: boolean;
}

const outline = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
} as const;

/** Home — gable roof + body with a doorway. */
export const HomeNavIcon = ({ className, filled }: NavIconProps) =>
  filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5 L22 11 V21.5 H14.5 V14.5 H9.5 V21.5 H2 V11 Z" />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" {...outline}>
      <path d="M3 11 L12 3.5 L21 11" />
      <path d="M5.5 9.3 V20.5 H18.5 V9.3" />
      <path d="M10 20.5 V14 H14 V20.5" />
    </svg>
  );

/** Schedule — calendar with binding tabs and day cells. */
export const ScheduleNavIcon = ({ className, filled }: NavIconProps) =>
  filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3 H8 V6 H5 Z M16 3 H19 V6 H16 Z M3 6 H21 V20 H3 Z M6.5 11 H9.5 V13 H6.5 Z M11 11 H14 V13 H11 Z M15.5 11 H18 V13 H15.5 Z M6.5 15 H9.5 V17 H6.5 Z M11 15 H14 V17 H11 Z"
      />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" {...outline}>
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
export const FeedbackNavIcon = ({ className, filled }: NavIconProps) =>
  filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 4 H21 V16 H9.5 L5.5 20 V16 H3 Z M6.5 8 H17.5 V9.8 H6.5 Z M6.5 11.2 H13 V13 H6.5 Z"
      />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" {...outline}>
      <path d="M4 4.5 H20 V16 H10.5 L6 20.5 V16 H4 Z" />
      <path d="M8 8.5 H16" />
      <path d="M8 12 H13" />
    </svg>
  );

/** WhatsApp — rounded chat bubble with a phone handset (contact admin). */
export const WhatsAppNavIcon = ({ className, filled }: NavIconProps) =>
  filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.3 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm-3 5.6c.2 0 .4 0 .5.4l.8 1.9c.1.2 0 .4-.1.6l-.5.6c-.2.2-.2.4-.1.6.5.9 1.3 1.7 2.2 2.2.2.1.4.1.6-.1l.6-.6c.2-.2.4-.2.6-.1l1.8.8c.4.2.4.4.4.6 0 1.1-1.1 2-2 2-3.6 0-7-3.5-7-7 0-.9.9-2 2-2Z"
      />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" {...outline} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5l1.4-4.1a8.5 8.5 0 1 1 3.2 3.1l-4.6 1Z" />
      <path d="M9 8.5c-.9 0-1.6.9-1.6 1.7 0 2.9 2.8 5.6 5.7 5.6.8 0 1.7-.7 1.7-1.6 0-.2-.1-.3-.3-.4l-1.6-.7c-.2-.1-.4 0-.5.1l-.5.6c-.8-.4-1.6-1.2-2-2l.6-.5c.1-.1.2-.3.1-.5l-.7-1.6c-.1-.2-.2-.3-.4-.3Z" />
    </svg>
  );

/** Exams — answer sheet with a folded corner and graded lines. */
export const ExamsNavIcon = ({ className, filled }: NavIconProps) =>
  filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 3 H13.5 L18 7.5 V21 H6 Z M8.5 11 H15 V12.6 H8.5 Z M8.5 14.5 H15 V16.1 H8.5 Z M8.5 18 H12.5 V19.6 H8.5 Z"
      />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" {...outline}>
      <path d="M6 3 H14 L18 7 V21 H6 Z" />
      <path d="M14 3 V7 H18" />
      <path d="M9 13.5 L11 15.5 L15 11.5" />
    </svg>
  );
