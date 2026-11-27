import { useMemo, useRef, useState } from 'react';
import type { AppSettings, TrackedExercise, WeightUnit } from '../types';
import {
  formatSyncTimestamp,
  getGoogleSignInUrl,
  type AuthStatus,
  type SyncStatus,
} from '../utils/api';
import {
  compareEntries,
  formatFullDate,
  formatWeightLabel,
  getEntryWeightInUnit,
} from '../utils/stats';
import { exportBackupJson, getTodayIso } from '../utils/storage';
import { GoogleMark } from './AccountMenu';
import { DeltaBadge } from './DeltaBadge';
import {
  CloudIcon,
  DownloadIcon,
  TrendDownIcon,
  TrendUpIcon,
  UploadIcon,
} from './Icons';

interface StatsViewProps {
  exercises: TrackedExercise[];
  settings: AppSettings;
  onChangeUnit: (unit: WeightUnit) => void;
  onImportJson: (jsonText: string) => void;
  onOpenExercise: (exerciseId: string) => void;
  authStatus: AuthStatus | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  onSignOut: () => void;
}

const SAVE_BADGE_MAP: Record<
  SyncStatus,
  { label: string; className: string; dotClass: string }
> = {
  loading: {
    label: 'Connecting…',
    className: 'bg-white/[0.06] text-[#8E98A8] border-white/10',
    dotClass: 'bg-[#8E98A8]',
  },
  syncing: {
    label: 'Saving…',
    className: 'bg-[#F97316]/15 text-[#FDBA74] border-[#F97316]/30',
    dotClass: 'bg-[#F97316] animate-pulse',
  },
  synced: {
    label: 'Saved',
    className: 'bg-[#22C55E]/15 text-[#86EFAC] border-[#22C55E]/30',
    dotClass: 'bg-[#22C55E]',
  },
  offline: {
    label: 'Offline (Local)',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  'signed-out': {
    label: 'Local Only',
    className: 'bg-white/[0.06] text-[#C5CDD9] border-white/10',
    dotClass: 'bg-[#8E98A8]',
  },
  error: {
    label: 'Save Error',
    className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
};

function getInitials(name: string, email: string): string {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function StatsView({
  exercises,
  settings,
  onChangeUnit,
  onImportJson,
  onOpenExercise,
  authStatus,
  syncStatus,
  lastSyncedAt,
  onSignOut,
}: StatsViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
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

  const saveBadge = SAVE_BADGE_MAP[syncStatus];
  const user = authStatus?.authenticated ? authStatus.user : null;
  const showPicture = Boolean(user?.picture && !avatarFailed);

  return (
    <div className="space-y-5 pb-28 animate-enter">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-[#F3F5F8]">
          Overview &amp; Backup
        </h2>
        <p className="text-xs text-[#8E98A8]">
          Track your progress across all workouts and manage your account.
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

      {/* Account & Auto-Save Status */}
      <section className="card-surface rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CloudIcon className="w-4 h-4 text-[#F97316] shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F3F5F8]">
              Account
            </h3>
          </div>

          <span
            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${saveBadge.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${saveBadge.dotClass}`} />
            {saveBadge.label}
          </span>
        </div>

        {user ? (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#0D1016] border border-white/[0.08] p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-[#F97316]/20 border border-[#F97316]/40 flex items-center justify-center text-xs font-extrabold text-[#FDBA74] shrink-0">
                  {showPicture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(user.name, user.email)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F3F5F8] truncate">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-[#8E98A8] truncate">
                    {user.isLocalFallback ? 'Local dev SQLite' : user.email}
                  </p>
                </div>
              </div>

              {!user.isLocalFallback && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="shrink-0 h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-rose-500/15 hover:text-rose-200 hover:border-rose-500/30 border border-white/10 text-[11px] font-semibold text-[#C5CDD9] transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-[#8E98A8]">
              <span>Every edit saves automatically to SQLite</span>
              {lastSyncedAt && (
                <span className="font-mono text-[#C5CDD9] shrink-0">
                  {formatSyncTimestamp(lastSyncedAt)}
                </span>
              )}
            </div>
          </>
        ) : authStatus?.oauthConfigured ? (
          <div className="space-y-2.5">
            <a
              href={getGoogleSignInUrl()}
              className="w-full h-10 px-4 rounded-xl bg-white hover:bg-neutral-100 text-xs font-bold text-[#0A0C10] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <GoogleMark className="w-4 h-4" />
              Sign in with Google
            </a>
            <p className="text-[11px] text-[#8E98A8]">
              Sign in to automatically save every edit to your SQLite database across devices.
              Local storage and JSON export/import below continue to work offline.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#8E98A8] rounded-xl bg-[#0D1016] border border-white/[0.08] p-3">
            {syncStatus === 'offline'
              ? 'Offline — edits are saved locally and will automatically save to SQLite when you reconnect.'
              : 'Google Sign-In is not configured on the server yet. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in Railway environment variables.'}
          </p>
        )}
      </section>

      {/* Preferences & Data Backup */}
      <section className="card-surface rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
          Settings &amp; Local Backup
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
