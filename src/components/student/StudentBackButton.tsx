import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

interface StudentBackButtonProps {
  onClick: () => void;
  className?: string;
}

/** Premium inline back arrow used beside page headings inside the content frame. */
export const StudentBackButton = ({ onClick, className }: StudentBackButtonProps) => (
  <button
    onClick={onClick}
    aria-label="Back"
    className={`shrink-0 text-[#1e293b] hover:opacity-70 transition-opacity ${className || ''}`}
  >
    <HugeiconsIcon icon={ArrowLeft01Icon} size={24} strokeWidth={2} />
  </button>
);
