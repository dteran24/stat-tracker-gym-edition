import { useMemo, useState } from 'react';
import type { StatEntry, TrackedExercise, WeightUnit } from '../types';
import {
  compareEntries,
  formatFullDate,
  formatWeightLabel,
  getAllTimeBestEntry,
  getEntryWeightInUnit,
  getWeightModeLabel,
  isBodyweightOnly,
} from '../utils/stats';
import { DeltaBadge } from './DeltaBadge';
import {
  ArrowLeftIcon,
  CalendarIcon,
  DumbbellIcon,
  EditIcon,
  MachineIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
} from './Icons';
import { MiniLineChart } from './MiniLineChart';

interface ExerciseDetailViewProps {
  exercise: TrackedExercise;
  unit: WeightUnit;
  onBack: () => void;
  onLogUpdate: (exercise: TrackedExercise) => void;
  onEditExercise: (exercise: TrackedExercise) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onEditEntry: (exercise: TrackedExercise, entry: StatEntry) => void;
  onDeleteEntry: (exerciseId: string, entryId: string) => void;
}

export function ExerciseDetailView({
  exercise,
  unit,
  onBack,
  onLogUpdate,
  onEditExercise,
  onDeleteExercise,
  onEditEntry,
  onDeleteEntry,
}: ExerciseDetailViewProps) {
  const bodyweightOnly = isBodyweightOnly(exercise);
  const [chartMetric, setChartMetric] = useState<'weight' | 'reps'>(
    bodyweightOnly ? 'reps' : 'weight'
  );
  const [confirmDeleteExercise, setConfirmDeleteExercise] = useState(false);

  const effectiveMetric = bodyweightOnly ? 'reps' : chartMetric;

  const latest = exercise.entries[0] ?? null;
  const allTimeBest = useMemo(
    () => getAllTimeBestEntry(exercise, unit),
    [exercise, unit]
  );

  const chartData = useMemo(() => {
    // Chronological oldest -> newest for chart
    const chronological = [...exercise.entries].reverse();
    return chronological
      .map((entry) => {
        const w = getEntryWeightInUnit(entry, unit);
        const value = effectiveMetric === 'weight' ? (w ?? 0) : entry.reps;
        const detail = `${formatWeightLabel(w, unit)} × ${entry.reps} reps`;
        return {
          date: entry.date,
          value,
          detail,
        };
      });
  }, [exercise.entries, effectiveMetric, unit]);

  return (
    <div className="space-y-4 pb-28 animate-enter">
      {/* Top Navigation & Actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-3 rounded-xl bg-white/[0.05] hover:bg-white/10 text-xs font-semibold text-[#C5CDD9] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEditExercise(exercise)}
            aria-label="Edit workout details"
            className="h-9 px-3 rounded-xl bg-white/[0.05] hover:bg-white/10 text-xs font-semibold text-[#C5CDD9] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <EditIcon className="w-3.5 h-3.5" />
            Edit
          </button>

          {!confirmDeleteExercise ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteExercise(true)}
              aria-label="Delete workout"
              className="h-9 w-9 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 text-[#8E98A8] hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          ) : (
            <div className="inline-flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 rounded-xl p-1">
              <button
                type="button"
                onClick={() => onDeleteExercise(exercise.id)}
                className="h-7 px-2.5 rounded-lg bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteExercise(false)}
                className="h-7 px-2 rounded-lg text-[11px] font-semibold text-rose-200 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header Card */}
      <section className="card-surface rounded-2xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold tracking-tight text-[#F3F5F8] break-words">
                {exercise.name}
              </h2>
            </div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.05] text-[#8E98A8] border border-white/[0.08]">
                {exercise.equipment === 'machine' ? (
                  <MachineIcon className="w-3 h-3" />
                ) : (
                  <DumbbellIcon className="w-3 h-3" />
                )}
                {exercise.equipment === 'machine' ? 'Machine' : 'No Machine'}
              </span>
              {exercise.weightMode && exercise.weightMode !== 'direct' && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F97316]/10 text-[#FB923C] border border-[#F97316]/20">
                  {getWeightModeLabel(exercise.weightMode)}
                </span>
              )}
              <span className="text-[11px] text-[#5C6677] font-mono">
                {exercise.entries.length}{' '}
                {exercise.entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onLogUpdate(exercise)}
            className="h-10 px-3.5 rounded-xl bg-[#F97316] hover:bg-[#FB923C] text-[#0A0C10] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-lg shadow-[#F97316]/20"
          >
            <PlusIcon className="w-4 h-4" />
            Log Update
          </button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-[#0D1016] border border-white/[0.07] p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E98A8]">
              Current
            </span>
            {latest ? (
              <>
                <p className="mt-1 text-base font-extrabold font-mono tabular-nums text-[#F3F5F8]">
                  {formatWeightLabel(getEntryWeightInUnit(latest, unit), unit)}
                  <span className="text-[#5C6677] mx-1">×</span>
                  <span className="text-[#F97316]">{latest.reps}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-[#5C6677]">
                  {formatFullDate(latest.date)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-[#5C6677]">—</p>
            )}
          </div>

          <div className="rounded-xl bg-[#0D1016] border border-white/[0.07] p-3">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B]">
              <TrophyIcon className="w-3 h-3" />
              All-Time Best
            </span>
            {allTimeBest ? (
              <>
                <p className="mt-1 text-base font-extrabold font-mono tabular-nums text-[#F3F5F8]">
                  {formatWeightLabel(getEntryWeightInUnit(allTimeBest, unit), unit)}
                  <span className="text-[#5C6677] mx-1">×</span>
                  <span className="text-[#F59E0B]">{allTimeBest.reps}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-[#5C6677]">
                  {formatFullDate(allTimeBest.date)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-[#5C6677]">—</p>
            )}
          </div>
        </div>
      </section>

      {/* Trend Chart */}
      {exercise.entries.length > 0 && (
        <section className="card-surface rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
              Progress Over Time
            </h3>
            {!bodyweightOnly && (
              <div className="inline-flex rounded-lg bg-[#0D1016] p-0.5 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setChartMetric('weight')}
                  className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    effectiveMetric === 'weight'
                      ? 'bg-[#F97316] text-[#0A0C10]'
                      : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                  }`}
                >
                  Weight
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('reps')}
                  className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    effectiveMetric === 'reps'
                      ? 'bg-[#F97316] text-[#0A0C10]'
                      : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                  }`}
                >
                  Reps
                </button>
              </div>
            )}
          </div>
          <MiniLineChart
            data={chartData}
            unitLabel={effectiveMetric === 'weight' ? unit : 'reps'}
          />
        </section>
      )}

      {/* Chronological History Timeline */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
            Update History
          </h3>
          <span className="text-[11px] text-[#5C6677]">Newest first</span>
        </div>

        {exercise.entries.length === 0 ? (
          <div className="card-surface rounded-2xl p-6 text-center text-xs text-[#8E98A8]">
            No entries recorded yet. Tap <strong className="text-[#F3F5F8]">Log Update</strong> to add one.
          </div>
        ) : (
          <div className="space-y-2.5">
            {exercise.entries.map((entry, idx) => {
              const previous = exercise.entries[idx + 1];
              const comparison = compareEntries(entry, previous, unit);
              const weightInUnit = getEntryWeightInUnit(entry, unit);
              const isLatest = idx === 0;

              return (
                <div
                  key={entry.id}
                  className={`card-surface rounded-2xl p-3.5 space-y-2 ${
                    isLatest ? 'border-[#F97316]/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C5CDD9]">
                          <CalendarIcon className="w-3.5 h-3.5 text-[#8E98A8]" />
                          {formatFullDate(entry.date)}
                        </span>
                        {isLatest && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F97316]/15 text-[#FB923C]">
                            Latest
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-lg font-extrabold font-mono tabular-nums text-[#F3F5F8]">
                          {formatWeightLabel(weightInUnit, unit)}
                        </span>
                        <span className="text-xs text-[#5C6677]">×</span>
                        <span className="text-lg font-extrabold font-mono tabular-nums text-[#F97316]">
                          {entry.reps}{' '}
                          <span className="text-xs font-sans font-semibold text-[#8E98A8]">
                            {entry.reps === 1 ? 'rep' : 'reps'}
                          </span>
                        </span>
                      </div>

                      {entry.weightDetail && (
                        <p className="text-[11px] font-mono text-[#5C6677]">
                          {entry.weightDetail}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditEntry(exercise, entry)}
                        aria-label="Edit entry"
                        className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/10 text-[#8E98A8] hover:text-[#F3F5F8] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(exercise.id, entry.id)}
                        aria-label="Delete entry"
                        className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 text-[#8E98A8] hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <DeltaBadge comparison={comparison} unit={unit} />
                  </div>

                  {entry.note && (
                    <p className="text-xs text-[#8E98A8] bg-[#0D1016] border border-white/[0.06] rounded-xl px-3 py-2">
                      {entry.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
