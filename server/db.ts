import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  AppSettings,
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightMode,
  WeightUnit,
} from '../src/types.ts';

export const DEFAULT_USER_ID = 'local-user';

let cachedDb: { path: string; instance: DatabaseSync } | null = null;

export function getDbPath(): string {
  return (
    process.env.STAT_TRACKER_DB_PATH ||
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), 'data', 'stat-tracker.db')
  );
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      unit TEXT NOT NULL DEFAULT 'lbs',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      equipment TEXT NOT NULL,
      weight_mode TEXT,
      bar_weight REAL,
      bar_weight_unit TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, id)
    );

    CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises (user_id);

    CREATE TABLE IF NOT EXISTS stat_entries (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      weight REAL,
      unit TEXT NOT NULL,
      weight_detail TEXT,
      reps INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, id),
      FOREIGN KEY (user_id, exercise_id)
        REFERENCES exercises (user_id, id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stat_entries_user_exercise
      ON stat_entries (user_id, exercise_id);
  `);
}

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  initSchema(db);
  return db;
}

export function getDb(): DatabaseSync {
  const dbPath = getDbPath();
  if (cachedDb && cachedDb.path === dbPath) {
    return cachedDb.instance;
  }
  if (cachedDb) {
    try {
      cachedDb.instance.close();
    } catch {
      // Ignore close error on path swap
    }
  }
  const instance = openDatabase(dbPath);
  cachedDb = { path: dbPath, instance };
  return instance;
}

export function closeDb(): void {
  if (cachedDb) {
    try {
      cachedDb.instance.close();
    } catch {
      // Ignore close errors
    }
    cachedDb = null;
  }
}

interface ExerciseRow {
  id: string;
  name: string;
  equipment: EquipmentType;
  weight_mode: WeightMode | null;
  bar_weight: number | null;
  bar_weight_unit: WeightUnit | null;
  created_at: number;
  updated_at: number;
}

interface StatEntryRow {
  id: string;
  exercise_id: string;
  weight: number | null;
  unit: WeightUnit;
  weight_detail: string | null;
  reps: number;
  date: string;
  note: string | null;
  created_at: number;
  updated_at: number;
}

function sortEntriesDesc(a: StatEntry, b: StatEntry): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.createdAt - a.createdAt;
}

function sortExercisesRecentDesc(a: TrackedExercise, b: TrackedExercise): number {
  const aDate = a.entries[0]?.date ?? '';
  const bDate = b.entries[0]?.date ?? '';
  if (aDate !== bDate) return bDate.localeCompare(aDate);
  return b.updatedAt - a.updatedAt;
}

export function getUserSettings(db: DatabaseSync, userId: string): AppSettings {
  const row = db
    .prepare('SELECT unit FROM user_settings WHERE user_id = ?')
    .get(userId) as { unit?: string } | undefined;
  return {
    unit: row?.unit === 'kg' ? 'kg' : 'lbs',
  };
}

export function saveUserSettings(
  db: DatabaseSync,
  userId: string,
  settings: AppSettings
): AppSettings {
  const unit: WeightUnit = settings.unit === 'kg' ? 'kg' : 'lbs';
  const now = Date.now();
  db.prepare(
    `INSERT INTO user_settings (user_id, unit, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET unit = excluded.unit, updated_at = excluded.updated_at`
  ).run(userId, unit, now);
  return { unit };
}

export function getUserExercises(db: DatabaseSync, userId: string): TrackedExercise[] {
  const exerciseRows = db
    .prepare(
      `SELECT id, name, equipment, weight_mode, bar_weight, bar_weight_unit, created_at, updated_at
       FROM exercises
       WHERE user_id = ?`
    )
    .all(userId) as unknown as ExerciseRow[];

  const entryRows = db
    .prepare(
      `SELECT id, exercise_id, weight, unit, weight_detail, reps, date, note, created_at, updated_at
       FROM stat_entries
       WHERE user_id = ?`
    )
    .all(userId) as unknown as StatEntryRow[];

  const entriesByExercise = new Map<string, StatEntry[]>();
  for (const row of entryRows) {
    const entry: StatEntry = {
      id: row.id,
      weight: row.weight,
      unit: row.unit,
      ...(row.weight_detail !== null ? { weightDetail: row.weight_detail } : {}),
      reps: row.reps,
      date: row.date,
      ...(row.note !== null ? { note: row.note } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    const list = entriesByExercise.get(row.exercise_id);
    if (list) {
      list.push(entry);
    } else {
      entriesByExercise.set(row.exercise_id, [entry]);
    }
  }

  const exercises: TrackedExercise[] = exerciseRows.map((row) => {
    const entries = (entriesByExercise.get(row.id) ?? []).sort(sortEntriesDesc);
    return {
      id: row.id,
      name: row.name,
      equipment: row.equipment,
      ...(row.weight_mode !== null ? { weightMode: row.weight_mode } : {}),
      ...(row.bar_weight !== null ? { barWeight: row.bar_weight } : {}),
      ...(row.bar_weight_unit !== null ? { barWeightUnit: row.bar_weight_unit } : {}),
      entries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return exercises.sort(sortExercisesRecentDesc);
}

export function getUserState(
  db: DatabaseSync,
  userId: string
): { exercises: TrackedExercise[]; settings: AppSettings } {
  return {
    exercises: getUserExercises(db, userId),
    settings: getUserSettings(db, userId),
  };
}

function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    throw err;
  }
}

export function createExerciseRecord(
  db: DatabaseSync,
  userId: string,
  exercise: TrackedExercise
): void {
  runInTransaction(db, () => {
    db.prepare(
      `INSERT INTO exercises
        (user_id, id, name, equipment, weight_mode, bar_weight, bar_weight_unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET
        name = excluded.name,
        equipment = excluded.equipment,
        weight_mode = excluded.weight_mode,
        bar_weight = excluded.bar_weight,
        bar_weight_unit = excluded.bar_weight_unit,
        updated_at = excluded.updated_at`
    ).run(
      userId,
      exercise.id,
      exercise.name,
      exercise.equipment,
      exercise.weightMode ?? null,
      exercise.barWeight ?? null,
      exercise.barWeightUnit ?? null,
      exercise.createdAt,
      exercise.updatedAt
    );

    const insertEntry = db.prepare(
      `INSERT INTO stat_entries
        (user_id, id, exercise_id, weight, unit, weight_detail, reps, date, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET
        weight = excluded.weight,
        unit = excluded.unit,
        weight_detail = excluded.weight_detail,
        reps = excluded.reps,
        date = excluded.date,
        note = excluded.note,
        updated_at = excluded.updated_at`
    );

    for (const entry of exercise.entries) {
      insertEntry.run(
        userId,
        entry.id,
        exercise.id,
        entry.weight,
        entry.unit,
        entry.weightDetail ?? null,
        entry.reps,
        entry.date,
        entry.note ?? null,
        entry.createdAt,
        entry.updatedAt
      );
    }
  });
}

export function updateExerciseRecord(
  db: DatabaseSync,
  userId: string,
  exerciseId: string,
  patch: {
    name: string;
    equipment: EquipmentType;
    weightMode?: WeightMode;
    barWeight?: number;
    barWeightUnit?: WeightUnit;
    updatedAt: number;
  }
): boolean {
  const result = db
    .prepare(
      `UPDATE exercises
       SET name = ?, equipment = ?, weight_mode = ?, bar_weight = ?, bar_weight_unit = ?, updated_at = ?
       WHERE user_id = ? AND id = ?`
    )
    .run(
      patch.name,
      patch.equipment,
      patch.weightMode ?? null,
      patch.barWeight ?? null,
      patch.barWeightUnit ?? null,
      patch.updatedAt,
      userId,
      exerciseId
    );
  return Number(result.changes) > 0;
}

export function deleteExerciseRecord(
  db: DatabaseSync,
  userId: string,
  exerciseId: string
): boolean {
  const result = db
    .prepare('DELETE FROM exercises WHERE user_id = ? AND id = ?')
    .run(userId, exerciseId);
  return Number(result.changes) > 0;
}

export function addEntryRecord(
  db: DatabaseSync,
  userId: string,
  exerciseId: string,
  entry: StatEntry,
  exerciseMeta?: {
    weightMode?: WeightMode;
    barWeight?: number;
    barWeightUnit?: WeightUnit;
    updatedAt: number;
  }
): boolean {
  return runInTransaction(db, () => {
    const existing = db
      .prepare('SELECT id FROM exercises WHERE user_id = ? AND id = ?')
      .get(userId, exerciseId);
    if (!existing) return false;

    db.prepare(
      `INSERT INTO stat_entries
        (user_id, id, exercise_id, weight, unit, weight_detail, reps, date, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET
        weight = excluded.weight,
        unit = excluded.unit,
        weight_detail = excluded.weight_detail,
        reps = excluded.reps,
        date = excluded.date,
        note = excluded.note,
        updated_at = excluded.updated_at`
    ).run(
      userId,
      entry.id,
      exerciseId,
      entry.weight,
      entry.unit,
      entry.weightDetail ?? null,
      entry.reps,
      entry.date,
      entry.note ?? null,
      entry.createdAt,
      entry.updatedAt
    );

    if (exerciseMeta) {
      db.prepare(
        `UPDATE exercises
         SET weight_mode = ?, bar_weight = ?, bar_weight_unit = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`
      ).run(
        exerciseMeta.weightMode ?? null,
        exerciseMeta.barWeight ?? null,
        exerciseMeta.barWeightUnit ?? null,
        exerciseMeta.updatedAt,
        userId,
        exerciseId
      );
    } else {
      db.prepare('UPDATE exercises SET updated_at = ? WHERE user_id = ? AND id = ?').run(
        entry.updatedAt,
        userId,
        exerciseId
      );
    }

    return true;
  });
}

export function updateEntryRecord(
  db: DatabaseSync,
  userId: string,
  exerciseId: string,
  entryId: string,
  patch: {
    weight: number | null;
    unit: WeightUnit;
    weightDetail?: string;
    reps: number;
    date: string;
    note?: string;
    updatedAt: number;
  }
): boolean {
  return runInTransaction(db, () => {
    const result = db
      .prepare(
        `UPDATE stat_entries
         SET weight = ?, unit = ?, weight_detail = ?, reps = ?, date = ?, note = ?, updated_at = ?
         WHERE user_id = ? AND exercise_id = ? AND id = ?`
      )
      .run(
        patch.weight,
        patch.unit,
        patch.weightDetail ?? null,
        patch.reps,
        patch.date,
        patch.note ?? null,
        patch.updatedAt,
        userId,
        exerciseId,
        entryId
      );

    if (Number(result.changes) === 0) return false;

    db.prepare('UPDATE exercises SET updated_at = ? WHERE user_id = ? AND id = ?').run(
      patch.updatedAt,
      userId,
      exerciseId
    );
    return true;
  });
}

export function deleteEntryRecord(
  db: DatabaseSync,
  userId: string,
  exerciseId: string,
  entryId: string,
  updatedAt: number
): boolean {
  return runInTransaction(db, () => {
    const result = db
      .prepare('DELETE FROM stat_entries WHERE user_id = ? AND exercise_id = ? AND id = ?')
      .run(userId, exerciseId, entryId);
    if (Number(result.changes) === 0) return false;

    db.prepare('UPDATE exercises SET updated_at = ? WHERE user_id = ? AND id = ?').run(
      updatedAt,
      userId,
      exerciseId
    );
    return true;
  });
}

export function mergeImportState(
  db: DatabaseSync,
  userId: string,
  incomingExercises: TrackedExercise[],
  incomingSettings?: AppSettings
): { exercises: TrackedExercise[]; settings: AppSettings } {
  runInTransaction(db, () => {
    const upsertExercise = db.prepare(
      `INSERT INTO exercises
        (user_id, id, name, equipment, weight_mode, bar_weight, bar_weight_unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET
        name = excluded.name,
        equipment = excluded.equipment,
        weight_mode = excluded.weight_mode,
        bar_weight = excluded.bar_weight,
        bar_weight_unit = excluded.bar_weight_unit,
        created_at = MIN(exercises.created_at, excluded.created_at),
        updated_at = MAX(exercises.updated_at, excluded.updated_at)`
    );

    const upsertEntry = db.prepare(
      `INSERT INTO stat_entries
        (user_id, id, exercise_id, weight, unit, weight_detail, reps, date, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET
        weight = excluded.weight,
        unit = excluded.unit,
        weight_detail = excluded.weight_detail,
        reps = excluded.reps,
        date = excluded.date,
        note = excluded.note,
        updated_at = MAX(stat_entries.updated_at, excluded.updated_at)`
    );

    for (const ex of incomingExercises) {
      upsertExercise.run(
        userId,
        ex.id,
        ex.name,
        ex.equipment,
        ex.weightMode ?? null,
        ex.barWeight ?? null,
        ex.barWeightUnit ?? null,
        ex.createdAt,
        ex.updatedAt
      );

      for (const entry of ex.entries) {
        upsertEntry.run(
          userId,
          entry.id,
          ex.id,
          entry.weight,
          entry.unit,
          entry.weightDetail ?? null,
          entry.reps,
          entry.date,
          entry.note ?? null,
          entry.createdAt,
          entry.updatedAt
        );
      }
    }

    if (incomingSettings) {
      saveUserSettings(db, userId, incomingSettings);
    }
  });

  return getUserState(db, userId);
}
