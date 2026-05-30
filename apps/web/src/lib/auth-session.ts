export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  issuedAt: number;
};

export type AuthSessionPayload = Omit<AuthSession, 'issuedAt'>;

type StoredAuthSession = AuthSessionPayload;

const LOCAL_STORAGE_KEY = 'raffle-royale.auth.local';
const SESSION_STORAGE_KEY = 'raffle-royale.auth.session';
const AUTH_SESSION_EVENT = 'raffle-royale:auth-session-change';
type JwtPayload = {
  sub?: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.accessToken === 'string' &&
    typeof record.refreshToken === 'string' &&
    typeof record.tokenType === 'string' &&
    typeof record.accessTokenExpiresIn === 'string' &&
    typeof record.refreshTokenExpiresIn === 'string'
  );
}

function readStoredSession(storage: Storage, key: string): AuthSession | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredAuthSession(parsed)) {
      return null;
    }

    return {
      ...parsed,
      issuedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  if (!isBrowser()) {
    return null;
  }

  const sessionStorageValue = readStoredSession(
    window.sessionStorage,
    SESSION_STORAGE_KEY,
  );
  if (sessionStorageValue) {
    return sessionStorageValue;
  }

  return readStoredSession(window.localStorage, LOCAL_STORAGE_KEY);
}

export function hasAuthSession(): boolean {
  return getAuthSession() !== null;
}

function emitAuthSessionChange(): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

export function subscribeAuthSession(onStoreChange: () => void): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleStorageUpdate = () => {
    onStoreChange();
  };

  window.addEventListener('storage', handleStorageUpdate);
  window.addEventListener(AUTH_SESSION_EVENT, handleStorageUpdate);

  return () => {
    window.removeEventListener('storage', handleStorageUpdate);
    window.removeEventListener(AUTH_SESSION_EVENT, handleStorageUpdate);
  };
}

export function setAuthSession(
  session: AuthSessionPayload,
  persist: boolean,
): void {
  if (!isBrowser()) {
    return;
  }

  const serialized = JSON.stringify(session);

  if (persist) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    emitAuthSessionChange();
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  emitAuthSessionChange();
}

export function clearAuthSession(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  emitAuthSessionChange();
}

export function isAuthSessionPersistent(): boolean {
  if (!isBrowser()) {
    return false;
  }

  return window.localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  const payloadPart = parts[1];

  if (!payloadPart) {
    return null;
  }

  try {
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payloadJson = atob(padded);
    const parsed: unknown = JSON.parse(payloadJson);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

export function getAuthUserId(): string | null {
  const session = getAuthSession();
  if (!session) {
    return null;
  }

  const payload = decodeJwtPayload(session.accessToken);
  return typeof payload?.sub === 'string' && payload.sub.length > 0
    ? payload.sub
    : null;
}
