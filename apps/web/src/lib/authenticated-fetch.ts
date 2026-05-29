import {
  clearAuthSession,
  getAuthSession,
  isAuthSessionPersistent,
  setAuthSession,
  type AuthSessionPayload,
} from '@/lib/auth-session';

type HeaderRecord = Record<string, string>;

function toHeaderRecord(headers: HeadersInit | undefined): HeaderRecord {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function isAuthSessionPayload(payload: unknown): payload is AuthSessionPayload {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;

  return (
    typeof record.accessToken === 'string' &&
    typeof record.refreshToken === 'string' &&
    typeof record.tokenType === 'string' &&
    typeof record.accessTokenExpiresIn === 'string' &&
    typeof record.refreshTokenExpiresIn === 'string'
  );
}

async function requestTokenRefresh(refreshToken: string): Promise<AuthSessionPayload | null> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json();
  return isAuthSessionPayload(payload) ? payload : null;
}

export async function fetchWithAuthRetry(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const session = getAuthSession();
  if (!session) {
    throw new Error('No active auth session');
  }

  const headers = toHeaderRecord(init.headers);
  const withAuthHeaders = {
    ...headers,
    Authorization: `${session.tokenType} ${session.accessToken}`,
  };

  const initialResponse = await fetch(input, {
    ...init,
    headers: withAuthHeaders,
  });

  if (initialResponse.status !== 401) {
    return initialResponse;
  }

  const refreshedSession = await requestTokenRefresh(session.refreshToken);
  if (!refreshedSession) {
    clearAuthSession();
    return initialResponse;
  }

  setAuthSession(refreshedSession, isAuthSessionPersistent());

  return fetch(input, {
    ...init,
    headers: {
      ...headers,
      Authorization: `${refreshedSession.tokenType} ${refreshedSession.accessToken}`,
    },
  });
}
