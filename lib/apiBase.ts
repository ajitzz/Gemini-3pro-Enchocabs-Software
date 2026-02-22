const DEFAULT_API_ORIGIN = 'https://enchocabs-software-orginal-gemini3pro-1.onrender.com';

const isLocalHost = (hostname?: string) => hostname === 'localhost' || hostname === '127.0.0.1';

const normalizeApiBase = (raw: string) => {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const getApiBase = () => {
  const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;
  const isLocal = !!env.DEV || isLocalHost(currentHostname);

  if (isLocal) {
    return '/api';
  }

  if (env.VITE_API_URL) {
    return normalizeApiBase(env.VITE_API_URL);
  }

  if (env.VITE_API_FALLBACK_URL) {
    return normalizeApiBase(env.VITE_API_FALLBACK_URL);
  }

  // Production safety-net for SPA-only hosts where same-origin /api returns index.html.
  return `${DEFAULT_API_ORIGIN}/api`;
};

