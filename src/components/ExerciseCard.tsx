import type { EquipmentType, ExerciseEntry, SetEntry, WeightUnit, Workout } from '../types';
import { formatNumber, getLastAndPrForExercise } from '../utils/stats';
import { createEmptySet } from '../utils/storage';
import { DumbbellIcon, MachineIcon, PlusIcon, TrashIcon, TrophyIcon } from './Icons';
import { SetRow } from './SetRow';

interface ExerciseCardProps {
  exercise: ExerciseEntry;
  unit: WeightUnit;
  workouts: Workout[];
  excludeWorkoutId?: string | null;
  onChange: (updated: ExerciseEntry) => void;
  onRemove: () => void;
}

export function ExerciseCard({
  exercise,
  unit,
  workouts,
  excludeWorkoutId,
  onChange,
  onRemove,
}: ExerciseCardProps) {
  const { lastPoint, prWeight, prReps } = getLastAndPrForExercise(
    workouts,
    exercise.name,
    exercise.equipment,
    unit,
    excludeWorkoutId
  );

  const handleSetChange = (setIndex: number, updatedSet: SetEntry) => {
    const nextSets = exercise.sets.map((s, i) => (i === setIndex ? updatedSet : s));
    onChange({ ...exercise, sets: nextSets });
  };

  const handleAddSet = () => {
    const prev = exercise.sets[exercise.sets.length - 1];
    const nextSet = createEmptySet(prev?.weight ?? '', prev?.reps ?? '');
    onChange({ ...exercise, sets: [...exercise.sets, nextSet] });
  };

  const handleRemoveSet = (setIndex: number) => {
    if (exercise.sets.length <= 1) return;
    onChange({
      ...exercise,
      sets: exercise.sets.filter((_, i) => i !== setIndex),
    });
  };

  const setEquipment = (equipment: EquipmentType) => {
    if (equipment === exercise.equipment) return;
    onChange({ ...exercise, equipment });
  };

  const completedCount = exercise.sets.filter((s) => s.completed).length;

  return (
    <section className="card-surface rounded-2xl p-4 space-y-3.5 animate-enter">
      {/* Header Row: Exercise Name + Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            aria-label="Exercise name"
            value={exercise.name}
            onChange={(e) => onChange({ ...exercise, name: e.target.value })}
            placeholder="Exercise name..."
            className="w-full bg-transparent text-base font-bold text-[#F3F5F8] placeholder:text-[#5C6677] focus:outline-none border-b border-transparent focus:border-[#F97316]/60 pb-0.5"
          />
          {/* Previous session & PR context */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {lastPoint ? (
              <span className="inline-flex items-center gap-1 text-[#8E98A8] font-mono tabular-nums">
                Last: {formatNumber(lastPoint.bestSetWeight)} {unit} × {lastPoint.bestSetReps}
              </span>
            ) : (
              <span className="text-[#5C6677]">First time logging this variation</span>
            )}
            {prWeight > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#22C55E]/15 text-[#4ADE80] font-mono font-semibold tabular-nums">
                <TrophyIcon className="w-3 h-3" />
                PR {formatNumber(prWeight)} {unit} × {prReps}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${exercise.name || 'exercise'}`}
          className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-[#5C6677] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Equipment Segmented Control: Machine vs No Machine */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setEquipment('machine')}
          className={`h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
            exercise.equipment === 'machine'
              ? 'bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/35'
              : 'text-[#8E98A8] hover:text-[#F3F5F8]'
          }`}
        >
          <MachineIcon className="w-3.5 h-3.5" />
          Machine
        </button>
        <button
          type="button"
          onClick={() => setEquipment('no-machine')}
          className={`h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
            exercise.equipment === 'no-machine'
              ? 'bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30'
              : 'text-[#8E98A8] hover:text-[#F3F5F8]'
          }`}
        >
          <DumbbellIcon className="w-3.5 h-3.5" />
          No Machine
        </button>
      </div>

      {/* Column Labels */}
      <div className="grid grid-cols-[2.25rem_1fr_1fr_2.75rem_2rem] items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#5C6677]">
        <span className="text-center">Set</span>
        <span className="text-center">Weight</span>
        <span className="text-center">Reps</span>
        <span className="text-center">Done</span>
        <span />
      </div>

      {/* Sets */}
      <div className="space-y-2">
        {exercise.sets.map((set, idx) => (
          <SetRow
            key={set.id}
            index={idx}
            set={set}
            unit={unit}
            canRemove={exercise.sets.length > 1}
            onChange={(updated) => handleSetChange(idx, updated)}
            onRemove={() => handleRemoveSet(idx)}
          />
        ))}
      </div>

      {/* Footer: Add Set + Completed Count */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleAddSet}
          className="h-10 px-3.5 rounded-xl bg-[#1A202B] hover:bg-[#232B3A] border border-white/10 text-xs font-semibold text-[#F3F5F8] inline-flex items-center gap-1.5 transition-colors active:scale-[0.98] cursor-pointer"
        >
          <PlusIcon className="w-4 h-4 text-[#F97316]" />
          Add Set
        </button>
        <span className="text-xs font-mono tabular-nums text-[#8E98A8]">
          {completedCount}/{exercise.sets.length} done
        </span>
      </div>
    </section>
  );
}
