import type {
  AppSettings,
  EquipmentType,
  StatEntry,
  TrackedExercise,
  WeightMode,
  WeightUnit,
} from '../types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  isLocalFallback: boolean;
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthUser | null;
  oauthConfigured: boolean;
  authEnforced: boolean;
}

export type SyncStatus =
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'signed-out'
  | 'error';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Ignore non-JSON error bodies
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

export function getGoogleSignInUrl(): string {
  return '/api/auth/google';
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  return apiFetch<AuthStatus>('/api/auth/me');
}

export async function logoutSession(): Promise<void> {
  await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function fetchCloudState(): Promise<{
  exercises: TrackedExercise[];
  settings: AppSettings;
  syncedAt: string;
}> {
  return apiFetch('/api/state');
}

export async function syncSettings(
  settings: AppSettings
): Promise<{ settings: AppSettings; syncedAt: string }> {
  return apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function syncCreateExercise(
  exercise: TrackedExercise
): Promise<{ ok: boolean; syncedAt: string }> {
  return apiFetch('/api/exercises', {
    method: 'POST',
    body: JSON.stringify(exercise),
  });
}

export async function syncUpdateExercise(
  exerciseId: string,
  patch: {
    name: string;
    equipment: EquipmentType;
    weightMode?: WeightMode;
    barWeight?: number;
    barWeightUnit?: WeightUnit;
    updatedAt: number;
  }
): Promise<{ ok: boolean; syncedAt: string }> {
  return apiFetch(`/api/exercises/${encodeURIComponent(exerciseId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function syncDeleteExercise(
  exerciseId: string
): Promise<{ ok: boolean; syncedAt: string }> {
  return apiFetch(`/api/exercises/${encodeURIComponent(exerciseId)}`, {
    method: 'DELETE',
  });
}

export async function syncAddEntry(
  exerciseId: string,
  payload: {
    entry: StatEntry;
    weightMode?: WeightMode;
    barWeight?: number;
    barWeightUnit?: WeightUnit;
    updatedAt: number;
  }
): Promise<{ ok: boolean; syncedAt: string }> {
  return apiFetch(`/api/exercises/${encodeURIComponent(exerciseId)}/entries`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function syncUpdateEntry(
  exerciseId: string,
  entryId: string,
  patch: {
    weight: number | null;
    unit: WeightUnit;
    weightDetail?: string;
    reps: number;
    date: string;
    note?: string;
    updatedAt: number;
  }
): Promise<{ ok: boolean; syncedAt: string }> {
  return apiFetch(
    `/api/exercises/${encodeURIComponent(exerciseId)}/entries/${encodeURIComponent(entryId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
}

export async function syncDeleteEntry(
  exerciseId: string,
  entryId: string
): Promise<{ ok: boolean; syncedAt: string }> {
  return apiFetch(
    `/api/exercises/${encodeURIComponent(exerciseId)}/entries/${encodeURIComponent(entryId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function syncImportState(
  exercises: TrackedExercise[],
  settings?: AppSettings
): Promise<{
  exercises: TrackedExercise[];
  settings: AppSettings;
  importedCount: number;
  syncedAt: string;
}> {
  return apiFetch('/api/import', {
    method: 'POST',
    body: JSON.stringify({ exercises, settings }),
  });
}

export function formatSyncTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Not synced yet';
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
