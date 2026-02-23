import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Client } from 'pg';
import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
import { Env, query, withTransaction } from './db';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const app = new Hono<{ Bindings: Env }>();

app.use('*', (c, next) => {
  const allowlist = (c.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  return cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (allowlist.length === 0) return '*';
      return allowlist.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })(c, next);
});

const healthHandler = (c: any) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ status: 'ok' });
};

app.get('/health', healthHandler);
app.head('/health', healthHandler);

const splitCsvEnv = (value: string | undefined) => String(value || '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean);

const verifyGoogleToken = async (token: string, audiences?: string[]) => {
  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: audiences && audiences.length > 0 ? audiences : undefined,
  });
  return payload;
};

app.post('/api/auth/google', async (c) => {
  const body = await c.req.json();
  const { token, clientId } = body || {};
  if (!token) {
    return c.json({ error: 'Missing Google token' }, 400);
  }

  try {
    const requestedClientId = String(clientId || '').trim();
    const allowedAudiences = Array.from(new Set([
      ...splitCsvEnv(c.env.GOOGLE_CLIENT_IDS),
      String(c.env.GOOGLE_CLIENT_ID || '').trim(),
      requestedClientId,
    ].filter(Boolean)));

    const payload = await verifyGoogleToken(token, allowedAudiences);
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) return c.json({ error: 'Email not found in Google profile' }, 400);

    let role: string = 'driver';
    let driverId: string | null = null;
    let name: string = (payload.name as string) || 'User';
    const photoURL = payload.picture as string | undefined;

    if (email === (c.env.SUPER_ADMIN_EMAIL || '').toLowerCase()) {
      role = 'super_admin';
    } else {
      const adminRes = await query(c.env, 'SELECT email FROM admin_access WHERE lower(email) = lower($1) LIMIT 1', [email]);
      if (adminRes.rowCount && adminRes.rowCount > 0) {
        role = 'admin';
      } else {
        const driverRes = await query(c.env, 'SELECT id, name FROM drivers WHERE lower(email) = lower($1) LIMIT 1', [email]);
        if (!driverRes.rowCount || driverRes.rowCount === 0) return c.json({ error: 'Unauthorized: email not registered' }, 403);
        driverId = driverRes.rows[0].id as string;
        name = (driverRes.rows[0].name as string) || name;
      }
    }

    return c.json({ email, name, role, photoURL, driverId });
  } catch (err: any) {
    console.error('Google authentication failed:', err?.message || err);
    return c.json({ error: 'Invalid Google token' }, 401);
  }
});

app.get('/api/driver-billings', async (c) => {
  try {
    const result = await query(c.env, `
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
    const safeRows = result.rows.map((r: any) => ({
      ...r,
      daysWorked: Number(r.daysWorked),
      trips: Number(r.trips),
      rentPerDay: Number(r.rentPerDay),
      rentTotal: Number(r.rentTotal),
      collection: Number(r.collection),
      due: Number(r.due),
      fuel: Number(r.fuel),
      wallet: Number(r.wallet),
      walletOverdue: Number(r.walletOverdue),
      adjustments: Number(r.adjustments),
      payout: Number(r.payout),
    }));
    return c.json(safeRows);
  } catch (err: any) {
    console.error('Error fetching billings:', err);
    return c.json({ error: err.message || 'Failed to fetch billings' }, 500);
  }
});

app.post('/api/daily-entries/bulk', async (c) => {
  const entries = await c.req.json();
  try {
    await withTransaction(c.env, async (client: Client) => {
      const keyToId = new Map<string, string | null>();
      const qrCodes = Array.from(new Set(entries.map((e: any) => (e.qrCode || '').trim()).filter(Boolean)));
      const qrToDriver: Record<string, string> = {};
      if (qrCodes.length > 0) {
        const qrRes = await client.query(`SELECT qr_code, name FROM drivers WHERE qr_code = ANY($1::text[])`, [qrCodes]);
        qrRes.rows.forEach((r: any) => {
          qrToDriver[String(r.qr_code || '').trim()] = r.name;
        });
      }

      for (const e of entries) {
        const canonicalDriver = e.qrCode && qrToDriver[String(e.qrCode).trim()] ? qrToDriver[String(e.qrCode).trim()] : e.driver;
        const isoDate = toISODate(e.date);
        if (!isoDate) throw new Error(`Invalid date format for entry ${e.id || e.date}`);
        const driverKey = normalizeDriver(canonicalDriver);
        const key = `${driverKey}|${isoDate}`;
        const incomingId = e.id || null;
        const existingIdForKey = keyToId.get(key);
        if (existingIdForKey && existingIdForKey !== incomingId) {
          throw new Error(`Duplicate entry detected in upload for ${canonicalDriver} on ${isoDate}.`);
        }
        keyToId.set(key, incomingId);

        const q = `
          INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, payout, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO UPDATE SET
            date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7,
            rent=$8, collection=$9, fuel=$10, due=$11, payout=$12, notes=$13;
        `;
        await client.query(q, [e.id, isoDate, e.day, e.vehicle, canonicalDriver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.payout, e.notes]);
      }

      const keyList = Array.from(keyToId.keys());
      if (keyList.length > 0) {
        const conflictCheck = await client.query(
          `SELECT id, LOWER(driver) AS driver_key, to_char(date, 'YYYY-MM-DD') as date FROM daily_entries WHERE LOWER(driver)||'|'||to_char(date, 'YYYY-MM-DD') = ANY($1::text[])`,
          [keyList],
        );
        const blocking = conflictCheck.rows.find((row: any) => {
          const key = `${row.driver_key}|${row.date}`;
          return (keyToId.get(key) || null) !== row.id;
        });
        if (blocking) {
          throw new Error(`Driver ${blocking.driver_key} already has an entry on ${blocking.date}. Please remove or edit existing record before importing.`);
        }
      }
    });

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Bulk daily entry upload failed:', err);
    return c.json({ error: err.message || 'Bulk upload failed' }, 400);
  }
});

const normalizeDriver = (name = '') => name.toLowerCase().trim();
const toISODate = (rawVal: any) => {
  if (!rawVal) return '';
  if (rawVal instanceof Date && !isNaN(rawVal as any)) {
    return rawVal.toISOString().slice(0, 10);
  }
  const str = String(rawVal).trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const buildIso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    return dt.toISOString().slice(0, 10);
  };
  const parts = str.split(/[\/.-]/).filter(Boolean);
  if (parts.length === 3) {
    const nums = parts.map((p) => parseInt(p, 10));
    if (parts[0].length === 4) {
      const iso = buildIso(nums[0], nums[1], nums[2]);
      if (iso) return iso;
    }
    if (parts[2].length === 4) {
      const iso = buildIso(nums[2], nums[1], nums[0]);
      if (iso) return iso;
    }
  }
  const native = new Date(str);
  if (!isNaN(native as any)) return native.toISOString().slice(0, 10);
  return '';
};

const syncDriverBillings = async (env: Env) => {
  // The heavy computation should be moved to SQL or a stored procedure. The scheduled trigger
  // simply invokes the database-side sync so the GET endpoint can stay lightweight.
  // Example: CREATE OR REPLACE FUNCTION refresh_driver_billings() ... and call it here.
  try {
    await query(env, 'SELECT refresh_driver_billings()');
  } catch (err) {
    console.error('Driver billing sync failed:', (err as any)?.message || err);
  }
};

const placeholderPaths = [
  '/api/driver-billings',
  '/api/drivers',
  '/api/daily-entries',
  '/api/weekly-wallets',
  '/api/assets',
  '/api/system-flags',
  '/api/rental-slabs',
  '/api/company-summaries',
  '/api/leaves',
  '/api/shifts',
  '/api/header-mappings',
  '/api/admin-access',
  '/api/manager-access',
];

placeholderPaths.forEach((path) => {
  if (path === '/api/driver-billings') return; // already implemented
  if (path === '/api/daily-entries') {
    app.get(path, async (c) => {
      const result = await query(c.env, `SELECT id, to_char(date, 'YYYY-MM-DD') as date, day, vehicle, driver, shift, qr_code as "qrCode", rent, collection, fuel, due, payout, notes FROM daily_entries ORDER BY date DESC`);
      const safeRows = result.rows.map((r: any) => ({
        ...r,
        rent: Number(r.rent),
        collection: Number(r.collection),
        fuel: Number(r.fuel),
        due: Number(r.due),
        payout: Number(r.payout),
      }));
      return c.json(safeRows);
    });
    app.post(path, async (c) => {
      const e = await c.req.json();
      const isoDate = toISODate(e.date);
      if (!isoDate) return c.json({ error: 'Invalid date format' }, 400);
      const normalizedDriver = normalizeDriver(e.driver);
      const duplicateCheck = await query(c.env, `SELECT id FROM daily_entries WHERE date = $1 AND LOWER(driver) = $2 AND ($3::uuid IS NULL OR id <> $3)`, [isoDate, normalizedDriver, e.id || null]);
      if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
        return c.json({ error: 'Driver already has an entry for this date. Please edit or delete the existing record.' }, 409);
      }
      const q = `
        INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, payout, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7, rent=$8, collection=$9, fuel=$10, due=$11, payout=$12, notes=$13
        RETURNING *;
      `;
      const result = await query(c.env, q, [e.id, isoDate, e.day, e.vehicle, e.driver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.payout, e.notes]);
      return c.json(result.rows[0]);
    });
    app.delete(`${path}/:id`, async (c) => {
      const { id } = c.req.param();
      await query(c.env, 'DELETE FROM daily_entries WHERE id = $1', [id]);
      return c.json({ success: true });
    });
    return;
  }
  app.all(path, (c) => c.json({ error: 'Route migrated placeholder - port logic from server/index.js' }, 501));
});

export default {
  fetch: app.fetch,
  scheduled: (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(syncDriverBillings(env));
  },
};
