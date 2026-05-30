type FetchApiResult =
  | { ok: true; response: Response }
  | { ok: false; error: string };

function normalizeApiPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === '/api' || normalizedPath.startsWith('/api/')) {
    return normalizedPath;
  }

  return `/api${normalizedPath}`;
}

function getAppOriginForServer(): string {
  const configuredOrigin = process.env.NEXT_SERVER_ORIGIN;
  if (typeof configuredOrigin === 'string' && configuredOrigin.trim().length > 0) {
    return configuredOrigin.trim().replace(/\/+$/, '');
  }

  const port = process.env.PORT ?? '3000';
  return `http://localhost:${port}`;
}

export async function fetchApiResponse(
  path: string,
  init?: RequestInit,
): Promise<FetchApiResult> {
  const apiPath = normalizeApiPath(path);
  const url =
    typeof window === 'undefined'
      ? `${getAppOriginForServer()}${apiPath}`
      : apiPath;

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
