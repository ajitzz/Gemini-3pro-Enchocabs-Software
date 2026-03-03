import { useEffect, useRef, useState } from 'react';
import { getApiBase } from './apiBase';

type LiveUpdateEvent = {
  type?: string;
  at?: number;
  key?: string;
  version?: number;
};

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15000;

const getLiveUpdatesUrl = () => {
  const base = getApiBase().replace(/\/$/, '');
  return `${base}/live-updates`;
};

export const useLiveUpdates = (
  onUpdate: (event: LiveUpdateEvent) => void,
  enabled = true,
) => {
  const [connected, setConnected] = useState(false);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const callbackRef = useRef(onUpdate);
  const lastVersionRef = useRef<Record<string, number>>({});

  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let source: EventSource | null = null;

    const clearRetry = () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const connect = () => {
      if (cancelled) return;

      source = new EventSource(getLiveUpdatesUrl());

      source.addEventListener('ready', () => {
        if (cancelled) return;
        retryAttemptRef.current = 0;
        setConnected(true);
      });

      source.addEventListener('update', (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((event as MessageEvent).data || '{}') as LiveUpdateEvent;

          if (payload.type && typeof payload.version === 'number') {
            const lastVersion = lastVersionRef.current[payload.type] || 0;
            if (payload.version <= lastVersion) {
              return;
            }
            lastVersionRef.current[payload.type] = payload.version;
          }

          callbackRef.current(payload);
        } catch (error) {
          console.warn('Failed to parse live update payload:', error);
        }
      });

      source.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        source?.close();
        source = null;

        clearRetry();
        const attempt = retryAttemptRef.current + 1;
        retryAttemptRef.current = attempt;
        const backoff = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
        retryTimeoutRef.current = window.setTimeout(connect, backoff);
      };
    };

    connect();

    return () => {
      cancelled = true;
      setConnected(false);
      clearRetry();
      source?.close();
    };
  }, [enabled]);

  return { connected };
};
