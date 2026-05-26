import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';

export interface BottomNavTab {
  id: string;
  /** Used for the accessible label only — the bar is icon-only on screen. */
  label: string;
  icon: Parameters<typeof HugeiconsIcon>[0]['icon'];
}

interface BottomNavProps {
  tabs: BottomNavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

/**
 * App-style bottom navigation — mobile only. Icon-only; the active tab lifts
 * into a solid brand-violet squircle with a white glyph (the same solid-violet
 * active treatment as the desktop sidebar), rather than a generic tinted pill.
 * Pads for the iOS home indicator via the safe-area inset.
 */
export const BottomNav = ({ tabs, activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(15,23,42,0.05)] pb-[env(safe-area-inset-bottom)]"
      role="navigation"
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around h-[68px]">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="flex-1 flex items-center justify-center"
            >
              <span
                className={cn(
                  'flex items-center justify-center h-12 w-12 rounded-[15px] transition-all duration-200 ease-out',
                  active
                    ? 'bg-brand text-white shadow-lg shadow-brand/30 -translate-y-1'
                    : 'text-slate-400 active:scale-90',
                )}
              >
                <HugeiconsIcon icon={tab.icon} size={24} strokeWidth={active ? 2 : 1.8} />
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
