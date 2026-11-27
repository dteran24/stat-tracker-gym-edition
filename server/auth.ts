import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const SESSION_COOKIE_NAME = 'st_session';
const OAUTH_STATE_COOKIE_NAME = 'st_oauth_state';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const OAUTH_STATE_MAX_AGE_SEC = 60 * 10; // 10 minutes
const LOCAL_DEV_SECRET = 'stat-tracker-local-dev-secret-do-not-use-in-prod';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  isLocalFallback: boolean;
}

interface SessionPayload {
  id: string;
  name: string;
  email: string;
  picture?: string;
  exp: number;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Please sign in with Google to continue.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function isOAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim()
  );
}

export function isPublicMode(): boolean {
  return (
    process.env.PUBLIC_MODE === 'true' || process.env.NODE_ENV === 'production'
  );
}

export function isAuthEnforced(): boolean {
  return isPublicMode() || isOAuthConfigured();
}

function getAuthSecret(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') {
    return LOCAL_DEV_SECRET;
  }
  throw new Error('AUTH_SECRET must be set in production.');
}

function isSecureRequest(req: IncomingMessage): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim() === 'https';
  }
  return process.env.NODE_ENV === 'production';
}

export function getAppOrigin(req: IncomingMessage): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : 'http';
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    typeof forwardedHost === 'string'
      ? forwardedHost.split(',')[0].trim()
      : req.headers.host || 'localhost:3001';
  return `${proto}://${host}`;
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

function appendSetCookie(res: ServerResponse, cookieValue: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieValue]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieValue]);
  }
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`,
  ];
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function signToken(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken<T>(token: string | undefined): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  let expectedSig: string;
  try {
    expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(encoded)
      .digest('base64url');
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  req: IncomingMessage,
  res: ServerResponse,
  user: Omit<AuthenticatedUser, 'isLocalFallback'>
): void {
  const payload: SessionPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.picture ? { picture: user.picture } : {}),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const token = signToken(payload);
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE_NAME, token, {
      maxAge: SESSION_MAX_AGE_SEC,
      secure: isSecureRequest(req),
    })
  );
}

export function clearSessionCookie(req: IncomingMessage, res: ServerResponse): void {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE_NAME, '', {
      maxAge: 0,
      secure: isSecureRequest(req),
    })
  );
}

export function getOptionalUser(req: IncomingMessage): AuthenticatedUser | null {
  if (!isAuthEnforced()) {
    return {
      id: 'local-user',
      name: 'Local Dev',
      email: 'local@localhost',
      isLocalFallback: true,
    };
  }

  const cookies = parseCookies(req.headers.cookie);
  const payload = verifyToken<SessionPayload>(cookies[SESSION_COOKIE_NAME]);
  if (!payload || !payload.id) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    id: payload.id,
    name: payload.name || 'Signed-in User',
    email: payload.email || '',
    ...(payload.picture ? { picture: payload.picture } : {}),
    isLocalFallback: false,
  };
}

export function requireUser(req: IncomingMessage): AuthenticatedUser {
  const user = getOptionalUser(req);
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

export function startGoogleOAuth(req: IncomingMessage, res: ServerResponse): void {
  if (!isOAuthConfigured()) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error:
          'Google Sign-In is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET on the server.',
      })
    );
    return;
  }

  const state = crypto.randomBytes(24).toString('base64url');
  appendSetCookie(
    res,
    serializeCookie(OAUTH_STATE_COOKIE_NAME, state, {
      maxAge: OAUTH_STATE_MAX_AGE_SEC,
      secure: isSecureRequest(req),
    })
  );

  const redirectUri = `${getAppOrigin(req)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function handleGoogleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse,
  query: URLSearchParams
): Promise<void> {
  const clearState = () => {
    appendSetCookie(
      res,
      serializeCookie(OAUTH_STATE_COOKIE_NAME, '', {
        maxAge: 0,
        secure: isSecureRequest(req),
      })
    );
  };

  if (!isOAuthConfigured()) {
    clearState();
    redirect(res, '/?authError=oauth_not_configured');
    return;
  }

  const errorParam = query.get('error');
  if (errorParam) {
    clearState();
    redirect(res, `/?authError=${encodeURIComponent(errorParam)}`);
    return;
  }

  const code = query.get('code');
  const state = query.get('state');
  const cookies = parseCookies(req.headers.cookie);
  const expectedState = cookies[OAUTH_STATE_COOKIE_NAME];

  clearState();

  if (!code || !state || !expectedState || state !== expectedState) {
    redirect(res, '/?authError=invalid_state');
    return;
  }

  try {
    const redirectUri = `${getAppOrigin(req)}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.AUTH_GOOGLE_ID!.trim(),
        client_secret: process.env.AUTH_GOOGLE_SECRET!.trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      redirect(res, '/?authError=token_exchange_failed');
      return;
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      redirect(res, '/?authError=missing_access_token');
      return;
    }

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      redirect(res, '/?authError=userinfo_failed');
      return;
    }

    const profile = (await userRes.json()) as {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
    };

    if (!profile.sub) {
      redirect(res, '/?authError=missing_profile');
      return;
    }

    setSessionCookie(req, res, {
      id: `google:${profile.sub}`,
      name: profile.name || profile.email || 'Signed-in User',
      email: profile.email || '',
      picture: profile.picture,
    });

    redirect(res, '/');
  } catch {
    redirect(res, '/?authError=oauth_failed');
  }
}
