const env = (import.meta as any).env || {};

const parseClientIdMap = (rawMap: string): Record<string, string> => {
  if (!rawMap) return {};

  try {
    const parsed = JSON.parse(rawMap);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce<Record<string, string>>((acc, [host, clientId]) => {
      const normalizedHost = host.trim().toLowerCase();
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

export const getGoogleClientId = (): string => {
  const defaultClientId = String(env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const clientIdMap = parseClientIdMap(String(env.VITE_GOOGLE_CLIENT_ID_MAP || '').trim());
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';

  if (hostname && clientIdMap[hostname]) {
    return clientIdMap[hostname];
  }

  return defaultClientId;
};
