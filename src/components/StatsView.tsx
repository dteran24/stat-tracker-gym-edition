import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type {
  AppSettings,
  EquipmentFilter,
  WeightUnit,
  Workout,
} from '../types';
import {
  formatNumber,
  formatShortDate,
  formatVolume,
  getExerciseProgressSeries,
  getTrackedExercises,
  getWorkoutStats,
  normalizeExerciseKey,
} from '../utils/stats';
import { exportBackupJson } from '../utils/storage';
import {
  ChartIcon,
  DownloadIcon,
  TrophyIcon,
  UploadIcon,
} from './Icons';
import { MiniLineChart } from './MiniLineChart';

type ChartMetric = 'maxWeight' | 'bestEst1RM' | 'totalVolume';

interface StatsViewProps {
  workouts: Workout[];
  settings: AppSettings;
  onChangeUnit: (unit: WeightUnit) => void;
  onImportJson: (jsonText: string) => void;
}

export function StatsView({
  workouts,
  settings,
  onChangeUnit,
  onImportJson,
}: StatsViewProps) {
  const [equipFilter, setEquipFilter] = useState<EquipmentFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [metric, setMetric] = useState<ChartMetric>('maxWeight');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const unit = settings.unit;

  const overallStats = useMemo(() => {
    let totalSets = 0;
    let totalVolume = 0;
    for (const w of workouts) {
      const s = getWorkoutStats(w, unit);
      totalSets += s.totalSets;
      totalVolume += s.totalVolume;
    }
    return {
      totalWorkouts: workouts.length,
      totalSets,
      totalVolume,
    };
  }, [workouts, unit]);

  const trackedExercises = useMemo(
    () => getTrackedExercises(workouts, equipFilter),
    [workouts, equipFilter]
  );

  const activeExercise = useMemo(() => {
    if (trackedExercises.length === 0) return null;
    const found = trackedExercises.find(
      (ex) => normalizeExerciseKey(ex.name, ex.equipment) === selectedKey
    );
    return found ?? trackedExercises[0];
  }, [trackedExercises, selectedKey]);

  const series = useMemo(() => {
    if (!activeExercise) return [];
    return getExerciseProgressSeries(
      workouts,
      activeExercise.name,
      activeExercise.equipment,
      unit
    );
  }, [workouts, activeExercise, unit]);

  const prSummary = useMemo(() => {
    if (series.length === 0) {
      return { bestWeight: 0, bestWeightReps: 0, best1RM: 0, bestVolume: 0 };
    }
    let bestWeight = 0;
    let bestWeightReps = 0;
    let best1RM = 0;
    let bestVolume = 0;
    for (const pt of series) {
      if (
        pt.maxWeight > bestWeight ||
        (pt.maxWeight === bestWeight && pt.bestSetReps > bestWeightReps)
      ) {
        bestWeight = pt.maxWeight;
        bestWeightReps = pt.bestSetReps;
      }
      if (pt.bestEst1RM > best1RM) best1RM = pt.bestEst1RM;
      if (pt.totalVolume > bestVolume) bestVolume = pt.totalVolume;
    }
    return { bestWeight, bestWeightReps, best1RM, bestVolume };
  }, [series]);

  const chartData = useMemo(
    () =>
      series.map((pt) => ({
        date: pt.date,
        value: pt[metric],
        detail: `${formatNumber(pt.bestSetWeight)} ${unit} × ${pt.bestSetReps}`,
      })),
    [series, metric, unit]
  );

  const handleExport = () => {
    const json = exportBackupJson(workouts, settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-stat-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Lifetime Summary Strip */}
      <section className="grid grid-cols-3 gap-2.5">
        <div className="card-surface rounded-2xl p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8]">
            Workouts
          </p>
          <p className="mt-1 text-xl font-extrabold font-mono tabular-nums text-[#F3F5F8]">
            {overallStats.totalWorkouts}
          </p>
        </div>
        <div className="card-surface rounded-2xl p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8]">
            Total Sets
          </p>
          <p className="mt-1 text-xl font-extrabold font-mono tabular-nums text-[#F3F5F8]">
            {overallStats.totalSets}
          </p>
        </div>
        <div className="card-surface rounded-2xl p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8]">
            Volume ({unit})
          </p>
          <p className="mt-1 text-xl font-extrabold font-mono tabular-nums text-[#F97316]">
            {formatVolume(overallStats.totalVolume)}
          </p>
        </div>
      </section>

      {/* Exercise Progress Explorer */}
      <section className="card-surface rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
            Exercise Progress
          </h2>
          <div className="inline-flex rounded-lg bg-[#0B0E14] p-0.5 border border-white/[0.06]">
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
                onClick={() => setEquipFilter(opt.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  equipFilter === opt.id
                    ? 'bg-[#212836] text-[#F3F5F8]'
                    : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {trackedExercises.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-xl bg-[#1A202B] flex items-center justify-center text-[#8E98A8]">
              <ChartIcon className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-[#F3F5F8]">
              No exercise stats yet
            </p>
            <p className="text-xs text-[#8E98A8]">
              Complete and save workouts to see your PRs and progression chart.
            </p>
          </div>
        ) : (
          <>
            {/* Exercise Picker */}
            <select
              id="stats-exercise-select"
              aria-label="Select exercise to analyze"
              value={
                activeExercise
                  ? normalizeExerciseKey(activeExercise.name, activeExercise.equipment)
                  : ''
              }
              onChange={(e) => setSelectedKey(e.target.value)}
              className="input-field w-full h-11 rounded-xl px-3.5 text-sm font-semibold"
            >
              {trackedExercises.map((ex) => {
                const key = normalizeExerciseKey(ex.name, ex.equipment);
                const tag = ex.equipment === 'machine' ? 'Machine' : 'No Machine';
                return (
                  <option key={key} value={key} className="bg-[#12161E]">
                    {ex.name} ({tag}) — {ex.usageCount}x
                  </option>
                );
              })}
            </select>

            {/* PR Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#0C0F15] border border-white/[0.06] p-3">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#4ADE80]">
                  <TrophyIcon className="w-3 h-3" />
                  Best PR
                </div>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-[#F3F5F8]">
                  {formatNumber(prSummary.bestWeight)}{' '}
                  <span className="text-xs font-normal text-[#8E98A8]">{unit}</span>
                </p>
                <p className="text-[11px] font-mono text-[#8E98A8]">
                  × {prSummary.bestWeightReps} reps
                </p>
              </div>

              <div className="rounded-xl bg-[#0C0F15] border border-white/[0.06] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E98A8]">
                  Est. 1RM
                </p>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-[#F3F5F8]">
                  {formatNumber(prSummary.best1RM)}{' '}
                  <span className="text-xs font-normal text-[#8E98A8]">{unit}</span>
                </p>
                <p className="text-[11px] text-[#5C6677]">Epley peak</p>
              </div>

              <div className="rounded-xl bg-[#0C0F15] border border-white/[0.06] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E98A8]">
                  Best Vol
                </p>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-[#F3F5F8]">
                  {formatVolume(prSummary.bestVolume)}
                </p>
                <p className="text-[11px] text-[#5C6677]">{unit} / session</p>
              </div>
            </div>

            {/* Metric Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
              {(
                [
                  { id: 'maxWeight', label: 'Max Weight' },
                  { id: 'bestEst1RM', label: 'Est. 1RM' },
                  { id: 'totalVolume', label: 'Volume' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    metric === m.id
                      ? 'bg-[#F97316] text-[#0A0C10]'
                      : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Progression Chart */}
            <MiniLineChart data={chartData} unitLabel={unit} />

            {/* Recent Session Rows */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6677]">
                Recent Sessions
              </p>
              {[...series]
                .reverse()
                .slice(0, 5)
                .map((pt) => (
                  <div
                    key={pt.workoutId}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0C0F15] border border-white/[0.05] text-xs"
                  >
                    <span className="font-mono text-[#8E98A8]">
                      {formatShortDate(pt.date)}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-[#F3F5F8]">
                      {formatNumber(pt.bestSetWeight)} {unit} × {pt.bestSetReps}
                    </span>
                    <span className="font-mono tabular-nums text-[#8E98A8]">
                      {formatVolume(pt.totalVolume)} vol
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </section>

      {/* Preferences & JSON Backup */}
      <section className="card-surface rounded-2xl p-4 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
          Preferences & Data Backup
        </h2>

        {/* Weight Unit Toggle */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#F3F5F8]">Weight Unit</p>
            <p className="text-xs text-[#8E98A8]">
              Converts displayed weights automatically
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-[#0B0E14] p-1 border border-white/[0.06]">
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => onChangeUnit(u)}
                className={`h-9 w-14 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer ${
                  unit === u
                    ? 'bg-[#F97316] text-[#0A0C10]'
                    : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Export / Import */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            id="export-json-btn"
            type="button"
            onClick={handleExport}
            className="h-11 rounded-xl bg-[#1A202B] hover:bg-[#232B3A] border border-white/10 text-xs font-semibold text-[#F3F5F8] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <DownloadIcon className="w-4 h-4 text-[#F97316]" />
            Export JSON
          </button>

          <button
            id="import-json-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-11 rounded-xl bg-[#1A202B] hover:bg-[#232B3A] border border-white/10 text-xs font-semibold text-[#F3F5F8] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <UploadIcon className="w-4 h-4 text-[#38BDF8]" />
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>
    </div>
  );
}
