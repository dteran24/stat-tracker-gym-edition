import type {
  AppBackupPayload,
  AppSettings,
  EquipmentType,
  ExerciseEntry,
  SetEntry,
  WeightUnit,
  Workout,
  WorkoutDraft,
} from '../types';

const WORKOUTS_KEY = 'gym_stat_tracker_workouts_v1';
const SETTINGS_KEY = 'gym_stat_tracker_settings_v1';
const DRAFT_KEY = 'gym_stat_tracker_draft_v1';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptySet(weight = '', reps = ''): SetEntry {
  return {
    id: createId(),
    weight,
    reps,
    completed: false,
  };
}

export function createEmptyDraft(): WorkoutDraft {
  return {
    editingId: null,
    title: '',
    date: getTodayIso(),
    exercises: [],
  };
}

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidWorkout).sort(sortWorkoutsDesc);
  } catch {
    return [];
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
  } catch {
    // Ignore storage quota / private mode errors gracefully
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { unit: 'lbs' };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      unit: parsed.unit === 'kg' ? 'kg' : 'lbs',
    };
  } catch {
    return { unit: 'lbs' };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function loadDraft(): WorkoutDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return createEmptyDraft();
    const parsed = JSON.parse(raw) as Partial<WorkoutDraft>;
    if (!parsed || !Array.isArray(parsed.exercises)) return createEmptyDraft();
    return {
      editingId: typeof parsed.editingId === 'string' ? parsed.editingId : null,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      date: typeof parsed.date === 'string' && parsed.date ? parsed.date : getTodayIso(),
      exercises: parsed.exercises.filter(isValidExercise),
    };
  } catch {
    return createEmptyDraft();
  }
}

export function saveDraft(draft: WorkoutDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage errors
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function exportBackupJson(workouts: Workout[], settings: AppSettings): string {
  const payload: AppBackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    workouts,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseBackupJson(rawText: string): {
  workouts: Workout[];
  settings?: AppSettings;
} {
  const parsed: unknown = JSON.parse(rawText);

  if (Array.isArray(parsed)) {
    const valid = parsed.filter(isValidWorkout);
    if (valid.length === 0 && parsed.length > 0) {
      throw new Error('No valid workouts found in file.');
    }
    return { workouts: valid.sort(sortWorkoutsDesc) };
  }

  if (parsed && typeof parsed === 'object' && 'workouts' in parsed) {
    const obj = parsed as { workouts?: unknown; settings?: { unit?: unknown } };
    if (!Array.isArray(obj.workouts)) {
      throw new Error('Invalid backup format: workouts must be an array.');
    }
    const valid = obj.workouts.filter(isValidWorkout);
    if (valid.length === 0 && obj.workouts.length > 0) {
      throw new Error('Backup file contained unrecognized workout entries.');
    }
    const unit: WeightUnit | undefined =
      obj.settings?.unit === 'kg'
        ? 'kg'
        : obj.settings?.unit === 'lbs'
          ? 'lbs'
          : undefined;
    return {
      workouts: valid.sort(sortWorkoutsDesc),
      settings: unit ? { unit } : undefined,
    };
  }

  throw new Error('Unrecognized JSON backup structure.');
}

export function sortWorkoutsDesc(a: Workout, b: Workout): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.createdAt - a.createdAt;
}

function isValidEquipment(val: unknown): val is EquipmentType {
  return val === 'machine' || val === 'no-machine';
}

function isValidSet(val: unknown): val is SetEntry {
  if (!val || typeof val !== 'object') return false;
  const s = val as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.weight === 'string' &&
    typeof s.reps === 'string' &&
    typeof s.completed === 'boolean'
  );
}

function isValidExercise(val: unknown): val is ExerciseEntry {
  if (!val || typeof val !== 'object') return false;
  const e = val as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    isValidEquipment(e.equipment) &&
    Array.isArray(e.sets) &&
    e.sets.every(isValidSet)
  );
}

function isValidWorkout(val: unknown): val is Workout {
  if (!val || typeof val !== 'object') return false;
  const w = val as Record<string, unknown>;
  return (
    typeof w.id === 'string' &&
    typeof w.title === 'string' &&
    typeof w.date === 'string' &&
    (w.unit === 'lbs' || w.unit === 'kg') &&
    Array.isArray(w.exercises) &&
    w.exercises.every(isValidExercise) &&
    typeof w.createdAt === 'number' &&
    typeof w.updatedAt === 'number'
  );
}
