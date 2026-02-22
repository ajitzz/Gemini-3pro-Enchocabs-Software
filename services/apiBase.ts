const isBrowser = typeof window !== 'undefined';

export const isLocalHost = () => {
  if ((import.meta as any).env?.DEV) return true;
  if (!isBrowser) return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
};

export const normalizeApiBase = (raw?: string) => {
  const trimmed = (raw || '').trim().replace(/\/$/, '');
  if (!trimmed) return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const getApiBase = () => {
  const env = (import.meta as any).env || {};

  if (isLocalHost()) return '/api';

  if (env.VITE_API_URL) {
    return normalizeApiBase(env.VITE_API_URL);
  }

  if (isBrowser && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  return '/api';
};
