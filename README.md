# Stat Tracker — Gym Edition

A lightweight, gym-independent React app with a Node 22 + SQLite backend for tracking your best **weight** and **# of reps** per workout/exercise. Update numbers whenever they go up or down—no live set-by-set logging required.

## Tech Stack
- **React 19 + TypeScript + Vite 6 + Tailwind CSS v4**
- **Node 22 built-in `node:sqlite` (`DatabaseSync`)** — zero native build dependencies, WAL mode enabled
- **Google Sign-In (OAuth 2.0)** with signed `HttpOnly` session cookies and per-user data isolation (plus seamless local-dev fallback when OAuth env vars are unset)
- **Browser `localStorage`** offline cache + **JSON Export / Import**

## Features
- **Workout Roster**: Track each exercise with its current best weight (or **Bodyweight** for reps-only movements), best reps, **Machine / No Machine** tag, last updated date, and an automatic **Up / Down / Mixed** delta badge.
- **Per-Workout History**: Every update is saved with its date and optional note, building a dedicated chronological history and progression chart (Weight or Reps) for each workout—recording both gains and dips.
- **Automatic SQLite Persistence**: Every edit saves automatically to SQLite on Railway with `localStorage` caching, automatic local-workout merging on sign-in, and automatic flush on reconnect.
- **Overview & Backup**: See total tracked workouts, trending up/down counts, a recent activity feed, instant **`lbs` / `kg`** conversion, Google Sign-In / Sign Out account status, and local **JSON Export / Import**.

## Run Locally
Requires **Node.js >= 22.18.0** (for built-in `node:sqlite` and TypeScript execution).

```bash
npm install
```

Run the SQLite API server and Vite frontend in two terminals:
```bash
# Terminal 1 — SQLite API server (http://localhost:3001)
npm run dev:server

# Terminal 2 — Vite frontend with /api proxy (http://localhost:5173)
npm run dev
```

> In local development (when `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and `PUBLIC_MODE=true` are not set), the server automatically uses a `local-user` profile backed by `./data/stat-tracker.db`.

## Run Tests
```bash
npm test
```

## Deploy on Railway (Single Service + Persistent Volume)
1. Create a new Railway service from this GitHub repository (Railway will automatically detect the `Dockerfile`).
2. Attach a **Railway Volume** mounted at `/data`.
3. In [Google Cloud Console](https://console.cloud.google.com/) (**APIs & Services → Credentials**), create or update an **OAuth 2.0 Client ID** (type: **Web application**) and add your Authorized redirect URI:
   - `https://<your-railway-domain>/api/auth/google/callback`
   - (Optional for local OAuth testing: `http://localhost:5173/api/auth/google/callback`)
4. Configure Railway environment variables:
   - `STAT_TRACKER_DB_PATH=/data/stat-tracker.db`
   - `AUTH_GOOGLE_ID=<your-google-oauth-client-id>`
   - `AUTH_GOOGLE_SECRET=<your-google-oauth-client-secret>`
5. (Optional) Set Railway's Healthcheck Path to `/api/health`.
