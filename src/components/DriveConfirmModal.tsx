import { useEffect } from 'react';
import {
  formatDriveTimestamp,
  type DriveDownloadedBackup,
  type DriveFileMeta,
  type DriveSyncConflictReason,
} from '../utils/googleDrive';
import { AlertTriangleIcon, CloudDownloadIcon, CloudUploadIcon, XIcon } from './Icons';

export type DriveDialogState =
  | {
      type: 'sync-conflict';
      reason: DriveSyncConflictReason;
      remoteFile: DriveFileMeta;
      lastDriveSyncedAt: string | null;
    }
  | {
      type: 'confirm-restore';
      backup: DriveDownloadedBackup;
    };

interface DriveConfirmModalProps {
  dialog: DriveDialogState | null;
  localExerciseCount: number;
  localEntryCount: number;
  onClose: () => void;
  onConfirmOverwriteDrive: () => void;
  onRestoreInstead: () => void;
  onConfirmRestore: () => void;
}

export function DriveConfirmModal({
  dialog,
  localExerciseCount,
  localEntryCount,
  onClose,
  onConfirmOverwriteDrive,
  onRestoreInstead,
  onConfirmRestore,
}: DriveConfirmModalProps) {
  useEffect(() => {
    if (!dialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, onClose]);

  if (!dialog) return null;

  const isConflict = dialog.type === 'sync-conflict';
  const remoteEntryCount =
    dialog.type === 'confirm-restore'
      ? dialog.backup.exercises.reduce((sum, ex) => sum + ex.entries.length, 0)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-dialog-title"
        className="w-full max-w-md rounded-2xl bg-[#12161E] border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="drive-dialog-title"
                className="text-sm font-extrabold text-[#F3F5F8]"
              >
                {isConflict
                  ? dialog.reason === 'local-empty'
                    ? 'Local Workouts Are Empty'
                    : 'Newer Backup Found on Drive'
                  : 'Replace Local Data?'}
              </h2>
              <p className="text-[11px] text-[#8E98A8]">
                Google Drive Sync Safeguard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8E98A8] hover:text-[#F3F5F8] hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 text-xs text-[#C5CDD9] leading-relaxed">
          {isConflict ? (
            <>
              {dialog.reason === 'local-empty' ? (
                <p>
                  This device currently has <strong className="text-[#F3F5F8]">0 workouts</strong>,
                  but a backup already exists in Google Drive. Syncing now will overwrite your
                  Drive backup with an empty list.
                </p>
              ) : (
                <p>
                  Your Google Drive backup was modified more recently than this device&apos;s last
                  sync (for example, from another device). Overwriting it could discard newer
                  updates.
                </p>
              )}

              <div className="rounded-xl bg-[#0D1016] border border-white/[0.08] p-3 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8E98A8]">Drive backup updated</span>
                  <span className="font-mono font-semibold text-[#F3F5F8]">
                    {formatDriveTimestamp(dialog.remoteFile.modifiedTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8E98A8]">Last synced here</span>
                  <span className="font-mono font-semibold text-[#C5CDD9]">
                    {formatDriveTimestamp(dialog.lastDriveSyncedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8E98A8]">Workouts on this device</span>
                  <span className="font-mono font-semibold text-[#F3F5F8]">
                    {localExerciseCount}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p>
                Restoring from Google Drive will <strong className="text-[#F3F5F8]">replace</strong>{' '}
                all workouts currently stored on this device.
              </p>

              <div className="rounded-xl bg-[#0D1016] border border-white/[0.08] p-3 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8E98A8]">Drive backup</span>
                  <span className="font-mono font-semibold text-[#86EFAC]">
                    {dialog.backup.exercises.length} workout(s) · {remoteEntryCount} update(s)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8E98A8]">Drive modified</span>
                  <span className="font-mono font-semibold text-[#F3F5F8]">
                    {formatDriveTimestamp(dialog.backup.modifiedTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8E98A8]">Current local data</span>
                  <span className="font-mono font-semibold text-[#C5CDD9]">
                    {localExerciseCount} workout(s) · {localEntryCount} update(s)
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
          {isConflict ? (
            <>
              <button
                type="button"
                onClick={onRestoreInstead}
                className="w-full h-10 px-4 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-[#0A0C10] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CloudDownloadIcon className="w-4 h-4" />
                Restore from Drive Instead
              </button>
              <button
                type="button"
                onClick={onConfirmOverwriteDrive}
                className="w-full h-10 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CloudUploadIcon className="w-4 h-4" />
                Overwrite Drive Backup Anyway
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-9 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8E98A8] hover:text-[#F3F5F8] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onConfirmRestore}
                className="w-full h-10 px-4 rounded-xl bg-[#F97316] hover:bg-[#FB923C] text-[#0A0C10] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CloudDownloadIcon className="w-4 h-4" />
                Replace Local Data
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-9 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8E98A8] hover:text-[#F3F5F8] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
