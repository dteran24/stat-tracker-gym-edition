# Stat Tracker — Gym Edition

A lightweight, mobile-first React SPA for logging gym workouts, tracking sets/reps/weight, tagging **Machine** vs. **No Machine** exercises, and visualizing strength progress over time.

## Tech Stack
- **React 19 + TypeScript + Vite 6**
- **Tailwind CSS v4**
- **Browser `localStorage`** (offline-ready) with **JSON Export / Import**

## Features
- **Log Workouts**: Add exercises with a **Machine / No Machine** toggle, autocomplete from previous exercises, add/complete individual sets with weight & reps, and see your previous session + PR right on each card. In-progress workouts auto-save as a draft.
- **History**: Search workouts, filter by **All / Machine / No Machine**, inspect sets, edit past sessions, or delete entries.
- **Stats & Backup**: Track lifetime totals, per-exercise **Best Weight (PR)**, **Estimated 1RM**, **Session Volume**, and a lightweight progression chart. Toggle between **`lbs`** and **`kg`** anytime, and export/import JSON backups.

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
