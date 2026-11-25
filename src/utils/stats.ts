import type { EntryComparison, StatEntry, TrackedExercise, WeightUnit } from '../types';

const LBS_PER_KG = 2.2046226218;

export function convertWeight(
  value: number,
  from: WeightUnit,
  to: WeightUnit
): number {
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  const converted = from === 'kg' ? value * LBS_PER_KG : value / LBS_PER_KG;
  return Math.round(converted * 10) / 10;
}

export function getEntryWeightInUnit(
  entry: StatEntry,
  displayUnit: WeightUnit
): number | null {
  if (entry.weight === null) return null;
  return convertWeight(entry.weight, entry.unit, displayUnit);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatSignedNumber(value: number): string {
  const formatted = formatNumber(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return '0';
}

export function formatWeightLabel(
  weight: number | null,
  unit: WeightUnit
): string {
  if (weight === null) return 'Bodyweight';
  return `${formatNumber(weight)} ${unit}`;
}

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatFullDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Compares a newer entry against the immediately preceding entry.
 * Uses direct weight + reps comparison with clear deltas and Up/Down/Mixed direction.
 */
export function compareEntries(
  current: StatEntry,
  previous: StatEntry | undefined,
  displayUnit: WeightUnit
): EntryComparison {
  if (!previous) {
    return {
      direction: 'initial',
      weightDelta: null,
      repsDelta: 0,
    };
  }

  const currW = getEntryWeightInUnit(current, displayUnit);
  const prevW = getEntryWeightInUnit(previous, displayUnit);
  const repsDelta = current.reps - previous.reps;

  const weightTransition: EntryComparison['weightTransition'] =
    prevW === null && currW !== null
      ? 'added-weight'
      : prevW !== null && currW === null
        ? 'to-bodyweight'
        : undefined;

  const weightDelta =
    currW !== null && prevW !== null
      ? Math.round((currW - prevW) * 10) / 10
      : null;

  // For direction, treat bodyweight as 0 when comparing across a bodyweight <-> weighted transition
  const effectiveDiffW = (currW ?? 0) - (prevW ?? 0);
  const wUp = effectiveDiffW > 0.05;
  const wDown = effectiveDiffW < -0.05;
  const rUp = repsDelta > 0;
  const rDown = repsDelta < 0;

  let direction: EntryComparison['direction'];
  if ((wUp && !rDown) || (rUp && !wDown)) {
    direction = 'up';
  } else if ((wDown && !rUp) || (rDown && !wUp)) {
    direction = 'down';
  } else if ((wUp && rDown) || (wDown && rUp)) {
    direction = 'mixed';
  } else {
    direction = 'same';
  }

  return {
    direction,
    weightDelta,
    repsDelta,
    weightTransition,
  };
}

/**
 * Returns the all-time best entry for an exercise:
 * - For weighted exercises: highest weight (tie-broken by highest reps, then newest).
 * - For bodyweight-only exercises: highest reps (tie-broken by newest).
 */
export function getAllTimeBestEntry(
  exercise: TrackedExercise,
  displayUnit: WeightUnit
): StatEntry | null {
  if (exercise.entries.length === 0) return null;

  let best = exercise.entries[0];
  let bestW = getEntryWeightInUnit(best, displayUnit);

  for (let i = 1; i < exercise.entries.length; i++) {
    const candidate = exercise.entries[i];
    const candW = getEntryWeightInUnit(candidate, displayUnit);

    if (candW !== null && bestW === null) {
      best = candidate;
      bestW = candW;
      continue;
    }

    if (candW !== null && bestW !== null) {
      if (candW > bestW + 0.05) {
        best = candidate;
        bestW = candW;
      } else if (Math.abs(candW - bestW) <= 0.05 && candidate.reps > best.reps) {
        best = candidate;
        bestW = candW;
      }
      continue;
    }

    if (candW === null && bestW === null && candidate.reps > best.reps) {
      best = candidate;
      bestW = candW;
    }
  }

  return best;
}

export function isBodyweightOnly(exercise: TrackedExercise): boolean {
  return exercise.entries.length > 0 && exercise.entries.every((e) => e.weight === null);
}
