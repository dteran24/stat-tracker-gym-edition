import type { AppSettings, TrackedExercise } from '../types';
import {
  clearDriveSyncCache,
  exportBackupJson,
  loadDriveSyncCache,
  parseBackupJson,
  saveDriveFileId,
  saveDriveFolderId,
  saveLastDriveSyncedAt,
} from './storage';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FOLDER_NAME = 'Stat Tracker Gym';
export const DRIVE_FILE_NAME = 'stat-tracker-backup.json';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

export class DriveActionCancelledError extends Error {
  constructor(message = 'Google sign-in was cancelled.') {
    super(message);
    this.name = 'DriveActionCancelledError';
  }
}

export interface DriveFileMeta {
  id: string;
  modifiedTime: string;
}

export type DriveSyncConflictReason = 'local-empty' | 'drive-newer';

export interface DrivePreSyncInspection {
  remoteFile: DriveFileMeta | null;
  conflictReason: DriveSyncConflictReason | null;
  lastDriveSyncedAt: string | null;
}

export interface DriveDownloadedBackup {
  fileId: string;
  modifiedTime: string;
  exercises: TrackedExercise[];
  settings?: AppSettings;
}

export function getGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
}

export function isGoogleDriveConfigured(): boolean {
  return getGoogleClientId().length > 0;
}

export function formatDriveTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function hasActiveDriveSession(): boolean {
  return Boolean(cachedAccessToken && Date.now() < tokenExpiresAt - 60_000);
}

export function clearDriveAccessToken(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

export function disconnectGoogleDrive(): void {
  const token = cachedAccessToken;
  clearDriveAccessToken();
  clearDriveSyncCache();
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token);
    } catch {
      // Ignore revoke errors on disconnect
    }
  }
}

type GoogleOAuth2Api = NonNullable<
  NonNullable<NonNullable<Window['google']>['accounts']>['oauth2']
>;

async function waitForGisReady(timeoutMs = 5000): Promise<GoogleOAuth2Api> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const oauth2 = window.google?.accounts?.oauth2;
    if (oauth2 && typeof oauth2.initTokenClient === 'function') {
      return oauth2;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  throw new Error(
    'Google Identity Services failed to load. Check your internet connection or disable blockers for accounts.google.com.'
  );
}

export async function requestDriveAccessToken(options?: {
  forcePrompt?: boolean;
}): Promise<string> {
  if (!options?.forcePrompt && hasActiveDriveSession() && cachedAccessToken) {
    return cachedAccessToken;
  }

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      'Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID in your environment.'
    );
  }

  const oauth2 = await waitForGisReady();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          if (response.error === 'access_denied') {
            reject(new DriveActionCancelledError('Google Drive permission was denied.'));
            return;
          }
          reject(
            new Error(
              response.error_description ||
                response.error ||
                'Failed to authorize Google Drive.'
            )
          );
          return;
        }

        const expiresInSec =
          typeof response.expires_in === 'number' && response.expires_in > 0
            ? response.expires_in
            : 3600;
        cachedAccessToken = response.access_token;
        tokenExpiresAt = Date.now() + expiresInSec * 1000;
        resolve(response.access_token);
      },
      error_callback: (err) => {
        if (err.type === 'popup_closed') {
          reject(new DriveActionCancelledError('Google sign-in popup was closed.'));
          return;
        }
        if (err.type === 'popup_failed_to_open') {
          reject(
            new Error(
              'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.'
            )
          );
          return;
        }
        reject(new Error(err.message || 'Google sign-in failed.'));
      },
    });

    tokenClient.requestAccessToken({
      prompt: options?.forcePrompt ? 'select_account' : '',
    });
  });
}

async function driveFetch(
  url: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    clearDriveAccessToken();
    throw new Error('Google session expired. Tap the button again to reconnect.');
  }

  return response;
}

async function readDriveErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
    };
    if (data?.error?.message) return data.error.message;
  } catch {
    // Fall back to status text
  }
  return `Google Drive request failed (${response.status}).`;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function getFolderIfValid(
  token: string,
  folderId: string
): Promise<string | null> {
  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed`;
  const res = await driveFetch(url, token);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readDriveErrorMessage(res));
  }
  const data = (await res.json()) as {
    id?: string;
    mimeType?: string;
    trashed?: boolean;
  };
  if (data.id && data.mimeType === FOLDER_MIME_TYPE && !data.trashed) {
    return data.id;
  }
  return null;
}

async function findFolderId(token: string): Promise<string | null> {
  const cache = loadDriveSyncCache();
  if (cache.folderId) {
    const validId = await getFolderIfValid(token, cache.folderId);
    if (validId) return validId;
    saveDriveFolderId(null);
  }

  const query = `name = '${escapeDriveQueryValue(DRIVE_FOLDER_NAME)}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive&pageSize=1`;
  const res = await driveFetch(url, token);
  if (!res.ok) {
    throw new Error(await readDriveErrorMessage(res));
  }
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  const foundId = data.files?.[0]?.id ?? null;
  if (foundId) {
    saveDriveFolderId(foundId);
  }
  return foundId;
}

async function ensureFolderId(token: string): Promise<string> {
  const existing = await findFolderId(token);
  if (existing) return existing;

  const url = `${DRIVE_API_BASE}/files?fields=id`;
  const res = await driveFetch(url, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: FOLDER_MIME_TYPE,
    }),
  });
  if (!res.ok) {
    throw new Error(await readDriveErrorMessage(res));
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error('Google Drive did not return a folder ID.');
  }
  saveDriveFolderId(data.id);
  return data.id;
}

async function getFileMetadata(
  token: string,
  fileId: string
): Promise<DriveFileMeta | null> {
  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,modifiedTime,trashed`;
  const res = await driveFetch(url, token);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readDriveErrorMessage(res));
  }
  const data = (await res.json()) as {
    id?: string;
    modifiedTime?: string;
    trashed?: boolean;
  };
  if (!data.id || !data.modifiedTime || data.trashed) {
    return null;
  }
  return { id: data.id, modifiedTime: data.modifiedTime };
}

async function findBackupFile(token: string): Promise<DriveFileMeta | null> {
  const cache = loadDriveSyncCache();
  if (cache.fileId) {
    const meta = await getFileMetadata(token, cache.fileId);
    if (meta) return meta;
    saveDriveFileId(null);
  }

  const folderId = await findFolderId(token);
  if (!folderId) return null;

  const query = `name = '${escapeDriveQueryValue(DRIVE_FILE_NAME)}' and '${escapeDriveQueryValue(folderId)}' in parents and trashed = false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,modifiedTime)&spaces=drive&pageSize=1`;
  const res = await driveFetch(url, token);
  if (!res.ok) {
    throw new Error(await readDriveErrorMessage(res));
  }
  const data = (await res.json()) as {
    files?: Array<{ id: string; modifiedTime?: string }>;
  };
  const file = data.files?.[0];
  if (!file?.id) return null;

  saveDriveFileId(file.id);
  if (file.modifiedTime) {
    return { id: file.id, modifiedTime: file.modifiedTime };
  }
  return getFileMetadata(token, file.id);
}

export async function inspectDriveBeforeSync(
  token: string,
  localExerciseCount: number
): Promise<DrivePreSyncInspection> {
  const { lastDriveSyncedAt } = loadDriveSyncCache();
  const remoteFile = await findBackupFile(token);

  if (!remoteFile) {
    return {
      remoteFile: null,
      conflictReason: null,
      lastDriveSyncedAt,
    };
  }

  if (localExerciseCount === 0) {
    return {
      remoteFile,
      conflictReason: 'local-empty',
      lastDriveSyncedAt,
    };
  }

  const remoteMs = Date.parse(remoteFile.modifiedTime);
  const lastSyncMs = lastDriveSyncedAt ? Date.parse(lastDriveSyncedAt) : Number.NaN;
  const isDriveNewer =
    Number.isNaN(lastSyncMs) || (!Number.isNaN(remoteMs) && remoteMs > lastSyncMs);

  return {
    remoteFile,
    conflictReason: isDriveNewer ? 'drive-newer' : null,
    lastDriveSyncedAt,
  };
}

export async function uploadBackupToDrive(
  token: string,
  exercises: TrackedExercise[],
  settings: AppSettings,
  existingFileId: string | null
): Promise<DriveFileMeta> {
  const jsonContent = exportBackupJson(exercises, settings);

  if (existingFileId) {
    const url = `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(existingFileId)}?uploadType=media&fields=id,modifiedTime`;
    const res = await driveFetch(url, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: jsonContent,
    });
    if (!res.ok) {
      throw new Error(await readDriveErrorMessage(res));
    }
    const data = (await res.json()) as { id?: string; modifiedTime?: string };
    const id = data.id ?? existingFileId;
    const modifiedTime = data.modifiedTime ?? new Date().toISOString();
    saveDriveFileId(id);
    saveLastDriveSyncedAt(modifiedTime);
    return { id, modifiedTime };
  }

  const folderId = await ensureFolderId(token);
  const boundary = `stat-tracker-boundary-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({
    name: DRIVE_FILE_NAME,
    parents: [folderId],
    mimeType: 'application/json',
  });

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    jsonContent,
    `--${boundary}--`,
  ].join('\r\n');

  const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,modifiedTime`;
  const res = await driveFetch(url, token, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    throw new Error(await readDriveErrorMessage(res));
  }

  const data = (await res.json()) as { id?: string; modifiedTime?: string };
  if (!data.id) {
    throw new Error('Google Drive did not return a file ID after upload.');
  }
  const modifiedTime = data.modifiedTime ?? new Date().toISOString();
  saveDriveFileId(data.id);
  saveLastDriveSyncedAt(modifiedTime);
  return { id: data.id, modifiedTime };
}

export async function downloadBackupFromDrive(
  token: string
): Promise<DriveDownloadedBackup | null> {
  const remoteFile = await findBackupFile(token);
  if (!remoteFile) return null;

  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(remoteFile.id)}?alt=media`;
  const res = await driveFetch(url, token);
  if (!res.ok) {
    throw new Error(await readDriveErrorMessage(res));
  }

  const rawText = await res.text();
  const parsed = parseBackupJson(rawText);

  return {
    fileId: remoteFile.id,
    modifiedTime: remoteFile.modifiedTime,
    exercises: parsed.exercises,
    settings: parsed.settings,
  };
}
