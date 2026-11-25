import type { EntryComparison, WeightUnit } from '../types';
import { formatSignedNumber } from '../utils/stats';
import { TrendDownIcon, TrendMixedIcon, TrendUpIcon } from './Icons';

interface DeltaBadgeProps {
  comparison: EntryComparison;
  unit: WeightUnit;
  compact?: boolean;
}

export function DeltaBadge({ comparison, unit, compact = false }: DeltaBadgeProps) {
  const { direction, weightDelta, repsDelta, weightTransition } = comparison;

  if (direction === 'initial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.06] text-[#8E98A8] border border-white/[0.08]">
        Baseline
      </span>
    );
  }

  const parts: string[] = [];

  if (weightTransition === 'added-weight') {
    parts.push('Added weight');
  } else if (weightTransition === 'to-bodyweight') {
    parts.push('Bodyweight');
  } else if (weightDelta !== null && Math.abs(weightDelta) > 0.05) {
    parts.push(`${formatSignedNumber(weightDelta)} ${unit}`);
  }

  if (repsDelta !== 0) {
    parts.push(`${formatSignedNumber(repsDelta)} ${Math.abs(repsDelta) === 1 ? 'rep' : 'reps'}`);
  }

  const deltaText = parts.length > 0 ? parts.join(', ') : 'No change';

  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#22C55E]/12 text-[#86EFAC] border border-[#22C55E]/25 font-mono tabular-nums">
        <TrendUpIcon className="w-3 h-3 shrink-0" />
        {!compact && <span className="font-sans">Up</span>}
        {!compact && <span className="opacity-50">·</span>}
        <span>{deltaText}</span>
      </span>
    );
  }

  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/12 text-rose-300 border border-rose-500/25 font-mono tabular-nums">
        <TrendDownIcon className="w-3 h-3 shrink-0" />
        {!compact && <span className="font-sans">Down</span>}
        {!compact && <span className="opacity-50">·</span>}
        <span>{deltaText}</span>
      </span>
    );
  }

  if (direction === 'mixed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/12 text-amber-300 border border-amber-500/25 font-mono tabular-nums">
        <TrendMixedIcon className="w-3 h-3 shrink-0" />
        {!compact && <span className="font-sans">Mixed</span>}
        {!compact && <span className="opacity-50">·</span>}
        <span>{deltaText}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.06] text-[#8E98A8] border border-white/[0.08]">
      Same
    </span>
  );
}
