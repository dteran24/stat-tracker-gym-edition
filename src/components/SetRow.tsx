import type { SetEntry, WeightUnit } from '../types';
import { CheckIcon, XIcon } from './Icons';

interface SetRowProps {
  index: number;
  set: SetEntry;
  unit: WeightUnit;
  canRemove: boolean;
  onChange: (updated: SetEntry) => void;
  onRemove: () => void;
}

export function SetRow({
  index,
  set,
  unit,
  canRemove,
  onChange,
  onRemove,
}: SetRowProps) {
  return (
    <div
      className={`grid grid-cols-[2.25rem_1fr_1fr_2.75rem_2rem] items-center gap-2 py-1.5 px-2 rounded-xl transition-colors ${
        set.completed
          ? 'bg-[#22C55E]/10 border border-[#22C55E]/20'
          : 'bg-[#0C0F15]/70 border border-white/[0.04]'
      }`}
    >
      {/* Set Number */}
      <div
        className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-mono font-bold tabular-nums ${
          set.completed
            ? 'bg-[#22C55E]/20 text-[#4ADE80]'
            : 'bg-[#171C26] text-[#8E98A8]'
        }`}
      >
        {index + 1}
      </div>

      {/* Weight Input */}
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          aria-label={`Set ${index + 1} weight in ${unit}`}
          placeholder="0"
          value={set.weight}
          onChange={(e) => onChange({ ...set, weight: e.target.value })}
          className="input-field w-full h-11 rounded-lg px-2.5 pr-8 text-center font-mono text-base font-semibold tabular-nums"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-[#5C6677]">
          {unit}
        </span>
      </div>

      {/* Reps Input */}
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          aria-label={`Set ${index + 1} reps`}
          placeholder="0"
          value={set.reps}
          onChange={(e) => onChange({ ...set, reps: e.target.value })}
          className="input-field w-full h-11 rounded-lg px-2.5 pr-9 text-center font-mono text-base font-semibold tabular-nums"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-[#5C6677]">
          reps
        </span>
      </div>

      {/* Complete Toggle */}
      <button
        type="button"
        aria-label={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
        onClick={() => onChange({ ...set, completed: !set.completed })}
        className={`h-11 w-11 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
          set.completed
            ? 'bg-[#22C55E] text-[#052E16]'
            : 'bg-[#1A202B] text-[#8E98A8] hover:text-white border border-white/10'
        }`}
      >
        <CheckIcon className="w-5 h-5" />
      </button>

      {/* Remove Set */}
      <button
        type="button"
        disabled={!canRemove}
        aria-label={`Remove set ${index + 1}`}
        onClick={onRemove}
        className={`h-9 w-8 rounded-lg flex items-center justify-center transition-colors ${
          canRemove
            ? 'text-[#5C6677] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer'
            : 'text-[#2B3240] cursor-not-allowed'
        }`}
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
