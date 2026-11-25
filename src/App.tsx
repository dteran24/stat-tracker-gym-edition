import { useEffect, useMemo, useState } from 'react';
import type {
  ActiveTab,
  AppSettings,
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightMode,
  WeightUnit,
} from './types';
import { BottomNav } from './components/BottomNav';
import { EntryModal, type ModalMode } from './components/EntryModal';
import { ExerciseDetailView } from './components/ExerciseDetailView';
import { ExerciseListView } from './components/ExerciseListView';
import { DumbbellIcon } from './components/Icons';
import { StatsView } from './components/StatsView';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('exercises');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<TrackedExercise[]>(() => loadExercises());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    saveExercises(exercises);
  }, [exercises]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  };

  const selectedExercise = useMemo(
    () =>
      selectedExerciseId
        ? exercises.find((ex) => ex.id === selectedExerciseId) ?? null
        : null,
    [exercises, selectedExerciseId]
  );

  const handleUnitChange = (nextUnit: WeightUnit) => {
    if (nextUnit === settings.unit) return;
    setSettings({ unit: nextUnit });
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

    setExercises((prev) =>
      prev
        .map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                weightMode: payload.weightMode,
                barWeight: payload.barWeight,
                barWeightUnit:
                  payload.barWeight !== undefined ? settings.unit : undefined,
                entries: [newEntry, ...ex.entries].sort(sortEntriesDesc),
                updatedAt: now,
              }
            : ex
        )
        .sort(sortExercisesRecentDesc)
    );

    setModalMode(null);
    showToast('Update recorded!');
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
                          note: payload.note || undefined,
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
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              name: payload.name,
              equipment: payload.equipment,
              weightMode: payload.weightMode,
              barWeight: payload.barWeight,
              barWeightUnit:
                payload.barWeight !== undefined ? settings.unit : undefined,
              updatedAt: now,
            }
          : ex
      )
    );
    setModalMode(null);
    showToast('Workout details updated.');
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
    if (selectedExerciseId === exerciseId) {
      setSelectedExerciseId(null);
    }
    showToast('Workout deleted.');
  };

  const handleImportJson = (jsonText: string) => {
    try {
      const imported = parseBackupJson(jsonText);
      setExercises((prev) => {
        const byId = new Map<string, TrackedExercise>();
        for (const ex of prev) byId.set(ex.id, ex);
        for (const ex of imported.exercises) byId.set(ex.id, ex);
        return Array.from(byId.values()).sort(sortExercisesRecentDesc);
      });
      if (imported.settings) {
        setSettings(imported.settings);
      }
      showToast(`Imported ${imported.exercises.length} workout(s)!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import JSON file.';
      showToast(msg, 'error');
    }
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
