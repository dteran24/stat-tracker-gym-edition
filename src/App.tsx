import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActiveTab,
  AppSettings,
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightMode,
  WeightUnit,
} from './types';
import { AccountMenu } from './components/AccountMenu';
import { BottomNav } from './components/BottomNav';
import { EntryModal, type ModalMode } from './components/EntryModal';
import { ExerciseDetailView } from './components/ExerciseDetailView';
import { ExerciseListView } from './components/ExerciseListView';
import { DumbbellIcon } from './components/Icons';
import { StatsView } from './components/StatsView';
import {
  ApiError,
  fetchAuthStatus,
  fetchCloudState,
  logoutSession,
  syncAddEntry,
  syncCreateExercise,
  syncDeleteEntry,
  syncDeleteExercise,
  syncImportState,
  syncSettings,
  syncUpdateEntry,
  syncUpdateExercise,
  type AuthStatus,
  type SyncStatus,
} from './utils/api';
import {
  createId,
  loadExercises,
  loadSettings,
  parseBackupJson,
  saveExercises,
  saveSettings,
  sortEntriesDesc,
  sortExercisesRecentDesc,
} from './utils/storage';

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

function mergeExerciseLists(
  base: TrackedExercise[],
  incoming: TrackedExercise[]
): TrackedExercise[] {
  const byId = new Map<string, TrackedExercise>();
  for (const ex of base) byId.set(ex.id, ex);

  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
    } else {
      const entriesById = new Map<string, StatEntry>();
      for (const entry of existing.entries) entriesById.set(entry.id, entry);
      for (const entry of item.entries) entriesById.set(entry.id, entry);
      const mergedEntries = Array.from(entriesById.values()).sort(sortEntriesDesc);

      byId.set(item.id, {
        ...existing,
        ...item,
        entries: mergedEntries,
        createdAt: Math.min(existing.createdAt, item.createdAt),
        updatedAt: Math.max(existing.updatedAt, item.updatedAt),
      });
    }
  }

  return Array.from(byId.values()).sort(sortExercisesRecentDesc);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('exercises');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<TrackedExercise[]>(() => loadExercises());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const exercisesRef = useRef(exercises);
  const settingsRef = useRef(settings);

  useEffect(() => {
    exercisesRef.current = exercises;
    saveExercises(exercises);
  }, [exercises]);

  useEffect(() => {
    settingsRef.current = settings;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error' = 'success') => {
      setToast({ message, tone });
    },
    []
  );

  // Surface OAuth redirect errors cleanly if present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    if (authError) {
      showToast(`Google Sign-In failed (${authError}). Please try again.`, 'error');
      params.delete('authError');
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, [showToast]);

  // Initial auth check + hydrate & auto-merge any local-only workouts into SQLite
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const auth = await fetchAuthStatus();
        if (cancelled) return;
        setAuthStatus(auth);

        if (!auth.authenticated) {
          setSyncStatus('signed-out');
          return;
        }

        const localSnapshot = loadExercises();
        const localSettings = loadSettings();
        const cloud = await fetchCloudState();
        if (cancelled) return;

        const cloudIds = new Set(cloud.exercises.map((ex) => ex.id));
        const localOnly = localSnapshot.filter((ex) => !cloudIds.has(ex.id));

        if (localOnly.length > 0) {
          setSyncStatus('syncing');
          const merged = await syncImportState(
            localOnly,
            cloud.exercises.length === 0 ? localSettings : undefined
          );
          if (cancelled) return;
          setExercises(merged.exercises);
          setSettings(merged.settings);
          setLastSyncedAt(merged.syncedAt);
          setSyncStatus('synced');
        } else {
          setExercises(cloud.exercises);
          setSettings(cloud.settings);
          setLastSyncedAt(cloud.syncedAt);
          setSyncStatus('synced');
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setSyncStatus('signed-out');
        } else {
          setSyncStatus('offline');
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Automatically flush any offline edits to SQLite when reconnecting
  useEffect(() => {
    if (!authStatus?.authenticated) return;
    if (syncStatus !== 'offline' && syncStatus !== 'error') return;

    const handleOnline = async () => {
      setSyncStatus('syncing');
      try {
        const synced = await syncImportState(
          exercisesRef.current,
          settingsRef.current
        );
        setExercises(synced.exercises);
        setSettings(synced.settings);
        setLastSyncedAt(synced.syncedAt);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [authStatus?.authenticated, syncStatus]);

  const runCloudSave = useCallback(
    async (task: () => Promise<{ syncedAt: string }>) => {
      if (!authStatus?.authenticated) return;
      setSyncStatus('syncing');
      try {
        const res = await task();
        setLastSyncedAt(res.syncedAt);
        setSyncStatus('synced');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthStatus((prev) =>
            prev ? { ...prev, authenticated: false, user: null } : prev
          );
          setSyncStatus('signed-out');
          showToast('Session expired. Sign in with Google to resume cloud saves.', 'error');
        } else {
          setSyncStatus('offline');
        }
      }
    },
    [authStatus?.authenticated, showToast]
  );

  const selectedExercise = useMemo(
    () =>
      selectedExerciseId
        ? exercises.find((ex) => ex.id === selectedExerciseId) ?? null
        : null,
    [exercises, selectedExerciseId]
  );

  const handleUnitChange = (nextUnit: WeightUnit) => {
    if (nextUnit === settings.unit) return;
    const nextSettings: AppSettings = { unit: nextUnit };
    setSettings(nextSettings);
    void runCloudSave(() => syncSettings(nextSettings));
  };

  const handleCreateExercise = (payload: {
    name: string;
    equipment: EquipmentType;
    weightMode: WeightMode;
    barWeight?: number;
    weight: number | null;
    weightDetail?: string;
    reps: number;
    date: string;
    note: string;
  }) => {
    const now = Date.now();
    const initialEntry: StatEntry = {
      id: createId(),
      weight: payload.weight,
      unit: settings.unit,
      weightDetail: payload.weightDetail,
      reps: payload.reps,
      date: payload.date,
      note: payload.note || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const newExercise: TrackedExercise = {
      id: createId(),
      name: payload.name,
      equipment: payload.equipment,
      weightMode: payload.weightMode,
      barWeight: payload.barWeight,
      barWeightUnit: payload.barWeight !== undefined ? settings.unit : undefined,
      entries: [initialEntry],
      createdAt: now,
      updatedAt: now,
    };

    setExercises((prev) => [newExercise, ...prev].sort(sortExercisesRecentDesc));
    setModalMode(null);
    showToast(`Added "${payload.name}"!`);
    void runCloudSave(() => syncCreateExercise(newExercise));
  };

  const handleLogUpdate = (
    exerciseId: string,
    payload: {
      weight: number | null;
      weightDetail?: string;
      weightMode: WeightMode;
      barWeight?: number;
      reps: number;
      date: string;
      note: string;
    }
  ) => {
    const now = Date.now();
    const newEntry: StatEntry = {
      id: createId(),
      weight: payload.weight,
      unit: settings.unit,
      weightDetail: payload.weightDetail,
      reps: payload.reps,
      date: payload.date,
      note: payload.note || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const barWeightUnit =
      payload.barWeight !== undefined ? settings.unit : undefined;

    setExercises((prev) =>
      prev
        .map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                weightMode: payload.weightMode,
                barWeight: payload.barWeight,
                barWeightUnit,
                entries: [newEntry, ...ex.entries].sort(sortEntriesDesc),
                updatedAt: now,
              }
            : ex
        )
        .sort(sortExercisesRecentDesc)
    );

    setModalMode(null);
    showToast('Update recorded!');
    void runCloudSave(() =>
      syncAddEntry(exerciseId, {
        entry: newEntry,
        weightMode: payload.weightMode,
        barWeight: payload.barWeight,
        barWeightUnit,
        updatedAt: now,
      })
    );
  };

  const handleEditEntry = (
    exerciseId: string,
    entryId: string,
    payload: {
      weight: number | null;
      weightDetail?: string;
      reps: number;
      date: string;
      note: string;
    }
  ) => {
    const now = Date.now();
    const note = payload.note || undefined;

    setExercises((prev) =>
      prev
        .map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                entries: ex.entries
                  .map((entry) =>
                    entry.id === entryId
                      ? {
                          ...entry,
                          weight: payload.weight,
                          unit: settings.unit,
                          weightDetail: payload.weightDetail,
                          reps: payload.reps,
                          date: payload.date,
                          note,
                          updatedAt: now,
                        }
                      : entry
                  )
                  .sort(sortEntriesDesc),
                updatedAt: now,
              }
            : ex
        )
        .sort(sortExercisesRecentDesc)
    );

    setModalMode(null);
    showToast('Entry updated!');
    void runCloudSave(() =>
      syncUpdateEntry(exerciseId, entryId, {
        weight: payload.weight,
        unit: settings.unit,
        weightDetail: payload.weightDetail,
        reps: payload.reps,
        date: payload.date,
        note,
        updatedAt: now,
      })
    );
  };

  const handleDeleteEntry = (exerciseId: string, entryId: string) => {
    const now = Date.now();
    setExercises((prev) =>
      prev
        .map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                entries: ex.entries.filter((e) => e.id !== entryId),
                updatedAt: now,
              }
            : ex
        )
        .sort(sortExercisesRecentDesc)
    );
    showToast('Entry deleted.');
    void runCloudSave(() => syncDeleteEntry(exerciseId, entryId));
  };

  const handleEditExercise = (
    exerciseId: string,
    payload: {
      name: string;
      equipment: EquipmentType;
      weightMode: WeightMode;
      barWeight?: number;
    }
  ) => {
    const now = Date.now();
    const barWeightUnit =
      payload.barWeight !== undefined ? settings.unit : undefined;

    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              name: payload.name,
              equipment: payload.equipment,
              weightMode: payload.weightMode,
              barWeight: payload.barWeight,
              barWeightUnit,
              updatedAt: now,
            }
          : ex
      )
    );
    setModalMode(null);
    showToast('Workout details updated.');
    void runCloudSave(() =>
      syncUpdateExercise(exerciseId, {
        name: payload.name,
        equipment: payload.equipment,
        weightMode: payload.weightMode,
        barWeight: payload.barWeight,
        barWeightUnit,
        updatedAt: now,
      })
    );
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
    if (selectedExerciseId === exerciseId) {
      setSelectedExerciseId(null);
    }
    showToast('Workout deleted.');
    void runCloudSave(() => syncDeleteExercise(exerciseId));
  };

  const handleImportJson = async (jsonText: string) => {
    try {
      const imported = parseBackupJson(jsonText);
      setExercises((prev) => mergeExerciseLists(prev, imported.exercises));
      if (imported.settings) {
        setSettings(imported.settings);
      }

      if (authStatus?.authenticated) {
        setSyncStatus('syncing');
        try {
          const synced = await syncImportState(imported.exercises, imported.settings);
          setExercises(synced.exercises);
          setSettings(synced.settings);
          setLastSyncedAt(synced.syncedAt);
          setSyncStatus('synced');
          showToast(`Imported & saved ${imported.exercises.length} workout(s)!`);
          return;
        } catch {
          setSyncStatus('offline');
        }
      }

      showToast(`Imported & merged ${imported.exercises.length} workout(s)!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import JSON file.';
      showToast(msg, 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutSession();
    } catch {
      // Ignore network errors on sign out
    }
    setAuthStatus((prev) =>
      prev ? { ...prev, authenticated: false, user: null } : prev
    );
    setSyncStatus('signed-out');
    setLastSyncedAt(null);
    showToast('Signed out.');
  };

  const handleOpenExercise = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setActiveTab('exercises');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'exercises') {
      setSelectedExerciseId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-[#0A0C10] text-[#F3F5F8] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0A0C10]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleTabChange('exercises')}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#F97316]/15 border border-[#F97316]/30 flex items-center justify-center text-[#F97316] shrink-0">
              <DumbbellIcon className="w-4 h-4" />
            </div>
            <div className="leading-tight truncate">
              <h1 className="text-sm font-extrabold tracking-tight text-[#F3F5F8]">
                Stat Tracker
              </h1>
              <p className="text-[11px] font-medium text-[#8E98A8]">
                Gym Edition
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick lbs / kg Toggle */}
            <div
              role="group"
              aria-label="Weight unit"
              className="inline-flex rounded-lg bg-[#12161E] p-0.5 border border-white/10 shrink-0"
            >
              {(['lbs', 'kg'] as const).map((u) => (
                <button
                  key={u}
                  id={`header-unit-${u}`}
                  type="button"
                  onClick={() => handleUnitChange(u)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                    settings.unit === u
                      ? 'bg-[#F97316] text-[#0A0C10]'
                      : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Signed-in Avatar Pill / Sign In Button */}
            <AccountMenu
              authStatus={authStatus}
              syncStatus={syncStatus}
              lastSyncedAt={lastSyncedAt}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-4">
        {activeTab === 'exercises' && selectedExercise ? (
          <ExerciseDetailView
            exercise={selectedExercise}
            unit={settings.unit}
            onBack={() => setSelectedExerciseId(null)}
            onLogUpdate={(ex) => setModalMode({ type: 'log-update', exercise: ex })}
            onEditExercise={(ex) => setModalMode({ type: 'edit-exercise', exercise: ex })}
            onDeleteExercise={handleDeleteExercise}
            onEditEntry={(ex, entry) =>
              setModalMode({ type: 'edit-entry', exercise: ex, entry })
            }
            onDeleteEntry={handleDeleteEntry}
          />
        ) : activeTab === 'exercises' ? (
          <ExerciseListView
            exercises={exercises}
            unit={settings.unit}
            onAddExercise={() => setModalMode({ type: 'create-exercise' })}
            onLogUpdate={(ex) => setModalMode({ type: 'log-update', exercise: ex })}
            onOpenDetail={handleOpenExercise}
          />
        ) : (
          <StatsView
            exercises={exercises}
            settings={settings}
            onChangeUnit={handleUnitChange}
            onImportJson={handleImportJson}
            onOpenExercise={handleOpenExercise}
            authStatus={authStatus}
            syncStatus={syncStatus}
            lastSyncedAt={lastSyncedAt}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Create / Update / Edit Modal */}
      <EntryModal
        mode={modalMode}
        unit={settings.unit}
        onClose={() => setModalMode(null)}
        onSubmitCreate={handleCreateExercise}
        onSubmitLogUpdate={handleLogUpdate}
        onSubmitEditEntry={handleEditEntry}
        onSubmitEditExercise={handleEditExercise}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 inset-x-4 z-50 mx-auto max-w-sm animate-enter"
        >
          <div
            className={`px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl border text-center ${
              toast.tone === 'error'
                ? 'bg-rose-950/95 border-rose-500/40 text-rose-200'
                : 'bg-[#141A24]/95 border-[#22C55E]/35 text-[#86EFAC]'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChange={handleTabChange}
        exerciseCount={exercises.length}
      />
    </div>
  );
}
