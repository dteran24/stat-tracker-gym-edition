import { useMemo, useState } from 'react';
import type {
  EquipmentType,
  ExerciseEntry,
  WeightUnit,
  Workout,
  WorkoutDraft,
} from '../types';
import { getExerciseSuggestions, getLastAndPrForExercise } from '../utils/stats';
import { createEmptySet, createId } from '../utils/storage';
import { ExerciseCard } from './ExerciseCard';
import { CheckIcon, DumbbellIcon, MachineIcon, PlusIcon, XIcon } from './Icons';

interface LogWorkoutViewProps {
  draft: WorkoutDraft;
  unit: WeightUnit;
  workouts: Workout[];
  onUpdateDraft: (next: WorkoutDraft) => void;
  onSaveWorkout: () => void;
  onDiscardDraft: () => void;
}

export function LogWorkoutView({
  draft,
  unit,
  workouts,
  onUpdateDraft,
  onSaveWorkout,
  onDiscardDraft,
}: LogWorkoutViewProps) {
  const [exerciseName, setExerciseName] = useState('');
  const [equipment, setEquipment] = useState<EquipmentType>('no-machine');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => getExerciseSuggestions(workouts), [workouts]);

  const filteredSuggestions = useMemo(() => {
    const q = exerciseName.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    return suggestions
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [exerciseName, suggestions]);

  const handleAddExercise = (nameToAdd?: string, equipToAdd?: EquipmentType) => {
    const cleanName = (nameToAdd ?? exerciseName).trim();
    if (!cleanName) return;

    const chosenEquip = equipToAdd ?? equipment;
    const { lastPoint } = getLastAndPrForExercise(
      workouts,
      cleanName,
      chosenEquip,
      unit,
      draft.editingId
    );

    const initialWeight = lastPoint ? String(lastPoint.bestSetWeight) : '';
    const initialReps = lastPoint ? String(lastPoint.bestSetReps) : '';

    const newExercise: ExerciseEntry = {
      id: createId(),
      name: cleanName,
      equipment: chosenEquip,
      sets: [createEmptySet(initialWeight, initialReps)],
    };

    onUpdateDraft({
      ...draft,
      exercises: [...draft.exercises, newExercise],
    });
    setExerciseName('');
    setShowSuggestions(false);
  };

  const handleExerciseChange = (index: number, updated: ExerciseEntry) => {
    const nextExercises = draft.exercises.map((ex, i) => (i === index ? updated : ex));
    onUpdateDraft({ ...draft, exercises: nextExercises });
  };

  const handleRemoveExercise = (index: number) => {
    onUpdateDraft({
      ...draft,
      exercises: draft.exercises.filter((_, i) => i !== index),
    });
  };

  const totalSets = draft.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = draft.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  );

  return (
    <div className="space-y-4 pb-28">
      {/* Editing Existing Workout Banner */}
      {draft.editingId && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#F97316]/15 border border-[#F97316]/35 text-xs text-[#FDBA74]">
          <span className="font-semibold">Editing saved workout</span>
          <button
            type="button"
            onClick={onDiscardDraft}
            className="inline-flex items-center gap-1 font-semibold text-white/90 hover:text-white cursor-pointer"
          >
            <XIcon className="w-3.5 h-3.5" />
            Cancel Edit
          </button>
        </div>
      )}

      {/* Session Meta Card */}
      <section className="card-surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8E98A8]">
            Workout Session
          </h2>
          {draft.exercises.length > 0 && (
            <span className="text-xs font-mono tabular-nums text-[#8E98A8]">
              {draft.exercises.length} ex · {completedSets}/{totalSets} sets
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_9.5rem] gap-2.5">
          <input
            id="workout-title-input"
            type="text"
            placeholder="Session name (e.g. Push Day, Legs)"
            value={draft.title}
            onChange={(e) => onUpdateDraft({ ...draft, title: e.target.value })}
            className="input-field h-11 rounded-xl px-3.5 text-sm font-medium placeholder:text-[#5C6677]"
          />
          <input
            id="workout-date-input"
            type="date"
            aria-label="Workout date"
            value={draft.date}
            onChange={(e) => onUpdateDraft({ ...draft, date: e.target.value })}
            className="input-field h-11 rounded-xl px-3 text-sm font-mono tabular-nums [color-scheme:dark]"
          />
        </div>
      </section>

      {/* Add Exercise Composer */}
      <section className="card-surface rounded-2xl p-4 space-y-3">
        <label
          htmlFor="add-exercise-input"
          className="block text-xs font-bold uppercase tracking-wider text-[#8E98A8]"
        >
          Add Exercise
        </label>

        {/* Equipment Selector */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
          <button
            id="composer-equipment-machine"
            type="button"
            onClick={() => setEquipment('machine')}
            className={`h-10 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              equipment === 'machine'
                ? 'bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/35'
                : 'text-[#8E98A8] hover:text-[#F3F5F8]'
            }`}
          >
            <MachineIcon className="w-4 h-4" />
            Machine
          </button>
          <button
            id="composer-equipment-no-machine"
            type="button"
            onClick={() => setEquipment('no-machine')}
            className={`h-10 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              equipment === 'no-machine'
                ? 'bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30'
                : 'text-[#8E98A8] hover:text-[#F3F5F8]'
            }`}
          >
            <DumbbellIcon className="w-4 h-4" />
            No Machine
          </button>
        </div>

        {/* Input + Add Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddExercise();
          }}
          className="relative flex gap-2"
        >
          <div className="relative flex-1">
            <input
              id="add-exercise-input"
              type="text"
              autoComplete="off"
              placeholder="e.g. Bench Press, Lat Pulldown..."
              value={exerciseName}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Delay so click on suggestion registers cleanly
                setTimeout(() => setShowSuggestions(false), 150);
              }}
              onChange={(e) => {
                setExerciseName(e.target.value);
                setShowSuggestions(true);
              }}
              className="input-field w-full h-11 rounded-xl px-3.5 text-sm font-medium placeholder:text-[#5C6677]"
            />

            {/* Suggestions Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl bg-[#161B24] border border-white/10 shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                {filteredSuggestions.map((item) => (
                  <button
                    key={`${item.name}-${item.equipment}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEquipment(item.equipment);
                      handleAddExercise(item.name, item.equipment);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-sm hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-b-0 cursor-pointer"
                  >
                    <span className="font-medium text-[#F3F5F8] truncate">
                      {item.name}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                        item.equipment === 'machine'
                          ? 'bg-[#F59E0B]/15 text-[#FBBF24]'
                          : 'bg-[#38BDF8]/15 text-[#7DD3FC]'
                      }`}
                    >
                      {item.equipment === 'machine' ? 'Machine' : 'No Machine'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            id="add-exercise-submit"
            type="submit"
            disabled={!exerciseName.trim()}
            className="h-11 px-4 rounded-xl bg-[#F97316] hover:bg-[#FB923C] disabled:bg-[#1E2430] disabled:text-[#5C6677] text-[#0A0C10] font-bold text-sm inline-flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Add
          </button>
        </form>
      </section>

      {/* Active Exercises List */}
      {draft.exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#10141C]/50 px-5 py-9 text-center space-y-2">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-[#1A202B] flex items-center justify-center text-[#F97316]">
            <DumbbellIcon className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-[#F3F5F8]">
            Ready to lift?
          </p>
          <p className="text-xs text-[#8E98A8] max-w-xs mx-auto leading-relaxed">
            Pick <strong className="text-[#FBBF24]">Machine</strong> or{' '}
            <strong className="text-[#7DD3FC]">No Machine</strong> above and add your
            first exercise. Your draft saves automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {draft.exercises.map((exercise, idx) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              unit={unit}
              workouts={workouts}
              excludeWorkoutId={draft.editingId}
              onChange={(updated) => handleExerciseChange(idx, updated)}
              onRemove={() => handleRemoveExercise(idx)}
            />
          ))}

          {/* Save / Clear Action Bar */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              id="discard-workout-btn"
              type="button"
              onClick={onDiscardDraft}
              className="h-12 px-4 rounded-xl bg-[#161B24] hover:bg-[#1E2532] border border-white/10 text-sm font-semibold text-[#8E98A8] hover:text-rose-300 transition-colors cursor-pointer"
            >
              {draft.editingId ? 'Cancel' : 'Clear'}
            </button>
            <button
              id="save-workout-btn"
              type="button"
              onClick={onSaveWorkout}
              className="flex-1 h-12 rounded-xl bg-[#F97316] hover:bg-[#FB923C] text-[#0A0C10] font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-[#F97316]/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <CheckIcon className="w-4 h-4" />
              {draft.editingId ? 'Update Workout' : 'Finish & Save Workout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
