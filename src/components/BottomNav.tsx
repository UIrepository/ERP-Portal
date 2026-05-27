import { cn } from '@/lib/utils';

export interface BottomNavTab {
  id: string;
  /** Used for the accessible label only — the bar is icon-only on screen. */
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface BottomNavProps {
  tabs: BottomNavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

/**
 * App-style bottom navigation — mobile only. Icon-only, no background blocks:
 * the active tab is simply shown in brand violet (slightly larger, crisp
 * stroke), inactive tabs in muted slate. Pads for the iOS home indicator.
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
              className={cn(
                'flex-1 flex items-center justify-center transition-transform duration-200 ease-out active:scale-90',
                active ? 'text-brand' : 'text-slate-400',
              )}
            >
              <tab.icon
                className={active ? 'h-7 w-7' : 'h-[26px] w-[26px]'}
                strokeWidth={active ? 2.2 : 1.8}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
