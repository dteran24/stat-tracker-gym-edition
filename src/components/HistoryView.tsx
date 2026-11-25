import { useMemo, useState } from 'react';
import type { EquipmentFilter, WeightUnit, Workout } from '../types';
import {
  formatFullDate,
  formatVolume,
  getDisplaySetWeight,
  getWorkoutStats,
} from '../utils/stats';
import {
  ChevronDownIcon,
  DumbbellIcon,
  EditIcon,
  HistoryIcon,
  MachineIcon,
  TrashIcon,
} from './Icons';

interface HistoryViewProps {
  workouts: Workout[];
  unit: WeightUnit;
  onEditWorkout: (workout: Workout) => void;
  onDeleteWorkout: (workoutId: string) => void;
}

export function HistoryView({
  workouts,
  unit,
  onEditWorkout,
  onDeleteWorkout,
}: HistoryViewProps) {
  const [filter, setFilter] = useState<EquipmentFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(
    workouts[0]?.id ?? null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredWorkouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workouts.filter((w) => {
      const matchesEquipment =
        filter === 'all' || w.exercises.some((ex) => ex.equipment === filter);
      if (!matchesEquipment) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.date.includes(q) ||
        w.exercises.some((ex) => ex.name.toLowerCase().includes(q))
      );
    });
  }, [workouts, filter, search]);

  return (
    <div className="space-y-4 pb-28">
      {/* Search + Equipment Filter */}
      <section className="card-surface rounded-2xl p-3.5 space-y-3">
        <input
          id="history-search-input"
          type="search"
          placeholder="Search workouts or exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-full h-10 rounded-xl px-3.5 text-sm placeholder:text-[#5C6677]"
        />

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'machine', label: 'Machine' },
              { id: 'no-machine', label: 'No Machine' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === opt.id
                  ? 'bg-[#212836] text-[#F3F5F8] border border-white/10'
                  : 'text-[#8E98A8] hover:text-[#F3F5F8]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Workout List */}
      {filteredWorkouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#10141C]/50 px-5 py-10 text-center space-y-2">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-[#1A202B] flex items-center justify-center text-[#8E98A8]">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-[#F3F5F8]">
            {workouts.length === 0 ? 'No workouts logged yet' : 'No matching workouts'}
          </p>
          <p className="text-xs text-[#8E98A8]">
            {workouts.length === 0
              ? 'Save your first workout in the Log tab to start building your training history.'
              : 'Try clearing your search or switching the equipment filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((workout) => {
            const stats = getWorkoutStats(workout, unit);
            const isExpanded = expandedId === workout.id;
            const visibleExercises =
              filter === 'all'
                ? workout.exercises
                : workout.exercises.filter((ex) => ex.equipment === filter);

            return (
              <article
                key={workout.id}
                className="card-surface rounded-2xl overflow-hidden animate-enter"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) => (prev === workout.id ? null : workout.id))
                  }
                  className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-[#F3F5F8] truncate">
                        {workout.title || 'Workout Session'}
                      </h3>
                      {stats.hasMachine && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#FBBF24] text-[10px] font-semibold uppercase">
                          <MachineIcon className="w-3 h-3" />
                          Machine
                        </span>
                      )}
                      {stats.hasNoMachine && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#38BDF8]/15 text-[#7DD3FC] text-[10px] font-semibold uppercase">
                          <DumbbellIcon className="w-3 h-3" />
                          No Machine
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8E98A8]">
                      {formatFullDate(workout.date)}
                    </p>
                    <div className="pt-1 flex items-center gap-3 text-xs font-mono tabular-nums text-[#C5CDD9]">
                      <span>{stats.exerciseCount} exercises</span>
                      <span className="text-[#5C6677]">·</span>
                      <span>{stats.totalSets} sets</span>
                      <span className="text-[#5C6677]">·</span>
                      <span>
                        {formatVolume(stats.totalVolume)} {unit} vol
                      </span>
                    </div>
                  </div>

                  <ChevronDownIcon
                    className={`w-5 h-5 text-[#8E98A8] shrink-0 mt-1 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
                    {visibleExercises.map((ex) => (
                      <div
                        key={ex.id}
                        className="rounded-xl bg-[#0C0F15] border border-white/[0.05] p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#F3F5F8]">
                            {ex.name}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                              ex.equipment === 'machine'
                                ? 'bg-[#F59E0B]/15 text-[#FBBF24]'
                                : 'bg-[#38BDF8]/15 text-[#7DD3FC]'
                            }`}
                          >
                            {ex.equipment === 'machine' ? 'Machine' : 'No Machine'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {ex.sets.map((s, idx) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161B24] border border-white/[0.06] text-xs font-mono tabular-nums text-[#D7DEE8]"
                            >
                              <span className="text-[#5C6677]">#{idx + 1}</span>
                              <span>
                                {getDisplaySetWeight(s, workout.unit, unit)} {unit}
                              </span>
                              <span className="text-[#5C6677]">×</span>
                              <span>{s.reps || '0'}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onEditWorkout(workout)}
                        className="h-9 px-3 rounded-lg bg-[#1A202B] hover:bg-[#232B3A] border border-white/10 text-xs font-semibold text-[#F3F5F8] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      {confirmDeleteId === workout.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteWorkout(workout.id);
                              setConfirmDeleteId(null);
                            }}
                            className="h-9 px-3 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-9 px-2.5 rounded-lg bg-[#1A202B] text-xs font-semibold text-[#8E98A8] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(workout.id)}
                          className="h-9 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-semibold text-rose-300 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
