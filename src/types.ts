export type EquipmentType = 'machine' | 'no-machine';
export type EquipmentFilter = 'all' | EquipmentType;
export type WeightUnit = 'lbs' | 'kg';
export type WeightMode = 'direct' | 'barbell' | 'plates-single' | 'plates-dual';
export type ActiveTab = 'exercises' | 'stats';
export type ChangeDirection = 'up' | 'down' | 'mixed' | 'same' | 'initial';
export type SortMode = 'recent' | 'name' | 'entries';

export interface StatEntry {
  id: string;
  /** Total weight lifted in `unit`, or null for bodyweight / reps-only exercises */
  weight: number | null;
  unit: WeightUnit;
  /** Optional human-readable breakdown (e.g. "45 + 45 / side + 45 bar" or "45 + 45") */
  weightDetail?: string;
  reps: number;
  /** YYYY-MM-DD date when this stat was recorded/updated */
  date: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TrackedExercise {
  id: string;
  name: string;
  equipment: EquipmentType;
  /** How entered weights are calculated (defaults to 'direct') */
  weightMode?: WeightMode;
  /** Bar weight used when weightMode === 'barbell' (defaults to 45 lbs / 20 kg) */
  barWeight?: number;
  barWeightUnit?: WeightUnit;
  /** Sorted newest-first by date desc, then createdAt desc */
  entries: StatEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface EntryComparison {
  direction: ChangeDirection;
  /** Difference in displayUnit (null if either entry is bodyweight) */
  weightDelta: number | null;
  repsDelta: number;
  /** Set when switching between bodyweight and weighted */
  weightTransition?: 'added-weight' | 'to-bodyweight';
}

export interface AppSettings {
  unit: WeightUnit;
}

export interface AppBackupPayload {
  version: 2;
  exportedAt: string;
  settings: AppSettings;
  exercises: TrackedExercise[];
}
