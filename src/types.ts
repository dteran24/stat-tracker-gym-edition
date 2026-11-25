export type EquipmentType = 'machine' | 'no-machine';
export type EquipmentFilter = 'all' | EquipmentType;
export type WeightUnit = 'lbs' | 'kg';
export type ActiveTab = 'exercises' | 'stats';
export type ChangeDirection = 'up' | 'down' | 'mixed' | 'same' | 'initial';
export type SortMode = 'recent' | 'name' | 'entries';

export interface StatEntry {
  id: string;
  /** Weight lifted in `unit`, or null for bodyweight / reps-only exercises */
  weight: number | null;
  unit: WeightUnit;
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
