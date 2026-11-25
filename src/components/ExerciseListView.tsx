import { useMemo, useState } from 'react';
import type { EquipmentFilter, SortMode, TrackedExercise, WeightUnit } from '../types';
import {
  compareEntries,
  formatFullDate,
  formatWeightLabel,
  getEntryWeightInUnit,
  getWeightModeLabel,
} from '../utils/stats';
import { DeltaBadge } from './DeltaBadge';
import {
  CalendarIcon,
  DumbbellIcon,
  HistoryIcon,
  MachineIcon,
  PlusIcon,
  SearchIcon,
} from './Icons';

interface ExerciseListViewProps {
  exercises: TrackedExercise[];
  unit: WeightUnit;
  onAddExercise: () => void;
  onLogUpdate: (exercise: TrackedExercise) => void;
  onOpenDetail: (exerciseId: string) => void;
}

export function ExerciseListView({
  exercises,
  unit,
  onAddExercise,
  onLogUpdate,
  onOpenDetail,
}: ExerciseListViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EquipmentFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = exercises.filter((ex) => {
      if (filter !== 'all' && ex.equipment !== filter) return false;
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === 'entries') {
        if (b.entries.length !== a.entries.length) {
          return b.entries.length - a.entries.length;
        }
      }
      const aDate = a.entries[0]?.date ?? '';
      const bDate = b.entries[0]?.date ?? '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return b.updatedAt - a.updatedAt;
    });
  }, [exercises, query, filter, sortMode]);

  return (
    <div className="space-y-4 pb-28 animate-enter">
      {/* Primary CTA Banner */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-[#F3F5F8]">
            Your Workouts
          </h2>
          <p className="text-xs text-[#8E98A8]">
            Track your best weight &amp; reps anytime — updates build each workout&apos;s history.
          </p>
        </div>
        <button
          id="add-workout-btn"
          type="button"
          onClick={onAddExercise}
          className="h-10 px-3.5 rounded-xl bg-[#F97316] hover:bg-[#FB923C] text-[#0A0C10] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-lg shadow-[#F97316]/20"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Search & Filter Controls */}
      {exercises.length > 0 && (
        <div className="space-y-2.5">
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-[#5C6677] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workouts..."
              aria-label="Search workouts"
              className="input-field w-full h-10 pl-10 pr-3.5 rounded-xl text-sm placeholder:text-[#5C6677]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div
              role="group"
              aria-label="Filter by equipment"
              className="inline-flex rounded-xl bg-[#12161E] p-0.5 border border-white/[0.08]"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'machine', label: 'Machine' },
                  { id: 'no-machine', label: 'No Machine' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    filter === item.id
                      ? 'bg-white/12 text-[#F3F5F8]'
                      : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Sort workouts"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-8 px-2.5 rounded-xl bg-[#12161E] border border-white/[0.08] text-[11px] font-semibold text-[#C5CDD9] focus:outline-none focus:border-[#F97316]/60 cursor-pointer"
            >
              <option value="recent">Recently Updated</option>
              <option value="name">Name (A–Z)</option>
              <option value="entries">Most History</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty State */}
      {exercises.length === 0 ? (
        <div className="card-surface rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F97316]/15 border border-[#F97316]/30 flex items-center justify-center text-[#F97316]">
            <DumbbellIcon className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#F3F5F8]">
              No workouts tracked yet
            </h3>
            <p className="text-xs text-[#8E98A8] max-w-xs mx-auto leading-relaxed">
              Add an exercise with your current best weight and reps. Whenever it goes up or down, log an update to build its history.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddExercise}
            className="h-11 px-5 rounded-xl bg-[#F97316] hover:bg-[#FB923C] text-[#0A0C10] text-xs font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#F97316]/20"
          >
            <PlusIcon className="w-4 h-4" />
            Add First Workout
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-surface rounded-2xl p-6 text-center text-xs text-[#8E98A8]">
          No workouts match your current search or filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exercise) => {
            const latest = exercise.entries[0];
            const previous = exercise.entries[1];
            const latestWeight = latest ? getEntryWeightInUnit(latest, unit) : null;
            const comparison = latest
              ? compareEntries(latest, previous, unit)
              : null;

            return (
              <article
                key={exercise.id}
                className="card-surface rounded-2xl p-4 transition-colors hover:border-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(exercise.id)}
                    className="text-left min-w-0 flex-1 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-[#F3F5F8] group-hover:text-[#FB923C] transition-colors truncate">
                        {exercise.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.05] text-[#8E98A8] border border-white/[0.07]">
                        {exercise.equipment === 'machine' ? (
                          <MachineIcon className="w-3 h-3" />
                        ) : (
                          <DumbbellIcon className="w-3 h-3" />
                        )}
                        {exercise.equipment === 'machine' ? 'Machine' : 'No Machine'}
                      </span>
                      {exercise.weightMode && exercise.weightMode !== 'direct' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F97316]/10 text-[#FB923C] border border-[#F97316]/20">
                          {getWeightModeLabel(exercise.weightMode)}
                        </span>
                      )}
                    </div>

                    {latest ? (
                      <>
                        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
                          <span className="text-xl font-extrabold font-mono tabular-nums text-[#F3F5F8]">
                            {formatWeightLabel(latestWeight, unit)}
                          </span>
                          <span className="text-xs font-semibold text-[#5C6677]">×</span>
                          <span className="text-xl font-extrabold font-mono tabular-nums text-[#F97316]">
                            {latest.reps}
                            <span className="text-xs font-sans font-semibold text-[#8E98A8] ml-1">
                              {latest.reps === 1 ? 'rep' : 'reps'}
                            </span>
                          </span>
                        </div>
                        {latest.weightDetail && (
                          <p className="mt-0.5 text-[11px] font-mono text-[#5C6677]">
                            {latest.weightDetail}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-[#5C6677]">No entries yet</p>
                    )}

                    {latest && (
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        {comparison && (
                          <DeltaBadge comparison={comparison} unit={unit} />
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#8E98A8]">
                          <CalendarIcon className="w-3 h-3 text-[#5C6677]" />
                          {formatFullDate(latest.date)}
                        </span>
                      </div>
                    )}

                    {latest?.note && (
                      <p className="mt-2 text-xs text-[#8E98A8] italic truncate">
                        &ldquo;{latest.note}&rdquo;
                      </p>
                    )}
                  </button>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-3.5 pt-3 border-t border-white/[0.07] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(exercise.id)}
                    className="h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-xs font-semibold text-[#C5CDD9] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <HistoryIcon className="w-3.5 h-3.5 text-[#8E98A8]" />
                    History
                    <span className="font-mono text-[11px] text-[#8E98A8] tabular-nums">
                      ({exercise.entries.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLogUpdate(exercise)}
                    className="h-9 px-3.5 rounded-xl bg-[#F97316]/15 hover:bg-[#F97316]/25 border border-[#F97316]/35 text-[#FB923C] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Update
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
