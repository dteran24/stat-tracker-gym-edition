# Stat Tracker — Gym Edition

A lightweight, gym-independent React SPA for tracking your best **weight** and **# of reps** per workout/exercise. Update numbers whenever they go up or down—no live set-by-set logging required.

## Tech Stack
- **React 19 + TypeScript + Vite 6**
- **Tailwind CSS v4**
- **Browser `localStorage`** (offline-ready) with **JSON Export / Import**

## Features
- **Workout Roster**: Track each exercise with its current best weight (or **Bodyweight** for reps-only movements), best reps, **Machine / No Machine** tag, last updated date, and an automatic **Up / Down / Mixed** delta badge.
- **Per-Workout History**: Every update is saved with its date and optional note, building a dedicated chronological history and progression chart (Weight or Reps) for each workout—recording both gains and dips.
- **Overview & Backup**: See total tracked workouts, trending up/down counts, a recent activity feed, instant **`lbs` / `kg`** conversion, and JSON backup Export / Import.

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
