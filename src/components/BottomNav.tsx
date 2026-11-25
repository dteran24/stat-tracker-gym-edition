import type { ActiveTab } from '../types';
import { ChartIcon, DumbbellIcon, HistoryIcon } from './Icons';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
  draftExerciseCount: number;
  workoutCount: number;
}

export function BottomNav({
  activeTab,
  onChange,
  draftExerciseCount,
  workoutCount,
}: BottomNavProps) {
  const tabs: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof DumbbellIcon;
    badge?: number;
  }> = [
    {
      id: 'log',
      label: 'Log',
      icon: DumbbellIcon,
      badge: draftExerciseCount > 0 ? draftExerciseCount : undefined,
    },
    {
      id: 'history',
      label: 'History',
      icon: HistoryIcon,
      badge: workoutCount > 0 ? workoutCount : undefined,
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: ChartIcon,
    },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#0D1017]/95 backdrop-blur-md border-t border-white/10 safe-bottom"
    >
      <div className="mx-auto max-w-lg grid grid-cols-3 px-2 pt-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#F97316]'
                  : 'text-[#8E98A8] hover:text-[#F3F5F8]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {tab.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold font-mono tabular-nums flex items-center justify-center ${
                      isActive
                        ? 'bg-[#F97316] text-[#0A0C10]'
                        : 'bg-[#212836] text-[#C5CDD9]'
                    }`}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold tracking-wide">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
