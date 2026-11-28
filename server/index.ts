import fs from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearSessionCookie,
  getOptionalUser,
  handleGoogleOAuthCallback,
  isAuthEnforced,
  isOAuthConfigured,
  isValidReadApiKey,
  requireUser,
  startGoogleOAuth,
  UnauthorizedError,
} from './auth.ts';
import {
  addEntryRecord,
  createExerciseRecord,
  deleteEntryRecord,
  deleteExerciseRecord,
  getDb,
  getUserState,
  listDistinctUserIds,
  mergeImportState,
  saveUserSettings,
  updateEntryRecord,
  updateExerciseRecord,
} from './db.ts';
import {
  isValidEquipment,
  isValidExercise,
  isValidStatEntry,
  isValidUnit,
  isValidWeightMode,
  parseSettingsInput,
} from './validation.ts';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Request body too large.');
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

function serveStaticFile(
  distDir: string,
  pathname: string,
  res: ServerResponse
): boolean {
  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) return false;

  const decodedPath = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();

  const relativePath = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(distDir, relativePath);
  const withinDist =
    candidate === distDir || candidate.startsWith(`${distDir}${path.sep}`);

  let fileToServe: string | null = null;
  if (withinDist && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else if (!path.extname(decodedPath)) {
    // SPA fallback for client-side routes
    fileToServe = indexHtml;
  }

  if (!fileToServe) return false;

  const ext = path.extname(fileToServe).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  if (fileToServe.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  fs.createReadStream(fileToServe).pipe(res);
  return true;
}

export function createServer(options?: { distDir?: string }): http.Server {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidateFromServer = path.resolve(__dirname, '..', 'dist');
  const distDir =
    options?.distDir ??
    (fs.existsSync(path.join(candidateFromServer, 'index.html'))
      ? candidateFromServer
      : path.resolve(process.cwd(), 'dist'));

  return http.createServer(async (req, res) => {
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;

    try {
      // Healthcheck for Railway
      if (method === 'GET' && pathname === '/api/health') {
        const db = getDb();
        db.prepare('SELECT 1').get();
        sendJson(res, 200, { ok: true, db: 'sqlite' });
        return;
      }

      // Auth routes
      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = getOptionalUser(req);
        sendJson(res, 200, {
          authenticated: Boolean(user),
          user,
          oauthConfigured: isOAuthConfigured(),
          authEnforced: isAuthEnforced(),
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/auth/google') {
        startGoogleOAuth(req, res);
        return;
      }

      if (method === 'GET' && pathname === '/api/auth/google/callback') {
        await handleGoogleOAuthCallback(req, res, url.searchParams);
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        clearSessionCookie(req, res);
        sendJson(res, 200, { ok: true });
        return;
      }

      // Protected API routes
      if (method === 'GET' && pathname === '/api/state') {
        const db = getDb();
        let targetUserId: string;
        if (isValidReadApiKey(req)) {
          const configuredUserId = process.env.STAT_TRACKER_API_USER_ID?.trim();
          if (configuredUserId) {
            targetUserId = configuredUserId;
          } else {
            const userIds = listDistinctUserIds(db);
            if (userIds.length === 1) {
              targetUserId = userIds[0];
            } else if (userIds.length === 0) {
              throw new HttpError(
                400,
                'No users found in Stat Tracker database yet. Sign in with Google once or set STAT_TRACKER_API_USER_ID.'
              );
            } else {
              throw new HttpError(
                400,
                'Multiple users exist in Stat Tracker database. Set STAT_TRACKER_API_USER_ID on the server to select which user to export.'
              );
            }
          }
        } else {
          const user = requireUser(req);
          targetUserId = user.id;
        }
        const state = getUserState(db, targetUserId);
        sendJson(res, 200, {
          ...state,
          syncedAt: new Date().toISOString(),
        });
        return;
      }

      if (method === 'PUT' && pathname === '/api/settings') {
        const user = requireUser(req);
        const body = await readJsonBody(req);
        const settings = parseSettingsInput(body);
        if (!settings) {
          sendJson(res, 400, { error: 'Invalid settings payload.' });
          return;
        }
        const saved = saveUserSettings(getDb(), user.id, settings);
        sendJson(res, 200, { settings: saved, syncedAt: new Date().toISOString() });
        return;
      }

      if (method === 'POST' && pathname === '/api/exercises') {
        const user = requireUser(req);
        const body = await readJsonBody(req);
        if (!isValidExercise(body)) {
          sendJson(res, 400, { error: 'Invalid exercise payload.' });
          return;
        }
        createExerciseRecord(getDb(), user.id, body);
        sendJson(res, 201, { ok: true, syncedAt: new Date().toISOString() });
        return;
      }

      // /api/exercises/:id
      const exerciseMatch = pathname.match(/^\/api\/exercises\/([^/]+)$/);
      if (exerciseMatch) {
        const exerciseId = decodeURIComponent(exerciseMatch[1]);
        if (method === 'PATCH') {
          const user = requireUser(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          if (
            typeof body?.name !== 'string' ||
            body.name.trim().length === 0 ||
            !isValidEquipment(body.equipment) ||
            !isValidWeightMode(body.weightMode) ||
            (body.barWeight !== undefined &&
              (typeof body.barWeight !== 'number' ||
                !Number.isFinite(body.barWeight) ||
                body.barWeight < 0)) ||
            (body.barWeightUnit !== undefined && !isValidUnit(body.barWeightUnit))
          ) {
            sendJson(res, 400, { error: 'Invalid exercise update payload.' });
            return;
          }

          const updatedAt =
            typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt)
              ? body.updatedAt
              : Date.now();

          const updated = updateExerciseRecord(getDb(), user.id, exerciseId, {
            name: body.name.trim(),
            equipment: body.equipment,
            weightMode: body.weightMode,
            barWeight: body.barWeight as number | undefined,
            barWeightUnit: body.barWeightUnit,
            updatedAt,
          });
          if (!updated) {
            sendJson(res, 404, { error: 'Workout not found.' });
            return;
          }
          sendJson(res, 200, { ok: true, syncedAt: new Date().toISOString() });
          return;
        }

        if (method === 'DELETE') {
          const user = requireUser(req);
          deleteExerciseRecord(getDb(), user.id, exerciseId);
          sendJson(res, 200, { ok: true, syncedAt: new Date().toISOString() });
          return;
        }
      }

      // /api/exercises/:id/entries
      const entriesMatch = pathname.match(/^\/api\/exercises\/([^/]+)\/entries$/);
      if (entriesMatch && method === 'POST') {
        const user = requireUser(req);
        const exerciseId = decodeURIComponent(entriesMatch[1]);
        const body = (await readJsonBody(req)) as {
          entry?: unknown;
          weightMode?: unknown;
          barWeight?: unknown;
          barWeightUnit?: unknown;
          updatedAt?: unknown;
        };
        const candidateEntry = body && 'entry' in body ? body.entry : body;
        if (!isValidStatEntry(candidateEntry)) {
          sendJson(res, 400, { error: 'Invalid entry payload.' });
          return;
        }
        if (!isValidWeightMode(body.weightMode)) {
          sendJson(res, 400, { error: 'Invalid weightMode.' });
          return;
        }
        if (
          body.barWeight !== undefined &&
          (typeof body.barWeight !== 'number' ||
            !Number.isFinite(body.barWeight) ||
            body.barWeight < 0)
        ) {
          sendJson(res, 400, { error: 'Invalid barWeight.' });
          return;
        }
        if (body.barWeightUnit !== undefined && !isValidUnit(body.barWeightUnit)) {
          sendJson(res, 400, { error: 'Invalid barWeightUnit.' });
          return;
        }

        const exerciseMeta =
          body.weightMode !== undefined ||
          body.barWeight !== undefined ||
          body.barWeightUnit !== undefined
            ? {
                weightMode: body.weightMode,
                barWeight: body.barWeight as number | undefined,
                barWeightUnit: body.barWeightUnit,
                updatedAt:
                  typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt)
                    ? body.updatedAt
                    : candidateEntry.updatedAt,
              }
            : undefined;

        const added = addEntryRecord(
          getDb(),
          user.id,
          exerciseId,
          candidateEntry,
          exerciseMeta
        );
        if (!added) {
          sendJson(res, 404, { error: 'Workout not found.' });
          return;
        }
        sendJson(res, 201, { ok: true, syncedAt: new Date().toISOString() });
        return;
      }

      // /api/exercises/:id/entries/:entryId
      const entryItemMatch = pathname.match(
        /^\/api\/exercises\/([^/]+)\/entries\/([^/]+)$/
      );
      if (entryItemMatch) {
        const exerciseId = decodeURIComponent(entryItemMatch[1]);
        const entryId = decodeURIComponent(entryItemMatch[2]);

        if (method === 'PATCH') {
          const user = requireUser(req);
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          const validWeight =
            body?.weight === null ||
            (typeof body?.weight === 'number' &&
              Number.isFinite(body.weight) &&
              body.weight >= 0);

          if (
            !validWeight ||
            !isValidUnit(body?.unit) ||
            (body.weightDetail !== undefined && typeof body.weightDetail !== 'string') ||
            typeof body?.reps !== 'number' ||
            !Number.isFinite(body.reps) ||
            body.reps <= 0 ||
            typeof body?.date !== 'string' ||
            body.date.trim().length === 0 ||
            (body.note !== undefined && typeof body.note !== 'string')
          ) {
            sendJson(res, 400, { error: 'Invalid entry update payload.' });
            return;
          }

          const updatedAt =
            typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt)
              ? body.updatedAt
              : Date.now();

          const updated = updateEntryRecord(getDb(), user.id, exerciseId, entryId, {
            weight: body.weight as number | null,
            unit: body.unit,
            weightDetail: body.weightDetail as string | undefined,
            reps: body.reps,
            date: body.date,
            note: body.note as string | undefined,
            updatedAt,
          });
          if (!updated) {
            sendJson(res, 404, { error: 'Entry not found.' });
            return;
          }
          sendJson(res, 200, { ok: true, syncedAt: new Date().toISOString() });
          return;
        }

        if (method === 'DELETE') {
          const user = requireUser(req);
          deleteEntryRecord(getDb(), user.id, exerciseId, entryId, Date.now());
          sendJson(res, 200, { ok: true, syncedAt: new Date().toISOString() });
          return;
        }
      }

      if (method === 'POST' && pathname === '/api/import') {
        const user = requireUser(req);
        const body = (await readJsonBody(req)) as {
          exercises?: unknown;
          settings?: unknown;
        };
        if (!Array.isArray(body?.exercises)) {
          sendJson(res, 400, { error: 'exercises must be an array.' });
          return;
        }
        const validExercises = body.exercises.filter(isValidExercise);
        if (validExercises.length === 0 && body.exercises.length > 0) {
          sendJson(res, 400, { error: 'No valid workout entries found.' });
          return;
        }
        const parsedSettings = body.settings ? parseSettingsInput(body.settings) : null;
        const merged = mergeImportState(
          getDb(),
          user.id,
          validExercises,
          parsedSettings ?? undefined
        );
        sendJson(res, 200, {
          ...merged,
          importedCount: validExercises.length,
          syncedAt: new Date().toISOString(),
        });
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: 'API route not found.' });
        return;
      }

      // Serve built Vite SPA in production
      if ((method === 'GET' || method === 'HEAD') && serveStaticFile(distDir, pathname, res)) {
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not Found');
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        sendJson(res, 401, { error: err.message });
        return;
      }
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      console.error('[server error]', err);
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '0.0.0.0';
  // Initialize SQLite DB on startup
  getDb();
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`Stat Tracker server listening on http://${host}:${port}`);
  });
}
