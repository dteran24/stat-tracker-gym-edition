# Stat Tracker — Gym Edition

A lightweight, gym-independent React SPA for tracking your best **weight** and **# of reps** per workout/exercise. Update numbers whenever they go up or down—no live set-by-set logging required.

## Tech Stack
- **React 19 + TypeScript + Vite 6**
- **Tailwind CSS v4**
- **Browser `localStorage`** (offline-ready) with **JSON Export / Import** and optional **Google Drive JSON Sync** (browser-only, no backend)

## Features
- **Workout Roster**: Track each exercise with its current best weight (or **Bodyweight** for reps-only movements), best reps, **Machine / No Machine** tag, last updated date, and an automatic **Up / Down / Mixed** delta badge.
- **Per-Workout History**: Every update is saved with its date and optional note, building a dedicated chronological history and progression chart (Weight or Reps) for each workout—recording both gains and dips.
- **Overview & Backup**: See total tracked workouts, trending up/down counts, a recent activity feed, instant **`lbs` / `kg`** conversion, manual **Google Drive Sync / Restore** (with conflict warnings), and local JSON backup Export / Import.

## Google Drive Sync Setup (Optional)
Google Drive sync runs entirely in the browser using Google Identity Services (`google.accounts.oauth2.initTokenClient`) and the Drive REST API v3 with the minimal `https://www.googleapis.com/auth/drive.file` scope. Backups are stored as a single file `stat-tracker-backup.json` inside a `Stat Tracker Gym` folder in your Drive.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project and enable the **Google Drive API**.
2. Configure the **OAuth consent screen** (External; add yourself as a test user while in Testing mode).
3. Under **APIs & Services → Credentials**, create an **OAuth client ID** of type **Web application**.
4. Add your Authorized JavaScript origins:
   - Local dev: `http://localhost:5173`
   - Production: your Cloudflare Pages URL (e.g., `https://<project>.pages.dev` and/or custom domain)
5. Copy `.env.example` to `.env.local` and paste your Client ID:
   ```bash
   cp .env.example .env.local
   ```
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
   ```

> If `VITE_GOOGLE_CLIENT_ID` is not set, local storage and manual JSON Export / Import continue to work offline.

## Run Locally
```bash
npm install
npm run dev
```

## Build for Production
```bash
npm run build
npm run preview
```

## Deploy on Cloudflare Pages
1. Connect your GitHub repository in the Cloudflare Dashboard (**Workers & Pages → Create → Pages**).
2. Configure the build settings:
   - **Framework preset**: `Vite` (or `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. Under **Settings → Environment variables**, add `VITE_GOOGLE_CLIENT_ID` for Production (and Preview if desired), then redeploy so Vite injects it at build time.
4. Make sure your deployed `*.pages.dev` (and any custom domain) is listed under **Authorized JavaScript origins** in your Google OAuth Web Client ID.
