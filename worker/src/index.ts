import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Client } from 'pg';
import { Env, query, withTransaction } from './db';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const app = new Hono<{ Bindings: Env }>();


const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const toUuidOrNull = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  return UUID_V4_REGEX.test(raw) ? raw : null;
};

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
          INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, due_label, payout, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          ON CONFLICT (id) DO UPDATE SET
            date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7,
            rent=$8, collection=$9, fuel=$10, due=$11, due_label=$12, payout=$13, notes=$14;
        `;
        await client.query(q, [e.id, isoDate, e.day, e.vehicle, canonicalDriver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.dueLabel || null, e.payout, e.notes]);
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
  const parts = str.split(/[/.-]/).filter(Boolean);
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

const parseQueryDate = (raw: string | undefined, label: string) => {
  if (!raw) return null;
  const iso = toISODate(raw);
  if (!iso) throw new Error(`Invalid ${label} date format`);
  return iso;
};

const parseQueryLimit = (raw: string | undefined, max = 5000) => {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.floor(value), max);
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

app.get('/api/daily-entries', async (c) => {
  try {
    const values: any[] = [];
    const filters: string[] = [];
    const driverFilter = c.req.query('driver') ? normalizeDriver(c.req.query('driver') as string) : null;

    if (driverFilter) {
      values.push(driverFilter);
      filters.push(`LOWER(driver) = $${values.length}`);
    }

    const fromDate = parseQueryDate(c.req.query('from'), 'from');
    if (fromDate) {
      values.push(fromDate);
      filters.push(`date >= $${values.length}`);
    }

    const toDate = parseQueryDate(c.req.query('to'), 'to');
    if (toDate) {
      values.push(toDate);
      filters.push(`date <= $${values.length}`);
    }

    const limit = parseQueryLimit(c.req.query('limit'));
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT $${values.length + 1}` : '';
    if (limit) values.push(limit);

    const result = await query(
      c.env,
      `SELECT id, to_char(date, 'YYYY-MM-DD') as date, day, vehicle, driver, shift, qr_code as "qrCode", rent, collection, fuel, due, due_label as "dueLabel", payout, to_char(payout_date, 'YYYY-MM-DD') as "payoutDate", notes
       FROM daily_entries
       ${whereClause}
       ORDER BY date DESC
       ${limitClause}`,
      values,
    );

    const safeRows = result.rows.map((r: any) => ({
      ...r,
      rent: Number(r.rent),
      collection: Number(r.collection),
      fuel: Number(r.fuel),
      due: Number(r.due),
      payout: Number(r.payout),
    }));

    return c.json(safeRows);
  } catch (err: any) {
    if (err?.message?.startsWith('Invalid')) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err?.message || 'Failed to fetch daily entries' }, 500);
  }
});

app.get('/api/daily-entries/bootstrap', async (c) => {
  try {
    const values: any[] = [];
    const filters: string[] = [];

    const fromDate = parseQueryDate(c.req.query('from'), 'from');
    if (fromDate) {
      values.push(fromDate);
      filters.push(`date >= $${values.length}`);
    }

    const toDate = parseQueryDate(c.req.query('to'), 'to');
    if (toDate) {
      values.push(toDate);
      filters.push(`date <= $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [dailyRes, driversRes, leavesRes, walletsRes] = await Promise.all([
      query(
        c.env,
        `SELECT id, to_char(date, 'YYYY-MM-DD') as date, day, vehicle, driver, shift, qr_code as "qrCode", rent, collection, fuel, due, due_label as "dueLabel", payout, to_char(payout_date, 'YYYY-MM-DD') as "payoutDate", notes
         FROM daily_entries
         ${whereClause}
         ORDER BY date DESC`,
        values,
      ),
      query(c.env, `SELECT id, name, mobile, email, to_char(join_date, 'YYYY-MM-DD') as "joinDate", to_char(termination_date, 'YYYY-MM-DD') as "terminationDate", deposit, qr_code as "qrCode", vehicle, status, current_shift as "currentShift", default_rent as "defaultRent", notes, is_manager as "isManager", food_option as "foodOption" FROM drivers ORDER BY name`),
      query(c.env, `SELECT id, driver_id as "driverId", to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", to_char(actual_return_date, 'YYYY-MM-DD') as "actualReturnDate", days, reason FROM leaves`),
      query(c.env, `SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as "weekStartDate", to_char(week_end_date, 'YYYY-MM-DD') as "weekEndDate", earnings, refund, diff, cash, charges, trips, wallet_week as "walletWeek", days_worked_override as "daysWorkedOverride", rent_override as "rentOverride", adjustments, notes
       FROM weekly_wallets
       ORDER BY week_start_date DESC`),
    ]);

    return c.json({
      entries: dailyRes.rows.map((r: any) => ({
        ...r,
        rent: Number(r.rent),
        collection: Number(r.collection),
        fuel: Number(r.fuel),
        due: Number(r.due),
        payout: Number(r.payout),
      })),
      drivers: driversRes.rows,
      leaves: leavesRes.rows,
      weeklyWallets: walletsRes.rows.map((r: any) => ({
        ...r,
        earnings: Number(r.earnings),
        refund: Number(r.refund),
        diff: Number(r.diff),
        cash: Number(r.cash),
        charges: Number(r.charges),
        walletWeek: Number(r.walletWeek),
        daysWorkedOverride: r.daysWorkedOverride !== null ? Number(r.daysWorkedOverride) : undefined,
        rentOverride: r.rentOverride !== null ? Number(r.rentOverride) : undefined,
        adjustments: Number(r.adjustments || 0),
      })),
    });
  } catch (err: any) {
    if (err?.message?.startsWith('Invalid')) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err?.message || 'Failed to build daily bootstrap payload' }, 500);
  }
});

app.post('/api/daily-entries', async (c) => {
  const e = await c.req.json();
  const isoDate = toISODate(e.date);
  if (!isoDate) return c.json({ error: 'Invalid date format' }, 400);
  const normalizedDriver = normalizeDriver(e.driver);
  const entryId = toUuidOrNull(e.id);
  const duplicateCheck = await query(c.env, `SELECT id FROM daily_entries WHERE date = $1 AND LOWER(driver) = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)`, [isoDate, normalizedDriver, entryId]);
  if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
    return c.json({ error: 'Driver already has an entry for this date. Please edit or delete the existing record.' }, 409);
  }
  const q = `
    INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, due_label, payout, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (id) DO UPDATE SET
      date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7, rent=$8, collection=$9, fuel=$10, due=$11, due_label=$12, payout=$13, notes=$14
    RETURNING *;
  `;
  const result = await query(c.env, q, [entryId || crypto.randomUUID(), isoDate, e.day, e.vehicle, e.driver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.dueLabel || null, e.payout, e.notes]);
  return c.json(result.rows[0]);
});

app.delete('/api/daily-entries/:id', async (c) => {
  const { id } = c.req.param();
  await query(c.env, 'DELETE FROM daily_entries WHERE id = $1', [id]);
  return c.json({ success: true });
});

app.get('/api/drivers', async (c) => {
  try {
    const result = await query(c.env, `SELECT id, name, mobile, email, to_char(join_date, 'YYYY-MM-DD') as "joinDate", to_char(termination_date, 'YYYY-MM-DD') as "terminationDate", deposit, qr_code as "qrCode", vehicle, status, current_shift as "currentShift", default_rent as "defaultRent", notes, is_manager as "isManager", food_option as "foodOption" FROM drivers ORDER BY name`);
    return c.json(result.rows);
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to fetch drivers' }, 500);
  }
});

app.get('/api/leaves', async (c) => {
  try {
    const result = await query(
      c.env,
      `SELECT id, driver_id as "driverId", to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", to_char(actual_return_date, 'YYYY-MM-DD') as "actualReturnDate", days, reason
       FROM leaves
       ORDER BY start_date DESC, id DESC`,
    );
    return c.json(result.rows);
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to fetch leaves' }, 500);
  }
});

app.post('/api/leaves', async (c) => {
  try {
    const l = await c.req.json();
    const id = l.id || crypto.randomUUID();
    const driverId = l.driverId;
    const startDate = toISODate(l.startDate);
    const endDate = toISODate(l.endDate);
    const actualReturnDate = l.actualReturnDate ? toISODate(l.actualReturnDate) : null;

    if (!driverId || !startDate || !endDate) {
      return c.json({ error: 'driverId, startDate and endDate are required.' }, 400);
    }
    if (startDate > endDate) {
      return c.json({ error: 'endDate must be on or after startDate.' }, 400);
    }
    if (actualReturnDate && actualReturnDate < startDate) {
      return c.json({ error: 'actualReturnDate cannot be before startDate.' }, 400);
    }

    const overlap = await query(
      c.env,
      `SELECT id
       FROM leaves
       WHERE driver_id = $1
         AND id <> $2
         AND daterange(start_date, COALESCE(actual_return_date, end_date) + 1, '[)')
             && daterange($3::date, COALESCE($4::date, $5::date) + 1, '[)')
       LIMIT 1`,
      [driverId, id, startDate, actualReturnDate, endDate],
    );
    if ((overlap.rowCount || 0) > 0) {
      return c.json({ error: 'Overlapping leave already exists for this driver.' }, 409);
    }

    const dayCount = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const result = await query(
      c.env,
      `INSERT INTO leaves (id, driver_id, start_date, end_date, actual_return_date, days, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         driver_id=$2, start_date=$3, end_date=$4, actual_return_date=$5, days=$6, reason=$7
       RETURNING id, driver_id as "driverId", to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", to_char(actual_return_date, 'YYYY-MM-DD') as "actualReturnDate", days, reason`,
      [id, driverId, startDate, endDate, actualReturnDate, dayCount, l.reason],
    );
    return c.json(result.rows[0]);
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to save leave' }, 500);
  }
});

app.delete('/api/leaves/:id', async (c) => {
  try {
    const { id } = c.req.param();
    await query(c.env, 'DELETE FROM leaves WHERE id = $1', [id]);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to delete leave' }, 500);
  }
});

app.get('/api/weekly-wallets', async (c) => {
  try {
    const values: any[] = [];
    const filters: string[] = [];
    const driverFilter = c.req.query('driver') ? normalizeDriver(c.req.query('driver') as string) : null;

    if (driverFilter) {
      values.push(driverFilter);
      filters.push(`LOWER(driver) = $${values.length}`);
    }

    const fromDate = parseQueryDate(c.req.query('from'), 'from');
    if (fromDate) {
      values.push(fromDate);
      filters.push(`week_start_date >= $${values.length}`);
    }

    const toDate = parseQueryDate(c.req.query('to'), 'to');
    if (toDate) {
      values.push(toDate);
      filters.push(`week_start_date <= $${values.length}`);
    }

    const limit = parseQueryLimit(c.req.query('limit'));
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT $${values.length + 1}` : '';
    if (limit) values.push(limit);

    const result = await query(
      c.env,
      `SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as "weekStartDate", to_char(week_end_date, 'YYYY-MM-DD') as "weekEndDate", earnings, refund, diff, cash, charges, trips, wallet_week as "walletWeek", days_worked_override as "daysWorkedOverride", rent_override as "rentOverride", adjustments, notes
       FROM weekly_wallets
       ${whereClause}
       ORDER BY week_start_date DESC
       ${limitClause}`,
      values,
    );

    return c.json(result.rows.map((r: any) => ({
      ...r,
      earnings: Number(r.earnings),
      refund: Number(r.refund),
      diff: Number(r.diff),
      cash: Number(r.cash),
      charges: Number(r.charges),
      walletWeek: Number(r.walletWeek),
      daysWorkedOverride: r.daysWorkedOverride !== null ? Number(r.daysWorkedOverride) : undefined,
      rentOverride: r.rentOverride !== null ? Number(r.rentOverride) : undefined,
      adjustments: Number(r.adjustments || 0),
    })));
  } catch (err: any) {
    if (err?.message?.startsWith('Invalid')) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err?.message || 'Failed to fetch weekly wallets' }, 500);
  }
});

const placeholderPaths = [
  '/api/driver-billings',
  '/api/assets',
  '/api/system-flags',
  '/api/rental-slabs',
  '/api/company-summaries',
  '/api/shifts',
  '/api/header-mappings',
  '/api/admin-access',
  '/api/manager-access',
];

placeholderPaths.forEach((path) => {
  if (path === '/api/driver-billings') return; // already implemented
  app.all(path, (c) => c.json({ error: 'Route migrated placeholder - port logic from server/index.js' }, 501));
});

export default {
  fetch: app.fetch,
  scheduled: (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(syncDriverBillings(env));
  },
};
