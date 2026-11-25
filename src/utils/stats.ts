import type {
  EquipmentFilter,
  EquipmentType,
  ExerciseEntry,
  ExerciseProgressPoint,
  ExerciseSuggestion,
  SetEntry,
  WeightUnit,
  Workout,
} from '../types';

const KG_PER_LB = 0.45359237;

export const STARTER_EXERCISES: Array<{ name: string; equipment: EquipmentType }> = [
  { name: 'Bench Press', equipment: 'no-machine' },
  { name: 'Incline Dumbbell Press', equipment: 'no-machine' },
  { name: 'Chest Press', equipment: 'machine' },
  { name: 'Pec Deck / Chest Fly', equipment: 'machine' },
  { name: 'Lat Pulldown', equipment: 'machine' },
  { name: 'Seated Cable Row', equipment: 'machine' },
  { name: 'Barbell Squat', equipment: 'no-machine' },
  { name: 'Leg Press', equipment: 'machine' },
  { name: 'Leg Extension', equipment: 'machine' },
  { name: 'Hamstring Curl', equipment: 'machine' },
  { name: 'Romanian Deadlift', equipment: 'no-machine' },
  { name: 'Overhead Press', equipment: 'no-machine' },
  { name: 'Lateral Raise', equipment: 'no-machine' },
  { name: 'Dumbbell Bicep Curl', equipment: 'no-machine' },
  { name: 'Tricep Rope Pushdown', equipment: 'machine' },
  { name: 'Pull-Up', equipment: 'no-machine' },
];

export function normalizeExerciseKey(name: string, equipment: EquipmentType): string {
  return `${name.trim().toLowerCase()}::${equipment}`;
}

export function parseNumeric(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function convertWeight(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) return value;
  const converted = fromUnit === 'lbs' ? value * KG_PER_LB : value / KG_PER_LB;
  return Math.round(converted * 10) / 10;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatVolume(value: number): string {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return Math.round(value).toLocaleString();
}

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatFullDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function calculateEst1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function getSetVolume(set: SetEntry): number {
  const w = parseNumeric(set.weight);
  const r = parseNumeric(set.reps);
  return w * r;
}

export function getWorkoutStats(workout: Workout, displayUnit: WeightUnit): {
  exerciseCount: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  hasMachine: boolean;
  hasNoMachine: boolean;
} {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let hasMachine = false;
  let hasNoMachine = false;

  for (const ex of workout.exercises) {
    if (ex.equipment === 'machine') hasMachine = true;
    else hasNoMachine = true;

    for (const s of ex.sets) {
      const r = parseNumeric(s.reps);
      const w = convertWeight(parseNumeric(s.weight), workout.unit, displayUnit);
      if (r > 0 || w > 0) {
        totalSets += 1;
        totalReps += r;
        totalVolume += w * r;
      }
    }
  }

  return {
    exerciseCount: workout.exercises.length,
    totalSets,
    totalReps,
    totalVolume: Math.round(totalVolume),
    hasMachine,
    hasNoMachine,
  };
}

export function getExerciseProgressSeries(
  workouts: Workout[],
  exerciseName: string,
  equipment: EquipmentType,
  displayUnit: WeightUnit,
  excludeWorkoutId?: string | null
): ExerciseProgressPoint[] {
  const targetKey = normalizeExerciseKey(exerciseName, equipment);
  const points: ExerciseProgressPoint[] = [];

  for (const workout of workouts) {
    if (excludeWorkoutId && workout.id === excludeWorkoutId) continue;

    const matching = workout.exercises.filter(
      (ex) => normalizeExerciseKey(ex.name, ex.equipment) === targetKey
    );
    if (matching.length === 0) continue;

    let maxWeight = 0;
    let bestEst1RM = 0;
    let totalVolume = 0;
    let bestSetWeight = 0;
    let bestSetReps = 0;
    let totalSets = 0;

    for (const ex of matching) {
      for (const s of ex.sets) {
        const rawW = parseNumeric(s.weight);
        const r = parseNumeric(s.reps);
        if (r <= 0 && rawW <= 0) continue;

        const w = convertWeight(rawW, workout.unit, displayUnit);
        totalSets += 1;
        totalVolume += w * r;

        if (w > maxWeight || (w === maxWeight && r > bestSetReps)) {
          maxWeight = w;
          bestSetWeight = w;
          bestSetReps = r;
        }

        const e1rm = calculateEst1RM(w, r);
        if (e1rm > bestEst1RM) {
          bestEst1RM = e1rm;
        }
      }
    }

    if (totalSets > 0) {
      points.push({
        date: workout.date,
        workoutId: workout.id,
        workoutTitle: workout.title,
        maxWeight,
        bestEst1RM,
        totalVolume: Math.round(totalVolume),
        bestSetReps,
        bestSetWeight,
        totalSets,
      });
    }
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export function getLastAndPrForExercise(
  workouts: Workout[],
  exerciseName: string,
  equipment: EquipmentType,
  displayUnit: WeightUnit,
  excludeWorkoutId?: string | null
): {
  lastPoint: ExerciseProgressPoint | null;
  prWeight: number;
  prReps: number;
} {
  if (!exerciseName.trim()) {
    return { lastPoint: null, prWeight: 0, prReps: 0 };
  }
  const series = getExerciseProgressSeries(
    workouts,
    exerciseName,
    equipment,
    displayUnit,
    excludeWorkoutId
  );
  if (series.length === 0) {
    return { lastPoint: null, prWeight: 0, prReps: 0 };
  }

  const lastPoint = series[series.length - 1];
  let prWeight = 0;
  let prReps = 0;
  for (const pt of series) {
    if (pt.maxWeight > prWeight || (pt.maxWeight === prWeight && pt.bestSetReps > prReps)) {
      prWeight = pt.maxWeight;
      prReps = pt.bestSetReps;
    }
  }
  return { lastPoint, prWeight, prReps };
}

export function getExerciseSuggestions(workouts: Workout[]): ExerciseSuggestion[] {
  const map = new Map<string, ExerciseSuggestion>();

  for (const w of workouts) {
    for (const ex of w.exercises) {
      const trimmed = ex.name.trim();
      if (!trimmed) continue;
      const key = normalizeExerciseKey(trimmed, ex.equipment);
      const existing = map.get(key);
      if (existing) {
        existing.usageCount += 1;
      } else {
        map.set(key, {
          name: trimmed,
          equipment: ex.equipment,
          usageCount: 1,
        });
      }
    }
  }

  for (const starter of STARTER_EXERCISES) {
    const key = normalizeExerciseKey(starter.name, starter.equipment);
    if (!map.has(key)) {
      map.set(key, {
        name: starter.name,
        equipment: starter.equipment,
        usageCount: 0,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.name.localeCompare(b.name);
  });
}

export function getTrackedExercises(
  workouts: Workout[],
  filter: EquipmentFilter
): ExerciseSuggestion[] {
  const map = new Map<string, ExerciseSuggestion>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (filter !== 'all' && ex.equipment !== filter) continue;
      const trimmed = ex.name.trim();
      if (!trimmed) continue;
      const key = normalizeExerciseKey(trimmed, ex.equipment);
      const existing = map.get(key);
      if (existing) {
        existing.usageCount += 1;
      } else {
        map.set(key, {
          name: trimmed,
          equipment: ex.equipment,
          usageCount: 1,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.name.localeCompare(b.name);
  });
}

export function getDisplaySetWeight(
  set: SetEntry,
  workoutUnit: WeightUnit,
  displayUnit: WeightUnit
): string {
  const n = parseNumeric(set.weight);
  if (set.weight.trim() === '') return '0';
  return formatNumber(convertWeight(n, workoutUnit, displayUnit));
}

export function getExerciseTotalVolume(
  exercise: ExerciseEntry,
  workoutUnit: WeightUnit,
  displayUnit: WeightUnit
): number {
  let vol = 0;
  for (const s of exercise.sets) {
    const w = convertWeight(parseNumeric(s.weight), workoutUnit, displayUnit);
    const r = parseNumeric(s.reps);
    vol += w * r;
  }
  return Math.round(vol);
}
