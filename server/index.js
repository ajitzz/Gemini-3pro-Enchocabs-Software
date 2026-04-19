
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('crypto');
const { EventEmitter } = require('events');
const { OAuth2Client } = require('google-auth-library');

let webPush = null;
try {
  // Optional dependency in restricted environments
  webPush = require('web-push');
} catch (error) {
  console.warn('web-push dependency not available; push delivery disabled.');
}
const db = require('./db');
const { getJSON: getCacheJSON, setJSON: setCacheJSON, deleteKeys: deleteCacheKeys } = require('./cache');
const { enqueueBillingRefresh, isQStashConfigured } = require('./qstash');
const app = express();


const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const toUuidOrNull = (value) => {
  const raw = String(value || '').trim();
  return UUID_V4_REGEX.test(raw) ? raw : null;
};

const splitCsvEnv = (value) => String(value || '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean);

const normalizeOrigin = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.origin.toLowerCase();
  } catch (_error) {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wildcardToRegex = (pattern) => {
  const escaped = escapeRegex(normalizeOrigin(pattern)).replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
};
const buildOriginRegexes = (pattern) => {
  const normalizedPattern = normalizeOrigin(pattern);
  const regexes = [wildcardToRegex(normalizedPattern)];
  const vercelExactMatch = normalizedPattern.match(/^https:\/\/([a-z0-9-]+)\.vercel\.app$/i);
  if (vercelExactMatch && !normalizedPattern.includes('*')) {
    // Also allow Vercel preview deployments for the same project slug.
    const slug = vercelExactMatch[1];
    regexes.push(new RegExp(`^https://${escapeRegex(slug)}-[a-z0-9-]+\\.vercel\\.app$`, 'i'));
  }
  return regexes;
};

const defaultAllowedOrigins = [
  'https://enchocabs.com',
  'https://www.enchocabs.com',
  'https://gemini-3pro-enchocabs-software.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const allowedOrigins = new Set([
  ...defaultAllowedOrigins.map(normalizeOrigin),
  ...splitCsvEnv(process.env.CORS_ORIGINS).map(normalizeOrigin),
]);
const allowedOriginPatterns = splitCsvEnv(process.env.CORS_ORIGIN_PATTERNS)
  .map((pattern) => {
    try {
      return buildOriginRegexes(pattern);
    } catch (_error) {
      console.warn(`Invalid CORS_ORIGIN_PATTERNS entry ignored: ${pattern}`);
      return null;
    }
  })
  .flat()
  .filter(Boolean);
const blockedCorsLogTimestamps = new Map();

if (process.env.NODE_ENV !== 'test' && (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN_PATTERNS)) {
  console.log(
    `CORS allowlist initialized with ${allowedOrigins.size} exact origins and ${allowedOriginPatterns.length} pattern regexes.`
  );
}

const isOriginAllowed = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) return true;
  return allowedOriginPatterns.some((regex) => regex.test(normalizedOrigin));
};

const logBlockedOrigin = (origin) => {
  const now = Date.now();
  const lastLoggedAt = blockedCorsLogTimestamps.get(origin) || 0;
  if (now - lastLoggedAt >= 60_000) {
    blockedCorsLogTimestamps.set(origin, now);
    console.warn(`Blocked CORS origin: ${origin}`);
  }
};

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, origin || true);
      return;
    }
    logBlockedOrigin(origin);
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Support large Excel imports

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    perfStats.requests += 1;
    perfStats.totalDurationMs += duration;

    if (duration > 1200) {
      perfStats.slowRequests += 1;
      perfStats.lastSlowPath = `${req.method} ${req.originalUrl} (${duration}ms)`;
    }
  });
  next();
});

const PORT = process.env.PORT || 3000;
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'enchoenterprises@gmail.com').toLowerCase();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const GOOGLE_CLIENT_IDS = Array.from(new Set([
  ...splitCsvEnv(process.env.GOOGLE_CLIENT_IDS),
  GOOGLE_CLIENT_ID,
].filter(Boolean)));
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || '';
const SESSION_CACHE_TTL_SECONDS = Number(process.env.SESSION_CACHE_TTL_SECONDS || 60 * 60 * 6);
const BOT_CONFIG_CACHE_TTL_SECONDS = Number(process.env.BOT_CONFIG_CACHE_TTL_SECONDS || 60 * 10);
const WIDGET_ACCESS_TOKEN = String(process.env.WIDGET_ACCESS_TOKEN || '').trim();
const VAPID_PUBLIC_KEY = String(process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = String(process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = String(process.env.VAPID_SUBJECT || 'mailto:ops@enchocabs.com').trim();
const webPushEnabled = Boolean(webPush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (webPushEnabled) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
const BOT_CONFIG_CACHE_KEY = 'driver_app_bot_config_v1';
const liveEvents = new EventEmitter();
liveEvents.setMaxListeners(200);

const liveEventVersions = new Map();
const perfStats = {
  requests: 0,
  totalDurationMs: 0,
  slowRequests: 0,
  lastSlowPath: null,
};
const perfMetricsBuffer = [];
const PERF_METRICS_LIMIT = 200;

const emitLiveUpdate = (type, payload = {}) => {
  const version = (liveEventVersions.get(type) || 0) + 1;
  liveEventVersions.set(type, version);

  liveEvents.emit('update', {
    type,
    version,
    at: Date.now(),
    ...payload,
  });
};

const getDriverIdsForName = async (driverName) => {
  if (!driverName) return [];
  const result = await db.query(
    `SELECT id FROM drivers WHERE LOWER(name) = LOWER($1) AND (termination_date IS NULL OR termination_date >= CURRENT_DATE)`,
    [driverName]
  );
  return result.rows.map((row) => row.id).filter(Boolean);
};

const sendPushToDriverIds = async (driverIds, notificationPayload) => {
  if (!webPushEnabled || !Array.isArray(driverIds) || driverIds.length === 0) return;

  const uniqueDriverIds = Array.from(new Set(driverIds.filter(Boolean)));
  if (!uniqueDriverIds.length) return;

  const subs = await db.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE driver_id = ANY($1::uuid[])`,
    [uniqueDriverIds]
  );

  if (!subs.rows.length) return;

  const payload = JSON.stringify(notificationPayload);

  await Promise.allSettled(subs.rows.map(async (sub) => {
    try {
      await webPush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
    } catch (error) {
      const code = Number(error?.statusCode || error?.status || 0);
      if (code === 404 || code === 410) {
        await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      }
      console.error('Push send failed:', code || error?.message || error);
    }
  }));
};

app.get('/api/live-updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const writeEvent = (eventName, data) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Hint browser/EventSource clients how fast to reconnect after disconnects.
  res.write('retry: 3000\n\n');

  writeEvent('ready', { at: Date.now() });

  const keepAlive = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  const onUpdate = (payload) => {
    writeEvent('update', payload);
  };

  liveEvents.on('update', onUpdate);

  req.on('close', () => {
    clearInterval(keepAlive);
    liveEvents.off('update', onUpdate);
  });
});

app.get('/api/push/public-key', (_req, res) => {
  res.json({ enabled: webPushEnabled, publicKey: webPushEnabled ? VAPID_PUBLIC_KEY : null });
});

app.post('/api/push-subscriptions', async (req, res) => {
  try {
    const { driverId, subscription } = req.body || {};
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!driverId || !endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'driverId and complete subscription keys are required' });
    }

    await db.query(
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        driver_id UUID NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await db.query(
      `INSERT INTO push_subscriptions (driver_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
       SET driver_id = EXCLUDED.driver_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth`,
      [driverId, endpoint, p256dh, auth]
    );

    res.json({ success: true, enabled: webPushEnabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/push-subscriptions', async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- HEALTH CHECK ---
const healthHandler = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok' });
};
app.get('/health', healthHandler);
app.head('/health', healthHandler);
app.get('/api/health', healthHandler);
app.head('/api/health', healthHandler);

// --- KEEP ALIVE PING (Render free dynos can sleep without traffic) ---
const startKeepAlive = () => {
  if (!KEEP_ALIVE_URL) {
    console.log('Keep-alive ping disabled: set KEEP_ALIVE_URL to enable.');
    return;
  }

  const intervalMinutes = Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES || 14);
  const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;

  const ping = async () => {
    try {
      const response = await fetch(KEEP_ALIVE_URL, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      console.log(`Keep-alive ping -> ${response.status} @ ${new Date().toISOString()}`);
    } catch (err) {
      console.error('Keep-alive ping failed:', err.message);
    }
  };

  ping();
  setInterval(ping, intervalMs);
};

// --- DATE HELPERS ---
const normalizeDriver = (name = '') => name.toLowerCase().trim();
const assertDriverEntryAllowedOnDate = async ({ client = db, driverName, isoDate }) => {
  const normalizedDriverName = normalizeDriver(driverName);
  if (!normalizedDriverName || !isoDate) return;

  const leaveConflict = await client.query(
    `
      SELECT l.id
      FROM leaves l
      JOIN drivers d ON d.id::text = l.driver_id::text
      WHERE LOWER(d.name) = $1
        AND $2::date >= l.start_date
        AND (
          l.actual_return_date IS NULL
          OR $2::date <= l.actual_return_date
        )
      LIMIT 1
    `,
    [normalizedDriverName, isoDate],
  );

  if ((leaveConflict.rowCount || 0) > 0) {
    throw new Error(`Driver ${driverName} is on leave on ${isoDate}. Daily entry is not allowed.`);
  }
};
const toISODate = (rawVal) => {
  if (!rawVal) return '';

  // Direct Date object
  if (rawVal instanceof Date && !isNaN(rawVal)) {
    return rawVal.toISOString().slice(0, 10);
  }

  const str = String(rawVal).trim();
  if (!str) return '';

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const buildIso = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    return dt.toISOString().slice(0, 10);
  };

  // Handle separated formats (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
  const parts = str.split(/[\/.-]/).filter(Boolean);
  if (parts.length === 3) {
    const nums = parts.map((p) => parseInt(p, 10));

    // Year-first (YYYY-MM-DD or YYYY/DD/MM)
    if (parts[0].length === 4) {
      const iso = buildIso(nums[0], nums[1], nums[2]);
      if (iso) return iso;
    }

    // Day-first (DD-MM-YYYY or DD/MM/YYYY)
    if (parts[2].length === 4) {
      const iso = buildIso(nums[2], nums[1], nums[0]);
      if (iso) return iso;
    }
  }

  // Fallback to native parsing
  const native = new Date(str);
  if (!isNaN(native)) {
    return native.toISOString().slice(0, 10);
  }

  return '';
};


const getMondayISO = (dateStr) => {
  const isoDate = toISODate(dateStr);
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
};
const getSundayISO = (mondayStr) => {
  const isoDate = toISODate(mondayStr);
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
};

const isDriverTerminatedOnDate = (driverRow, isoDate) => {
  if (!driverRow) return true;
  const termination = toISODate(driverRow.termination_date);
  return Boolean(termination && termination < isoDate);
};

const isDriverOnLeaveOnDate = (leaveRow, isoDate) => {
  if (!leaveRow) return false;
  const startDate = toISODate(leaveRow.start_date);
  const endDate = toISODate(leaveRow.end_date);
  const actualReturnDate = toISODate(leaveRow.actual_return_date);
  if (!startDate || !endDate) return false;

  const effectiveEnd = actualReturnDate && actualReturnDate < endDate ? actualReturnDate : endDate;
  return isoDate >= startDate && isoDate <= effectiveEnd;
};

const splitAmountEquallyInRupees = (amount, count) => {
  if (count <= 0) return [];
  const normalizedAmount = Math.max(0, Math.round(Number(amount) || 0));
  const base = Math.floor(normalizedAmount / count);
  const remainder = normalizedAmount % count;

  return Array.from({ length: count }, (_, index) => {
    return base + (index < remainder ? 1 : 0);
  });
};

const buildDriverBuckets = (dailyEntries, weeklyWallets) => {
  const buckets = new Map();

  const ensureBucket = (name) => {
    const normalized = normalizeDriver(name);
    if (!normalized) return null;
    if (!buckets.has(normalized)) {
      buckets.set(normalized, { name: name?.trim() || normalized, daily: [], wallets: [] });
    }
    return buckets.get(normalized);
  };

  dailyEntries.forEach((entry) => {
    const bucket = ensureBucket(entry.driver);
    if (bucket) bucket.daily.push(entry);
  });

  weeklyWallets.forEach((wallet) => {
    const bucket = ensureBucket(wallet.driver);
    if (bucket) bucket.wallets.push(wallet);
  });

  return buckets;
};

// --- AGGREGATION HELPERS (SERVER-SIDE DASHBOARD SUMMARY) ---
const formatWeekRange = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  const startFmt = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const endFmt = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const yearSuffix = start.getUTCFullYear() !== end.getUTCFullYear()
    ? ` '${String(end.getUTCFullYear()).slice(-2)}`
    : '';

  return `${startFmt} - ${endFmt}${yearSuffix}`;
};

const calculateWalletWeek = (wallet) => {
  const earnings = Number(wallet.earnings) || 0;
  const refund = Number(wallet.refund) || 0;
  const diff = Number(wallet.diff) || 0;
  const cash = Number(wallet.cash) || 0;
  const charges = Number(wallet.charges) || 0;

  return earnings + refund - (diff + cash + charges);
};

const calculateDriverStatsServer = (driverName, driverDaily, driverWallets, sortedSlabs, driverExpenses = []) => {
  if (!driverName) {
    return null;
  }

  let totalCollection = 0;
  let totalRent = 0;
  let totalFuel = 0;
  let totalDue = 0;
  let totalPayout = 0;
  let totalExpenses = 0;
  let totalWalletWeek = 0;

  const processedDailyIds = new Set();
  let latestWeekRange;

  let cutoffCollection = 0;
  let cutoffRent = 0;
  let cutoffFuel = 0;
  let cutoffDue = 0;
  let cutoffPayout = 0;
  let cutoffExpenses = 0;
  let cutoffWalletWeek = 0;

  const sortedWallets = [...driverWallets].sort((a, b) => b.weekEndDate.localeCompare(a.weekEndDate));
  const latestWallet = sortedWallets[0];
  const latestWalletEndDate = latestWallet?.weekEndDate;
  const latestWalletId = latestWallet?.id;

  sortedWallets.forEach((wallet) => {
    const startDate = wallet.weekStartDate;
    const endDate = wallet.weekEndDate;

    const weekDaily = driverDaily.filter((d) => {
      if (processedDailyIds.has(d.id)) return false;
      const date = d.date;
      return date >= startDate && date <= endDate;
    });

    weekDaily.forEach((d) => processedDailyIds.add(d.id));

    const trips = wallet.trips;
    const slab = sortedSlabs.find((s) => trips >= s.minTrips && (s.maxTrips === null || trips <= s.maxTrips));

    const dailyRentTotal = weekDaily.reduce((sum, d) => sum + d.rent, 0);

    let rentRateUsed = 0;
    if (wallet.rentOverride !== undefined && wallet.rentOverride !== null) {
      rentRateUsed = wallet.rentOverride;
    } else if (weekDaily.length > 0) {
      rentRateUsed = dailyRentTotal / weekDaily.length;
    } else {
      rentRateUsed = slab ? slab.rentAmount : 0;
    }

    const daysWorked = wallet.daysWorkedOverride !== undefined && wallet.daysWorkedOverride !== null
      ? wallet.daysWorkedOverride
      : weekDaily.length;

    const extraDays = Math.max(0, daysWorked - weekDaily.length);
    const weeklyRentTotal = dailyRentTotal + (extraDays * rentRateUsed);

    const weeklyCollection = weekDaily.reduce((sum, d) => sum + d.collection, 0);
    const weeklyFuel = weekDaily.reduce((sum, d) => sum + d.fuel, 0);
    const weeklyDueBase = weekDaily.reduce((sum, d) => sum + d.due, 0);
    const weeklyAdjustment = Number(wallet.adjustments || 0);
    const weeklyDue = weeklyDueBase + weeklyAdjustment;
    const weeklyPayout = weekDaily.reduce((sum, d) => sum + (d.payout || 0), 0);
    const weeklyWalletTotal = calculateWalletWeek(wallet);

    totalCollection += weeklyCollection;
    totalRent += weeklyRentTotal;
    totalFuel += weeklyFuel;
    totalDue += weeklyDue;
    totalPayout += weeklyPayout;
    totalWalletWeek += weeklyWalletTotal;

    if (wallet.id === latestWalletId) {
      latestWeekRange = formatWeekRange(startDate, endDate);
    }

    if (latestWalletEndDate && wallet.weekEndDate <= latestWalletEndDate) {
      cutoffCollection += weeklyCollection;
      cutoffRent += weeklyRentTotal;
      cutoffFuel += weeklyFuel;
      cutoffDue += weeklyDue;
      cutoffPayout += weeklyPayout;
      cutoffWalletWeek += weeklyWalletTotal;
    }
  });

  driverDaily.forEach((d) => {
    if (!processedDailyIds.has(d.id)) {
      totalCollection += d.collection;
      totalRent += d.rent;
      totalFuel += d.fuel;
      totalDue += d.due;
      totalPayout += d.payout || 0;

      if (latestWalletEndDate && d.date <= latestWalletEndDate) {
        cutoffCollection += d.collection;
        cutoffRent += d.rent;
        cutoffFuel += d.fuel;
        cutoffDue += d.due;
        cutoffPayout += d.payout || 0;
      }
    }
  });

  driverExpenses.forEach((expense) => {
    const amount = Number(expense.amount) || 0;
    totalExpenses += amount;
    if (latestWalletEndDate && expense.expenseDate <= latestWalletEndDate) {
      cutoffExpenses += amount;
    }
  });

  const finalTotal = totalCollection - totalRent - totalFuel + totalDue + totalWalletWeek - totalPayout - totalExpenses;
  const cutoffTotal = latestWalletEndDate
    ? (cutoffCollection - cutoffRent - cutoffFuel + cutoffDue + cutoffWalletWeek - cutoffPayout - cutoffExpenses)
    : finalTotal;

  let netPayout = finalTotal;
  let netPayoutSource = 'overall';
  let netPayoutRange;

  if (latestWalletEndDate) {
    const candidate = Math.min(cutoffTotal, finalTotal);
    netPayout = candidate;

    if (candidate === cutoffTotal) {
      netPayoutSource = 'latest-wallet';
      netPayoutRange = latestWeekRange
        ?? (latestWallet ? formatWeekRange(latestWallet.weekStartDate, latestWallet.weekEndDate) : undefined);
    }
  }

  return {
    driver: driverName,
    totalCollection,
    totalRent,
    totalFuel,
    totalDue,
    totalPayout,
    totalExpenses,
    totalWalletWeek,
    finalTotal,
    netPayout,
    netPayoutSource,
    netPayoutRange
  };
};


const getWidgetTokenFromRequest = (req) => {
  const headerToken = String(req.headers['x-widget-token'] || '').trim();
  const queryToken = String(req.query?.token || '').trim();
  return headerToken || queryToken;
};

const isWidgetRequestAuthorized = (req) => {
  if (!WIDGET_ACCESS_TOKEN) return true;
  const provided = getWidgetTokenFromRequest(req);
  return provided === WIDGET_ACCESS_TOKEN;
};

const clampTtlSeconds = (value, fallbackSeconds) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return fallbackSeconds;
  return Math.min(Math.max(numeric, 30), 300);
};

const SUMMARY_CACHE_KEY = 'summary:global';
const BILLINGS_CACHE_KEY = 'driver-billings:all';
const DRIVERS_CACHE_KEY = 'drivers:all';
const DAILY_ENTRIES_CACHE_KEY = 'daily-entries:all';
const WEEKLY_WALLETS_CACHE_KEY = 'weekly-wallets:all';
const DRIVER_EXPENSES_CACHE_KEY = 'driver-expenses:all';
const ASSETS_CACHE_KEY = 'assets:all';
const QUERY_CACHE_NAMESPACE = {
  dailyEntries: 'daily-entries',
  weeklyWallets: 'weekly-wallets',
  driverExpenses: 'driver-expenses',
};
const rentalSlabCacheKey = (type) => `rental-slabs:${type}`;
const dailyEntriesCacheKey = (driver) =>
  driver ? `daily-entries:driver:${normalizeDriver(driver)}` : DAILY_ENTRIES_CACHE_KEY;
const weeklyWalletsCacheKey = (driver) =>
  driver ? `weekly-wallets:driver:${normalizeDriver(driver)}` : WEEKLY_WALLETS_CACHE_KEY;
const driverExpensesCacheKey = (driver) =>
  driver ? `driver-expenses:driver:${normalizeDriver(driver)}` : DRIVER_EXPENSES_CACHE_KEY;
const systemFlagCacheKey = (key) => `system-flag:${key}`;

const queryCacheRegistry = new Map();

const registerQueryCacheKey = (namespace, key) => {
  if (!namespace || !key) return;
  const existing = queryCacheRegistry.get(namespace) || new Set();
  existing.add(key);
  queryCacheRegistry.set(namespace, existing);
};

const invalidateQueryCacheNamespace = async (namespace) => {
  const keys = Array.from(queryCacheRegistry.get(namespace) || []);
  queryCacheRegistry.delete(namespace);
  if (keys.length === 0) return;
  await deleteCacheKeys(keys);
};

const buildQueryCacheKey = (baseKey, query = {}) => {
  const normalizedEntries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .filter(([key]) => key !== 'fresh')
    .sort(([a], [b]) => a.localeCompare(b));

  if (normalizedEntries.length === 0) return baseKey;

  const searchParams = new URLSearchParams();
  normalizedEntries.forEach(([key, value]) => searchParams.append(key, String(value)));
  return `${baseKey}?${searchParams.toString()}`;
};

const SUMMARY_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.SUMMARY_CACHE_TTL_SECONDS || 120, 120);
const BILLINGS_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.BILLINGS_CACHE_TTL_SECONDS || 300, 300);
const DRIVERS_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.DRIVERS_CACHE_TTL_SECONDS || 240, 240);
const DAILY_ENTRIES_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.DAILY_ENTRIES_CACHE_TTL_SECONDS || 240, 240);
const WEEKLY_WALLETS_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.WEEKLY_WALLETS_CACHE_TTL_SECONDS || 240, 240);
const DRIVER_EXPENSES_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.DRIVER_EXPENSES_CACHE_TTL_SECONDS || 240, 240);
const ASSETS_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.ASSETS_CACHE_TTL_SECONDS || 600, 600);
const RENTAL_SLAB_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.RENTAL_SLAB_CACHE_TTL_SECONDS || 600, 600);
const SYSTEM_FLAG_CACHE_TTL_SECONDS = clampTtlSeconds(process.env.SYSTEM_FLAG_CACHE_TTL_SECONDS || 600, 600);

const summaryCache = {
  data: null,
  etag: null,
  expiresAt: 0,
};
let summaryBuildPromise = null;

const billingsCache = {
  data: null,
  etag: null,
  expiresAt: 0,
};

const resetSummaryCache = () => {
  summaryCache.data = null;
  summaryCache.etag = null;
  summaryCache.expiresAt = 0;
};

const resetBillingsCache = () => {
  billingsCache.data = null;
  billingsCache.etag = null;
  billingsCache.expiresAt = 0;
};

const invalidateKeys = async (...keys) => deleteCacheKeys(keys.filter(Boolean));

const computeEtag = (payload) => createHash('sha1').update(JSON.stringify(payload)).digest('hex');
const sessionCacheKey = (tokenHash) => `session:${tokenHash}`;
const getBotConfigFallback = () => {
  const raw = (process.env.BOT_CONFIG_JSON || process.env.BOT_CONFIG || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('BOT_CONFIG_JSON is not valid JSON. Returning null config.');
    return null;
  }
};

const respondWithCacheHeaders = (req, res, payload, etag, cacheStatus, maxAgeSeconds) => {
  if (cacheStatus) {
    res.set('X-Cache', cacheStatus);
  }

  if (etag) {
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
  }

  const safeAge = Math.max(30, Math.min(maxAgeSeconds, 300));
  const staleWindow = Math.max(15, Math.floor(safeAge / 2));
  res.set('Cache-Control', `public, max-age=${safeAge - staleWindow}, stale-while-revalidate=${staleWindow}`);

  return res.json(payload);
};

const parseQueryDate = (raw, label) => {
  if (!raw) return null;
  const iso = toISODate(raw);
  if (!iso) {
    throw new Error(`Invalid ${label} date format`);
  }
  return iso;
};

const parseQueryLimit = (raw, max = 5000) => {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.floor(value), max);
};


const parseDriverFilters = (query = {}) => {
  const multi = typeof query.drivers === 'string'
    ? query.drivers.split(',').map((name) => normalizeDriver(name)).filter(Boolean)
    : [];

  if (multi.length) {
    return Array.from(new Set(multi));
  }

  if (typeof query.driver === 'string') {
    const single = normalizeDriver(query.driver);
    return single ? [single] : [];
  }

  return [];
};

const hasQueryParams = (query = {}) => Object.keys(query).length > 0;

const invalidateSummaryCache = async () => {
  resetSummaryCache();
  await deleteCacheKeys([SUMMARY_CACHE_KEY]);
};

const invalidateBillingsCache = async () => {
  resetBillingsCache();
  await deleteCacheKeys([BILLINGS_CACHE_KEY]);
};

const invalidateAggregateCaches = async () => {
  await invalidateSummaryCache();
  await invalidateBillingsCache();
};

const invalidateDailyEntriesCache = async () => {
  await invalidateKeys(DAILY_ENTRIES_CACHE_KEY);
  await invalidateQueryCacheNamespace(QUERY_CACHE_NAMESPACE.dailyEntries);
};

const invalidateWeeklyWalletsCache = async () => {
  await invalidateKeys(WEEKLY_WALLETS_CACHE_KEY);
  await invalidateQueryCacheNamespace(QUERY_CACHE_NAMESPACE.weeklyWallets);
};

const invalidateDriverExpensesCache = async () => {
  await invalidateKeys(DRIVER_EXPENSES_CACHE_KEY);
  await invalidateQueryCacheNamespace(QUERY_CACHE_NAMESPACE.driverExpenses);
};

// --- INITIALIZATION SQL ---
const initDb = async () => {
  try {
    // Enable UUID extension
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 1. Create Tables if not exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT,
        email TEXT,
        join_date DATE DEFAULT CURRENT_DATE,
        termination_date DATE,
        is_hidden BOOLEAN DEFAULT FALSE,
        deposit NUMERIC DEFAULT 0,
        qr_code TEXT,
        vehicle TEXT,
        status TEXT DEFAULT 'Active',
        current_shift TEXT DEFAULT 'Day',
        default_rent NUMERIC DEFAULT 0,
        notes TEXT,
        is_manager BOOLEAN DEFAULT FALSE,
        food_option BOOLEAN DEFAULT FALSE
      );
    `);

    await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS food_option BOOLEAN DEFAULT FALSE;`);
    await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS daily_entries (
        id UUID PRIMARY KEY,
        date DATE,
        day TEXT,
        vehicle TEXT,
        driver TEXT,
        shift TEXT,
        qr_code TEXT,
        rent NUMERIC,
        collection NUMERIC,
        fuel NUMERIC DEFAULT 0,
        due NUMERIC DEFAULT 0,
        due_label TEXT,
        payout NUMERIC DEFAULT 0,
        payout_date DATE,
        notes TEXT
      );
    `);

    await db.query(`ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS payout_date DATE;`);
    await db.query(`ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS due_label TEXT;`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS weekly_wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        driver TEXT,
        week_start_date DATE,
        week_end_date DATE,
        earnings NUMERIC DEFAULT 0,
        refund NUMERIC DEFAULT 0,
        diff NUMERIC DEFAULT 0,
        cash NUMERIC DEFAULT 0,
        charges NUMERIC DEFAULT 0,
        trips NUMERIC DEFAULT 0,
        wallet_week NUMERIC DEFAULT 0,
        days_worked_override NUMERIC DEFAULT NULL,
        rent_override NUMERIC DEFAULT NULL,
        adjustments NUMERIC DEFAULT 0,
        notes TEXT
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS driver_expenses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id UUID NOT NULL,
        expense_date DATE NOT NULL,
        category TEXT NOT NULL,
        custom_type TEXT,
        driver TEXT NOT NULL,
        amount NUMERIC NOT NULL CHECK (amount >= 0),
        notes TEXT,
        split_mode TEXT NOT NULL DEFAULT 'selected',
        distribution_mode TEXT NOT NULL DEFAULT 'split',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`ALTER TABLE driver_expenses ADD COLUMN IF NOT EXISTS distribution_mode TEXT NOT NULL DEFAULT 'split';`);
    await db.query(`CREATE INDEX IF NOT EXISTS driver_expenses_group_idx ON driver_expenses (group_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS driver_expenses_date_idx ON driver_expenses (expense_date);`);
    await db.query(`CREATE INDEX IF NOT EXISTS driver_expenses_driver_idx ON driver_expenses (LOWER(driver));`);

    // NEW TABLE: driver_billings (Fixes 404 Error)
    await db.query(`
      CREATE TABLE IF NOT EXISTS driver_billings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        driver_id TEXT,
        driver_name TEXT NOT NULL,
        qr_code TEXT,
        week_start_date DATE NOT NULL,
        week_end_date DATE NOT NULL,
        days_worked NUMERIC DEFAULT 0,
        trips NUMERIC DEFAULT 0,
        rent_per_day NUMERIC DEFAULT 0,
        rent_total NUMERIC DEFAULT 0,
        collection NUMERIC DEFAULT 0,
        due NUMERIC DEFAULT 0,
        fuel NUMERIC DEFAULT 0,
        wallet NUMERIC DEFAULT 0,
        wallet_overdue NUMERIC DEFAULT 0,
        adjustments NUMERIC DEFAULT 0,
        payout NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'Finalized',
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id UUID PRIMARY KEY,
        driver_id UUID,
        start_date DATE,
        end_date DATE,
        actual_return_date DATE,
        days INTEGER,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY,
        driver_id UUID,
        shift TEXT,
        start_date DATE,
        end_date DATE
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS header_mappings (
        internal_key TEXT PRIMARY KEY,
        label TEXT,
        excel_header TEXT,
        required BOOLEAN
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_access (
        email TEXT PRIMARY KEY,
        added_by TEXT,
        added_at TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS manager_access (
        manager_id UUID,
        child_driver_id UUID,
        PRIMARY KEY (manager_id, child_driver_id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS assets (
        type TEXT,
        value TEXT,
        PRIMARY KEY (type, value)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        flag_key TEXT PRIMARY KEY,
        flag_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        driver_id UUID NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 2. Migrations / Updates
    await db.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_wallets' AND column_name='days_worked_override') THEN
              ALTER TABLE weekly_wallets ADD COLUMN days_worked_override NUMERIC DEFAULT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_wallets' AND column_name='rent_override') THEN
              ALTER TABLE weekly_wallets ADD COLUMN rent_override NUMERIC DEFAULT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_wallets' AND column_name='adjustments') THEN
              ALTER TABLE weekly_wallets ADD COLUMN adjustments NUMERIC DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='driver_billings' AND column_name='due') THEN
              ALTER TABLE driver_billings ADD COLUMN due NUMERIC DEFAULT 0;
          END IF;
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_name='driver_billings' AND constraint_name='unique_driver_week'
          ) THEN
              ALTER TABLE driver_billings ADD CONSTRAINT unique_driver_week UNIQUE (driver_name, week_start_date);
          END IF;

          -- Clean duplicate daily entries (case-insensitive driver match) before enforcing uniqueness
          DELETE FROM daily_entries a
          USING daily_entries b
          WHERE a.date = b.date AND LOWER(a.driver) = LOWER(b.driver) AND a.ctid > b.ctid;

          -- Enforce strict one-entry-per-driver-per-day rule
          IF NOT EXISTS (
              SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'daily_entries_driver_date_key'
          ) THEN
              CREATE UNIQUE INDEX daily_entries_driver_date_key ON daily_entries (LOWER(driver), date);
          END IF;

          -- Align table definition with expected schema for billing aggregation
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='driver_billings' AND column_name='driver_id' AND data_type <> 'text') THEN
              ALTER TABLE driver_billings ALTER COLUMN driver_id TYPE TEXT USING driver_id::text;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='driver_billings' AND column_name='days_worked' AND data_type <> 'numeric') THEN
              ALTER TABLE driver_billings ALTER COLUMN days_worked TYPE NUMERIC USING days_worked::numeric;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='driver_billings' AND column_name='trips' AND data_type <> 'numeric') THEN
              ALTER TABLE driver_billings ALTER COLUMN trips TYPE NUMERIC USING trips::numeric;
          END IF;
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name='driver_billings' AND column_name='week_start_date' AND is_nullable='NO'
          ) THEN
              ALTER TABLE driver_billings ALTER COLUMN week_start_date SET NOT NULL;
          END IF;
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name='driver_billings' AND column_name='week_end_date' AND is_nullable='NO'
          ) THEN
              ALTER TABLE driver_billings ALTER COLUMN week_end_date SET NOT NULL;
          END IF;
          ALTER TABLE driver_billings ALTER COLUMN days_worked SET DEFAULT 0;
          ALTER TABLE driver_billings ALTER COLUMN trips SET DEFAULT 0;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leaves' AND column_name='created_at') THEN
              ALTER TABLE leaves ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
      END $$;
    `);

    // 3. Schema Constraints & Data Cleanup
    await db.query(`
      UPDATE drivers 
      SET mobile = NULL 
      WHERE mobile IS NOT NULL 
      AND (trim(mobile) = '' OR mobile = '0' OR mobile = '.' OR mobile = '-' OR lower(mobile) = 'n/a' OR lower(mobile) = 'null' OR lower(mobile) = 'undefined');
    `);
    
    await db.query(`
      UPDATE drivers
      SET qr_code = NULL
      WHERE qr_code IS NOT NULL
      AND (trim(qr_code) = '' OR qr_code = '0' OR qr_code = '.' OR qr_code = '-' OR lower(qr_code) = 'n/a' OR lower(qr_code) = 'null');
    `);

    await db.query(`
      UPDATE drivers
      SET is_hidden = TRUE
      WHERE termination_date IS NOT NULL
        AND COALESCE(is_hidden, FALSE) = FALSE;
    `);

    // 4. Performance indexes for common filters
    await db.query('CREATE INDEX IF NOT EXISTS daily_entries_date_idx ON daily_entries (date);');
    await db.query('CREATE INDEX IF NOT EXISTS daily_entries_driver_idx ON daily_entries ((lower(driver)));');
    await db.query('CREATE INDEX IF NOT EXISTS weekly_wallets_driver_week_idx ON weekly_wallets (driver, week_start_date, week_end_date);');
    await db.query('CREATE INDEX IF NOT EXISTS weekly_wallets_range_idx ON weekly_wallets (week_end_date, week_start_date);');
    await db.query('CREATE INDEX IF NOT EXISTS leaves_range_idx ON leaves (end_date, start_date);');
    await db.query('CREATE INDEX IF NOT EXISTS driver_billings_week_idx ON driver_billings (week_start_date, week_end_date);');
    await db.query('CREATE INDEX IF NOT EXISTS driver_billings_driver_idx ON driver_billings ((lower(driver_name)));');

    console.log("Database initialized. Tables ready.");
  } catch (err) {
    console.error("DB Init Error:", err);
  }
};

// --- DRIVER BILLINGS (AUTO SYNCED) ---
const defaultDriverRentalSlabs = [
  { minTrips: 0, maxTrips: 49, rentAmount: 957 },
  { minTrips: 50, maxTrips: 54, rentAmount: 885 },
  { minTrips: 55, maxTrips: 59, rentAmount: 842 },
  { minTrips: 60, maxTrips: 64, rentAmount: 772 },
  { minTrips: 65, maxTrips: 69, rentAmount: 700 },
  { minTrips: 70, maxTrips: null, rentAmount: 550 },
];

const normalizeWalletRow = (row) => {
  const start = getMondayISO(row.week_start_date);
  if (!start) return null;
  const resolvedEnd = toISODate(row.week_end_date) || getSundayISO(start);
  return {
    ...row,
    week_start_date: start,
    week_end_date: resolvedEnd,
    earnings: Number(row.earnings) || 0,
    refund: Number(row.refund) || 0,
    diff: Number(row.diff) || 0,
    cash: Number(row.cash) || 0,
    charges: Number(row.charges) || 0,
    trips: Number(row.trips) || 0,
    wallet_week: Number(row.wallet_week) || 0,
    rent_override: row.rent_override !== null ? Number(row.rent_override) : null,
    adjustments: Number(row.adjustments || 0),
    days_worked_override: row.days_worked_override !== null ? Number(row.days_worked_override) : null
  };
};

const normalizeDailyRow = (row) => ({
  ...row,
  collection: Number(row.collection) || 0,
  fuel: Number(row.fuel) || 0,
  due: Number(row.due) || 0
});

const buildBillingRecord = ({ wallet, entries, driverInfo, driverRentalSlabs }) => {
  if (!wallet || entries.length === 0) return null;

  const driverName = wallet?.driver || entries[0]?.driver;
  if (!driverName) return null;

  const daysWorkedCalculated = entries.filter((e) => {
    const shift = (e.shift || '').toLowerCase().trim();
    return !['leave', 'off', 'absent', 'holiday'].includes(shift);
  }).length;
  const daysWorked = wallet && wallet.days_worked_override !== null && wallet.days_worked_override !== undefined
    ? Number(wallet.days_worked_override)
    : daysWorkedCalculated;

  const trips = wallet ? wallet.trips : 0;
  const slab = driverRentalSlabs.find((s) => trips >= s.minTrips && (s.maxTrips === null || trips <= s.maxTrips));

  let rentPerDay = 0;
  if (wallet && wallet.rent_override !== null && wallet.rent_override !== undefined) {
    rentPerDay = wallet.rent_override;
  } else if (slab) {
    rentPerDay = slab.rentAmount;
  }

  const rentTotal = rentPerDay * daysWorked;
  const collection = entries.reduce((sum, e) => sum + e.collection, 0);
  const baseDue = entries.reduce((sum, e) => sum + e.due, 0);
  const fuel = entries.reduce((sum, e) => sum + e.fuel, 0);
  const walletAmount = wallet ? calculateWalletWeek(wallet) : 0;
  const adjustments = wallet ? Number(wallet.adjustments || 0) : 0;
  const dueWithAdjustments = baseDue + adjustments;

  const payout = collection - rentTotal - fuel + dueWithAdjustments + walletAmount;

  return {
    driver_id: driverInfo.id || null,
    driver_name: driverName,
    qr_code: driverInfo.qrCode || wallet?.qr_code || entries[0]?.qr_code || null,
    week_start_date: wallet?.week_start_date || getMondayISO(entries[0]?.date),
    week_end_date: wallet?.week_end_date || getSundayISO(wallet?.week_start_date || getMondayISO(entries[0]?.date)),
    days_worked: daysWorked,
    trips,
    rent_per_day: rentPerDay,
    rent_total: rentTotal,
    collection,
    due: dueWithAdjustments,
    fuel,
    wallet: walletAmount,
    wallet_overdue: dueWithAdjustments,
    adjustments,
    payout,
    status: 'Finalized'
  };
};

const calculateDriverBillings = async () => {
  const [slabRes, walletRes, dailyRes, driverRes] = await Promise.all([
    db.query("SELECT min_trips as \"minTrips\", max_trips as \"maxTrips\", rent_amount as \"rentAmount\" FROM rental_slabs WHERE slab_type = 'driver' ORDER BY min_trips"),
    db.query("SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as week_start_date, to_char(week_end_date, 'YYYY-MM-DD') as week_end_date, earnings, refund, diff, cash, charges, trips, wallet_week, rent_override, days_worked_override, adjustments, notes FROM weekly_wallets"),
    db.query("SELECT id, to_char(date, 'YYYY-MM-DD') as date, driver, shift, qr_code, collection, fuel, due FROM daily_entries"),
    db.query("SELECT id, name, qr_code FROM drivers WHERE COALESCE(is_hidden, FALSE) = FALSE")
  ]);

  const rentalSlabs = slabRes.rows.map(r => ({
    minTrips: Number(r.minTrips),
    maxTrips: r.maxTrips === null ? null : Number(r.maxTrips),
    rentAmount: Number(r.rentAmount)
  }));
const driverRentalSlabs = rentalSlabs.length > 0 ? rentalSlabs : defaultDriverRentalSlabs;
  const driverIndex = new Map();
  driverRes.rows.forEach((d) => {
    driverIndex.set(normalizeDriver(d.name), { id: d.id, qrCode: d.qr_code });
  });

  const walletMap = new Map();
  walletRes.rows.forEach((w) => {
    const normalized = normalizeWalletRow(w);
    if (!normalized) return;
    const driverKey = normalizeDriver(normalized.driver);
    const key = `${normalized.week_start_date}__${driverKey}`;
    walletMap.set(key, normalized);
  });

  const dailyGroups = new Map();
  dailyRes.rows.forEach((d) => {
    const start = getMondayISO(d.date);
    if (!start) return;
    const driverKey = normalizeDriver(d.driver);
    const key = `${start}__${driverKey}`;
    const group = dailyGroups.get(key) || [];
    group.push(normalizeDailyRow(d));
    dailyGroups.set(key, group);
  });

  const allKeys = new Set([...walletMap.keys(), ...dailyGroups.keys()]);
  const billings = [];

  allKeys.forEach((key) => {
    const wallet = walletMap.get(key);
    const entries = dailyGroups.get(key) || [];
    const driverName = wallet?.driver || entries[0]?.driver;
    if (!driverName) return;

    const driverInfo = driverIndex.get(normalizeDriver(driverName)) || {};
    const record = buildBillingRecord({
      wallet,
      entries,
      driverInfo,
      driverRentalSlabs
    });

    if (record) {
      billings.push(record);
    }
  });

  return billings;
};

const fetchDriverBillingForWeek = async ({ driverName, weekStart }) => {
  if (!driverName || !weekStart) return null;

  const weekEnd = getSundayISO(weekStart);
  if (!weekEnd) return null;

  const [slabRes, walletRes, dailyRes, driverRes] = await Promise.all([
    db.query("SELECT min_trips as \"minTrips\", max_trips as \"maxTrips\", rent_amount as \"rentAmount\" FROM rental_slabs WHERE slab_type = 'driver' ORDER BY min_trips"),
    db.query(
      `SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as week_start_date, to_char(week_end_date, 'YYYY-MM-DD') as week_end_date, earnings, refund, diff, cash, charges, trips, wallet_week, rent_override, days_worked_override, adjustments, notes
       FROM weekly_wallets
       WHERE lower(driver) = lower($1)
         AND week_start_date <= $2::date
         AND (week_end_date IS NULL OR week_end_date >= $2::date)`,
      [driverName, weekStart]
    ),
    db.query(
      `SELECT id, to_char(date, 'YYYY-MM-DD') as date, driver, shift, qr_code, collection, fuel, due
       FROM daily_entries
       WHERE lower(driver) = lower($1)
         AND date BETWEEN $2::date AND $3::date`,
      [driverName, weekStart, weekEnd]
    ),
    db.query("SELECT id, name, qr_code FROM drivers WHERE lower(name) = lower($1) AND COALESCE(is_hidden, FALSE) = FALSE LIMIT 1", [driverName])
  ]);

  const rentalSlabs = slabRes.rows.map((r) => ({
    minTrips: Number(r.minTrips),
    maxTrips: r.maxTrips === null ? null : Number(r.maxTrips),
    rentAmount: Number(r.rentAmount)
  }));
  const driverRentalSlabs = rentalSlabs.length > 0 ? rentalSlabs : defaultDriverRentalSlabs;

  const normalizedWallets = walletRes.rows.map(normalizeWalletRow).filter(Boolean);
  const wallet = normalizedWallets.find((w) => w.week_start_date === weekStart) || normalizedWallets[0];
  const entries = dailyRes.rows.map(normalizeDailyRow);

  const driverInfoRow = driverRes.rows[0] || {};
  const driverInfo = {
    id: driverInfoRow.id || null,
    qrCode: driverInfoRow.qr_code || null
  };

  return buildBillingRecord({
    wallet,
    entries,
    driverInfo,
    driverRentalSlabs
  });
};

const syncDriverBillingForWeek = async ({ driverName, weekStart }) => {
  if (!driverName || !weekStart) return;

  const billing = await fetchDriverBillingForWeek({ driverName, weekStart });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    if (!billing) {
      await client.query(
        'DELETE FROM driver_billings WHERE lower(driver_name) = lower($1) AND week_start_date = $2::date',
        [driverName, weekStart]
      );
      await client.query('COMMIT');
      await invalidateBillingsCache();
      return;
    }

    const existing = await client.query(
      'SELECT id FROM driver_billings WHERE lower(driver_name) = lower($1) AND week_start_date = $2::date LIMIT 1',
      [billing.driver_name, billing.week_start_date]
    );
    const idToUse = existing.rows[0]?.id || uuidv4();

    await client.query(
      `INSERT INTO driver_billings (
        id, driver_id, driver_name, qr_code, week_start_date, week_end_date,
        days_worked, trips, rent_per_day, rent_total, collection, due, fuel,
        wallet, wallet_overdue, adjustments, payout, status, generated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        driver_id = $2, driver_name = $3, qr_code = $4,
        week_start_date = $5, week_end_date = $6,
        days_worked = $7, trips = $8, rent_per_day = $9, rent_total = $10,
        collection = $11, due = $12, fuel = $13, wallet = $14, wallet_overdue = $15,
        adjustments = $16, payout = $17, status = $18, generated_at = NOW();
      `,
      [
        idToUse, billing.driver_id, billing.driver_name, billing.qr_code, billing.week_start_date, billing.week_end_date,
        billing.days_worked, billing.trips, billing.rent_per_day, billing.rent_total, billing.collection, billing.due, billing.fuel,
        billing.wallet, billing.wallet_overdue, billing.adjustments, billing.payout, billing.status
      ]
    );

    await client.query(
      `UPDATE daily_entries
       SET rent = $1
       WHERE lower(driver) = lower($2)
         AND date >= $3 AND date <= $4
         AND rent > 0`,
      [billing.rent_per_day, billing.driver_name, billing.week_start_date, billing.week_end_date]
    );

    await client.query('COMMIT');
    await invalidateBillingsCache();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const syncDriverBillings = async () => {
  const billings = await calculateDriverBillings();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query("SELECT id, driver_name, to_char(week_start_date, 'YYYY-MM-DD') as week_start_date FROM driver_billings");
    const keyToId = new Map();
    const staleIds = new Set(existing.rows.map((r) => r.id));

    existing.rows.forEach((r) => {
      const key = `${normalizeDriver(r.driver_name)}__${r.week_start_date}`;
      if (!keyToId.has(key)) keyToId.set(key, r.id);
    });

    for (const bill of billings) {
      const billKey = `${normalizeDriver(bill.driver_name)}__${bill.week_start_date}`;
      const existingId = keyToId.get(billKey);
      const idToUse = existingId || uuidv4();

      await client.query(
        `INSERT INTO driver_billings (
          id, driver_id, driver_name, qr_code, week_start_date, week_end_date,
          days_worked, trips, rent_per_day, rent_total, collection, due, fuel,
          wallet, wallet_overdue, adjustments, payout, status, generated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          driver_id = $2, driver_name = $3, qr_code = $4,
          week_start_date = $5, week_end_date = $6,
          days_worked = $7, trips = $8, rent_per_day = $9, rent_total = $10,
          collection = $11, due = $12, fuel = $13, wallet = $14, wallet_overdue = $15,
          adjustments = $16, payout = $17, status = $18, generated_at = NOW();
        `,
        [
          idToUse, bill.driver_id, bill.driver_name, bill.qr_code, bill.week_start_date, bill.week_end_date,
          bill.days_worked, bill.trips, bill.rent_per_day, bill.rent_total, bill.collection, bill.due, bill.fuel,
          bill.wallet, bill.wallet_overdue, bill.adjustments, bill.payout, bill.status
        ]
      );
  // Keep daily entries in sync with the computed rent/day for the week.
      await client.query(
        `UPDATE daily_entries
         SET rent = $1
         WHERE lower(driver) = lower($2)
           AND date >= $3 AND date <= $4
           AND rent > 0`,
        [bill.rent_per_day, bill.driver_name, bill.week_start_date, bill.week_end_date]
      );

      staleIds.delete(idToUse);
    }

    if (staleIds.size > 0) {
      await client.query('DELETE FROM driver_billings WHERE id = ANY($1)', [Array.from(staleIds)]);
    }

    await client.query('COMMIT');
    await invalidateBillingsCache();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
// --- AUTHENTICATION ---
app.post('/api/auth/google', async (req, res) => {
  const { token, clientId } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: 'Missing Google token' });
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const cachedSession = await getCacheJSON(sessionCacheKey(tokenHash));
    if (cachedSession) {
      if (cachedSession.role === 'admin') {
        const adminRes = await db.query('SELECT email FROM admin_access WHERE lower(email) = lower($1) LIMIT 1', [cachedSession.email]);
        if (adminRes.rows.length === 0) {
          await invalidateKeys(sessionCacheKey(tokenHash));
          return res.status(403).json({ error: 'Unauthorized: admin access revoked' });
        }
      }
      res.set('X-Cache', 'REDIS');
      return res.json(cachedSession);
    }

    const requestedClientId = String(clientId || '').trim();
    const allowedAudiences = Array.from(new Set([
      ...GOOGLE_CLIENT_IDS,
      requestedClientId,
    ].filter(Boolean)));

    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: allowedAudiences.length > 0 ? allowedAudiences : undefined,
    });

    const payload = ticket.getPayload() || {};
    const email = (payload.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email not found in Google profile' });
    }

    const isGmail = /^[a-z0-9._%+-]+@gmail\.com$/i.test(email);
    if (!isGmail) {
      return res.status(403).json({ error: 'Unauthorized: only registered Gmail accounts are allowed' });
    }

    let role = 'driver';
    let driverId = null;
    let name = payload.name || 'User';
    const photoURL = payload.picture;

    if (email === SUPER_ADMIN_EMAIL) {
      role = 'super_admin';
    } else {
      const adminRes = await db.query('SELECT email FROM admin_access WHERE lower(email) = lower($1) LIMIT 1', [email]);
      if (adminRes.rows.length > 0) {
        role = 'admin';
      } else {
        const driverRes = await db.query(
          'SELECT id, name, COALESCE(is_manager, FALSE) as "isManager" FROM drivers WHERE lower(email) = lower($1) AND COALESCE(is_hidden, FALSE) = FALSE LIMIT 1',
          [email]
        );
        if (driverRes.rows.length === 0) {
          return res.status(403).json({ error: 'Unauthorized: email not registered' });
        }
        driverId = driverRes.rows[0].id;
        name = driverRes.rows[0].name || name;
        // STRICT ACCESS POLICY:
        // - Only super admin + emails explicitly listed in admin_access can reach Driver Tracker (/app).
        // - Every other registered staff account (including is_manager staff from registration page)
        //   is treated as driver-level access and can only use Driver Portal (/portal).
        role = 'driver';
      }
    }

    const sessionPayload = { email, name, role, photoURL, driverId };
    await setCacheJSON(sessionCacheKey(tokenHash), sessionPayload, SESSION_CACHE_TTL_SECONDS);
    res.set('X-Cache', 'MISS');
    res.json(sessionPayload);
  } catch (err) {
    console.error('Google authentication failed:', err.message || err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});



app.get('/api/drivers/:driverId/widget-summary', async (req, res) => {
  try {
    if (!isWidgetRequestAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized widget request' });
    }

    const driverId = String(req.params.driverId || '').trim();
    if (!driverId) {
      return res.status(400).json({ error: 'driverId is required' });
    }

    const [driverRes, dailyRes, walletRes, slabsRes, expenseRes] = await Promise.all([
      db.query('SELECT id, name FROM drivers WHERE id = $1 AND COALESCE(is_hidden, FALSE) = FALSE LIMIT 1', [driverId]),
      db.query(
        `SELECT id, to_char(date, 'YYYY-MM-DD') as date, driver, rent, collection, fuel, due, payout
         FROM daily_entries
         WHERE lower(driver) = lower((SELECT name FROM drivers WHERE id = $1 LIMIT 1))`,
        [driverId]
      ),
      db.query(
        `SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as "weekStartDate", to_char(week_end_date, 'YYYY-MM-DD') as "weekEndDate",
                trips, earnings, rent_override as "rentOverride", days_worked_override as "daysWorkedOverride",
                refund, diff, cash, charges, adjustments
         FROM weekly_wallets
         WHERE lower(driver) = lower((SELECT name FROM drivers WHERE id = $1 LIMIT 1))`,
        [driverId]
      ),
      db.query(
        `SELECT id, type, min_trips as "minTrips", max_trips as "maxTrips", rent_amount as "rentAmount"
         FROM rental_slabs
         ORDER BY min_trips ASC`
      ),
      db.query(
        `SELECT driver, to_char(expense_date, 'YYYY-MM-DD') as "expenseDate", amount
         FROM driver_expenses
         WHERE lower(driver) = lower((SELECT name FROM drivers WHERE id = $1 LIMIT 1))`,
        [driverId]
      )
    ]);

    if (driverRes.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverRes.rows[0];
    const dailyEntries = dailyRes.rows.map((r) => ({
      ...r,
      rent: Number(r.rent) || 0,
      collection: Number(r.collection) || 0,
      fuel: Number(r.fuel) || 0,
      due: Number(r.due) || 0,
      payout: Number(r.payout) || 0,
    }));
    const weeklyWallets = walletRes.rows.map((r) => ({
      ...r,
      trips: Number(r.trips) || 0,
      earnings: Number(r.earnings) || 0,
      rentOverride: r.rentOverride === null ? null : Number(r.rentOverride),
      daysWorkedOverride: r.daysWorkedOverride === null ? null : Number(r.daysWorkedOverride),
      refund: Number(r.refund) || 0,
      diff: Number(r.diff) || 0,
      cash: Number(r.cash) || 0,
      charges: Number(r.charges) || 0,
      adjustments: Number(r.adjustments) || 0,
    }));
    const sortedSlabs = slabsRes.rows.map((r) => ({
      ...r,
      minTrips: Number(r.minTrips) || 0,
      maxTrips: r.maxTrips === null ? null : Number(r.maxTrips),
      rentAmount: Number(r.rentAmount) || 0,
    }));

    const expenses = expenseRes.rows.map((r) => ({
      ...r,
      amount: Number(r.amount) || 0,
    }));

    const summary = calculateDriverStatsServer(driver.name, dailyEntries, weeklyWallets, sortedSlabs, expenses);

    if (!summary) {
      return res.status(404).json({ error: 'Unable to compute widget summary' });
    }

    res.set('Cache-Control', 'no-store');
    return res.json({
      driverId: driver.id,
      driverName: driver.name,
      netBalance: Number(summary.finalTotal) || 0,
      netPayout: Number(summary.netPayout) || 0,
      netPayoutSource: summary.netPayoutSource,
      netPayoutRange: summary.netPayoutRange || null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/driver-billings', async (req, res) => {
  const now = Date.now();
  if (billingsCache.data && billingsCache.expiresAt <= now) {
    resetBillingsCache();
  }
  if (billingsCache.data && billingsCache.expiresAt > now) {
    return respondWithCacheHeaders(req, res, billingsCache.data, billingsCache.etag, 'MEM', BILLINGS_CACHE_TTL_SECONDS);
  }

  try {
    const cached = await getCacheJSON(BILLINGS_CACHE_KEY);
    if (cached?.payload) {
      const cachedEtag = cached.etag || computeEtag(cached.payload);
      billingsCache.data = cached.payload;
      billingsCache.etag = cachedEtag;
      billingsCache.expiresAt = now + BILLINGS_CACHE_TTL_SECONDS * 1000;
      return respondWithCacheHeaders(req, res, cached.payload, cachedEtag, 'REDIS', BILLINGS_CACHE_TTL_SECONDS);
    }

    const shouldRefresh = String(req.query.refresh || '').toLowerCase() === 'true'
      || String(process.env.SYNC_BILLINGS_ON_READ || '').toLowerCase() === 'true';
    if (shouldRefresh) {
      if (isQStashConfigured()) {
        try {
          const result = await enqueueBillingRefresh();
          if (result.queued) {
            res.set('X-Refresh', 'QSTASH');
          } else {
            res.set('X-Refresh', 'SKIPPED');
            await syncDriverBillings();
          }
        } catch (err) {
          console.error('Failed to enqueue billing refresh:', err.message || err);
          await syncDriverBillings();
        }
      } else {
        await syncDriverBillings();
      }
    }

    const result = await db.query(`
      SELECT
        id, driver_id as "driverId", driver_name as "driverName", qr_code as "qrCode",
        to_char(week_start_date, 'YYYY-MM-DD') as "weekStartDate",
        to_char(week_end_date, 'YYYY-MM-DD') as "weekEndDate",
        days_worked as "daysWorked", trips, rent_per_day as "rentPerDay",
        rent_total as "rentTotal", collection, due, fuel, wallet,
        wallet_overdue as "walletOverdue", adjustments, payout, status,
        generated_at as "generatedAt"
      FROM driver_billings
      ORDER BY week_start_date DESC, driver_name ASC
    `);
    const safeRows = result.rows.map(r => ({
      ...r,
      daysWorked: Number(r.daysWorked), trips: Number(r.trips),
      rentPerDay: Number(r.rentPerDay), rentTotal: Number(r.rentTotal),
      collection: Number(r.collection), due: Number(r.due), fuel: Number(r.fuel),
      wallet: Number(r.wallet), walletOverdue: Number(r.walletOverdue),
      adjustments: Number(r.adjustments), payout: Number(r.payout)
    }));

    const etag = computeEtag(safeRows);
    billingsCache.data = safeRows;
    billingsCache.etag = etag;
    billingsCache.expiresAt = Date.now() + BILLINGS_CACHE_TTL_SECONDS * 1000;
    await setCacheJSON(BILLINGS_CACHE_KEY, { payload: safeRows, etag }, BILLINGS_CACHE_TTL_SECONDS);

    return respondWithCacheHeaders(req, res, safeRows, etag, 'MISS', BILLINGS_CACHE_TTL_SECONDS);
  } catch (err) {
    console.error("Error fetching billings:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/driver-billings/refresh', async (req, res) => {
  const expectedToken = (process.env.QSTASH_REFRESH_TOKEN || '').trim();
  const providedToken = (req.get('x-refresh-token') || '').trim();
  if (expectedToken && expectedToken !== providedToken) {
    return res.status(401).json({ error: 'Unauthorized refresh request' });
  }

  try {
    await syncDriverBillings();
    res.json({ refreshed: true });
  } catch (err) {
    console.error('Driver billings refresh failed:', err.message || err);
    res.status(500).json({ error: err.message || 'Refresh failed' });
  }
});

app.post('/api/driver-billings', async (req, res) => {
  const b = req.body;
  const dueValue = b.due !== undefined && b.due !== null ? b.due : 0;
  try {
    const q = `
      INSERT INTO driver_billings (
        id, driver_id, driver_name, qr_code, week_start_date, week_end_date,
        days_worked, trips, rent_per_day, rent_total, collection, due, fuel,
        wallet, wallet_overdue, adjustments, payout, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        driver_id=$2, driver_name=$3, qr_code=$4, week_start_date=$5, week_end_date=$6,
        days_worked=$7, trips=$8, rent_per_day=$9, rent_total=$10, collection=$11, due=$12, fuel=$13,
        wallet=$14, wallet_overdue=$15, adjustments=$16, payout=$17, status=$18
      RETURNING *;
    `;
    const result = await db.query(q, [
      b.id || uuidv4(), b.driverId, b.driverName, b.qrCode, b.weekStartDate, b.weekEndDate,
      b.daysWorked, b.trips, b.rentPerDay, b.rentTotal, b.collection, dueValue, b.fuel,
      b.wallet, b.walletOverdue, b.adjustments, b.payout, b.status || 'Finalized'
    ]);
    await syncDriverBillings();
    await invalidateBillingsCache();
    res.json(result.rows[0]);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/driver-billings/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM driver_billings WHERE id = $1', [req.params.id]);
    await syncDriverBillings();
    await invalidateBillingsCache();
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// --- DRIVERS ---
app.get('/api/drivers', async (req, res) => {
  try {
    const cached = await getCacheJSON(DRIVERS_CACHE_KEY);
    if (cached) {
      res.set('X-Cache', 'REDIS');
      return res.json(cached);
    }

    const result = await db.query(`SELECT id, name, mobile, email, to_char(join_date, 'YYYY-MM-DD') as "joinDate", to_char(termination_date, 'YYYY-MM-DD') as "terminationDate", COALESCE(is_hidden, FALSE) as "isHidden", deposit, qr_code as "qrCode", vehicle, status, current_shift as "currentShift", default_rent as "defaultRent", notes, is_manager as "isManager", food_option as "foodOption" FROM drivers ORDER BY name`);
    await setCacheJSON(DRIVERS_CACHE_KEY, result.rows, DRIVERS_CACHE_TTL_SECONDS);

    res.set('X-Cache', 'MISS');
    res.json(result.rows);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers', async (req, res) => {
  const d = req.body;
  const idToUse = (d.id && d.id.trim().length > 0) ? d.id : uuidv4();
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const nameToSave = d.name.trim();
    const shouldAutoHide = !!d.terminationDate && d.isHidden === undefined;
    const isHiddenToSave = shouldAutoHide ? true : !!d.isHidden;
    let mobileToSave = null;
    if (d.mobile) {
        const clean = String(d.mobile).trim();
        if (clean.length > 0 && !['null', 'undefined', 'n/a', '-', '0', 'none', '.'].includes(clean.toLowerCase())) {
            mobileToSave = clean;
        }
    }
    let qrToSave = null;
    if (d.qrCode) {
        const cleanQr = String(d.qrCode).trim();
        if (cleanQr.length > 0 && !['null', 'undefined', 'n/a', '-', '0', 'none', '.'].includes(cleanQr.toLowerCase())) {
            qrToSave = cleanQr;
        }
    }

    const nameCheck = await client.query('SELECT * FROM drivers WHERE lower(name) = lower($1) AND id != $2', [nameToSave, idToUse]);
    if (nameCheck.rows.length > 0) {
        const existing = nameCheck.rows[0];
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Driver name "${nameToSave}" already exists (Status: ${existing.status || 'Active'}).` });
    }

    if (mobileToSave) {
        const mobileCheck = await client.query('SELECT * FROM drivers WHERE mobile = $1 AND id != $2', [mobileToSave, idToUse]);
        if (mobileCheck.rows.length > 0) {
            const existing = mobileCheck.rows[0];
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Mobile number "${mobileToSave}" is already assigned to driver "${existing.name}".` });
        }
    }

    if (qrToSave) {
        const qrCheck = await client.query('SELECT * FROM drivers WHERE qr_code = $1 AND id != $2', [qrToSave, idToUse]);
        if (qrCheck.rows.length > 0) {
            const existing = qrCheck.rows[0];
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `QR Code "${qrToSave}" is already assigned to driver "${existing.name}".` });
        }
    }

    const currentDriverRes = await client.query('SELECT name FROM drivers WHERE id = $1', [idToUse]);
    if (currentDriverRes.rows.length > 0) {
        const oldName = currentDriverRes.rows[0].name;
        if (oldName !== nameToSave) {
            await client.query('UPDATE daily_entries SET driver = $1 WHERE driver = $2', [nameToSave, oldName]);
            await client.query('UPDATE weekly_wallets SET driver = $1 WHERE driver = $2', [nameToSave, oldName]);
            await client.query('UPDATE driver_billings SET driver_name = $1 WHERE driver_name = $2', [nameToSave, oldName]);
        }
    }

    const q = `
      INSERT INTO drivers (id, name, mobile, email, join_date, termination_date, is_hidden, deposit, qr_code, vehicle, status, current_shift, default_rent, notes, is_manager, food_option)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        name=$2, mobile=$3, email=$4, join_date=$5, termination_date=$6, is_hidden=$7, deposit=$8, qr_code=$9, vehicle=$10, status=$11, current_shift=$12, default_rent=$13, notes=$14, is_manager=$15, food_option=$16
      RETURNING *;
    `;
    const result = await client.query(q, [
      idToUse, nameToSave, mobileToSave, d.email, d.joinDate, d.terminationDate || null,
      isHiddenToSave, d.deposit, qrToSave, d.vehicle, d.status, d.currentShift, d.defaultRent, d.notes, d.isManager, d.foodOption ?? false
    ]);

    await client.query('COMMIT');
    await invalidateSummaryCache();
    await invalidateKeys(DRIVERS_CACHE_KEY);
    emitLiveUpdate('drivers_changed');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
        let msg = "Duplicate entry detected in database.";
        if (err.detail && err.detail.includes('mobile')) msg = "This mobile number is already in use.";
        else if (err.detail && err.detail.includes('qr_code')) msg = "This QR code is already in use.";
        else if (err.detail && err.detail.includes('name')) msg = "This driver name already exists.";
        return res.status(409).json({ error: msg });
    }
    console.error("Driver Save Error:", err);
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
    await invalidateSummaryCache();
    await invalidateKeys(DRIVERS_CACHE_KEY);
    emitLiveUpdate('drivers_changed');
    res.json({ success: true });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- DASHBOARD SUMMARY (SERVER-SIDE FOR FAST INITIAL LOADS) ---
app.get('/api/summary', async (req, res) => {
  const now = Date.now();
  if (summaryCache.data && summaryCache.expiresAt <= now) {
    resetSummaryCache();
  }
  if (summaryCache.data && summaryCache.expiresAt > now) {
    return respondWithCacheHeaders(req, res, summaryCache.data, summaryCache.etag, 'MEM', SUMMARY_CACHE_TTL_SECONDS);
  }

  try {
    if (!summaryCache.data) {
      const cached = await getCacheJSON(SUMMARY_CACHE_KEY);
      if (cached?.payload) {
        summaryCache.data = cached.payload;
        summaryCache.etag = cached.etag || computeEtag(cached.payload);
        summaryCache.expiresAt = now + SUMMARY_CACHE_TTL_SECONDS * 1000;
        return respondWithCacheHeaders(req, res, summaryCache.data, summaryCache.etag, 'REDIS', SUMMARY_CACHE_TTL_SECONDS);
      }
    }

    if (!summaryBuildPromise) {
      summaryBuildPromise = (async () => {
        const [dailyRes, walletRes, slabRes, expenseRes] = await Promise.all([
          db.query("SELECT id, to_char(date, 'YYYY-MM-DD') as date, driver, rent, collection, fuel, due, payout FROM daily_entries"),
          db.query("SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as week_start_date, to_char(week_end_date, 'YYYY-MM-DD') as week_end_date, trips, wallet_week, days_worked_override, rent_override, adjustments FROM weekly_wallets"),
          db.query(`SELECT min_trips as "minTrips", max_trips as "maxTrips", rent_amount as "rentAmount" FROM rental_slabs WHERE slab_type = 'driver' ORDER BY min_trips`),
          db.query(`SELECT driver, to_char(expense_date, 'YYYY-MM-DD') as "expenseDate", amount FROM driver_expenses`)
        ]);

        const dailyEntries = dailyRes.rows.map((r) => ({
          ...r,
          collection: Number(r.collection) || 0,
          rent: Number(r.rent) || 0,
          fuel: Number(r.fuel) || 0,
          due: Number(r.due) || 0,
          payout: Number(r.payout) || 0,
        }));

        const weeklyWallets = walletRes.rows.map((w) => ({
          ...w,
          weekStartDate: getMondayISO(w.week_start_date),
          weekEndDate: toISODate(w.week_end_date) || getSundayISO(getMondayISO(w.week_start_date)),
          trips: Number(w.trips) || 0,
          walletWeek: Number(w.wallet_week) || 0,
          daysWorkedOverride: w.days_worked_override !== null ? Number(w.days_worked_override) : null,
          rentOverride: w.rent_override !== null ? Number(w.rent_override) : null,
          adjustments: Number(w.adjustments || 0),
        }));

        const rentalSlabs = slabRes.rows.map((r) => ({
          minTrips: Number(r.minTrips),
          maxTrips: r.maxTrips === null ? null : Number(r.maxTrips),
          rentAmount: Number(r.rentAmount)
        }));
        const sortedSlabs = (rentalSlabs.length ? rentalSlabs : defaultDriverRentalSlabs).sort((a, b) => a.minTrips - b.minTrips);
        const expensesByDriver = expenseRes.rows.reduce((acc, row) => {
          const key = normalizeDriver(row.driver);
          if (!key) return acc;
          if (!acc[key]) acc[key] = [];
          acc[key].push({ driver: row.driver, expenseDate: row.expenseDate, amount: Number(row.amount) || 0 });
          return acc;
        }, {});

        const driverBuckets = buildDriverBuckets(dailyEntries, weeklyWallets);
        Object.keys(expensesByDriver).forEach((driverKey) => {
          if (!driverKey) return;
          if (!driverBuckets.has(driverKey)) {
            const name = expensesByDriver[driverKey][0]?.driver || driverKey;
            driverBuckets.set(driverKey, { name, daily: [], wallets: [] });
          }
        });
        const driverSummaries = Array.from(driverBuckets.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ name, daily, wallets }) => calculateDriverStatsServer(name, daily, wallets, sortedSlabs, expensesByDriver[normalizeDriver(name)] || []))
          .filter(Boolean);

        const global = {
          totalCollection: driverSummaries.reduce((sum, d) => sum + d.totalCollection, 0),
          totalRent: driverSummaries.reduce((sum, d) => sum + d.totalRent, 0),
          totalFuel: driverSummaries.reduce((sum, d) => sum + d.totalFuel, 0),
          totalDue: driverSummaries.reduce((sum, d) => sum + d.totalDue, 0),
          totalPayout: driverSummaries.reduce((sum, d) => sum + d.totalPayout, 0),
          totalExpenses: driverSummaries.reduce((sum, d) => sum + d.totalExpenses, 0),
          totalWalletWeek: driverSummaries.reduce((sum, d) => sum + d.totalWalletWeek, 0),
          pendingFromDrivers: driverSummaries.filter((d) => d.finalTotal < 0).reduce((sum, d) => sum + Math.abs(d.finalTotal), 0),
          payableToDrivers: driverSummaries.filter((d) => d.finalTotal > 0).reduce((sum, d) => sum + d.finalTotal, 0),
        };

        const payload = { driverSummaries, global };
        const etag = computeEtag(payload);
        summaryCache.data = payload;
        summaryCache.etag = etag;
        summaryCache.expiresAt = Date.now() + SUMMARY_CACHE_TTL_SECONDS * 1000;

        await setCacheJSON(SUMMARY_CACHE_KEY, { payload, etag }, SUMMARY_CACHE_TTL_SECONDS);

        return { payload, etag };
      })().finally(() => {
        summaryBuildPromise = null;
      });
    }

    const { payload, etag } = await summaryBuildPromise;
    return respondWithCacheHeaders(req, res, payload, etag, 'MISS', SUMMARY_CACHE_TTL_SECONDS);
  } catch (err) {
    console.error('Summary aggregation error:', err);
    res.status(500).json({ error: 'Failed to build dashboard summary.' });
  }
});

// --- DAILY ENTRIES ---
app.get('/api/daily-entries', async (req, res) => {
  try {
    const cacheBypass = req.query.fresh !== undefined;
    const cacheKey = buildQueryCacheKey(DAILY_ENTRIES_CACHE_KEY, req.query);

    if (!cacheBypass) {
      const cached = await getCacheJSON(cacheKey);
      if (cached) {
        res.set('X-Cache', 'REDIS');
        const cachedPayload = cached.payload || cached;
        const cachedEtag = cached.etag || computeEtag(cachedPayload);
        return respondWithCacheHeaders(req, res, cachedPayload, cachedEtag, 'REDIS', DAILY_ENTRIES_CACHE_TTL_SECONDS);
      }
    }

    const values = [];
    const filters = [];
    const driverFilters = parseDriverFilters(req.query);
    if (driverFilters.length === 1) {
      values.push(driverFilters[0]);
      filters.push(`LOWER(driver) = $${values.length}`);
    } else if (driverFilters.length > 1) {
      values.push(driverFilters);
      filters.push(`LOWER(driver) = ANY($${values.length})`);
    }

    const fromDate = parseQueryDate(req.query.from, 'from');
    if (fromDate) {
      values.push(fromDate);
      filters.push(`date >= $${values.length}`);
    }

    const toDate = parseQueryDate(req.query.to, 'to');
    if (toDate) {
      values.push(toDate);
      filters.push(`date <= $${values.length}`);
    }

    const limit = parseQueryLimit(req.query.limit);
    const visibilityFilter = `NOT EXISTS (
      SELECT 1 FROM drivers d
      WHERE LOWER(d.name) = LOWER(daily_entries.driver)
        AND COALESCE(d.is_hidden, FALSE) = TRUE
    )`;
    const whereClause = `WHERE ${[...filters, visibilityFilter].join(' AND ')}`;
    const limitClause = limit ? `LIMIT $${values.length + 1}` : '';
    if (limit) values.push(limit);

    const result = await db.query(
      `SELECT id, to_char(date, 'YYYY-MM-DD') as date, day, vehicle, driver, shift, qr_code as "qrCode", rent, collection, fuel, due, due_label as "dueLabel", payout, to_char(payout_date, 'YYYY-MM-DD') as "payoutDate", notes
       FROM daily_entries
       ${whereClause}
       ORDER BY date DESC
       ${limitClause}`,
      values
    );
    const safeRows = result.rows.map(r => ({
      ...r,
      rent: Number(r.rent), collection: Number(r.collection), fuel: Number(r.fuel), due: Number(r.due), payout: Number(r.payout)
    }));

    if (!cacheBypass) {
      const etag = computeEtag(safeRows);
      await setCacheJSON(cacheKey, { payload: safeRows, etag }, DAILY_ENTRIES_CACHE_TTL_SECONDS);
      registerQueryCacheKey(QUERY_CACHE_NAMESPACE.dailyEntries, cacheKey);
      return respondWithCacheHeaders(req, res, safeRows, etag, 'MISS', DAILY_ENTRIES_CACHE_TTL_SECONDS);
    }
    res.set('Cache-Control', 'no-store');
    res.json(safeRows);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/daily-entries/bootstrap', async (req, res) => {
  try {
    const cacheBypass = req.query.fresh !== undefined;
    const cacheKey = buildQueryCacheKey('daily-entries:bootstrap', req.query);
    const metaOnly = String(req.query.metaOnly || '').toLowerCase() === 'true';
    const includeMeta = String(req.query.includeMeta || 'true').toLowerCase() !== 'false';

    if (!cacheBypass) {
      const cached = await getCacheJSON(cacheKey);
      if (cached) {
        res.set('X-Cache', 'REDIS');
        const cachedPayload = cached.payload || cached;
        const cachedEtag = cached.etag || computeEtag(cachedPayload);
        return respondWithCacheHeaders(req, res, cachedPayload, cachedEtag, 'REDIS', DAILY_ENTRIES_CACHE_TTL_SECONDS);
      }
    }

    const values = [];
    const filters = [];
    const driverFilters = parseDriverFilters(req.query);
    if (driverFilters.length === 1) {
      values.push(driverFilters[0]);
      filters.push(`LOWER(driver) = $${values.length}`);
    } else if (driverFilters.length > 1) {
      values.push(driverFilters);
      filters.push(`LOWER(driver) = ANY($${values.length})`);
    }

    const fromDate = parseQueryDate(req.query.from, 'from');
    if (fromDate) {
      values.push(fromDate);
      filters.push(`date >= $${values.length}`);
    }

    const toDate = parseQueryDate(req.query.to, 'to');
    if (toDate) {
      values.push(toDate);
      filters.push(`date <= $${values.length}`);
    }

    const dailyVisibilityFilter = `NOT EXISTS (
      SELECT 1 FROM drivers d
      WHERE LOWER(d.name) = LOWER(daily_entries.driver)
        AND COALESCE(d.is_hidden, FALSE) = TRUE
    )`;
    const whereClause = `WHERE ${[...filters, dailyVisibilityFilter].join(' AND ')}`;

    const leavesValues = [];
    const leavesFilters = [];
    if (fromDate) {
      leavesValues.push(fromDate);
      leavesFilters.push(`COALESCE(actual_return_date, 'infinity'::date) >= $${leavesValues.length}`);
    }
    if (toDate) {
      leavesValues.push(toDate);
      leavesFilters.push(`start_date <= $${leavesValues.length}`);
    }
    const leavesWhereClause = leavesFilters.length ? `WHERE ${leavesFilters.join(' AND ')}` : '';

    const walletsValues = [];
    const walletsFilters = [];
    if (driverFilters.length === 1) {
      walletsValues.push(driverFilters[0]);
      walletsFilters.push(`LOWER(driver) = $${walletsValues.length}`);
    } else if (driverFilters.length > 1) {
      walletsValues.push(driverFilters);
      walletsFilters.push(`LOWER(driver) = ANY($${walletsValues.length})`);
    }
    if (fromDate) {
      walletsValues.push(fromDate);
      walletsFilters.push(`week_end_date >= $${walletsValues.length}`);
    }
    if (toDate) {
      walletsValues.push(toDate);
      walletsFilters.push(`week_start_date <= $${walletsValues.length}`);
    }
    const walletVisibilityFilter = `NOT EXISTS (
      SELECT 1 FROM drivers d
      WHERE LOWER(d.name) = LOWER(weekly_wallets.driver)
        AND COALESCE(d.is_hidden, FALSE) = TRUE
    )`;
    const walletsWhereClause = `WHERE ${[...walletsFilters, walletVisibilityFilter].join(' AND ')}`;

    const [dailyRes, driversRes, leavesRes, walletsRes] = await Promise.all([
      metaOnly
        ? Promise.resolve({ rows: [] })
        : db.query(
            `SELECT id, to_char(date, 'YYYY-MM-DD') as date, day, vehicle, driver, shift, qr_code as "qrCode", rent, collection, fuel, due, due_label as "dueLabel", payout, to_char(payout_date, 'YYYY-MM-DD') as "payoutDate", notes
             FROM daily_entries
             ${whereClause}
             ORDER BY date DESC`,
            values,
          ),
      includeMeta
        ? db.query(`SELECT id, name, mobile, email, to_char(join_date, 'YYYY-MM-DD') as "joinDate", to_char(termination_date, 'YYYY-MM-DD') as "terminationDate", COALESCE(is_hidden, FALSE) as "isHidden", deposit, qr_code as "qrCode", vehicle, status, current_shift as "currentShift", default_rent as "defaultRent", notes, is_manager as "isManager", food_option as "foodOption" FROM drivers ORDER BY name`)
        : Promise.resolve({ rows: [] }),
      includeMeta
        ? db.query(
            `SELECT id, driver_id as "driverId", to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", to_char(actual_return_date, 'YYYY-MM-DD') as "actualReturnDate", days, reason
             FROM leaves
             ${leavesWhereClause}`,
            leavesValues,
          )
        : Promise.resolve({ rows: [] }),
      db.query(`SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as "weekStartDate", to_char(week_end_date, 'YYYY-MM-DD') as "weekEndDate", earnings, refund, diff, cash, charges, trips, wallet_week as "walletWeek", days_worked_override as "daysWorkedOverride", rent_override as "rentOverride", adjustments, notes
       FROM weekly_wallets
       ${walletsWhereClause}
       ORDER BY week_start_date DESC`, walletsValues),
    ]);

    const payload = {
      entries: dailyRes.rows.map((r) => ({
        ...r,
        rent: Number(r.rent), collection: Number(r.collection), fuel: Number(r.fuel), due: Number(r.due), payout: Number(r.payout)
      })),
      drivers: driversRes.rows,
      leaves: leavesRes.rows,
      weeklyWallets: walletsRes.rows.map((r) => ({
        ...r,
        earnings: Number(r.earnings), refund: Number(r.refund), diff: Number(r.diff), cash: Number(r.cash), charges: Number(r.charges), walletWeek: Number(r.walletWeek),
        daysWorkedOverride: r.daysWorkedOverride !== null ? Number(r.daysWorkedOverride) : undefined,
        rentOverride: r.rentOverride !== null ? Number(r.rentOverride) : undefined,
        adjustments: Number(r.adjustments || 0)
      })),
    };

    if (!cacheBypass) {
      const etag = computeEtag(payload);
      await setCacheJSON(cacheKey, { payload, etag }, DAILY_ENTRIES_CACHE_TTL_SECONDS);
      registerQueryCacheKey(QUERY_CACHE_NAMESPACE.dailyEntries, cacheKey);
      return respondWithCacheHeaders(req, res, payload, etag, 'MISS', DAILY_ENTRIES_CACHE_TTL_SECONDS);
    }

    res.set('Cache-Control', 'no-store');
    res.json(payload);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily-entries', async (req, res) => {
  const e = req.body;
  try {
    const isoDate = toISODate(e.date);
    if (!isoDate) return res.status(400).json({ error: 'Invalid date format' });

    const payoutDateISO = e.payoutDate ? toISODate(e.payoutDate) : null;
    if (e.payoutDate && !payoutDateISO) return res.status(400).json({ error: 'Invalid payout date format' });

    const entryId = toUuidOrNull(e.id);

    const existingEntry = entryId
      ? await db.query(`SELECT driver, to_char(date, 'YYYY-MM-DD') as date FROM daily_entries WHERE id = $1::uuid`, [entryId])
      : { rows: [] };
    const previousEntry = existingEntry.rows[0];

    const normalizedDriver = normalizeDriver(e.driver);
    const duplicateCheck = await db.query(
      `SELECT id FROM daily_entries WHERE date = $1 AND LOWER(driver) = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)`
      , [isoDate, normalizedDriver, entryId]
    );
    if (duplicateCheck.rowCount > 0) {
      return res.status(409).json({ error: 'Driver already has an entry for this date. Please edit or delete the existing record.' });
    }
    await assertDriverEntryAllowedOnDate({ client: db, driverName: e.driver, isoDate });

    const q = `
      INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, due_label, payout, payout_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7, rent=$8, collection=$9, fuel=$10, due=$11, due_label=$12, payout=$13, payout_date=$14, notes=$15
      RETURNING *;
    `;
    const result = await db.query(q, [entryId || uuidv4(), isoDate, e.day, e.vehicle, e.driver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.dueLabel || null, e.payout, payoutDateISO, e.notes]);

    const newWeekStart = getMondayISO(isoDate);
    if (newWeekStart) {
      await syncDriverBillingForWeek({ driverName: e.driver, weekStart: newWeekStart });
    }

    if (previousEntry?.driver && previousEntry?.date) {
      const prevWeekStart = getMondayISO(previousEntry.date);
      const prevDriverKey = normalizeDriver(previousEntry.driver);
      const newDriverKey = normalizeDriver(e.driver);
      if (prevWeekStart && (prevWeekStart !== newWeekStart || prevDriverKey !== newDriverKey)) {
        await syncDriverBillingForWeek({ driverName: previousEntry.driver, weekStart: prevWeekStart });
      }
    }

    await invalidateAggregateCaches();
    await invalidateDailyEntriesCache();
    emitLiveUpdate('daily_entries_changed');
    res.json(result.rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('is on leave')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Driver already has an entry for this date. Please edit or delete the existing record.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily-entries/bulk', async (req, res) => {
  const entries = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const keyToId = new Map();
    const existingEntryMap = new Map();
    const trackedEntries = [];
    const qrCodes = [...new Set(entries.map(e => (e.qrCode || '').trim()).filter(Boolean))];
    const driversTouched = new Set();
    let qrToDriver = {};
    if (qrCodes.length > 0) {
      const qrRes = await client.query(`SELECT qr_code, name FROM drivers WHERE qr_code = ANY($1::text[])`, [qrCodes]);
      qrRes.rows.forEach(r => { qrToDriver[String(r.qr_code || '').trim()] = r.name; });
    }

    const incomingIds = entries.map((e) => e.id).filter(Boolean);
    if (incomingIds.length > 0) {
      const existingRes = await client.query(
        `SELECT id, driver, to_char(date, 'YYYY-MM-DD') as date FROM daily_entries WHERE id = ANY($1::uuid[])`,
        [incomingIds]
      );
      existingRes.rows.forEach((row) => {
        existingEntryMap.set(row.id, row);
      });
    }

    for (const e of entries) {
      const canonicalDriver = (e.qrCode && qrToDriver[String(e.qrCode).trim()]) ? qrToDriver[String(e.qrCode).trim()] : e.driver;
      if (canonicalDriver) {
        driversTouched.add(canonicalDriver);
      }
      const isoDate = toISODate(e.date);
      if (!isoDate) throw new Error(`Invalid date format for entry ${e.id || e.date}`);
      trackedEntries.push({ id: e.id || null, driver: canonicalDriver, date: isoDate });
      const driverKey = normalizeDriver(canonicalDriver);
      const key = `${driverKey}|${isoDate}`;
      const incomingId = e.id || null;
      const existingIdForKey = keyToId.get(key);
      if (existingIdForKey && existingIdForKey !== incomingId) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Duplicate entry detected in upload for ${canonicalDriver} on ${isoDate}.` });
      }

      keyToId.set(key, incomingId);

      const payoutDateISO = e.payoutDate ? toISODate(e.payoutDate) : null;
      await assertDriverEntryAllowedOnDate({ client, driverName: canonicalDriver, isoDate });

      const q = `
        INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, due_label, payout, payout_date, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7,
          rent=$8, collection=$9, fuel=$10, due=$11, due_label=$12, payout=$13, payout_date=$14, notes=$15;
      `;
      await client.query(q, [e.id, isoDate, e.day, e.vehicle, canonicalDriver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.dueLabel || null, e.payout, payoutDateISO, e.notes]);
    }

    const keyList = Array.from(keyToId.keys());
    if (keyList.length > 0) {
      const conflictCheck = await client.query(
        `SELECT id, LOWER(driver) AS driver_key, to_char(date, 'YYYY-MM-DD') as date FROM daily_entries WHERE LOWER(driver)||'|'||to_char(date, 'YYYY-MM-DD') = ANY($1::text[])`,
        [keyList]
      );
      const blocking = conflictCheck.rows.find(row => {
        const key = `${row.driver_key}|${row.date}`;
        return (keyToId.get(key) || null) !== row.id;
      });
      if (blocking) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Driver ${blocking.driver_key} already has an entry on ${blocking.date}. Please remove or edit the existing record before importing.` });
      }
    }

    await client.query('COMMIT');
    const syncTargets = new Map();
    const addSyncTarget = (driverName, dateStr) => {
      if (!driverName || !dateStr) return;
      const weekStart = getMondayISO(dateStr);
      if (!weekStart) return;
      const key = `${normalizeDriver(driverName)}__${weekStart}`;
      if (!syncTargets.has(key)) {
        syncTargets.set(key, { driverName, weekStart });
      }
    };

    trackedEntries.forEach((entry) => {
      addSyncTarget(entry.driver, entry.date);
      const previous = entry.id ? existingEntryMap.get(entry.id) : null;
      if (previous) {
        const prevWeekStart = getMondayISO(previous.date);
        const newWeekStart = getMondayISO(entry.date);
        const prevDriverKey = normalizeDriver(previous.driver);
        const newDriverKey = normalizeDriver(entry.driver);
        if (prevWeekStart && (prevWeekStart !== newWeekStart || prevDriverKey !== newDriverKey)) {
          addSyncTarget(previous.driver, previous.date);
        }
      }
    });

    for (const target of syncTargets.values()) {
      await syncDriverBillingForWeek(target);
    }
    await invalidateAggregateCaches();
    await invalidateDailyEntriesCache();
    emitLiveUpdate('daily_entries_changed');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message && err.message.includes('is on leave')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Duplicate daily entry detected. Each driver can only have one entry per day.' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/daily-entries/:id', async (req, res) => {
  try {
    const existing = await db.query(`SELECT driver, to_char(date, 'YYYY-MM-DD') as date FROM daily_entries WHERE id = $1`, [req.params.id]);
    await db.query('DELETE FROM daily_entries WHERE id = $1', [req.params.id]);
    const previous = existing.rows[0];
    if (previous?.driver && previous?.date) {
      const weekStart = getMondayISO(previous.date);
      if (weekStart) {
        await syncDriverBillingForWeek({ driverName: previous.driver, weekStart });
      }
    }
    await invalidateAggregateCaches();
    await invalidateDailyEntriesCache();
    emitLiveUpdate('daily_entries_changed');
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// --- WEEKLY WALLETS ---
app.get('/api/weekly-wallets', async (req, res) => {
  try {
    const cacheBypass = req.query.fresh !== undefined;
    const cacheKey = buildQueryCacheKey(WEEKLY_WALLETS_CACHE_KEY, req.query);

    if (!cacheBypass) {
      const cached = await getCacheJSON(cacheKey);
      if (cached) {
        res.set('X-Cache', 'REDIS');
        return res.json(cached);
      }
    }

    const values = [];
    const filters = [];
    const driverFilters = parseDriverFilters(req.query);
    if (driverFilters.length === 1) {
      values.push(driverFilters[0]);
      filters.push(`LOWER(driver) = $${values.length}`);
    } else if (driverFilters.length > 1) {
      values.push(driverFilters);
      filters.push(`LOWER(driver) = ANY($${values.length})`);
    }

    const fromDate = parseQueryDate(req.query.from, 'from');
    if (fromDate) {
      values.push(fromDate);
      filters.push(`week_start_date >= $${values.length}`);
    }

    const toDate = parseQueryDate(req.query.to, 'to');
    if (toDate) {
      values.push(toDate);
      filters.push(`week_start_date <= $${values.length}`);
    }

    const limit = parseQueryLimit(req.query.limit);
    const visibilityFilter = `NOT EXISTS (
      SELECT 1 FROM drivers d
      WHERE LOWER(d.name) = LOWER(weekly_wallets.driver)
        AND COALESCE(d.is_hidden, FALSE) = TRUE
    )`;
    const whereClause = `WHERE ${[...filters, visibilityFilter].join(' AND ')}`;
    const limitClause = limit ? `LIMIT $${values.length + 1}` : '';
    if (limit) values.push(limit);

    const result = await db.query(
      `SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as "weekStartDate", to_char(week_end_date, 'YYYY-MM-DD') as "weekEndDate", earnings, refund, diff, cash, charges, trips, wallet_week as "walletWeek", days_worked_override as "daysWorkedOverride", rent_override as "rentOverride", adjustments, notes
       FROM weekly_wallets
       ${whereClause}
       ORDER BY week_start_date DESC
       ${limitClause}`,
      values
    );
    const safeRows = result.rows.map(r => ({
      ...r,
      earnings: Number(r.earnings), refund: Number(r.refund), diff: Number(r.diff), cash: Number(r.cash), charges: Number(r.charges), walletWeek: Number(r.walletWeek),
      daysWorkedOverride: r.daysWorkedOverride !== null ? Number(r.daysWorkedOverride) : undefined,
      rentOverride: r.rentOverride !== null ? Number(r.rentOverride) : undefined,
      adjustments: Number(r.adjustments || 0)
    }));

    if (!cacheBypass) {
      await setCacheJSON(cacheKey, safeRows, WEEKLY_WALLETS_CACHE_TTL_SECONDS);
      registerQueryCacheKey(QUERY_CACHE_NAMESPACE.weeklyWallets, cacheKey);
      res.set('X-Cache', 'MISS');
    }
    res.json(safeRows);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/weekly-wallets', async (req, res) => {
  const w = req.body;
  try {
    const startISO = toISODate(w.weekStartDate);
    const endISO = toISODate(w.weekEndDate || (startISO ? getSundayISO(startISO) : ''));
    if (!startISO) return res.status(400).json({ error: 'Invalid week start date' });

    const duplicateCheck = await db.query(
      `SELECT id FROM weekly_wallets WHERE driver = $1 AND week_start_date = $2 AND id <> $3 LIMIT 1`,
      [w.driver, startISO, w.id || '']
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Weekly wallet already exists for this driver and week.' });
    }

    const existingWallet = w.id
      ? await db.query(`SELECT driver, to_char(week_start_date, 'YYYY-MM-DD') as week_start_date FROM weekly_wallets WHERE id = $1`, [w.id])
      : { rows: [] };
    const previousWallet = existingWallet.rows[0];

    const q = `
      INSERT INTO weekly_wallets (id, driver, week_start_date, week_end_date, earnings, refund, diff, cash, charges, trips, wallet_week, days_worked_override, rent_override, adjustments, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        driver=$2, week_start_date=$3, week_end_date=$4, earnings=$5, refund=$6, diff=$7, cash=$8, charges=$9, trips=$10, wallet_week=$11, days_worked_override=$12, rent_override=$13, adjustments=$14, notes=$15
      RETURNING *;
    `;
    const result = await db.query(q, [w.id, w.driver, startISO, endISO || null, w.earnings, w.refund, w.diff, w.cash, w.charges, w.trips, w.walletWeek, w.daysWorkedOverride ?? null, w.rentOverride ?? null, w.adjustments || 0, w.notes]);

    const newWeekStart = getMondayISO(startISO);
    if (newWeekStart) {
      await syncDriverBillingForWeek({ driverName: w.driver, weekStart: newWeekStart });
    }

    if (previousWallet?.driver && previousWallet?.week_start_date) {
      const prevWeekStart = getMondayISO(previousWallet.week_start_date);
      const prevDriverKey = normalizeDriver(previousWallet.driver);
      const newDriverKey = normalizeDriver(w.driver);
      if (prevWeekStart && (prevWeekStart !== newWeekStart || prevDriverKey !== newDriverKey)) {
        await syncDriverBillingForWeek({ driverName: previousWallet.driver, weekStart: prevWeekStart });
      }
    }

    await invalidateAggregateCaches();
    await invalidateWeeklyWalletsCache();

    const savedWallet = result.rows[0] || {};
    const walletBalance = Number(savedWallet.wallet_week || w.walletWeek || 0);
    emitLiveUpdate('weekly_wallets_changed', {
      change: previousWallet ? 'updated' : 'added',
      driver: savedWallet.driver || w.driver,
      weekStartDate: savedWallet.week_start_date || startISO,
      weekEndDate: savedWallet.week_end_date || endISO || null,
      walletBalance,
    });

    const targetDriverIds = await getDriverIdsForName(savedWallet.driver || w.driver);
    await sendPushToDriverIds(targetDriverIds, {
      title: 'Weekly wallet updated',
      body: `${savedWallet.driver || w.driver}: ${walletBalance.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`,
      url: '/portal',
      tag: `weekly-wallet-${savedWallet.driver || w.driver}`,
      meta: {
        type: 'weekly_wallets_changed',
        change: previousWallet ? 'updated' : 'added',
        walletBalance,
        weekStartDate: savedWallet.week_start_date || startISO,
        weekEndDate: savedWallet.week_end_date || endISO || null,
      },
    });

    res.json(savedWallet);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/weekly-wallets/:id', async (req, res) => {
  try {
    const existing = await db.query(`SELECT driver, to_char(week_start_date, 'YYYY-MM-DD') as week_start_date FROM weekly_wallets WHERE id = $1`, [req.params.id]);
    await db.query('DELETE FROM weekly_wallets WHERE id = $1', [req.params.id]);
    const previous = existing.rows[0];
    if (previous?.driver && previous?.week_start_date) {
      const weekStart = getMondayISO(previous.week_start_date);
      if (weekStart) {
        await syncDriverBillingForWeek({ driverName: previous.driver, weekStart });
      }
    }
    await invalidateAggregateCaches();
    await invalidateWeeklyWalletsCache();
    emitLiveUpdate('weekly_wallets_changed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/driver-expenses', async (req, res) => {
  try {
    const cacheBypass = req.query.fresh === '1';
    const cacheKey = buildQueryCacheKey(driverExpensesCacheKey(), req.query);
    if (!cacheBypass) {
      const cached = await getCacheJSON(cacheKey);
      if (cached) {
        res.set('X-Cache', 'REDIS');
        return res.json(cached);
      }
    }

    const values = [];
    const filters = [];
    const driverFilters = parseDriverFilters(req.query);
    if (driverFilters.length === 1) {
      values.push(driverFilters[0]);
      filters.push(`LOWER(driver) = $${values.length}`);
    } else if (driverFilters.length > 1) {
      values.push(driverFilters);
      filters.push(`LOWER(driver) = ANY($${values.length})`);
    }

    const fromDate = parseQueryDate(req.query.from, 'from');
    if (fromDate) {
      values.push(fromDate);
      filters.push(`expense_date >= $${values.length}`);
    }

    const toDate = parseQueryDate(req.query.to, 'to');
    if (toDate) {
      values.push(toDate);
      filters.push(`expense_date <= $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT id, group_id as "groupId", to_char(expense_date, 'YYYY-MM-DD') as "expenseDate", category, custom_type as "customType",
              driver, amount, notes, split_mode as "splitMode", distribution_mode as "distributionMode", created_at as "createdAt", updated_at as "updatedAt"
       FROM driver_expenses
       ${whereClause}
       ORDER BY expense_date DESC, created_at DESC`,
      values
    );
    const payload = result.rows.map((r) => ({
      ...r,
      amount: Number(r.amount) || 0,
    }));

    if (!cacheBypass) {
      await setCacheJSON(cacheKey, payload, DRIVER_EXPENSES_CACHE_TTL_SECONDS);
      registerQueryCacheKey(QUERY_CACHE_NAMESPACE.driverExpenses, cacheKey);
      res.set('X-Cache', 'MISS');
    }
    res.json(payload);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/driver-expenses', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const payload = req.body || {};
    const groupId = toUuidOrNull(payload.id) || uuidv4();
    const expenseDate = toISODate(payload.expenseDate);
    const amount = Math.round(Number(payload.amount) || 0);
    const splitMode = payload.splitMode === 'all' ? 'all' : 'selected';
    const distributionMode = payload.distributionMode === 'common' ? 'common' : 'split';
    const notes = String(payload.notes || '').trim();
    const category = String(payload.category || '').trim();
    const customType = String(payload.customType || '').trim();
    const selectedDrivers = Array.isArray(payload.selectedDrivers)
      ? payload.selectedDrivers.map((d) => String(d || '').trim()).filter(Boolean)
      : [];

    if (!expenseDate) return res.status(400).json({ error: 'Invalid expense date' });
    if (!category) return res.status(400).json({ error: 'Category is required' });
    if (amount <= 0) return res.status(400).json({ error: 'Expense amount must be greater than 0' });

    const activeDriversRes = await client.query(
      `SELECT name, status, termination_date
       FROM drivers
       WHERE COALESCE(is_hidden, FALSE) = FALSE
         AND LOWER(status) = 'active'`
    );
    const allActiveDrivers = activeDriversRes.rows
      .filter((row) => !isDriverTerminatedOnDate(row, expenseDate))
      .map((row) => String(row.name || '').trim())
      .filter(Boolean);

    const leaveRes = await client.query(
      `SELECT d.name, l.start_date, l.end_date, l.actual_return_date
       FROM leaves l
       JOIN drivers d ON d.id::text = l.driver_id::text`
    );
    const blockedByLeave = new Set(
      leaveRes.rows
        .filter((row) => isDriverOnLeaveOnDate(row, expenseDate))
        .map((row) => normalizeDriver(row.name))
        .filter(Boolean)
    );

    const eligibleDrivers = allActiveDrivers.filter((name) => !blockedByLeave.has(normalizeDriver(name)));
    const targets = splitMode === 'all'
      ? eligibleDrivers
      : selectedDrivers.filter((name) => eligibleDrivers.some((eligible) => normalizeDriver(eligible) === normalizeDriver(name)));

    if (!targets.length) return res.status(400).json({ error: 'No eligible drivers available for split.' });

    const normalizedTargets = Array.from(new Set(targets.map((name) => name.trim()))).sort((a, b) => a.localeCompare(b));
    const allocations = distributionMode === 'common'
      ? normalizedTargets.map(() => amount)
      : splitAmountEquallyInRupees(amount, normalizedTargets.length);

    await client.query('BEGIN');
    await client.query('DELETE FROM driver_expenses WHERE group_id = $1', [groupId]);

    const inserted = [];
    for (let index = 0; index < normalizedTargets.length; index += 1) {
      const driver = normalizedTargets[index];
      const allocatedAmount = allocations[index] || 0;
      if (allocatedAmount <= 0) continue;

      const row = await client.query(
        `INSERT INTO driver_expenses (id, group_id, expense_date, category, custom_type, driver, amount, notes, split_mode, distribution_mode, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id, group_id as "groupId", to_char(expense_date, 'YYYY-MM-DD') as "expenseDate", category, custom_type as "customType",
                   driver, amount, notes, split_mode as "splitMode", distribution_mode as "distributionMode", created_at as "createdAt", updated_at as "updatedAt"`,
        [uuidv4(), groupId, expenseDate, category, customType || null, driver, allocatedAmount, notes || null, splitMode, distributionMode]
      );
      inserted.push({ ...row.rows[0], amount: Number(row.rows[0].amount) || 0 });
    }
    await client.query('COMMIT');

    await invalidateAggregateCaches();
    await invalidateDriverExpensesCache();
    emitLiveUpdate('driver_expenses_changed', { groupId, expenseDate });
    res.json({ groupId, entries: inserted });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/driver-expenses/:groupId', async (req, res) => {
  try {
    const groupId = toUuidOrNull(req.params.groupId);
    if (!groupId) return res.status(400).json({ error: 'Invalid expense group id' });
    await db.query('DELETE FROM driver_expenses WHERE group_id = $1', [groupId]);
    await invalidateAggregateCaches();
    await invalidateDriverExpensesCache();
    emitLiveUpdate('driver_expenses_changed', { groupId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ASSETS ---
app.get('/api/assets', async (req, res) => {
  try {
    const cached = await getCacheJSON(ASSETS_CACHE_KEY);
    if (cached) {
      res.set('X-Cache', 'REDIS');
      return res.json(cached);
    }

    const result = await db.query('SELECT type, value FROM assets');
    const normalize = (value) => String(value || '').trim().toLowerCase();

    const rawVehicles = result.rows.filter(r => r.type === 'vehicle').map(r => String(r.value || '').trim()).filter(Boolean);
    const rawQrCodes = result.rows.filter(r => r.type === 'qrcode').map(r => String(r.value || '').trim()).filter(Boolean);
    const rawVehicleFirstFuelRecords = result.rows
      .filter(r => r.type === 'vehicle_first_fuel')
      .map(r => {
        try {
          return JSON.parse(r.value);
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean);

    const vehicles = [];
    const seenVehicles = new Set();
    for (const vehicle of rawVehicles) {
      const key = normalize(vehicle);
      if (!key || seenVehicles.has(key)) continue;
      seenVehicles.add(key);
      vehicles.push(vehicle);
    }

    const qrCodes = [];
    const seenQrCodes = new Set();
    for (const qr of rawQrCodes) {
      const key = normalize(qr);
      if (!key || seenQrCodes.has(key)) continue;
      seenQrCodes.add(key);
      qrCodes.push(qr);
    }

    const vehicleFirstFuelRecords = [];
    const seenFuelVehicles = new Set();
    const seenFuelDrivers = new Set();
    for (const record of rawVehicleFirstFuelRecords) {
      const vehicleKey = normalize(record?.vehicle);
      const driverKey = normalize(record?.driverId || record?.driverName);
      if (!vehicleKey || !driverKey) continue;
      if (seenFuelVehicles.has(vehicleKey) || seenFuelDrivers.has(driverKey)) continue;
      if (!seenVehicles.has(vehicleKey)) continue;
      seenFuelVehicles.add(vehicleKey);
      seenFuelDrivers.add(driverKey);
      vehicleFirstFuelRecords.push(record);
    }

    const payload = { vehicles, qrCodes, vehicleFirstFuelRecords };
    await setCacheJSON(ASSETS_CACHE_KEY, payload, ASSETS_CACHE_TTL_SECONDS);
    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/assets', async (req, res) => {
  const { vehicles = [], qrCodes = [], vehicleFirstFuelRecords = [] } = req.body;
  const client = await db.pool.connect();
  try {
    const normalize = (value) => String(value || '').trim().toLowerCase();

    const uniqueVehicles = [];
    const seenVehicles = new Set();
    for (const vehicle of vehicles.map(v => String(v || '').trim()).filter(Boolean)) {
      const key = normalize(vehicle);
      if (!key || seenVehicles.has(key)) continue;
      seenVehicles.add(key);
      uniqueVehicles.push(vehicle);
    }

    const uniqueQrCodes = [];
    const seenQrCodes = new Set();
    for (const qr of qrCodes.map(q => String(q || '').trim()).filter(Boolean)) {
      const key = normalize(qr);
      if (!key || seenQrCodes.has(key)) continue;
      seenQrCodes.add(key);
      uniqueQrCodes.push(qr);
    }

    const uniqueVehicleFirstFuelRecords = [];
    const seenFuelVehicles = new Set();
    const seenFuelDrivers = new Set();
    for (const record of vehicleFirstFuelRecords) {
      const vehicleKey = normalize(record?.vehicle);
      const driverKey = normalize(record?.driverId || record?.driverName);
      if (!vehicleKey || !driverKey) continue;
      if (!seenVehicles.has(vehicleKey)) continue;
      if (seenFuelVehicles.has(vehicleKey) || seenFuelDrivers.has(driverKey)) continue;
      seenFuelVehicles.add(vehicleKey);
      seenFuelDrivers.add(driverKey);
      uniqueVehicleFirstFuelRecords.push(record);
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM assets'); 
    for (const v of uniqueVehicles) await client.query("INSERT INTO assets (type, value) VALUES ('vehicle', $1)", [v]);
    for (const q of uniqueQrCodes) await client.query("INSERT INTO assets (type, value) VALUES ('qrcode', $1)", [q]);
    for (const record of uniqueVehicleFirstFuelRecords) {
      await client.query("INSERT INTO assets (type, value) VALUES ('vehicle_first_fuel', $1)", [JSON.stringify(record)]);
    }
    await client.query('COMMIT');
    await invalidateKeys(ASSETS_CACHE_KEY);
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- BOT CONFIG ---
app.get('/api/bot-config', async (_req, res) => {
  try {
    const cached = await getCacheJSON(BOT_CONFIG_CACHE_KEY);
    if (cached) {
      res.set('X-Cache', 'REDIS');
      return res.json({ config: cached });
    }

    const fallback = getBotConfigFallback();
    if (fallback !== null) {
      await setCacheJSON(BOT_CONFIG_CACHE_KEY, fallback, BOT_CONFIG_CACHE_TTL_SECONDS);
      res.set('X-Cache', 'MISS');
      return res.json({ config: fallback });
    }

    res.set('X-Cache', 'MISS');
    return res.json({ config: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot-config', async (req, res) => {
  const { config } = req.body || {};
  try {
    await setCacheJSON(BOT_CONFIG_CACHE_KEY, config ?? null, BOT_CONFIG_CACHE_TTL_SECONDS);
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SYSTEM FLAGS ---
app.get('/api/system-flags/:key', async (req, res) => {
  try {
    const cacheKey = systemFlagCacheKey(req.params.key);
    const cached = await getCacheJSON(cacheKey);
    if (cached) {
      res.set('X-Cache', 'REDIS');
      return res.json(cached);
    }

    const result = await db.query('SELECT flag_value FROM system_flags WHERE flag_key = $1', [req.params.key]);
    const payload = result.rows.length === 0
      ? { key: req.params.key, value: null }
      : { key: req.params.key, value: result.rows[0].flag_value };
    await setCacheJSON(cacheKey, payload, SYSTEM_FLAG_CACHE_TTL_SECONDS);
    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system-flags/:key', async (req, res) => {
  const { value } = req.body;
  try {
    await db.query(
      `INSERT INTO system_flags (flag_key, flag_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (flag_key) DO UPDATE
       SET flag_value = EXCLUDED.flag_value, updated_at = CURRENT_TIMESTAMP`,
      [req.params.key, value]
    );
    await invalidateKeys(systemFlagCacheKey(req.params.key));
    if (req.params.key.startsWith('cash-mode')) {
      emitLiveUpdate('cash_mode_changed', { key: req.params.key });
    }
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RENTAL SLABS ---
app.get('/api/rental-slabs/:type', async (req, res) => {
  try {
    const cacheKey = rentalSlabCacheKey(req.params.type);
    const cached = await getCacheJSON(cacheKey);
    if (cached) {
      res.set('X-Cache', 'REDIS');
      return res.json(cached);
    }

    const result = await db.query(`SELECT id, min_trips as "minTrips", max_trips as "maxTrips", rent_amount as "rentAmount", notes FROM rental_slabs WHERE slab_type = $1 ORDER BY min_trips`, [req.params.type]);
    const safeRows = result.rows.map(r => ({ ...r, rentAmount: Number(r.rentAmount) }));
    await setCacheJSON(cacheKey, safeRows, RENTAL_SLAB_CACHE_TTL_SECONDS);
    res.set('X-Cache', 'MISS');
    res.json(safeRows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rental-slabs/:type', async (req, res) => {
  const type = req.params.type;
  const slabs = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM rental_slabs WHERE slab_type = $1', [type]);
    for (const s of slabs) {
      await client.query(
        'INSERT INTO rental_slabs (id, slab_type, min_trips, max_trips, rent_amount, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [s.id, type, s.minTrips, s.maxTrips, s.rentAmount, s.notes]
      );
    }
    await client.query('COMMIT');
    await invalidateSummaryCache();
    await invalidateKeys(rentalSlabCacheKey(type));
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- COMPANY SUMMARIES ---
app.get('/api/company-summaries', async (req, res) => {
  try {
    const summaries = await db.query(`SELECT id, to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", file_name as "fileName", imported_at as "importedAt", note FROM company_summaries`);
    const fullData = await Promise.all(summaries.rows.map(async (s) => {
      try {
          const rows = await db.query(`
            SELECT 
                vehicle_number as "vehicleNumber", 
                onroad_days as "onroadDays", 
                daily_rent_applied as "dailyRentApplied", 
                weekly_indemnity_fees as "weeklyIndemnityFees", 
                net_weekly_lease_rental as "netWeeklyLeaseRental", 
                performance_day as "performanceDay", 
                uber_trips as "uberTrips", 
                total_earning as "totalEarning", 
                uber_cash_collection as "uberCashCollection", 
                toll, 
                driver_subscription_charge as "driverSubscriptionCharge", 
                uber_incentive as "uberIncentive", 
                uber_week_os as "uberWeekOs", 
                ola_week_os as "olaWeekOs", 
                vehicle_level_adjustment as "vehicleLevelAdjustment", 
                tds, 
                challan, 
                accident, 
                dead_mile as "deadMile", 
                current_os as "currentOs"
            FROM company_summary_rows 
            WHERE summary_id = $1
          `, [s.id]);
          
          const cleanRows = rows.rows.map(r => {
              const n = {...r};
              const numKeys = ['onroadDays','dailyRentApplied', 'weeklyIndemnityFees', 'netWeeklyLeaseRental', 'totalEarning', 'uberCashCollection', 'toll', 'driverSubscriptionCharge', 'uberIncentive', 'uberWeekOs', 'olaWeekOs', 'vehicleLevelAdjustment', 'tds', 'challan', 'accident', 'deadMile', 'currentOs'];
              numKeys.forEach(k => n[k] = Number(n[k] || 0));
              return n;
          });

          return { ...s, rows: cleanRows };
      } catch (childErr) {
          throw childErr;
      }
    }));
    res.json(fullData);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/company-summaries', async (req, res) => {
  const s = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM company_summaries WHERE id = $1', [s.id]);
    await client.query(
      'INSERT INTO company_summaries (id, start_date, end_date, file_name, imported_at, note) VALUES ($1, $2, $3, $4, $5, $6)',
      [s.id, s.startDate, s.endDate, s.fileName, s.importedAt, s.note]
    );
    for (const r of s.rows) {
      await client.query(`
        INSERT INTO company_summary_rows (
          summary_id, vehicle_number, onroad_days, daily_rent_applied, weekly_indemnity_fees, net_weekly_lease_rental,
          performance_day, uber_trips, total_earning, uber_cash_collection, toll, driver_subscription_charge,
          uber_incentive, uber_week_os, ola_week_os, vehicle_level_adjustment, tds, challan, accident, dead_mile, current_os
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `, [
        s.id, r.vehicleNumber, r.onroadDays, r.dailyRentApplied, r.weeklyIndemnityFees, r.netWeeklyLeaseRental,
        r.performanceDay, r.uberTrips, r.totalEarning, r.uberCashCollection, r.toll, r.driverSubscriptionCharge,
        r.uberIncentive, r.uberWeekOs, r.olaWeekOs, r.vehicleLevelAdjustment, r.tds, r.challan, r.accident, r.deadMile, r.currentOs
      ]);
    }
    await client.query('COMMIT');
    res.json(s);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/company-summaries/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM company_summaries WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- LEAVES, SHIFTS, CONFIG ---
app.get('/api/leaves', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        driver_id as "driverId",
        to_char(start_date, 'YYYY-MM-DD') as "startDate",
        to_char(end_date, 'YYYY-MM-DD') as "endDate",
        to_char(actual_return_date, 'YYYY-MM-DD') as "actualReturnDate",
        days,
        reason
      FROM leaves
      ORDER BY start_date DESC, id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/leaves', async (req, res) => {
  const l = req.body;
  try {
    const id = l.id || randomUUID();
    const driverId = l.driverId;
    const startDate = toISODate(l.startDate);
    const endDate = toISODate(l.endDate);
    const actualReturnDate = l.actualReturnDate ? toISODate(l.actualReturnDate) : null;

    if (!driverId || !startDate || !endDate) {
      return res.status(400).json({ error: 'driverId, startDate and endDate are required.' });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: 'endDate must be on or after startDate.' });
    }

    if (actualReturnDate && actualReturnDate < startDate) {
      return res.status(400).json({ error: 'actualReturnDate cannot be before startDate.' });
    }

    const requestedEffectiveEndDate = actualReturnDate || endDate;
    const overlapCheck = await db.query(
      `
        SELECT id
        FROM leaves
        WHERE driver_id = $1
          AND id <> $2
          AND daterange(start_date, COALESCE(actual_return_date + 1, end_date + 1, 'infinity'::date), '[)')
              && daterange($3::date, $4::date + 1, '[)')
        LIMIT 1
      `,
      [driverId, id, startDate, requestedEffectiveEndDate],
    );

    if ((overlapCheck.rowCount || 0) > 0) {
      return res.status(409).json({ error: 'Overlapping leave already exists for this driver.' });
    }

    const dayCount = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const q = `INSERT INTO leaves (id, driver_id, start_date, end_date, actual_return_date, days, reason) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET driver_id=$2, start_date=$3, end_date=$4, actual_return_date=$5, days=$6, reason=$7 RETURNING *`;
    const result = await db.query(q, [id, driverId, startDate, endDate, actualReturnDate, dayCount, l.reason]);
    emitLiveUpdate('leaves_changed');
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/leaves/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM leaves WHERE id = $1', [req.params.id]);
    emitLiveUpdate('leaves_changed');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shifts', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, driver_id as "driverId", shift, to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate" FROM shifts`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shifts', async (req, res) => {
  const s = req.body;
  try {
    const q = `INSERT INTO shifts (id, driver_id, shift, start_date, end_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET driver_id=$2, shift=$3, start_date=$4, end_date=$5 RETURNING *`;
    const result = await db.query(q, [s.id, s.driverId, s.shift, s.startDate, s.endDate]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/header-mappings', async (req, res) => {
  try {
    const result = await db.query(`SELECT internal_key as "internalKey", label, excel_header as "excelHeader", required FROM header_mappings`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/header-mappings', async (req, res) => {
  const mappings = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM header_mappings');
    for (const m of mappings) {
      await client.query('INSERT INTO header_mappings (internal_key, label, excel_header, required) VALUES ($1, $2, $3, $4)', [m.internalKey, m.label, m.excelHeader, m.required]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/admin-access', async (req, res) => {
  try {
    const result = await db.query(`SELECT email, added_by as "addedBy", added_at as "addedAt" FROM admin_access`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin-access', async (req, res) => {
  const a = req.body;
  try {
    await db.query(`INSERT INTO admin_access (email, added_by, added_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`, [a.email, a.addedBy, a.addedAt]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin-access/:email', async (req, res) => {
  try {
    await db.query('DELETE FROM admin_access WHERE email = $1', [req.params.email]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/manager-access', async (req, res) => {
  try {
    const result = await db.query('SELECT manager_id, child_driver_id FROM manager_access');
    const map = {};
    result.rows.forEach(row => {
      if (!map[row.manager_id]) map[row.manager_id] = [];
      map[row.manager_id].push(row.child_driver_id);
    });
    const accessList = Object.keys(map).map(k => ({ managerId: k, childDriverIds: map[k] }));
    res.json(accessList);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/manager-access/:managerId', async (req, res) => {
  try {
    const result = await db.query('SELECT child_driver_id FROM manager_access WHERE manager_id = $1', [req.params.managerId]);
    const childDriverIds = result.rows.map((row) => row.child_driver_id);
    res.json({ managerId: req.params.managerId, childDriverIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/manager-access', async (req, res) => {
  const { managerId, childDriverIds } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM manager_access WHERE manager_id = $1', [managerId]);
    for (const childId of childDriverIds) {
      await client.query('INSERT INTO manager_access (manager_id, child_driver_id) VALUES ($1, $2)', [managerId, childId]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


app.post('/api/perf-metrics', (req, res) => {
  try {
    const metric = req.body || {};
    perfMetricsBuffer.push({
      at: Date.now(),
      route: metric.route || '',
      name: metric.name || '',
      value: Number(metric.value) || 0,
      rating: metric.rating || 'unknown',
      id: metric.id || '',
    });

    if (perfMetricsBuffer.length > PERF_METRICS_LIMIT) {
      perfMetricsBuffer.splice(0, perfMetricsBuffer.length - PERF_METRICS_LIMIT);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/perf-stats', (_req, res) => {
  const avgMs = perfStats.requests ? Math.round(perfStats.totalDurationMs / perfStats.requests) : 0;
  const metricSummary = perfMetricsBuffer.reduce((acc, metric) => {
    const key = metric.name || 'unknown';
    if (!acc[key]) {
      acc[key] = { count: 0, total: 0 };
    }
    acc[key].count += 1;
    acc[key].total += metric.value;
    return acc;
  }, {});

  const webVitals = Object.entries(metricSummary).map(([name, data]) => ({
    name,
    count: data.count,
    avg: data.count ? Number((data.total / data.count).toFixed(2)) : 0,
  }));

  res.json({
    api: {
      requests: perfStats.requests,
      avgDurationMs: avgMs,
      slowRequests: perfStats.slowRequests,
      lastSlowPath: perfStats.lastSlowPath,
    },
    liveEventVersions: Object.fromEntries(liveEventVersions.entries()),
    webVitals,
  });
});

let billingSyncInterval = null;

const startRecurringBillingSync = () => {
  if (billingSyncInterval) return;
  billingSyncInterval = setInterval(() => {
    syncDriverBillings().catch((err) => console.error('Driver billing sync failed:', err));
  }, 5 * 60 * 1000);
};

const runBackgroundInitialization = async () => {
  try {
    await initDb();
    await syncDriverBillings();
    startRecurringBillingSync();
    console.log('Background initialization completed successfully.');
  } catch (err) {
    console.error('Initialization failed:', err);
    setTimeout(() => {
      runBackgroundInitialization().catch((retryErr) => {
        console.error('Initialization retry failed:', retryErr);
      });
    }, 60 * 1000);
  }
};

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

startKeepAlive();
runBackgroundInitialization().catch((err) => {
  console.error('Unexpected initialization error:', err);
});
