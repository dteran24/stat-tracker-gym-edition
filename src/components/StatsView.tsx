import { useMemo, useRef } from 'react';
import type { AppSettings, TrackedExercise, WeightUnit } from '../types';
import {
  compareEntries,
  formatFullDate,
  formatWeightLabel,
  getEntryWeightInUnit,
} from '../utils/stats';
import { exportBackupJson, getTodayIso } from '../utils/storage';
import { DeltaBadge } from './DeltaBadge';
import { DownloadIcon, TrendDownIcon, TrendUpIcon, UploadIcon } from './Icons';

interface StatsViewProps {
  exercises: TrackedExercise[];
  settings: AppSettings;
  onChangeUnit: (unit: WeightUnit) => void;
  onImportJson: (jsonText: string) => void;
  onOpenExercise: (exerciseId: string) => void;
}

export function StatsView({
  exercises,
  settings,
  onChangeUnit,
  onImportJson,
  onOpenExercise,
}: StatsViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const unit = settings.unit;

  const summary = useMemo(() => {
    let totalEntries = 0;
    let trendingUp = 0;
    let trendingDown = 0;

    for (const ex of exercises) {
      totalEntries += ex.entries.length;
      if (ex.entries.length >= 2) {
        const cmp = compareEntries(ex.entries[0], ex.entries[1], unit);
        if (cmp.direction === 'up') trendingUp += 1;
        else if (cmp.direction === 'down') trendingDown += 1;
      }
    }

    return {
      totalExercises: exercises.length,
      totalEntries,
      trendingUp,
      trendingDown,
    };
  }, [exercises, unit]);

  const recentChanges = useMemo(() => {
    const items = exercises.flatMap((ex) =>
      ex.entries.map((entry, idx) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        entry,
        comparison: compareEntries(entry, ex.entries[idx + 1], unit),
      }))
    );

    return items
      .sort((a, b) => {
        if (a.entry.date !== b.entry.date) {
          return b.entry.date.localeCompare(a.entry.date);
        }
        return b.entry.createdAt - a.entry.createdAt;
      })
      .slice(0, 12);
  }, [exercises, unit]);

  const handleExport = () => {
    const json = exportBackupJson(exercises, settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stat-tracker-backup-${getTodayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="space-y-5 pb-28 animate-enter">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-[#F3F5F8]">
          Overview &amp; Backup
        </h2>
        <p className="text-xs text-[#8E98A8]">
          Track your progress across all workouts and keep your data backed up.
        </p>
      </div>

      {/* Overview Tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-surface rounded-2xl p-3.5">
          <span className="text-[11px] font-semibold text-[#8E98A8]">
            Workouts Tracked
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#F3F5F8]">
            {summary.totalExercises}
          </p>
        </div>

        <div className="card-surface rounded-2xl p-3.5">
          <span className="text-[11px] font-semibold text-[#8E98A8]">
            Total Updates
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#F3F5F8]">
            {summary.totalEntries}
          </p>
        </div>

        <div className="card-surface rounded-2xl p-3.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#86EFAC]">
            <TrendUpIcon className="w-3.5 h-3.5" />
            Trending Up
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#86EFAC]">
            {summary.trendingUp}
          </p>
        </div>

        <div className="card-surface rounded-2xl p-3.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300">
            <TrendDownIcon className="w-3.5 h-3.5" />
            Trending Down
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-rose-300">
            {summary.trendingDown}
          </p>
        </div>
      </div>

      {/* Recent Changes Feed */}
      <section className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
          Recent Activity
        </h3>

        {recentChanges.length === 0 ? (
          <div className="card-surface rounded-2xl p-6 text-center text-xs text-[#8E98A8]">
            Your recent updates across all workouts will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {recentChanges.map(({ exerciseId, exerciseName, entry, comparison }) => {
              const weightInUnit = getEntryWeightInUnit(entry, unit);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onOpenExercise(exerciseId)}
                  className="w-full text-left card-surface rounded-2xl p-3.5 hover:border-white/15 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#F3F5F8] truncate">
                      {exerciseName}
                    </span>
                    <span className="text-[11px] text-[#8E98A8] shrink-0">
                      {formatFullDate(entry.date)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold tabular-nums text-[#C5CDD9]">
                      {formatWeightLabel(weightInUnit, unit)} ×{' '}
                      <span className="text-[#F97316]">{entry.reps} reps</span>
                    </span>
                    <DeltaBadge comparison={comparison} unit={unit} compact />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Preferences & Data Backup */}
      <section className="card-surface rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
          Settings &amp; Backup
        </h3>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#F3F5F8]">Display Unit</p>
            <p className="text-[11px] text-[#8E98A8]">
              Weights convert automatically without losing accuracy.
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-[#0D1016] p-0.5 border border-white/10 shrink-0">
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => onChangeUnit(u)}
                className={`h-8 px-3 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer ${
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

        <div className="pt-3 border-t border-white/[0.08] grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            className="h-10 px-3 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#F3F5F8] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <DownloadIcon className="w-4 h-4 text-[#F97316]" />
            Export JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-3 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#F3F5F8] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <UploadIcon className="w-4 h-4 text-[#22C55E]" />
            Import JSON
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </section>
    </div>
  );
}
