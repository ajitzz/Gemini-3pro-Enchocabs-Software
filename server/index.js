
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large Excel imports

const PORT = process.env.PORT || 3000;
// --- DATE HELPERS ---
const normalizeDriver = (name = '') => name.toLowerCase().trim();
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
        deposit NUMERIC DEFAULT 0,
        qr_code TEXT,
        vehicle TEXT,
        status TEXT DEFAULT 'Active',
        current_shift TEXT DEFAULT 'Day',
        default_rent NUMERIC DEFAULT 0,
        notes TEXT,
        is_manager BOOLEAN DEFAULT FALSE
      );
    `);

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
const calculateDriverBillings = async () => {
  const [slabRes, walletRes, dailyRes, driverRes] = await Promise.all([
    db.query("SELECT min_trips as \"minTrips\", max_trips as \"maxTrips\", rent_amount as \"rentAmount\" FROM rental_slabs WHERE slab_type = 'driver' ORDER BY min_trips"),
    db.query("SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as week_start_date, to_char(week_end_date, 'YYYY-MM-DD') as week_end_date, trips, wallet_week, rent_override, days_worked_override, adjustments, notes FROM weekly_wallets"),
    db.query("SELECT id, to_char(date, 'YYYY-MM-DD') as date, driver, shift, qr_code, collection, fuel, due FROM daily_entries"),
    db.query("SELECT id, name, qr_code FROM drivers")
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
    const start = getMondayISO(w.week_start_date);
    if (!start) return;
    const driverKey = normalizeDriver(w.driver);
    const key = `${start}__${driverKey}`;
    const resolvedEnd = toISODate(w.week_end_date) || getSundayISO(start);
    walletMap.set(key, {
      ...w,
      week_start_date: start,
      week_end_date: resolvedEnd,
      trips: Number(w.trips) || 0,
      wallet_week: Number(w.wallet_week) || 0,
      rent_override: w.rent_override !== null ? Number(w.rent_override) : null,
      adjustments: Number(w.adjustments || 0),
      days_worked_override: w.days_worked_override !== null ? Number(w.days_worked_override) : null
    });
  });

  const dailyGroups = new Map();
  dailyRes.rows.forEach((d) => {
    const start = getMondayISO(d.date);
    if (!start) return;
    const driverKey = normalizeDriver(d.driver);
    const key = `${start}__${driverKey}`;
    const group = dailyGroups.get(key) || [];
    group.push({
      ...d,
      collection: Number(d.collection) || 0,
      fuel: Number(d.fuel) || 0,
      due: Number(d.due) || 0
    });
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
    const weekStart = wallet?.week_start_date || getMondayISO(entries[0]?.date);
    if (!weekStart) return;
    const weekEnd = wallet?.week_end_date || getSundayISO(weekStart);

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
    const due = entries.reduce((sum, e) => sum + e.due, 0);
    const fuel = entries.reduce((sum, e) => sum + e.fuel, 0);
    const walletAmount = wallet ? wallet.wallet_week : 0;
    const adjustments = wallet ? wallet.adjustments : 0;

    const payout = collection - rentTotal - fuel + due + walletAmount + adjustments;

    billings.push({
      driver_id: driverInfo.id || null,
      driver_name: driverName,
      qr_code: driverInfo.qrCode || wallet?.qr_code || entries[0]?.qr_code || null,
      week_start_date: weekStart,
      week_end_date: weekEnd,
      days_worked: daysWorked,
      trips,
      rent_per_day: rentPerDay,
      rent_total: rentTotal,
      collection,
      due,
      fuel,
      wallet: walletAmount,
      wallet_overdue: due,
      adjustments,
      payout,
      status: 'Finalized'
    });
  });

  return billings;
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

      staleIds.delete(idToUse);
    }

    if (staleIds.size > 0) {
      await client.query('DELETE FROM driver_billings WHERE id = ANY($1)', [Array.from(staleIds)]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

app.get('/api/driver-billings', async (req, res) => {
  try {
    await syncDriverBillings();

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
    res.json(safeRows);
  } catch (err) {
    console.error("Error fetching billings:", err);
    res.status(500).json({ error: err.message });
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
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/driver-billings/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM driver_billings WHERE id = $1', [req.params.id]);
    await syncDriverBillings();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- DRIVERS ---
app.get('/api/drivers', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, name, mobile, email, to_char(join_date, 'YYYY-MM-DD') as "joinDate", to_char(termination_date, 'YYYY-MM-DD') as "terminationDate", deposit, qr_code as "qrCode", vehicle, status, current_shift as "currentShift", default_rent as "defaultRent", notes, is_manager as "isManager" FROM drivers ORDER BY name`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/drivers', async (req, res) => {
  const d = req.body;
  const idToUse = (d.id && d.id.trim().length > 0) ? d.id : uuidv4();
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const nameToSave = d.name.trim();
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
      INSERT INTO drivers (id, name, mobile, email, join_date, termination_date, deposit, qr_code, vehicle, status, current_shift, default_rent, notes, is_manager)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name=$2, mobile=$3, email=$4, join_date=$5, termination_date=$6, deposit=$7, qr_code=$8, vehicle=$9, status=$10, current_shift=$11, default_rent=$12, notes=$13, is_manager=$14
      RETURNING *;
    `;
    const result = await client.query(q, [
      idToUse, nameToSave, mobileToSave, d.email, d.joinDate, d.terminationDate || null, 
      d.deposit, qrToSave, d.vehicle, d.status, d.currentShift, d.defaultRent, d.notes, d.isManager
    ]);
    
    await client.query('COMMIT');
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
    res.json({ success: true });
  } catch (err) { 
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message }); 
  }
});

// --- DAILY ENTRIES ---
app.get('/api/daily-entries', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, to_char(date, 'YYYY-MM-DD') as date, day, vehicle, driver, shift, qr_code as "qrCode", rent, collection, fuel, due, payout, notes FROM daily_entries ORDER BY date DESC`);
    const safeRows = result.rows.map(r => ({
      ...r,
      rent: Number(r.rent), collection: Number(r.collection), fuel: Number(r.fuel), due: Number(r.due), payout: Number(r.payout)
    }));
    res.json(safeRows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/daily-entries', async (req, res) => {
  const e = req.body;
  try {
    const isoDate = toISODate(e.date);
    if (!isoDate) return res.status(400).json({ error: 'Invalid date format' });

    const q = `
      INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, payout, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7, rent=$8, collection=$9, fuel=$10, due=$11, payout=$12, notes=$13
      RETURNING *;
    `;
    const result = await db.query(q, [e.id, isoDate, e.day, e.vehicle, e.driver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.payout, e.notes]);
    await syncDriverBillings();
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/daily-entries/bulk', async (req, res) => {
  const entries = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const qrCodes = [...new Set(entries.map(e => (e.qrCode || '').trim()).filter(Boolean))];
    let qrToDriver = {};
    if (qrCodes.length > 0) {
      const qrRes = await client.query(`SELECT qr_code, name FROM drivers WHERE qr_code = ANY($1::text[])`, [qrCodes]);
      qrRes.rows.forEach(r => { qrToDriver[String(r.qr_code || '').trim()] = r.name; });
    }

    for (const e of entries) {
      const canonicalDriver = (e.qrCode && qrToDriver[String(e.qrCode).trim()]) ? qrToDriver[String(e.qrCode).trim()] : e.driver;
      const isoDate = toISODate(e.date);
      if (!isoDate) throw new Error(`Invalid date format for entry ${e.id || e.date}`);
      const q = `
        INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, payout, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7,
          rent=$8, collection=$9, fuel=$10, due=$11, payout=$12, notes=$13;
      `;
      await client.query(q, [e.id, isoDate, e.day, e.vehicle, canonicalDriver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.payout, e.notes]);
    }
    await client.query('COMMIT');
    await syncDriverBillings();
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/daily-entries/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM daily_entries WHERE id = $1', [req.params.id]);
    await syncDriverBillings();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- WEEKLY WALLETS ---
app.get('/api/weekly-wallets', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, driver, to_char(week_start_date, 'YYYY-MM-DD') as "weekStartDate", to_char(week_end_date, 'YYYY-MM-DD') as "weekEndDate", earnings, refund, diff, cash, charges, trips, wallet_week as "walletWeek", days_worked_override as "daysWorkedOverride", rent_override as "rentOverride", adjustments, notes FROM weekly_wallets ORDER BY week_start_date DESC`);
    const safeRows = result.rows.map(r => ({
      ...r,
      earnings: Number(r.earnings), refund: Number(r.refund), diff: Number(r.diff), cash: Number(r.cash), charges: Number(r.charges), walletWeek: Number(r.walletWeek), 
      daysWorkedOverride: r.daysWorkedOverride !== null ? Number(r.daysWorkedOverride) : undefined,
      rentOverride: r.rentOverride !== null ? Number(r.rentOverride) : undefined,
      adjustments: Number(r.adjustments || 0)
    }));
    res.json(safeRows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/weekly-wallets', async (req, res) => {
  const w = req.body;
  try {
    const startISO = toISODate(w.weekStartDate);
    const endISO = toISODate(w.weekEndDate || (startISO ? getSundayISO(startISO) : ''));
    if (!startISO) return res.status(400).json({ error: 'Invalid week start date' });

    const q = `
      INSERT INTO weekly_wallets (id, driver, week_start_date, week_end_date, earnings, refund, diff, cash, charges, trips, wallet_week, days_worked_override, rent_override, adjustments, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        driver=$2, week_start_date=$3, week_end_date=$4, earnings=$5, refund=$6, diff=$7, cash=$8, charges=$9, trips=$10, wallet_week=$11, days_worked_override=$12, rent_override=$13, adjustments=$14, notes=$15
      RETURNING *;
    `;
    const result = await db.query(q, [w.id, w.driver, startISO, endISO || null, w.earnings, w.refund, w.diff, w.cash, w.charges, w.trips, w.walletWeek, w.daysWorkedOverride ?? null, w.rentOverride ?? null, w.adjustments || 0, w.notes]);
    await syncDriverBillings();
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/weekly-wallets/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM weekly_wallets WHERE id = $1', [req.params.id]);
    await syncDriverBillings();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ASSETS ---
app.get('/api/assets', async (req, res) => {
  try {
    const result = await db.query('SELECT type, value FROM assets');
    const vehicles = result.rows.filter(r => r.type === 'vehicle').map(r => r.value);
    const qrCodes = result.rows.filter(r => r.type === 'qrcode').map(r => r.value);
    res.json({ vehicles, qrCodes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/assets', async (req, res) => {
  const { vehicles, qrCodes } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM assets'); 
    for (const v of vehicles) await client.query("INSERT INTO assets (type, value) VALUES ('vehicle', $1)", [v]);
    for (const q of qrCodes) await client.query("INSERT INTO assets (type, value) VALUES ('qrcode', $1)", [q]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- RENTAL SLABS ---
app.get('/api/rental-slabs/:type', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, min_trips as "minTrips", max_trips as "maxTrips", rent_amount as "rentAmount", notes FROM rental_slabs WHERE slab_type = $1 ORDER BY min_trips`, [req.params.type]);
    const safeRows = result.rows.map(r => ({ ...r, rentAmount: Number(r.rentAmount) }));
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
    const result = await db.query(`SELECT id, driver_id as "driverId", to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", to_char(actual_return_date, 'YYYY-MM-DD') as "actualReturnDate", days, reason FROM leaves`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/leaves', async (req, res) => {
  const l = req.body;
  try {
    const q = `INSERT INTO leaves (id, driver_id, start_date, end_date, actual_return_date, days, reason) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET driver_id=$2, start_date=$3, end_date=$4, actual_return_date=$5, days=$6, reason=$7 RETURNING *`;
    const result = await db.query(q, [l.id, l.driverId, l.startDate, l.endDate, l.actualReturnDate, l.days, l.reason]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/leaves/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM leaves WHERE id = $1', [req.params.id]);
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

initDb()
  .then(async () => {
    try {
      await syncDriverBillings();
      setInterval(() => {
        syncDriverBillings().catch((err) => console.error('Driver billing sync failed:', err));
      }, 5 * 60 * 1000);
    } catch (err) {
      console.error('Initial driver billing sync failed:', err);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Initialization failed:', err);
  });

