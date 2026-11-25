import { useEffect, useState } from 'react';
import type {
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightMode,
  WeightUnit,
} from '../types';
import {
  calculateWeightFromExpression,
  compareEntries,
  formatFullDate,
  formatNumber,
  formatWeightLabel,
  getDefaultBarWeight,
  getEntryWeightInUnit,
  getExerciseBarWeightInUnit,
  getPlatePresets,
} from '../utils/stats';
import { getTodayIso } from '../utils/storage';
import { DeltaBadge } from './DeltaBadge';
import { DumbbellIcon, MachineIcon, XIcon } from './Icons';

export type ModalMode =
  | { type: 'create-exercise' }
  | { type: 'log-update'; exercise: TrackedExercise }
  | { type: 'edit-entry'; exercise: TrackedExercise; entry: StatEntry }
  | { type: 'edit-exercise'; exercise: TrackedExercise };

interface EntryModalProps {
  mode: ModalMode | null;
  unit: WeightUnit;
  onClose: () => void;
  onSubmitCreate: (payload: {
    name: string;
    equipment: EquipmentType;
    weightMode: WeightMode;
    barWeight?: number;
    weight: number | null;
    weightDetail?: string;
    reps: number;
    date: string;
    note: string;
  }) => void;
  onSubmitLogUpdate: (
    exerciseId: string,
    payload: {
      weight: number | null;
      weightDetail?: string;
      weightMode: WeightMode;
      barWeight?: number;
      reps: number;
      date: string;
      note: string;
    }
  ) => void;
  onSubmitEditEntry: (
    exerciseId: string,
    entryId: string,
    payload: {
      weight: number | null;
      weightDetail?: string;
      reps: number;
      date: string;
      note: string;
    }
  ) => void;
  onSubmitEditExercise: (
    exerciseId: string,
    payload: {
      name: string;
      equipment: EquipmentType;
      weightMode: WeightMode;
      barWeight?: number;
    }
  ) => void;
}

const WEIGHT_MODE_OPTIONS: Array<{
  id: WeightMode;
  label: string;
  hint: string;
}> = [
  { id: 'direct', label: 'Total', hint: 'Enter total weight directly' },
  { id: 'barbell', label: 'Barbell', hint: 'Per side × 2 + bar' },
  { id: 'plates-single', label: 'Plates (1×)', hint: 'Sum plates (e.g. T-Bar)' },
  { id: 'plates-dual', label: 'Per Side (2×)', hint: 'Per side × 2, no bar' },
];

function getAllowedWeightModes(equipment: EquipmentType): WeightMode[] {
  return equipment === 'machine'
    ? ['direct', 'plates-single', 'plates-dual']
    : ['barbell', 'plates-single', 'plates-dual'];
}

function getDefaultWeightMode(equipment: EquipmentType): WeightMode {
  return equipment === 'machine' ? 'direct' : 'barbell';
}

function coerceWeightMode(
  mode: WeightMode | undefined,
  equipment: EquipmentType
): WeightMode {
  const allowed = getAllowedWeightModes(equipment);
  if (mode && allowed.includes(mode)) return mode;
  return getDefaultWeightMode(equipment);
}

function getModalKey(mode: ModalMode, unit: WeightUnit): string {
  switch (mode.type) {
    case 'create-exercise':
      return `create-${unit}`;
    case 'log-update':
      return `log-${mode.exercise.id}-${mode.exercise.entries[0]?.id ?? 'none'}-${unit}`;
    case 'edit-entry':
      return `edit-entry-${mode.entry.id}-${unit}`;
    case 'edit-exercise':
      return `edit-ex-${mode.exercise.id}-${unit}`;
  }
}

/**
 * Reconstructs the editable input expression from a saved entry so that
 * Barbell / Per-Side modes pre-fill per-side plates rather than the doubled total.
 */
function getPrefilledWeightInput(
  entry: StatEntry | undefined,
  weightMode: WeightMode,
  barWeight: number,
  unit: WeightUnit
): string {
  if (!entry || entry.weight === null) return '';

  // If recorded in the same unit and we saved the exact expression, reuse it cleanly
  if (entry.unit === unit && entry.weightDetail) {
    if (weightMode === 'barbell' && entry.weightDetail.includes(' / side')) {
      return entry.weightDetail.split(' / side')[0];
    }
    if (weightMode === 'plates-dual' && entry.weightDetail.includes(' / side')) {
      return entry.weightDetail.split(' / side')[0];
    }
    if (weightMode === 'plates-single' && entry.weightDetail.endsWith(' plates')) {
      return entry.weightDetail.replace(/ plates$/, '');
    }
  }

  const totalInUnit = getEntryWeightInUnit(entry, unit);
  if (totalInUnit === null) return '';

  if (weightMode === 'barbell') {
    const perSide = Math.max(0, (totalInUnit - barWeight) / 2);
    return formatNumber(perSide);
  }
  if (weightMode === 'plates-dual') {
    const perSide = Math.max(0, totalInUnit / 2);
    return formatNumber(perSide);
  }
  return formatNumber(totalInUnit);
}

function getInitialValues(mode: ModalMode, unit: WeightUnit) {
  if (mode.type === 'create-exercise') {
    const defaultEquipment: EquipmentType = 'no-machine';
    return {
      name: '',
      equipment: defaultEquipment,
      weightMode: getDefaultWeightMode(defaultEquipment),
      barWeightInput: formatNumber(getDefaultBarWeight(unit)),
      weightInput: '',
      repsInput: '',
      date: getTodayIso(),
      note: '',
    };
  }

  const weightMode: WeightMode = coerceWeightMode(
    mode.exercise.weightMode,
    mode.exercise.equipment
  );
  const barWeight = getExerciseBarWeightInUnit(mode.exercise, unit);

  if (mode.type === 'log-update') {
    const latest = mode.exercise.entries[0];
    return {
      name: mode.exercise.name,
      equipment: mode.exercise.equipment,
      weightMode,
      barWeightInput: formatNumber(barWeight),
      weightInput: getPrefilledWeightInput(latest, weightMode, barWeight, unit),
      repsInput: latest ? String(latest.reps) : '',
      date: getTodayIso(),
      note: '',
    };
  }

  if (mode.type === 'edit-entry') {
    return {
      name: mode.exercise.name,
      equipment: mode.exercise.equipment,
      weightMode,
      barWeightInput: formatNumber(barWeight),
      weightInput: getPrefilledWeightInput(mode.entry, weightMode, barWeight, unit),
      repsInput: String(mode.entry.reps),
      date: mode.entry.date,
      note: mode.entry.note ?? '',
    };
  }

  return {
    name: mode.exercise.name,
    equipment: mode.exercise.equipment,
    weightMode,
    barWeightInput: formatNumber(barWeight),
    weightInput: '',
    repsInput: '',
    date: getTodayIso(),
    note: '',
  };
}

export function EntryModal(props: EntryModalProps) {
  const { mode, unit } = props;
  if (!mode) return null;

  return (
    <EntryModalDialog key={getModalKey(mode, unit)} {...props} mode={mode} />
  );
}

interface EntryModalDialogProps extends Omit<EntryModalProps, 'mode'> {
  mode: ModalMode;
}

function EntryModalDialog({
  mode,
  unit,
  onClose,
  onSubmitCreate,
  onSubmitLogUpdate,
  onSubmitEditEntry,
  onSubmitEditExercise,
}: EntryModalDialogProps) {
  const initial = getInitialValues(mode, unit);
  const [name, setName] = useState(initial.name);
  const [equipment, setEquipment] = useState<EquipmentType>(initial.equipment);
  const [weightMode, setWeightMode] = useState<WeightMode>(initial.weightMode);
  const [barWeightInput, setBarWeightInput] = useState(initial.barWeightInput);
  const [weightInput, setWeightInput] = useState(initial.weightInput);
  const [repsInput, setRepsInput] = useState(initial.repsInput);
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isMetadataOnly = mode.type === 'edit-exercise';
  const showNameAndEquipment =
    mode.type === 'create-exercise' || mode.type === 'edit-exercise';
  const allowedModes = getAllowedWeightModes(equipment);
  const visibleWeightModeOptions = WEIGHT_MODE_OPTIONS.filter((opt) =>
    allowedModes.includes(opt.id)
  );
  const isPlateMode = weightMode !== 'direct';
  const platePresets = getPlatePresets(unit);

  const handleEquipmentChange = (nextEquipment: EquipmentType) => {
    setEquipment(nextEquipment);
    setWeightMode((prev) => coerceWeightMode(prev, nextEquipment));
  };

  const parsedBarWeight = (() => {
    const n = Number(barWeightInput.trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : getDefaultBarWeight(unit);
  })();

  const weightCalc =
    weightInput.trim() === ''
      ? null
      : calculateWeightFromExpression(weightInput, weightMode, parsedBarWeight, unit);

  // Live preview of comparison when logging a new update
  const latestEntry = mode.type === 'log-update' ? mode.exercise.entries[0] : undefined;
  const parsedRepsPreview = Number(repsInput.trim());
  const previewWeightVal = weightInput.trim() === '' ? null : weightCalc?.total;
  const canPreviewDelta =
    mode.type === 'log-update' &&
    latestEntry !== undefined &&
    Number.isFinite(parsedRepsPreview) &&
    parsedRepsPreview > 0 &&
    previewWeightVal !== undefined;

  const previewComparison = canPreviewDelta
    ? compareEntries(
        {
          id: 'preview',
          weight: previewWeightVal,
          unit,
          reps: Math.round(parsedRepsPreview),
          date,
          createdAt: 0,
          updatedAt: 0,
        },
        latestEntry,
        unit
      )
    : null;

  const handleAppendPlate = (plate: number) => {
    setError(null);
    const trimmed = weightInput.trim();
    if (!trimmed || trimmed === '0') {
      setWeightInput(formatNumber(plate));
    } else if (trimmed.endsWith('+')) {
      setWeightInput(`${trimmed} ${formatNumber(plate)}`);
    } else {
      setWeightInput(`${trimmed} + ${formatNumber(plate)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (showNameAndEquipment && name.trim().length === 0) {
      setError('Please enter a workout / exercise name.');
      return;
    }

    const barWeightToSave = weightMode === 'barbell' ? parsedBarWeight : undefined;

    if (mode.type === 'edit-exercise') {
      onSubmitEditExercise(mode.exercise.id, {
        name: name.trim(),
        equipment,
        weightMode,
        barWeight: barWeightToSave,
      });
      return;
    }

    const trimmedWeight = weightInput.trim();
    let weight: number | null = null;
    let weightDetail: string | undefined;

    if (trimmedWeight !== '') {
      const calc = calculateWeightFromExpression(
        trimmedWeight,
        weightMode,
        parsedBarWeight,
        unit
      );
      if (!calc) {
        setError(
          'Enter a valid weight or plate sum like "45 + 45" (or leave blank for bodyweight).'
        );
        return;
      }
      weight = calc.total;
      weightDetail = calc.detail;
    }

    const numReps = Number(repsInput.trim());
    if (!Number.isFinite(numReps) || numReps <= 0) {
      setError('Please enter your best # of reps (at least 1).');
      return;
    }
    const reps = Math.round(numReps);

    if (!date) {
      setError('Please select a date.');
      return;
    }

    const cleanNote = note.trim();

    if (mode.type === 'create-exercise') {
      onSubmitCreate({
        name: name.trim(),
        equipment,
        weightMode,
        barWeight: barWeightToSave,
        weight,
        weightDetail,
        reps,
        date,
        note: cleanNote,
      });
    } else if (mode.type === 'log-update') {
      onSubmitLogUpdate(mode.exercise.id, {
        weight,
        weightDetail,
        weightMode,
        barWeight: barWeightToSave,
        reps,
        date,
        note: cleanNote,
      });
    } else if (mode.type === 'edit-entry') {
      onSubmitEditEntry(mode.exercise.id, mode.entry.id, {
        weight,
        weightDetail,
        reps,
        date,
        note: cleanNote,
      });
    }
  };

  const title =
    mode.type === 'create-exercise'
      ? 'Add Workout'
      : mode.type === 'log-update'
        ? `Update ${mode.exercise.name}`
        : mode.type === 'edit-entry'
          ? `Edit Entry · ${mode.exercise.name}`
          : 'Edit Workout Details';

  const submitLabel =
    mode.type === 'create-exercise'
      ? 'Save Workout'
      : mode.type === 'log-update'
        ? 'Record Update'
        : 'Save Changes';

  const weightFieldLabel =
    weightMode === 'barbell'
      ? `Plates / Side (${unit})`
      : weightMode === 'plates-dual'
        ? `Weight / Side (${unit})`
        : weightMode === 'plates-single'
          ? `Plates Loaded (${unit})`
          : `Weight (${unit})`;

  const weightFieldPlaceholder =
    weightMode === 'direct' ? 'Bodyweight' : 'e.g. 45 + 45';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full sm:max-w-md bg-[#12161E] border-t sm:border border-white/12 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl animate-enter max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-extrabold tracking-tight text-[#F3F5F8] truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/10 text-[#8E98A8] hover:text-[#F3F5F8] flex items-center justify-center transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Reference current value when logging an update */}
        {mode.type === 'log-update' && latestEntry && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#0D1016] border border-white/[0.08] flex items-center justify-between gap-2 text-xs">
            <span className="text-[#8E98A8]">Current best</span>
            <span className="font-mono font-semibold text-[#F3F5F8] tabular-nums">
              {formatWeightLabel(getEntryWeightInUnit(latestEntry, unit), unit)} × {latestEntry.reps}{' '}
              {latestEntry.reps === 1 ? 'rep' : 'reps'}
              <span className="text-[#5C6677] font-sans font-normal ml-1.5">
                ({formatFullDate(latestEntry.date)})
              </span>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {showNameAndEquipment && (
            <>
              <div>
                <label
                  htmlFor="exercise-name-input"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8] mb-1.5"
                >
                  Workout / Exercise Name
                </label>
                <input
                  id="exercise-name-input"
                  type="text"
                  autoFocus={mode.type === 'create-exercise'}
                  placeholder="e.g. Bench Press, T-Bar Row, Pull-Ups"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full h-11 px-3.5 rounded-xl text-sm font-medium placeholder:text-[#5C6677]"
                />
              </div>

              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8] mb-1.5">
                  Equipment
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEquipmentChange('machine')}
                    className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      equipment === 'machine'
                        ? 'bg-[#F97316]/15 border-[#F97316]/50 text-[#FB923C]'
                        : 'bg-[#0D1016] border-white/10 text-[#8E98A8] hover:text-[#F3F5F8]'
                    }`}
                  >
                    <MachineIcon className="w-4 h-4" />
                    Machine
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEquipmentChange('no-machine')}
                    className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      equipment === 'no-machine'
                        ? 'bg-[#F97316]/15 border-[#F97316]/50 text-[#FB923C]'
                        : 'bg-[#0D1016] border-white/10 text-[#8E98A8] hover:text-[#F3F5F8]'
                    }`}
                  >
                    <DumbbellIcon className="w-4 h-4" />
                    No Machine
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Weight Calculation Mode Selector */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8]">
                Weight Calculation
              </span>
              <span className="text-[10px] text-[#5C6677]">
                {visibleWeightModeOptions.find((o) => o.id === weightMode)?.hint}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {visibleWeightModeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWeightMode(opt.id)}
                  className={`h-8 px-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    weightMode === opt.id
                      ? 'bg-[#F97316]/15 border-[#F97316]/50 text-[#FB923C]'
                      : 'bg-[#0D1016] border-white/10 text-[#8E98A8] hover:text-[#F3F5F8]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {weightMode === 'barbell' && (
              <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0D1016] border border-white/[0.08]">
                <label
                  htmlFor="bar-weight-input"
                  className="text-[11px] font-medium text-[#8E98A8]"
                >
                  Bar Weight ({unit})
                </label>
                <input
                  id="bar-weight-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={barWeightInput}
                  onChange={(e) => setBarWeightInput(e.target.value)}
                  className="input-field w-20 h-7 px-2 rounded-lg text-xs font-mono font-bold text-right tabular-nums"
                />
              </div>
            )}
          </div>

          {!isMetadataOnly && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="stat-weight-input"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8] mb-1.5"
                  >
                    {weightFieldLabel}
                  </label>
                  <input
                    id="stat-weight-input"
                    type="text"
                    inputMode={isPlateMode ? 'text' : 'decimal'}
                    autoFocus={mode.type === 'log-update'}
                    placeholder={weightFieldPlaceholder}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="input-field w-full h-12 px-3.5 rounded-xl text-base font-mono font-bold tabular-nums placeholder:text-xs placeholder:font-sans placeholder:font-normal placeholder:text-[#5C6677]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="stat-reps-input"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8] mb-1.5"
                  >
                    Best Reps *
                  </label>
                  <input
                    id="stat-reps-input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    placeholder="e.g. 10"
                    value={repsInput}
                    onChange={(e) => setRepsInput(e.target.value)}
                    className="input-field w-full h-12 px-3.5 rounded-xl text-base font-mono font-bold tabular-nums placeholder:text-xs placeholder:font-sans placeholder:font-normal placeholder:text-[#5C6677]"
                  />
                </div>
              </div>

              {/* Quick Plate Chips when in any plate mode */}
              {isPlateMode && (
                <div className="space-y-2 -mt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {platePresets.map((plate) => (
                      <button
                        key={plate}
                        type="button"
                        onClick={() => handleAppendPlate(plate)}
                        className="h-7 px-2.5 rounded-lg bg-white/[0.06] hover:bg-[#F97316]/20 border border-white/10 hover:border-[#F97316]/40 text-[11px] font-mono font-bold text-[#C5CDD9] hover:text-[#FB923C] transition-colors cursor-pointer"
                      >
                        +{formatNumber(plate)}
                      </button>
                    ))}
                    {weightInput.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => setWeightInput('')}
                        className="h-7 px-2 rounded-lg text-[11px] font-semibold text-[#8E98A8] hover:text-rose-300 transition-colors cursor-pointer ml-auto"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Live Calculated Weight Readout */}
              {weightCalc && (isPlateMode || weightInput.includes('+')) ? (
                <div className="px-3.5 py-2.5 rounded-xl bg-[#F97316]/10 border border-[#F97316]/30 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[#FB923C]">
                    Calculated total
                  </span>
                  <span className="text-xs font-mono font-bold text-[#F3F5F8] tabular-nums text-right">
                    {weightCalc.formula}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-[#5C6677] -mt-2">
                  {isPlateMode
                    ? 'Type plates like "45 + 45" or tap plate chips above (leave blank for bodyweight).'
                    : 'Leave weight blank for bodyweight (reps-only) exercises.'}
                </p>
              )}

              {/* Live change preview */}
              {previewComparison && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[11px] font-medium text-[#8E98A8]">
                    Change vs. last entry
                  </span>
                  <DeltaBadge comparison={previewComparison} unit={unit} />
                </div>
              )}

              <div>
                <label
                  htmlFor="stat-date-input"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8] mb-1.5"
                >
                  Date Updated
                </label>
                <input
                  id="stat-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field w-full h-11 px-3.5 rounded-xl text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="stat-note-input"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8] mb-1.5"
                >
                  Note <span className="normal-case text-[#5C6677]">(optional)</span>
                </label>
                <input
                  id="stat-note-input"
                  type="text"
                  maxLength={140}
                  placeholder="e.g. Felt strong, returning from rest week..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-field w-full h-11 px-3.5 rounded-xl text-sm placeholder:text-[#5C6677]"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-white/[0.05] hover:bg-white/10 text-xs font-semibold text-[#C5CDD9] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[1.5] h-11 rounded-xl bg-[#F97316] hover:bg-[#FB923C] text-[#0A0C10] text-xs font-extrabold tracking-wide transition-colors cursor-pointer shadow-lg shadow-[#F97316]/20"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
