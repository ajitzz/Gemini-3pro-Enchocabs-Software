const env = (import.meta as any).env || {};

const normalizeMapKey = (rawKey: string): string => {
  const key = String(rawKey || '').trim().toLowerCase();
  if (!key) return '';

  // Allow env keys in any of these forms:
  // - https://portal.example.com
  // - portal.example.com:5173
  // - portal.example.com
  try {
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return new URL(key).host;
    }
  } catch {
    // Keep the raw key when URL parsing fails.
  }

  // Support protocol-less values copied from docs/console, e.g.
  // "portal.example.com/" or "portal.example.com/staff".
  return key
    .replace(/^\.+/, '')
    .replace(/^\/\//, '')
    .replace(/\/$/, '')
    .split('/')[0];
};

const parseClientIdMap = (rawMap: string): Record<string, string> => {
  if (!rawMap) return {};

  try {
    const parsed = JSON.parse(rawMap);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce<Record<string, string>>((acc, [host, clientId]) => {
      const normalizedHost = normalizeMapKey(host);
      const normalizedClientId = String(clientId || '').trim();
      if (normalizedHost && normalizedClientId) {
        acc[normalizedHost] = normalizedClientId;
      }
      return acc;
    }, {});
  } catch (error) {
    console.warn('Invalid VITE_GOOGLE_CLIENT_ID_MAP value. Falling back to VITE_GOOGLE_CLIENT_ID.', error);
    return {};
  }
};

export const getGoogleAuthDiagnostics = () => {
  const defaultClientId = String(env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const clientIdMap = parseClientIdMap(String(env.VITE_GOOGLE_CLIENT_ID_MAP || '').trim());
  const host = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const origin = typeof window !== 'undefined' ? window.location.origin.toLowerCase() : '';

  const candidates = [
    normalizeMapKey(origin),
    normalizeMapKey(host),
    normalizeMapKey(hostname),
    normalizeMapKey(hostname.replace(/^www\./, '')),
  ].filter(Boolean);

  let resolvedFrom: string | null = null;
  let clientId = '';

  for (const candidate of candidates) {
    if (clientIdMap[candidate]) {
      clientId = clientIdMap[candidate];
      resolvedFrom = candidate;
      break;
    }
  }

  if (!clientId && hostname) {
    // Support parent-domain mappings like "example.com" for "portal.example.com".
    const parts = hostname.split('.').filter(Boolean);
    for (let i = 1; i < parts.length - 1; i += 1) {
      const parentDomain = parts.slice(i).join('.');
      if (clientIdMap[parentDomain]) {
        clientId = clientIdMap[parentDomain];
        resolvedFrom = parentDomain;
        break;
      }
    }
  }

  if (!clientId) {
    clientId = defaultClientId;
  }

  return {
    origin,
    host,
    hostname,
    candidates,
    configuredHosts: Object.keys(clientIdMap),
    resolvedFrom,
    hasClientId: !!clientId,
    clientId,
  };
};

export const getGoogleClientId = (): string => getGoogleAuthDiagnostics().clientId;
