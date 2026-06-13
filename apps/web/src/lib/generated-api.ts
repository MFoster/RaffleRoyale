import { authRefresh } from '@/generated/clients';
import {
  clearAuthSession,
  getAuthSession,
  isAuthSessionPersistent,
  setAuthSession,
  type AuthSession,
  type AuthSessionPayload,
} from '@/lib/auth-session';
import type { RequestConfig } from '@kubb/plugin-client/clients/axios';

type ApiRequestConfig<TData = never> = Partial<RequestConfig<TData>>;

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: unknown;
  };
};

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

function getApiErrorLike(error: unknown): ApiErrorLike | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate = error as ApiErrorLike;
  return candidate.response ? candidate : null;
}

function parseMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  const message = (data as Record<string, unknown>).message;
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(' ');
  }

  return null;
}

function getAuthHeaders(session: AuthSession): Record<string, string> {
  return {
    Authorization: `${session.tokenType} ${session.accessToken}`,
  };
}

export function getApiErrorStatus(error: unknown): number | null {
  const apiError = getApiErrorLike(error);
  return typeof apiError?.response?.status === 'number'
    ? apiError.response.status
    : null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = getApiErrorLike(error);
  const message = parseMessage(apiError?.response?.data);
  return message ?? fallback;
}

export function getBrowserApiConfig<TData = never>(): ApiRequestConfig<TData> {
  return { baseURL: '/api' };
}

export function getServerApiBaseUrl(): string {
  const configuredApiOrigin = process.env.API_PROXY_TARGET;
  if (
    typeof configuredApiOrigin === 'string' &&
    configuredApiOrigin.trim().length > 0
  ) {
    return configuredApiOrigin.trim().replace(/\/+$/, '');
  }

  return 'http://localhost:3001';
}

export function getServerApiConfig<TData = never>(): ApiRequestConfig<TData> {
  return { baseURL: getServerApiBaseUrl() };
}

export async function callApiWithAuthRetry<TResponse, TData = never>(
  execute: (config: ApiRequestConfig<TData>) => Promise<TResponse>,
): Promise<TResponse> {
  const session = getAuthSession();
  if (!session) {
    throw new Error('No active auth session');
  }

  const initialConfig: ApiRequestConfig<TData> = {
    ...getBrowserApiConfig(),
    headers: getAuthHeaders(session),
  };

  try {
    return await execute(initialConfig);
  } catch (error) {
    if (getApiErrorStatus(error) !== 401) {
      throw error;
    }

    const refreshed = await authRefresh(
      { refreshToken: session.refreshToken },
      getBrowserApiConfig(),
    );

    if (!isAuthSessionPayload(refreshed)) {
      clearAuthSession();
      throw error;
    }

    setAuthSession(refreshed, isAuthSessionPersistent());

    return execute({
      ...getBrowserApiConfig(),
      headers: getAuthHeaders({ ...session, ...refreshed, issuedAt: Date.now() }),
    });
  }
}
