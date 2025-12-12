
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large Excel imports

const PORT = process.env.PORT || 3000;

// --- INITIALIZATION SQL ---
const initDb = async () => {
  try {
    // Ensure weekly_wallets has required columns
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
    
    // Add columns if missing (Migration)
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
      END $$;
    `);
    console.log("Database schema verified.");
  } catch (err) {
    console.error("DB Init Error:", err);
  }
};

initDb();

// --- HELPERS ---
const snakeToCamel = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const mapKeys = (obj) => {
  const newObj = {};
  for (let key in obj) newObj[snakeToCamel(key)] = obj[key];
  return newObj;
};

// --- DRIVERS ---
app.get('/api/drivers', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, name, mobile, email, to_char(join_date, 'YYYY-MM-DD') as "joinDate", to_char(termination_date, 'YYYY-MM-DD') as "terminationDate", deposit, qr_code as "qrCode", vehicle, status, current_shift as "currentShift", default_rent as "defaultRent", notes, is_manager as "isManager" FROM drivers ORDER BY name`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/drivers', async (req, res) => {
  const d = req.body;
  
  // UUID FIX: Generate a new ID if one isn't provided or is empty
  const idToUse = (d.id && d.id.trim().length > 0) ? d.id : uuidv4();

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check Name Duplication
    const nameCheck = await client.query('SELECT * FROM drivers WHERE lower(name) = lower($1) AND id != $2', [d.name, idToUse]);
    if (nameCheck.rows.length > 0) {
        const existing = nameCheck.rows[0];
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Driver name "${d.name}" already exists (Status: ${existing.status || 'Active'}).` });
    }

    // 2. Check Mobile Duplication (Only if mobile is provided)
    if (d.mobile && d.mobile.trim().length > 0) {
        const mobileCheck = await client.query('SELECT * FROM drivers WHERE mobile = $1 AND id != $2', [d.mobile, idToUse]);
        if (mobileCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Mobile number "${d.mobile}" is already assigned to driver "${mobileCheck.rows[0].name}".` });
        }
    }

    // 3. Handle Name Change Propagation
    // Check if driver exists and name is different
    const currentDriverRes = await client.query('SELECT name FROM drivers WHERE id = $1', [idToUse]);
    if (currentDriverRes.rows.length > 0) {
        const oldName = currentDriverRes.rows[0].name;
        const newName = d.name;
        
        if (oldName !== newName) {
            console.log(`Renaming driver from "${oldName}" to "${newName}" in history...`);
            // Update daily entries and weekly wallets which rely on the name text
            await client.query('UPDATE daily_entries SET driver = $1 WHERE driver = $2', [newName, oldName]);
            await client.query('UPDATE weekly_wallets SET driver = $1 WHERE driver = $2', [newName, oldName]);
        }
    }

    // 4. Upsert using idToUse
    const q = `
      INSERT INTO drivers (id, name, mobile, email, join_date, termination_date, deposit, qr_code, vehicle, status, current_shift, default_rent, notes, is_manager)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name=$2, mobile=$3, email=$4, join_date=$5, termination_date=$6, deposit=$7, qr_code=$8, vehicle=$9, status=$10, current_shift=$11, default_rent=$12, notes=$13, is_manager=$14
      RETURNING *;
    `;
    const result = await client.query(q, [idToUse, d.name, d.mobile, d.email, d.joinDate, d.terminationDate || null, d.deposit, d.qrCode, d.vehicle, d.status, d.currentShift, d.defaultRent, d.notes, d.isManager]);
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  console.log(`Received DELETE request for driver ID: ${req.params.id}`);
  try {
    const result = await db.query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
        console.log(`Driver ID ${req.params.id} not found in DB, but returning success to ensure idempotency.`);
    }
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
    // Convert numeric strings to numbers for frontend safety
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
    const q = `
      INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, payout, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7, rent=$8, collection=$9, fuel=$10, due=$11, payout=$12, notes=$13
      RETURNING *;
    `;
    const result = await db.query(q, [e.id, e.date, e.day, e.vehicle, e.driver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.payout, e.notes]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/daily-entries/bulk', async (req, res) => {
  const entries = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of entries) {
      const q = `
        INSERT INTO daily_entries (id, date, day, vehicle, driver, shift, qr_code, rent, collection, fuel, due, payout, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          date=$2, day=$3, vehicle=$4, driver=$5, shift=$6, qr_code=$7, rent=$8, collection=$9, fuel=$10, due=$11, payout=$12, notes=$13;
      `;
      // Updated: Use DO UPDATE to allow overrides (e.g. rent updates)
      await client.query(q, [e.id, e.date, e.day, e.vehicle, e.driver, e.shift, e.qrCode, e.rent, e.collection, e.fuel, e.due, e.payout, e.notes]);
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

app.delete('/api/daily-entries/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM daily_entries WHERE id = $1', [req.params.id]);
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
    const q = `
      INSERT INTO weekly_wallets (id, driver, week_start_date, week_end_date, earnings, refund, diff, cash, charges, trips, wallet_week, days_worked_override, rent_override, adjustments, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        driver=$2, week_start_date=$3, week_end_date=$4, earnings=$5, refund=$6, diff=$7, cash=$8, charges=$9, trips=$10, wallet_week=$11, days_worked_override=$12, rent_override=$13, adjustments=$14, notes=$15
      RETURNING *;
    `;
    const result = await db.query(q, [w.id, w.driver, w.weekStartDate, w.weekEndDate, w.earnings, w.refund, w.diff, w.cash, w.charges, w.trips, w.walletWeek, w.daysWorkedOverride ?? null, w.rentOverride ?? null, w.adjustments || 0, w.notes]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/weekly-wallets/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM weekly_wallets WHERE id = $1', [req.params.id]);
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
    await client.query('DELETE FROM assets'); // Full replace to match localStorage behavior
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
    console.log("Fetching company summaries list...");
    // 1. Fetch parent table
    const summaries = await db.query(`SELECT id, to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", file_name as "fileName", imported_at as "importedAt", note FROM company_summaries`);
    
    console.log(`Found ${summaries.rows.length} summaries. Fetching rows...`);

    // 2. Fetch children
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
              // Ensure numbers are Numbers
              const numKeys = ['onroadDays','dailyRentApplied', 'weeklyIndemnityFees', 'netWeeklyLeaseRental', 'totalEarning', 'uberCashCollection', 'toll', 'driverSubscriptionCharge', 'uberIncentive', 'uberWeekOs', 'olaWeekOs', 'vehicleLevelAdjustment', 'tds', 'challan', 'accident', 'deadMile', 'currentOs'];
              numKeys.forEach(k => n[k] = Number(n[k] || 0));
              return n;
          });

          return { ...s, rows: cleanRows };
      } catch (childErr) {
          console.error(`Error fetching rows for summary ${s.id}:`, childErr);
          throw childErr; // Propagate to main catch
      }
    }));
    
    res.json(fullData);
  } catch (err) { 
      console.error("API GET Error (/company-summaries):", err.message);
      res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/company-summaries', async (req, res) => {
  const s = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete existing if ID matches (Update logic)
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
    console.error("API POST Error (/company-summaries):", err.message);
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

// --- LEAVES ---
app.get('/api/leaves', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, driver_id as "driverId", to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate", to_char(actual_return_date, 'YYYY-MM-DD') as "actualReturnDate", days, reason FROM leaves`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/leaves', async (req, res) => {
  const l = req.body;
  try {
    const q = `
      INSERT INTO leaves (id, driver_id, start_date, end_date, actual_return_date, days, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        driver_id=$2, start_date=$3, end_date=$4, actual_return_date=$5, days=$6, reason=$7
      RETURNING *;
    `;
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

// --- SHIFTS ---
app.get('/api/shifts', async (req, res) => {
  try {
    const result = await db.query(`SELECT id, driver_id as "driverId", shift, to_char(start_date, 'YYYY-MM-DD') as "startDate", to_char(end_date, 'YYYY-MM-DD') as "endDate" FROM shifts`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shifts', async (req, res) => {
  const s = req.body;
  try {
    const q = `
      INSERT INTO shifts (id, driver_id, shift, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        driver_id=$2, shift=$3, start_date=$4, end_date=$5
      RETURNING *;
    `;
    const result = await db.query(q, [s.id, s.driverId, s.shift, s.startDate, s.endDate]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CONFIG & ACCESS ---
app.get('/api/header-mappings', async (req, res) => {
  try {
    const result = await db.query(`SELECT internal_key as "internalKey", label, excel_header as "excelHeader", required FROM header_mappings`);
    // If empty, return defaults (handled in frontend logic usually, but here we can return empty array)
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
    // Group by manager_id for frontend format: { managerId, childDriverIds: [] }
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
