import { useEffect, useRef, useState } from 'react';
import {
  formatSyncTimestamp,
  getGoogleSignInUrl,
  type AuthStatus,
  type SyncStatus,
} from '../utils/api';

interface AccountMenuProps {
  authStatus: AuthStatus | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  onSignOut: () => void;
}

function getInitials(name: string, email: string): string {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getStatusDisplay(syncStatus: SyncStatus): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  switch (syncStatus) {
    case 'loading':
      return {
        label: 'Connecting…',
        dotClass: 'bg-[#8E98A8]',
        textClass: 'text-[#8E98A8]',
      };
    case 'syncing':
      return {
        label: 'Saving…',
        dotClass: 'bg-[#F97316] animate-pulse',
        textClass: 'text-[#FDBA74]',
      };
    case 'synced':
      return {
        label: 'Saved to cloud',
        dotClass: 'bg-[#22C55E]',
        textClass: 'text-[#86EFAC]',
      };
    case 'offline':
      return {
        label: 'Offline (local)',
        dotClass: 'bg-amber-400',
        textClass: 'text-amber-300',
      };
    case 'error':
      return {
        label: 'Save error',
        dotClass: 'bg-rose-400',
        textClass: 'text-rose-300',
      };
    default:
      return {
        label: 'Local only',
        dotClass: 'bg-[#8E98A8]',
        textClass: 'text-[#8E98A8]',
      };
  }
}

export function GoogleMark({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.6-4.8 9.6-7.3 0-.5-.1-.9-.1-1.3H12z"
      />
      <path
        fill="#34A853"
        d="M3.4 7.4l3.2 2.4C7.5 7.7 9.6 6 12 6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 8.2 2.2 4.9 4.3 3.4 7.4z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.8c2.6 0 4.9-.9 6.5-2.4l-3-2.5c-.8.6-1.9 1-3.5 1-2.7 0-5-1.8-5.8-4.3l-3.2 2.5c1.6 3.3 5 5.7 9 5.7z"
      />
      <path
        fill="#4285F4"
        d="M21.6 14.5c0-.5-.1-.9-.1-1.3H12v3.9h5.5c-.3 1.2-1 2.2-2 2.8l3 2.5c1.8-1.6 3.1-4.1 3.1-7.9z"
      />
    </svg>
  );
}

export function AccountMenu({
  authStatus,
  syncStatus,
  lastSyncedAt,
  onSignOut,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!authStatus) {
    return (
      <div
        aria-hidden="true"
        className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 animate-pulse shrink-0"
      />
    );
  }

  const user = authStatus.authenticated ? authStatus.user : null;

  if (!user) {
    if (!authStatus.oauthConfigured) return null;
    return (
      <a
        href={getGoogleSignInUrl()}
        className="h-8 px-2.5 rounded-lg bg-[#12161E] hover:bg-white/[0.08] border border-white/15 text-[11px] font-bold text-[#F3F5F8] inline-flex items-center gap-1.5 transition-colors shrink-0"
      >
        <GoogleMark className="w-3.5 h-3.5" />
        <span>Sign In</span>
      </a>
    );
  }

  const initials = getInitials(user.name, user.email);
  const status = getStatusDisplay(syncStatus);
  const showPicture = Boolean(user.picture && !avatarFailed);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${user.name}`}
        className="relative flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full bg-[#12161E] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
      >
        <span className="relative w-6 h-6 rounded-full overflow-hidden bg-[#F97316]/20 border border-[#F97316]/40 flex items-center justify-center text-[10px] font-extrabold text-[#FDBA74] shrink-0">
          {showPicture ? (
            <img
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
        <span
          className={`w-2 h-2 rounded-full ${status.dotClass}`}
          title={status.label}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#12161E] border border-white/10 shadow-2xl p-3.5 space-y-3 z-50 animate-enter"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-[#F97316]/20 border border-[#F97316]/40 flex items-center justify-center text-xs font-extrabold text-[#FDBA74] shrink-0">
              {showPicture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#F3F5F8] truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-[#8E98A8] truncate">
                {user.isLocalFallback ? 'Local Dev SQLite' : user.email}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0D1016] border border-white/[0.08] px-3 py-2 space-y-1 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8E98A8]">Status</span>
              <span className={`inline-flex items-center gap-1.5 font-semibold ${status.textClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                {status.label}
              </span>
            </div>
            {lastSyncedAt && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#8E98A8]">Last saved</span>
                <span className="font-mono text-[#C5CDD9]">
                  {formatSyncTimestamp(lastSyncedAt)}
                </span>
              </div>
            )}
          </div>

          {!user.isLocalFallback && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="w-full h-9 px-3 rounded-xl bg-white/[0.05] hover:bg-rose-500/15 hover:text-rose-200 hover:border-rose-500/30 border border-white/10 text-xs font-semibold text-[#C5CDD9] transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
