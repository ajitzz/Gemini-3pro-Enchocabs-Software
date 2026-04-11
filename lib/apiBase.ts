const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const isLocalDev = () => {
  const env = (import.meta as any).env;
  return Boolean(env?.DEV) || isLocalHost();
};

const stripWrappingQuotes = (value: string) => value.trim().replace(/^['"]|['"]$/g, '');

const normalizeApiUrl = (rawApiUrl: string): string | null => {
  const normalized = stripWrappingQuotes(rawApiUrl).replace(/\/$/, '');
  if (!normalized) return null;

  if (normalized.startsWith('/')) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (/^[a-z0-9.-]+\/[a-z0-9/_-].*$/i.test(normalized)) {
    return `https://${normalized}`;
  }

  return null;
};

export const getApiBase = () => {
  if (isLocalDev()) return '/api';

  const env = (import.meta as any).env;
  const rawApiUrl = env && typeof env.VITE_API_URL === 'string' ? env.VITE_API_URL : '';
  if (!rawApiUrl) {
    return '/api';
  }

  const normalized = normalizeApiUrl(rawApiUrl);
  if (normalized) {
    return normalized;
  }

  console.error(
    `Invalid VITE_API_URL: "${rawApiUrl}". Use https://example.com/api, example.com/api, or /api. Falling back to /api.`
  );
  return '/api';
};
