type FetchApiResult =
  | { ok: true; response: Response }
  | { ok: false; error: string };

function normalizeApiProxyPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === '/api' || normalizedPath.startsWith('/api/')) {
    return normalizedPath;
  }

  return `/api${normalizedPath}`;
}

function normalizeApiOriginPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (normalizedPath === '/api') {
    return '/';
  }

  if (normalizedPath.startsWith('/api/')) {
    return normalizedPath.slice('/api'.length);
  }

  return normalizedPath;
}

function getAppOriginForServer(): string {
  const configuredOrigin = process.env.NEXT_SERVER_ORIGIN;
  if (typeof configuredOrigin === 'string' && configuredOrigin.trim().length > 0) {
    return configuredOrigin.trim().replace(/\/+$/, '');
  }

  const port = process.env.PORT ?? '3000';
  return `http://127.0.0.1:${port}`;
}

function getApiOriginForServer(): string | null {
  const configuredApiOrigin = process.env.API_PROXY_TARGET;
  if (
    typeof configuredApiOrigin === 'string' &&
    configuredApiOrigin.trim().length > 0
  ) {
    return configuredApiOrigin.trim().replace(/\/+$/, '');
  }

  return null;
}

export async function fetchApiResponse(
  path: string,
  init?: RequestInit,
): Promise<FetchApiResult> {
  const apiProxyPath = normalizeApiProxyPath(path);
  const apiOriginPath = normalizeApiOriginPath(path);
  const url =
    typeof window === 'undefined'
      ? (() => {
          const apiOrigin = getApiOriginForServer();
          if (apiOrigin) {
            return `${apiOrigin}${apiOriginPath}`;
          }

          return `${getAppOriginForServer()}${apiProxyPath}`;
        })()
      : apiProxyPath;

  try {
    const response = await fetch(url, init);
    return { ok: true, response };
  } catch {
    return {
      ok: false,
      error: `Could not reach API route at ${url}`,
    };
  }
}
