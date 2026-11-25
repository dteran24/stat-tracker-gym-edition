import type {
  AppBackupPayload,
  AppSettings,
  DriveSyncCache,
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightUnit,
} from '../types';

const EXERCISES_KEY = 'gym_stat_tracker_exercises_v2';
const SETTINGS_KEY = 'gym_stat_tracker_settings_v1';
const DRIVE_FOLDER_ID_KEY = 'gym_stat_tracker_drive_folder_id_v1';
const DRIVE_FILE_ID_KEY = 'gym_stat_tracker_drive_file_id_v1';
const DRIVE_LAST_SYNCED_AT_KEY = 'gym_stat_tracker_last_drive_synced_at_v1';

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

export function sortEntriesDesc(a: StatEntry, b: StatEntry): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.createdAt - a.createdAt;
}

export function sortExercisesRecentDesc(
  a: TrackedExercise,
  b: TrackedExercise
): number {
  const aDate = a.entries[0]?.date ?? '';
  const bDate = b.entries[0]?.date ?? '';
  if (aDate !== bDate) return bDate.localeCompare(aDate);
  return b.updatedAt - a.updatedAt;
}

export function loadExercises(): TrackedExercise[] {
  try {
    const raw = localStorage.getItem(EXERCISES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidExercise)
      .map((ex) => ({
        ...ex,
        entries: [...ex.entries].sort(sortEntriesDesc),
      }))
      .sort(sortExercisesRecentDesc);
  } catch {
    return [];
  }
}

export function saveExercises(exercises: TrackedExercise[]): void {
  try {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify(exercises));
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

export function loadDriveSyncCache(): DriveSyncCache {
  try {
    return {
      folderId: localStorage.getItem(DRIVE_FOLDER_ID_KEY),
      fileId: localStorage.getItem(DRIVE_FILE_ID_KEY),
      lastDriveSyncedAt: localStorage.getItem(DRIVE_LAST_SYNCED_AT_KEY),
    };
  } catch {
    return {
      folderId: null,
      fileId: null,
      lastDriveSyncedAt: null,
    };
  }
}

export function saveDriveFolderId(folderId: string | null): void {
  try {
    if (folderId) {
      localStorage.setItem(DRIVE_FOLDER_ID_KEY, folderId);
    } else {
      localStorage.removeItem(DRIVE_FOLDER_ID_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function saveDriveFileId(fileId: string | null): void {
  try {
    if (fileId) {
      localStorage.setItem(DRIVE_FILE_ID_KEY, fileId);
    } else {
      localStorage.removeItem(DRIVE_FILE_ID_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function saveLastDriveSyncedAt(isoTimestamp: string | null): void {
  try {
    if (isoTimestamp) {
      localStorage.setItem(DRIVE_LAST_SYNCED_AT_KEY, isoTimestamp);
    } else {
      localStorage.removeItem(DRIVE_LAST_SYNCED_AT_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearDriveSyncCache(): void {
  saveDriveFolderId(null);
  saveDriveFileId(null);
  saveLastDriveSyncedAt(null);
}

export function exportBackupJson(
  exercises: TrackedExercise[],
  settings: AppSettings
): string {
  const payload: AppBackupPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    exercises,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseBackupJson(rawText: string): {
  exercises: TrackedExercise[];
  settings?: AppSettings;
} {
  const parsed: unknown = JSON.parse(rawText);

  if (Array.isArray(parsed)) {
    const valid = parsed.filter(isValidExercise).map((ex) => ({
      ...ex,
      entries: [...ex.entries].sort(sortEntriesDesc),
    }));
    if (valid.length === 0 && parsed.length > 0) {
      throw new Error('No valid workouts found in file.');
    }
    return { exercises: valid.sort(sortExercisesRecentDesc) };
  }

  if (parsed && typeof parsed === 'object' && 'exercises' in parsed) {
    const obj = parsed as { exercises?: unknown; settings?: { unit?: unknown } };
    if (!Array.isArray(obj.exercises)) {
      throw new Error('Invalid backup format: exercises must be an array.');
    }
    const valid = obj.exercises.filter(isValidExercise).map((ex) => ({
      ...ex,
      entries: [...ex.entries].sort(sortEntriesDesc),
    }));
    if (valid.length === 0 && obj.exercises.length > 0) {
      throw new Error('Backup file contained unrecognized workout entries.');
    }
    const unit: WeightUnit | undefined =
      obj.settings?.unit === 'kg'
        ? 'kg'
        : obj.settings?.unit === 'lbs'
          ? 'lbs'
          : undefined;
    return {
      exercises: valid.sort(sortExercisesRecentDesc),
      settings: unit ? { unit } : undefined,
    };
  }

  throw new Error('Unrecognized JSON backup structure.');
}

function isValidEquipment(val: unknown): val is EquipmentType {
  return val === 'machine' || val === 'no-machine';
}

function isValidUnit(val: unknown): val is WeightUnit {
  return val === 'lbs' || val === 'kg';
}

function isValidWeightMode(val: unknown): boolean {
  return (
    val === undefined ||
    val === 'direct' ||
    val === 'barbell' ||
    val === 'plates-single' ||
    val === 'plates-dual'
  );
}

function isValidStatEntry(val: unknown): val is StatEntry {
  if (!val || typeof val !== 'object') return false;
  const e = val as Record<string, unknown>;
  const validWeight =
    e.weight === null ||
    (typeof e.weight === 'number' && Number.isFinite(e.weight) && e.weight >= 0);
  return (
    typeof e.id === 'string' &&
    validWeight &&
    isValidUnit(e.unit) &&
    (e.weightDetail === undefined || typeof e.weightDetail === 'string') &&
    typeof e.reps === 'number' &&
    Number.isFinite(e.reps) &&
    e.reps > 0 &&
    typeof e.date === 'string' &&
    e.date.length > 0 &&
    (e.note === undefined || typeof e.note === 'string') &&
    typeof e.createdAt === 'number' &&
    typeof e.updatedAt === 'number'
  );
}

function isValidExercise(val: unknown): val is TrackedExercise {
  if (!val || typeof val !== 'object') return false;
  const ex = val as Record<string, unknown>;
  return (
    typeof ex.id === 'string' &&
    typeof ex.name === 'string' &&
    ex.name.trim().length > 0 &&
    isValidEquipment(ex.equipment) &&
    isValidWeightMode(ex.weightMode) &&
    (ex.barWeight === undefined ||
      (typeof ex.barWeight === 'number' && Number.isFinite(ex.barWeight) && ex.barWeight >= 0)) &&
    (ex.barWeightUnit === undefined || isValidUnit(ex.barWeightUnit)) &&
    Array.isArray(ex.entries) &&
    ex.entries.every(isValidStatEntry) &&
    typeof ex.createdAt === 'number' &&
    typeof ex.updatedAt === 'number'
  );
}
