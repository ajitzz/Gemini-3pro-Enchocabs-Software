
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { getApiBase } from './lib/apiBase';
import './styles.css';
import { getGoogleClientId } from './lib/googleAuth';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const GOOGLE_CLIENT_ID = getGoogleClientId();

if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
  console.warn("Google Client ID is missing for this hostname. Set VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID_MAP.");
}


const reportPerfMetric = (name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor', id: string) => {
  const payload = {
    name,
    value: Number(value.toFixed(2)),
    rating,
    id,
    route: window.location.pathname,
  };

  const url = `${getApiBase().replace(/\/$/, '')}/perf-metrics`;
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
};

const observeWebVitals = () => {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  const metricMap = new Map<string, number>();

  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lcp = entries[entries.length - 1] as any;
      if (!lcp) return;
      const value = lcp.startTime;
      metricMap.set('LCP', value);
      const rating = value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
      reportPerfMetric('LCP', value, rating, String(lcp.id || 'lcp'));
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    const clsObserver = new PerformanceObserver((entryList) => {
      let cls = metricMap.get('CLS') || 0;
      for (const entry of entryList.getEntries() as any) {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      }
      metricMap.set('CLS', cls);
      const rating = cls <= 0.1 ? 'good' : cls <= 0.25 ? 'needs-improvement' : 'poor';
      reportPerfMetric('CLS', cls, rating, 'cls');
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (_err) {
    // no-op for unsupported browser observer entries
  }
};

const root = createRoot(rootElement);
observeWebVitals();

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
