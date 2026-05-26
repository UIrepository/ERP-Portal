import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';

export interface BottomNavTab {
  id: string;
  label: string;
  icon: Parameters<typeof HugeiconsIcon>[0]['icon'];
}

interface BottomNavProps {
  tabs: BottomNavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

/**
 * App-style bottom navigation — mobile only. The desktop floating rail
 * (Sidebar) takes over from `md:` up. Pads for the iOS home indicator via the
 * safe-area inset so the bar never sits under the gesture line.
 */
export const BottomNav = ({ tabs, activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
      role="navigation"
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[58px] transition-colors',
                active ? 'text-brand' : 'text-slate-500 active:text-brand',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center h-7 w-14 rounded-full transition-colors',
                  active ? 'bg-brand/10' : 'bg-transparent',
                )}
              >
                <HugeiconsIcon icon={tab.icon} size={22} strokeWidth={active ? 2 : 1.8} />
              </span>
              <span className={cn('text-[11px] leading-none', active ? 'font-semibold' : 'font-medium')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
