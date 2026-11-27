import type {
  AppSettings,
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightMode,
  WeightUnit,
} from '../src/types.ts';

export function isValidEquipment(val: unknown): val is EquipmentType {
  return val === 'machine' || val === 'no-machine';
}

export function isValidUnit(val: unknown): val is WeightUnit {
  return val === 'lbs' || val === 'kg';
}

export function isValidWeightMode(val: unknown): val is WeightMode | undefined {
  return (
    val === undefined ||
    val === 'direct' ||
    val === 'barbell' ||
    val === 'plates-single' ||
    val === 'plates-dual'
  );
}

export function isValidStatEntry(val: unknown): val is StatEntry {
  if (!val || typeof val !== 'object') return false;
  const e = val as Record<string, unknown>;
  const validWeight =
    e.weight === null ||
    (typeof e.weight === 'number' && Number.isFinite(e.weight) && e.weight >= 0);
  return (
    typeof e.id === 'string' &&
    e.id.trim().length > 0 &&
    validWeight &&
    isValidUnit(e.unit) &&
    (e.weightDetail === undefined || typeof e.weightDetail === 'string') &&
    typeof e.reps === 'number' &&
    Number.isFinite(e.reps) &&
    e.reps > 0 &&
    typeof e.date === 'string' &&
    e.date.trim().length > 0 &&
    (e.note === undefined || typeof e.note === 'string') &&
    typeof e.createdAt === 'number' &&
    Number.isFinite(e.createdAt) &&
    typeof e.updatedAt === 'number' &&
    Number.isFinite(e.updatedAt)
  );
}

export function isValidExercise(val: unknown): val is TrackedExercise {
  if (!val || typeof val !== 'object') return false;
  const ex = val as Record<string, unknown>;
  return (
    typeof ex.id === 'string' &&
    ex.id.trim().length > 0 &&
    typeof ex.name === 'string' &&
    ex.name.trim().length > 0 &&
    isValidEquipment(ex.equipment) &&
    isValidWeightMode(ex.weightMode) &&
    (ex.barWeight === undefined ||
      (typeof ex.barWeight === 'number' &&
        Number.isFinite(ex.barWeight) &&
        ex.barWeight >= 0)) &&
    (ex.barWeightUnit === undefined || isValidUnit(ex.barWeightUnit)) &&
    Array.isArray(ex.entries) &&
    ex.entries.every(isValidStatEntry) &&
    typeof ex.createdAt === 'number' &&
    Number.isFinite(ex.createdAt) &&
    typeof ex.updatedAt === 'number' &&
    Number.isFinite(ex.updatedAt)
  );
}

export function parseSettingsInput(val: unknown): AppSettings | null {
  if (!val || typeof val !== 'object') return null;
  const obj = val as { unit?: unknown };
  if (!isValidUnit(obj.unit)) return null;
  return { unit: obj.unit };
}
