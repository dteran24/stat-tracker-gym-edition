import { useEffect, useMemo, useState } from 'react';
import type {
  ActiveTab,
  AppSettings,
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightMode,
  WeightUnit,
} from './types';
import { BottomNav } from './components/BottomNav';
import {
  DriveConfirmModal,
  type DriveDialogState,
} from './components/DriveConfirmModal';
import { EntryModal, type ModalMode } from './components/EntryModal';
import { ExerciseDetailView } from './components/ExerciseDetailView';
import { ExerciseListView } from './components/ExerciseListView';
import { DumbbellIcon } from './components/Icons';
import { StatsView } from './components/StatsView';
import {
  disconnectGoogleDrive,
  downloadBackupFromDrive,
  DriveActionCancelledError,
  inspectDriveBeforeSync,
  isGoogleDriveConfigured,
  requestDriveAccessToken,
  uploadBackupToDrive,
} from './utils/googleDrive';
import {
  createId,
  loadDriveSyncCache,
  loadExercises,
  loadSettings,
  parseBackupJson,
  saveExercises,
  saveLastDriveSyncedAt,
  saveSettings,
  sortEntriesDesc,
  sortExercisesRecentDesc,
} from './utils/storage';

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('exercises');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<TrackedExercise[]>(() => loadExercises());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [driveBusyAction, setDriveBusyAction] = useState<'sync' | 'restore' | null>(null);
  const [driveDialog, setDriveDialog] = useState<DriveDialogState | null>(null);
  const [lastDriveSyncedAt, setLastDriveSyncedAt] = useState<string | null>(
    () => loadDriveSyncCache().lastDriveSyncedAt
  );
  const driveConfigured = isGoogleDriveConfigured();

  useEffect(() => {
    saveExercises(exercises);
  }, [exercises]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  };

  const selectedExercise = useMemo(
    () =>
      selectedExerciseId
        ? exercises.find((ex) => ex.id === selectedExerciseId) ?? null
        : null,
    [exercises, selectedExerciseId]
  );

  const handleUnitChange = (nextUnit: WeightUnit) => {
    if (nextUnit === settings.unit) return;
    setSettings({ unit: nextUnit });
  };

  const handleCreateExercise = (payload: {
    name: string;
    equipment: EquipmentType;
    weightMode: WeightMode;
    barWeight?: number;
    weight: number | null;
    weightDetail?: string;
    reps: number;
    date: string;
    note: string;
  }) => {
    const now = Date.now();
    const initialEntry: StatEntry = {
      id: createId(),
      weight: payload.weight,
      unit: settings.unit,
      weightDetail: payload.weightDetail,
      reps: payload.reps,
      date: payload.date,
      note: payload.note || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const newExercise: TrackedExercise = {
      id: createId(),
      name: payload.name,
      equipment: payload.equipment,
      weightMode: payload.weightMode,
      barWeight: payload.barWeight,
      barWeightUnit: payload.barWeight !== undefined ? settings.unit : undefined,
      entries: [initialEntry],
      createdAt: now,
      updatedAt: now,
    };

    setExercises((prev) => [newExercise, ...prev].sort(sortExercisesRecentDesc));
    setModalMode(null);
    showToast(`Added "${payload.name}"!`);
  };

  const handleLogUpdate = (
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
  ) => {
    const now = Date.now();
    const newEntry: StatEntry = {
      id: createId(),
      weight: payload.weight,
      unit: settings.unit,
      weightDetail: payload.weightDetail,
      reps: payload.reps,
      date: payload.date,
      note: payload.note || undefined,
      createdAt: now,
      updatedAt: now,
    };

    setExercises((prev) =>
      prev
        .map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                weightMode: payload.weightMode,
                barWeight: payload.barWeight,
                barWeightUnit:
                  payload.barWeight !== undefined ? settings.unit : undefined,
                entries: [newEntry, ...ex.entries].sort(sortEntriesDesc),
                updatedAt: now,
              }
            : ex
        )
        .sort(sortExercisesRecentDesc)
    );

    setModalMode(null);
    showToast('Update recorded!');
  };

  const handleEditEntry = (
    exerciseId: string,
    entryId: string,
    payload: {
      weight: number | null;
      weightDetail?: string;
      reps: number;
      date: string;
      note: string;
    }
  ) => {
    const now = Date.now();
    setExercises((prev) =>
      prev
        .map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                entries: ex.entries
                  .map((entry) =>
                    entry.id === entryId
                      ? {
                          ...entry,
                          weight: payload.weight,
                          unit: settings.unit,
                          weightDetail: payload.weightDetail,
                          reps: payload.reps,
                          date: payload.date,
                          note: payload.note || undefined,
                          updatedAt: now,
                        }
                      : entry
                  )
                  .sort(sortEntriesDesc),
                updatedAt: now,
              }
            : ex
        )
        .sort(sortExercisesRecentDesc)
    );

    setModalMode(null);
    showToast('Entry updated!');
  };

  const handleDeleteEntry = (exerciseId: string, entryId: string) => {
    const now = Date.now();
    setExercises((prev) =>
      prev
        .map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                entries: ex.entries.filter((e) => e.id !== entryId),
                updatedAt: now,
              }
            : ex
        )
        .sort(sortExercisesRecentDesc)
    );
    showToast('Entry deleted.');
  };

  const handleEditExercise = (
    exerciseId: string,
    payload: {
      name: string;
      equipment: EquipmentType;
      weightMode: WeightMode;
      barWeight?: number;
    }
  ) => {
    const now = Date.now();
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              name: payload.name,
              equipment: payload.equipment,
              weightMode: payload.weightMode,
              barWeight: payload.barWeight,
              barWeightUnit:
                payload.barWeight !== undefined ? settings.unit : undefined,
              updatedAt: now,
            }
          : ex
      )
    );
    setModalMode(null);
    showToast('Workout details updated.');
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
    if (selectedExerciseId === exerciseId) {
      setSelectedExerciseId(null);
    }
    showToast('Workout deleted.');
  };

  const handleImportJson = (jsonText: string) => {
    try {
      const imported = parseBackupJson(jsonText);
      setExercises((prev) => {
        const byId = new Map<string, TrackedExercise>();
        for (const ex of prev) byId.set(ex.id, ex);

        for (const incoming of imported.exercises) {
          const existing = byId.get(incoming.id);
          if (!existing) {
            byId.set(incoming.id, incoming);
          } else {
            const entriesById = new Map<string, StatEntry>();
            for (const entry of existing.entries) entriesById.set(entry.id, entry);
            for (const entry of incoming.entries) entriesById.set(entry.id, entry);
            const mergedEntries = Array.from(entriesById.values()).sort(sortEntriesDesc);

            byId.set(incoming.id, {
              ...existing,
              ...incoming,
              entries: mergedEntries,
              createdAt: Math.min(existing.createdAt, incoming.createdAt),
              updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
            });
          }
        }

        return Array.from(byId.values()).sort(sortExercisesRecentDesc);
      });
      if (imported.settings) {
        setSettings(imported.settings);
      }
      showToast(`Imported & merged ${imported.exercises.length} workout(s)!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import JSON file.';
      showToast(msg, 'error');
    }
  };

  const handleSyncToDrive = async () => {
    if (driveBusyAction) return;
    setDriveBusyAction('sync');
    try {
      const token = await requestDriveAccessToken();
      const inspection = await inspectDriveBeforeSync(token, exercises.length);

      if (inspection.conflictReason && inspection.remoteFile) {
        setDriveDialog({
          type: 'sync-conflict',
          reason: inspection.conflictReason,
          remoteFile: inspection.remoteFile,
          lastDriveSyncedAt: inspection.lastDriveSyncedAt,
        });
        return;
      }

      const saved = await uploadBackupToDrive(
        token,
        exercises,
        settings,
        inspection.remoteFile?.id ?? null
      );
      setLastDriveSyncedAt(saved.modifiedTime);
      showToast('Synced backup to Google Drive!');
    } catch (err) {
      if (err instanceof DriveActionCancelledError) {
        showToast(err.message, 'error');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to sync to Google Drive.';
        showToast(msg, 'error');
      }
    } finally {
      setDriveBusyAction(null);
    }
  };

  const handleConfirmOverwriteDrive = async () => {
    if (driveDialog?.type !== 'sync-conflict' || driveBusyAction) return;
    const remoteFileId = driveDialog.remoteFile.id;
    setDriveDialog(null);
    setDriveBusyAction('sync');
    try {
      const token = await requestDriveAccessToken();
      const saved = await uploadBackupToDrive(token, exercises, settings, remoteFileId);
      setLastDriveSyncedAt(saved.modifiedTime);
      showToast('Overwrote Google Drive backup!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to overwrite Google Drive backup.';
      showToast(msg, 'error');
    } finally {
      setDriveBusyAction(null);
    }
  };

  const handleRestoreFromDrive = async () => {
    if (driveBusyAction) return;
    setDriveDialog(null);
    setDriveBusyAction('restore');
    try {
      const token = await requestDriveAccessToken();
      const backup = await downloadBackupFromDrive(token);
      if (!backup) {
        showToast('No backup found in Google Drive yet.', 'error');
        return;
      }
      setDriveDialog({
        type: 'confirm-restore',
        backup,
      });
    } catch (err) {
      if (err instanceof DriveActionCancelledError) {
        showToast(err.message, 'error');
      } else {
        const msg =
          err instanceof Error ? err.message : 'Failed to load backup from Google Drive.';
        showToast(msg, 'error');
      }
    } finally {
      setDriveBusyAction(null);
    }
  };

  const handleConfirmRestore = () => {
    if (driveDialog?.type !== 'confirm-restore') return;
    const { backup } = driveDialog;
    setExercises(backup.exercises);
    if (backup.settings) {
      setSettings(backup.settings);
    }
    if (
      selectedExerciseId &&
      !backup.exercises.some((ex) => ex.id === selectedExerciseId)
    ) {
      setSelectedExerciseId(null);
    }
    saveLastDriveSyncedAt(backup.modifiedTime);
    setLastDriveSyncedAt(backup.modifiedTime);
    setDriveDialog(null);
    showToast(`Restored ${backup.exercises.length} workout(s) from Google Drive!`);
  };

  const handleDisconnectDrive = () => {
    disconnectGoogleDrive();
    setLastDriveSyncedAt(null);
    showToast('Reset Google Drive link.');
  };

  const handleOpenExercise = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setActiveTab('exercises');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'exercises') {
      setSelectedExerciseId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-[#0A0C10] text-[#F3F5F8] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0A0C10]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleTabChange('exercises')}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#F97316]/15 border border-[#F97316]/30 flex items-center justify-center text-[#F97316] shrink-0">
              <DumbbellIcon className="w-4 h-4" />
            </div>
            <div className="leading-tight truncate">
              <h1 className="text-sm font-extrabold tracking-tight text-[#F3F5F8]">
                Stat Tracker
              </h1>
              <p className="text-[11px] font-medium text-[#8E98A8]">
                Gym Edition
              </p>
            </div>
          </button>

          {/* Quick lbs / kg Toggle */}
          <div
            role="group"
            aria-label="Weight unit"
            className="inline-flex rounded-lg bg-[#12161E] p-0.5 border border-white/10 shrink-0"
          >
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                id={`header-unit-${u}`}
                type="button"
                onClick={() => handleUnitChange(u)}
                className={`h-7 px-2.5 rounded-md text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  settings.unit === u
                    ? 'bg-[#F97316] text-[#0A0C10]'
                    : 'text-[#8E98A8] hover:text-[#F3F5F8]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-4">
        {activeTab === 'exercises' && selectedExercise ? (
          <ExerciseDetailView
            exercise={selectedExercise}
            unit={settings.unit}
            onBack={() => setSelectedExerciseId(null)}
            onLogUpdate={(ex) => setModalMode({ type: 'log-update', exercise: ex })}
            onEditExercise={(ex) => setModalMode({ type: 'edit-exercise', exercise: ex })}
            onDeleteExercise={handleDeleteExercise}
            onEditEntry={(ex, entry) =>
              setModalMode({ type: 'edit-entry', exercise: ex, entry })
            }
            onDeleteEntry={handleDeleteEntry}
          />
        ) : activeTab === 'exercises' ? (
          <ExerciseListView
            exercises={exercises}
            unit={settings.unit}
            onAddExercise={() => setModalMode({ type: 'create-exercise' })}
            onLogUpdate={(ex) => setModalMode({ type: 'log-update', exercise: ex })}
            onOpenDetail={handleOpenExercise}
          />
        ) : (
          <StatsView
            exercises={exercises}
            settings={settings}
            onChangeUnit={handleUnitChange}
            onImportJson={handleImportJson}
            onOpenExercise={handleOpenExercise}
            driveConfigured={driveConfigured}
            driveBusyAction={driveBusyAction}
            lastDriveSyncedAt={lastDriveSyncedAt}
            onSyncToDrive={handleSyncToDrive}
            onRestoreFromDrive={handleRestoreFromDrive}
            onDisconnectDrive={handleDisconnectDrive}
          />
        )}
      </main>

      {/* Create / Update / Edit Modal */}
      <EntryModal
        mode={modalMode}
        unit={settings.unit}
        onClose={() => setModalMode(null)}
        onSubmitCreate={handleCreateExercise}
        onSubmitLogUpdate={handleLogUpdate}
        onSubmitEditEntry={handleEditEntry}
        onSubmitEditExercise={handleEditExercise}
      />

      {/* Google Drive Conflict / Restore Confirmation Modal */}
      <DriveConfirmModal
        dialog={driveDialog}
        localExerciseCount={exercises.length}
        localEntryCount={exercises.reduce((sum, ex) => sum + ex.entries.length, 0)}
        onClose={() => setDriveDialog(null)}
        onConfirmOverwriteDrive={handleConfirmOverwriteDrive}
        onRestoreInstead={handleRestoreFromDrive}
        onConfirmRestore={handleConfirmRestore}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 inset-x-4 z-50 mx-auto max-w-sm animate-enter"
        >
          <div
            className={`px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl border text-center ${
              toast.tone === 'error'
                ? 'bg-rose-950/95 border-rose-500/40 text-rose-200'
                : 'bg-[#141A24]/95 border-[#22C55E]/35 text-[#86EFAC]'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChange={handleTabChange}
        exerciseCount={exercises.length}
      />
    </div>
  );
}
