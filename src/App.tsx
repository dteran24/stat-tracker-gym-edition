import { useEffect, useState } from 'react';
import type { ActiveTab, AppSettings, WeightUnit, Workout, WorkoutDraft } from './types';
import { BottomNav } from './components/BottomNav';
import { HistoryView } from './components/HistoryView';
import { DumbbellIcon } from './components/Icons';
import { LogWorkoutView } from './components/LogWorkoutView';
import { StatsView } from './components/StatsView';
import { convertWeight, formatNumber, parseNumeric } from './utils/stats';
import {
  clearDraft,
  createEmptyDraft,
  createId,
  loadDraft,
  loadSettings,
  loadWorkouts,
  parseBackupJson,
  saveDraft,
  saveSettings,
  saveWorkouts,
  sortWorkoutsDesc,
} from './utils/storage';

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('log');
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [draft, setDraft] = useState<WorkoutDraft>(() => loadDraft());
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    saveWorkouts(workouts);
  }, [workouts]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  };

  const handleUnitChange = (nextUnit: WeightUnit) => {
    if (nextUnit === settings.unit) return;
    const prevUnit = settings.unit;
    setSettings({ unit: nextUnit });

    // Keep any in-progress draft weights consistent with the newly selected unit
    if (draft.exercises.length > 0) {
      setDraft((prev) => ({
        ...prev,
        exercises: prev.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.weight.trim() === '') return s;
            const converted = convertWeight(parseNumeric(s.weight), prevUnit, nextUnit);
            return { ...s, weight: formatNumber(converted) };
          }),
        })),
      }));
    }
  };

  const handleSaveWorkout = () => {
    const cleanedExercises = draft.exercises
      .map((ex) => ({
        ...ex,
        name: ex.name.trim(),
        sets: ex.sets.filter((s) => s.weight.trim() !== '' || s.reps.trim() !== ''),
      }))
      .filter((ex) => ex.name.length > 0 && ex.sets.length > 0);

    if (cleanedExercises.length === 0) {
      showToast('Add at least one exercise with weight or reps before saving.', 'error');
      return;
    }

    const now = Date.now();
    const defaultTitle =
      cleanedExercises.length === 1
        ? cleanedExercises[0].name
        : `${cleanedExercises[0].name} + ${cleanedExercises.length - 1} more`;

    if (draft.editingId) {
      setWorkouts((prev) =>
        prev
          .map((w) =>
            w.id === draft.editingId
              ? {
                  ...w,
                  title: draft.title.trim() || defaultTitle,
                  date: draft.date,
                  unit: settings.unit,
                  exercises: cleanedExercises,
                  updatedAt: now,
                }
              : w
          )
          .sort(sortWorkoutsDesc)
      );
      showToast('Workout updated!');
    } else {
      const newWorkout: Workout = {
        id: createId(),
        title: draft.title.trim() || defaultTitle,
        date: draft.date,
        unit: settings.unit,
        exercises: cleanedExercises,
        createdAt: now,
        updatedAt: now,
      };
      setWorkouts((prev) => [newWorkout, ...prev].sort(sortWorkoutsDesc));
      showToast('Workout saved!');
    }

    clearDraft();
    setDraft(createEmptyDraft());
    setActiveTab('history');
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraft(createEmptyDraft());
    showToast(draft.editingId ? 'Edit cancelled.' : 'Draft cleared.');
  };

  const handleEditWorkout = (workout: Workout) => {
    const convertedExercises = workout.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        weight:
          s.weight.trim() === ''
            ? ''
            : formatNumber(convertWeight(parseNumeric(s.weight), workout.unit, settings.unit)),
      })),
    }));

    setDraft({
      editingId: workout.id,
      title: workout.title,
      date: workout.date,
      exercises: convertedExercises,
    });
    setActiveTab('log');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteWorkout = (workoutId: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    if (draft.editingId === workoutId) {
      clearDraft();
      setDraft(createEmptyDraft());
    }
    showToast('Workout deleted.');
  };

  const handleImportJson = (jsonText: string) => {
    try {
      const imported = parseBackupJson(jsonText);
      setWorkouts((prev) => {
        const byId = new Map<string, Workout>();
        for (const w of prev) byId.set(w.id, w);
        for (const w of imported.workouts) byId.set(w.id, w);
        return Array.from(byId.values()).sort(sortWorkoutsDesc);
      });
      if (imported.settings) {
        setSettings(imported.settings);
      }
      showToast(`Imported ${imported.workouts.length} workout(s)!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import JSON file.';
      showToast(msg, 'error');
    }
  };

  return (
    <div className="min-h-dvh bg-[#0A0C10] text-[#F3F5F8] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0A0C10]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
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
          </div>

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
        {activeTab === 'log' && (
          <LogWorkoutView
            draft={draft}
            unit={settings.unit}
            workouts={workouts}
            onUpdateDraft={setDraft}
            onSaveWorkout={handleSaveWorkout}
            onDiscardDraft={handleDiscardDraft}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            workouts={workouts}
            unit={settings.unit}
            onEditWorkout={handleEditWorkout}
            onDeleteWorkout={handleDeleteWorkout}
          />
        )}

        {activeTab === 'stats' && (
          <StatsView
            workouts={workouts}
            settings={settings}
            onChangeUnit={handleUnitChange}
            onImportJson={handleImportJson}
          />
        )}
      </main>

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
        onChange={setActiveTab}
        draftExerciseCount={draft.exercises.length}
        workoutCount={workouts.length}
      />
    </div>
  );
}
