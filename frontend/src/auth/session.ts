import { client } from '../api/client.gen';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
/** Refresh slightly early so a request never leaves with a token about to expire. */
const EXPIRY_MARGIN_MS = 30_000;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getAccessToken = () => read(ACCESS_KEY);

export function saveSession(accessToken: string, refreshToken?: string | null) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Fire-and-forget: revokes the server-side session, then forgets the tokens locally. */
export function signOut() {
  const refreshToken = read(REFRESH_KEY);
  clearSession();
  if (refreshToken) {
    void fetch(`${client.getConfig().baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    }).catch(() => undefined);
  }
}

function isExpiring(token: string) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' && exp * 1000 - Date.now() < EXPIRY_MARGIN_MS;
  } catch {
    return false;
  }
}

let inflight: Promise<boolean> | null = null;

/** Single-flight: concurrent callers share one refresh, since each refresh token works once. */
function refreshSession(): Promise<boolean> {
  inflight ??= exchangeRefreshToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function exchangeRefreshToken(): Promise<boolean> {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${client.getConfig().baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.ok) {
      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      saveSession(body.accessToken, body.refreshToken);
      return true;
    }
    // Another tab may have rotated the token a moment ago; its new tokens are already stored.
    if (read(REFRESH_KEY) !== refreshToken) return true;
    if (res.status === 401) clearSession();
    return false;
  } catch {
    return false; // offline: keep the session and try again on the next request
  }
}

/** Returns a usable access token, refreshing it first if it is about to expire. */
export async function getFreshAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token && !isExpiring(token)) return token;
  if (!read(REFRESH_KEY)) return token;
  await refreshSession();
  return getAccessToken();
}
