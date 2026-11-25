import { useEffect, useState } from 'react';
import type { EquipmentType, StatEntry, TrackedExercise, WeightUnit } from '../types';
import {
  compareEntries,
  formatFullDate,
  formatNumber,
  formatWeightLabel,
  getEntryWeightInUnit,
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
    weight: number | null;
    reps: number;
    date: string;
    note: string;
  }) => void;
  onSubmitLogUpdate: (
    exerciseId: string,
    payload: { weight: number | null; reps: number; date: string; note: string }
  ) => void;
  onSubmitEditEntry: (
    exerciseId: string,
    entryId: string,
    payload: { weight: number | null; reps: number; date: string; note: string }
  ) => void;
  onSubmitEditExercise: (
    exerciseId: string,
    payload: { name: string; equipment: EquipmentType }
  ) => void;
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
      return `edit-ex-${mode.exercise.id}`;
  }
}

export function EntryModal(props: EntryModalProps) {
  const { mode, unit } = props;
  if (!mode) return null;

  return (
    <EntryModalDialog
      key={getModalKey(mode, unit)}
      {...props}
      mode={mode}
    />
  );
}

interface EntryModalDialogProps extends Omit<EntryModalProps, 'mode'> {
  mode: ModalMode;
}

function getInitialValues(mode: ModalMode, unit: WeightUnit) {
  if (mode.type === 'create-exercise') {
    return {
      name: '',
      equipment: 'no-machine' as EquipmentType,
      weightInput: '',
      repsInput: '',
      date: getTodayIso(),
      note: '',
    };
  }
  if (mode.type === 'log-update') {
    const latest = mode.exercise.entries[0];
    const latestW = latest ? getEntryWeightInUnit(latest, unit) : null;
    return {
      name: mode.exercise.name,
      equipment: mode.exercise.equipment,
      weightInput: latestW !== null ? formatNumber(latestW) : '',
      repsInput: latest ? String(latest.reps) : '',
      date: getTodayIso(),
      note: '',
    };
  }
  if (mode.type === 'edit-entry') {
    const entryW = getEntryWeightInUnit(mode.entry, unit);
    return {
      name: mode.exercise.name,
      equipment: mode.exercise.equipment,
      weightInput: entryW !== null ? formatNumber(entryW) : '',
      repsInput: String(mode.entry.reps),
      date: mode.entry.date,
      note: mode.entry.note ?? '',
    };
  }
  return {
    name: mode.exercise.name,
    equipment: mode.exercise.equipment,
    weightInput: '',
    repsInput: '',
    date: getTodayIso(),
    note: '',
  };
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

  // Live preview of comparison when logging a new update
  const latestEntry = mode.type === 'log-update' ? mode.exercise.entries[0] : undefined;
  const parsedWeightPreview =
    weightInput.trim() === '' ? null : Number(weightInput.trim());
  const parsedRepsPreview = Number(repsInput.trim());
  const canPreviewDelta =
    mode.type === 'log-update' &&
    latestEntry !== undefined &&
    Number.isFinite(parsedRepsPreview) &&
    parsedRepsPreview > 0 &&
    (parsedWeightPreview === null ||
      (Number.isFinite(parsedWeightPreview) && parsedWeightPreview >= 0));

  const previewComparison = canPreviewDelta
    ? compareEntries(
        {
          id: 'preview',
          weight: parsedWeightPreview,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (showNameAndEquipment && name.trim().length === 0) {
      setError('Please enter a workout / exercise name.');
      return;
    }

    if (mode.type === 'edit-exercise') {
      onSubmitEditExercise(mode.exercise.id, {
        name: name.trim(),
        equipment,
      });
      return;
    }

    const trimmedWeight = weightInput.trim();
    let weight: number | null = null;
    if (trimmedWeight !== '') {
      const numW = Number(trimmedWeight);
      if (!Number.isFinite(numW) || numW < 0) {
        setError('Weight must be a valid non-negative number (or leave blank for bodyweight).');
        return;
      }
      weight = Math.round(numW * 10) / 10;
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
        weight,
        reps,
        date,
        note: cleanNote,
      });
    } else if (mode.type === 'log-update') {
      onSubmitLogUpdate(mode.exercise.id, {
        weight,
        reps,
        date,
        note: cleanNote,
      });
    } else if (mode.type === 'edit-entry') {
      onSubmitEditEntry(mode.exercise.id, mode.entry.id, {
        weight,
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
                  placeholder="e.g. Bench Press, Lat Pulldown, Pull-Ups"
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
                    onClick={() => setEquipment('machine')}
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
                    onClick={() => setEquipment('no-machine')}
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

          {!isMetadataOnly && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="stat-weight-input"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#8E98A8] mb-1.5"
                  >
                    Weight ({unit})
                  </label>
                  <input
                    id="stat-weight-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    autoFocus={mode.type === 'log-update'}
                    placeholder="Bodyweight"
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

              <p className="text-[11px] text-[#5C6677] -mt-2">
                Leave weight blank for bodyweight (reps-only) exercises.
              </p>

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
