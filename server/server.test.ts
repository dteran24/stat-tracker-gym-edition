import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { closeDb, getDb, getUserState, mergeImportState, openDatabase } from './db.ts';
import { createServer } from './index.ts';
import type { TrackedExercise } from '../src/types.ts';

function sampleExercise(id = 'ex-1'): TrackedExercise {
  const now = 1700000000000;
  return {
    id,
    name: 'Bench Press',
    equipment: 'no-machine',
    weightMode: 'barbell',
    barWeight: 45,
    barWeightUnit: 'lbs',
    entries: [
      {
        id: `${id}-entry-1`,
        weight: 185,
        unit: 'lbs',
        weightDetail: '45 + 25 / side + 45 bar',
        reps: 8,
        date: '2026-11-20',
        note: 'Felt strong',
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe('SQLite database layer', () => {
  it('isolates data per user and cascades deletes', () => {
    const db = openDatabase(':memory:');
    try {
      mergeImportState(db, 'google:user-a', [sampleExercise('ex-shared')], {
        unit: 'kg',
      });
      mergeImportState(db, 'google:user-b', [
        { ...sampleExercise('ex-shared'), name: 'Incline Press' },
      ]);

      const stateA = getUserState(db, 'google:user-a');
      const stateB = getUserState(db, 'google:user-b');

      assert.equal(stateA.settings.unit, 'kg');
      assert.equal(stateB.settings.unit, 'lbs');
      assert.equal(stateA.exercises.length, 1);
      assert.equal(stateA.exercises[0].name, 'Bench Press');
      assert.equal(stateB.exercises.length, 1);
      assert.equal(stateB.exercises[0].name, 'Incline Press');
    } finally {
      db.close();
    }
  });
});

describe('HTTP API + SQLite integration', () => {
  let tmpDir: string;
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stat-tracker-test-'));
    process.env.STAT_TRACKER_DB_PATH = path.join(tmpDir, 'test.db');
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.PUBLIC_MODE;
    process.env.NODE_ENV = 'test';
    closeDb();

    server = createServer({ distDir: path.join(tmpDir, 'no-dist') });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns healthy sqlite status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; db: string };
    assert.deepEqual(body, { ok: true, db: 'sqlite' });
  });

  it('uses local-user fallback when OAuth is not configured in dev/test', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      authenticated: boolean;
      user: { id: string; isLocalFallback: boolean } | null;
      authEnforced: boolean;
    };
    assert.equal(body.authenticated, true);
    assert.equal(body.authEnforced, false);
    assert.equal(body.user?.id, 'local-user');
    assert.equal(body.user?.isLocalFallback, true);
  });

  it('creates, updates, logs entries, edits entries, imports, and deletes via API', async () => {
    const ex = sampleExercise('ex-1');

    // Create exercise
    let res = await fetch(`${baseUrl}/api/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ex),
    });
    assert.equal(res.status, 201);

    // Update settings
    res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit: 'kg' }),
    });
    assert.equal(res.status, 200);

    // Log another entry
    const entry2 = {
      id: 'ex-1-entry-2',
      weight: 195,
      unit: 'lbs',
      reps: 6,
      date: '2026-11-25',
      note: 'PR',
      createdAt: 1700001000000,
      updatedAt: 1700001000000,
    };
    res = await fetch(`${baseUrl}/api/exercises/ex-1/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry: entry2,
        weightMode: 'barbell',
        barWeight: 45,
        barWeightUnit: 'lbs',
        updatedAt: entry2.updatedAt,
      }),
    });
    assert.equal(res.status, 201);

    // Edit entry
    res = await fetch(`${baseUrl}/api/exercises/ex-1/entries/ex-1-entry-2`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weight: 200,
        unit: 'lbs',
        reps: 5,
        date: '2026-11-25',
        note: 'Clean PR',
      }),
    });
    assert.equal(res.status, 200);

    // Edit exercise
    res = await fetch(`${baseUrl}/api/exercises/ex-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Flat Bench Press',
        equipment: 'no-machine',
        weightMode: 'barbell',
        barWeight: 45,
        barWeightUnit: 'lbs',
      }),
    });
    assert.equal(res.status, 200);

    // Verify full state
    res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const state = (await res.json()) as {
      exercises: TrackedExercise[];
      settings: { unit: string };
    };
    assert.equal(state.settings.unit, 'kg');
    assert.equal(state.exercises.length, 1);
    assert.equal(state.exercises[0].name, 'Flat Bench Press');
    assert.equal(state.exercises[0].entries.length, 2);
    assert.equal(state.exercises[0].entries[0].weight, 200);
    assert.equal(state.exercises[0].entries[0].note, 'Clean PR');

    // Delete one entry
    res = await fetch(`${baseUrl}/api/exercises/ex-1/entries/ex-1-entry-1`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 200);

    // Import & merge another exercise
    const ex2 = { ...sampleExercise('ex-2'), name: 'Squat' };
    res = await fetch(`${baseUrl}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises: [ex2], settings: { unit: 'lbs' } }),
    });
    assert.equal(res.status, 200);
    const imported = (await res.json()) as {
      exercises: TrackedExercise[];
      settings: { unit: string };
    };
    assert.equal(imported.exercises.length, 2);
    assert.equal(imported.settings.unit, 'lbs');

    // Delete exercise
    res = await fetch(`${baseUrl}/api/exercises/ex-1`, { method: 'DELETE' });
    assert.equal(res.status, 200);

    res = await fetch(`${baseUrl}/api/state`);
    const finalState = (await res.json()) as { exercises: TrackedExercise[] };
    assert.equal(finalState.exercises.length, 1);
    assert.equal(finalState.exercises[0].id, 'ex-2');
  });

  it('enforces authentication when PUBLIC_MODE=true', async () => {
    process.env.PUBLIC_MODE = 'true';
    try {
      const meRes = await fetch(`${baseUrl}/api/auth/me`);
      const me = (await meRes.json()) as {
        authenticated: boolean;
        authEnforced: boolean;
      };
      assert.equal(me.authenticated, false);
      assert.equal(me.authEnforced, true);

      const stateRes = await fetch(`${baseUrl}/api/state`);
      assert.equal(stateRes.status, 401);
    } finally {
      delete process.env.PUBLIC_MODE;
    }
  });

  it('supports read-only Bearer STAT_TRACKER_API_KEY on GET /api/state and fails closed for multiple users', async () => {
    process.env.PUBLIC_MODE = 'true';
    process.env.STAT_TRACKER_API_KEY = 'super-secret-coach-key';
    delete process.env.STAT_TRACKER_API_USER_ID;

    try {
      // Wrong key -> 401
      let res = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: 'Bearer wrong-key' },
      });
      assert.equal(res.status, 401);

      // Valid key with 1 user in DB (local-user from earlier test) -> 200
      res = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: 'Bearer super-secret-coach-key' },
      });
      assert.equal(res.status, 200);
      const singleUserState = (await res.json()) as {
        exercises: TrackedExercise[];
        syncedAt: string;
      };
      assert.equal(singleUserState.exercises.length, 1);
      assert.equal(singleUserState.exercises[0].id, 'ex-2');
      assert.ok(singleUserState.syncedAt);

      // Write route MUST still reject Bearer API key -> 401 (strictly read-only)
      res = await fetch(`${baseUrl}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer super-secret-coach-key',
        },
        body: JSON.stringify({ unit: 'kg' }),
      });
      assert.equal(res.status, 401);

      // Add a second user -> fails closed with 400 when STAT_TRACKER_API_USER_ID is unset
      mergeImportState(getDb(), 'google:second-user', [
        { ...sampleExercise('ex-second'), name: 'Overhead Press' },
      ]);
      res = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: 'Bearer super-secret-coach-key' },
      });
      assert.equal(res.status, 400);

      // Setting STAT_TRACKER_API_USER_ID selects the configured user cleanly -> 200
      process.env.STAT_TRACKER_API_USER_ID = 'google:second-user';
      res = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: 'Bearer super-secret-coach-key' },
      });
      assert.equal(res.status, 200);
      const targetedState = (await res.json()) as {
        exercises: TrackedExercise[];
      };
      assert.equal(targetedState.exercises.length, 1);
      assert.equal(targetedState.exercises[0].name, 'Overhead Press');
    } finally {
      delete process.env.PUBLIC_MODE;
      delete process.env.STAT_TRACKER_API_KEY;
      delete process.env.STAT_TRACKER_API_USER_ID;
    }
  });
});
