const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const normalizeApiBase = (raw: string) => {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const getApiBase = () => {
  const env = (import.meta as any).env || {};
  const isLocal = Boolean(env.DEV) || isLocalHost();

  if (isLocal) return '/api';

  const configuredBase = env.VITE_API_URL || env.VITE_API_BASE_URL;
  if (configuredBase) {
    return normalizeApiBase(configuredBase);
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  return '/api';
};
