export type EquipmentType = 'machine' | 'no-machine';
export type EquipmentFilter = 'all' | EquipmentType;
export type WeightUnit = 'lbs' | 'kg';
export type ActiveTab = 'log' | 'history' | 'stats';

export interface SetEntry {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
}

export interface ExerciseEntry {
  id: string;
  name: string;
  equipment: EquipmentType;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  unit: WeightUnit;
  exercises: ExerciseEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutDraft {
  editingId: string | null;
  title: string;
  date: string;
  exercises: ExerciseEntry[];
}

export interface AppSettings {
  unit: WeightUnit;
}

export interface AppBackupPayload {
  version: 1;
  exportedAt: string;
  settings: AppSettings;
  workouts: Workout[];
}

export interface ExerciseSuggestion {
  name: string;
  equipment: EquipmentType;
  usageCount: number;
}

export interface ExerciseProgressPoint {
  date: string;
  workoutId: string;
  workoutTitle: string;
  maxWeight: number;
  bestEst1RM: number;
  totalVolume: number;
  bestSetReps: number;
  bestSetWeight: number;
  totalSets: number;
}
