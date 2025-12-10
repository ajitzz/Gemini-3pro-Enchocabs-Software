-- Enable UUID extension if needed (optional, as we generate UUIDs in frontend/node)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT,
    join_date DATE NOT NULL,
    termination_date DATE,
    deposit NUMERIC(12, 2) DEFAULT 0,
    qr_code TEXT,
    vehicle TEXT,
    status TEXT DEFAULT 'Active', -- 'Active' or 'Terminated'
    current_shift TEXT DEFAULT 'Day',
    default_rent NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,
    is_manager BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(name);

-- 2. DAILY ENTRIES (The Ledger)
CREATE TABLE IF NOT EXISTS daily_entries (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    day TEXT,
    vehicle TEXT,
    driver TEXT NOT NULL,
    shift TEXT,
    qr_code TEXT,
    rent NUMERIC(12, 2) DEFAULT 0,
    collection NUMERIC(12, 2) DEFAULT 0,
    fuel NUMERIC(12, 2) DEFAULT 0,
    due NUMERIC(12, 2) DEFAULT 0,
    payout NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,
    CONSTRAINT uniq_entry_driver_date UNIQUE (date, driver)
);

CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_driver ON daily_entries(driver);

-- 3. WEEKLY WALLETS
CREATE TABLE IF NOT EXISTS weekly_wallets (
    id TEXT PRIMARY KEY,
    driver TEXT NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    earnings NUMERIC(12, 2) DEFAULT 0,
    refund NUMERIC(12, 2) DEFAULT 0,
    diff NUMERIC(12, 2) DEFAULT 0,
    cash NUMERIC(12, 2) DEFAULT 0,
    charges NUMERIC(12, 2) DEFAULT 0,
    trips NUMERIC(12, 2) DEFAULT 0,
    wallet_week NUMERIC(12, 2) DEFAULT 0, -- Calculated Net
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_weekly_wallets_driver ON weekly_wallets(driver);

-- 4. ASSETS (Polymorphic table for Vehicles & QR Codes)
CREATE TABLE IF NOT EXISTS assets (
    type TEXT NOT NULL, -- 'vehicle' or 'qrcode'
    value TEXT NOT NULL,
    PRIMARY KEY (type, value)
);

-- 5. RENTAL SLABS (Configuration)
CREATE TABLE IF NOT EXISTS rental_slabs (
    id TEXT PRIMARY KEY,
    slab_type TEXT NOT NULL DEFAULT 'company', -- 'company' or 'driver'
    min_trips INTEGER DEFAULT 0,
    max_trips INTEGER, -- NULL represents Infinity (e.g. 125+)
    rent_amount NUMERIC(12, 2) DEFAULT 0,
    notes TEXT
);

-- 6. COMPANY SUMMARIES (Excel Import Headers)
CREATE TABLE IF NOT EXISTS company_summaries (
    id TEXT PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    file_name TEXT NOT NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

-- 7. COMPANY SUMMARY ROWS (Excel Import Data)
CREATE TABLE IF NOT EXISTS company_summary_rows (
    id SERIAL PRIMARY KEY,
    summary_id TEXT NOT NULL REFERENCES company_summaries(id) ON DELETE CASCADE,
    vehicle_number TEXT,
    onroad_days INTEGER DEFAULT 0,
    daily_rent_applied NUMERIC(12, 2) DEFAULT 0,
    weekly_indemnity_fees NUMERIC(12, 2) DEFAULT 0,
    net_weekly_lease_rental NUMERIC(12, 2) DEFAULT 0,
    performance_day NUMERIC(12, 2) DEFAULT 0,
    uber_trips INTEGER DEFAULT 0,
    total_earning NUMERIC(12, 2) DEFAULT 0,
    uber_cash_collection NUMERIC(12, 2) DEFAULT 0,
    toll NUMERIC(12, 2) DEFAULT 0,
    driver_subscription_charge NUMERIC(12, 2) DEFAULT 0,
    uber_incentive NUMERIC(12, 2) DEFAULT 0,
    uber_week_os NUMERIC(12, 2) DEFAULT 0,
    ola_week_os NUMERIC(12, 2) DEFAULT 0,
    vehicle_level_adjustment NUMERIC(12, 2) DEFAULT 0,
    tds NUMERIC(12, 2) DEFAULT 0,
    challan NUMERIC(12, 2) DEFAULT 0,
    accident NUMERIC(12, 2) DEFAULT 0,
    dead_mile NUMERIC(12, 2) DEFAULT 0,
    current_os NUMERIC(12, 2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_summary_rows_summary_id ON company_summary_rows(summary_id);

-- 8. HEADER MAPPINGS (Excel Config)
CREATE TABLE IF NOT EXISTS header_mappings (
    internal_key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    excel_header TEXT NOT NULL,
    required BOOLEAN DEFAULT FALSE
);

-- 9. SHIFTS HISTORY
CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL REFERENCES drivers(id),
    shift TEXT NOT NULL, -- 'Day' or 'Night'
    start_date DATE NOT NULL,
    end_date DATE -- NULL means currently active
);

-- 10. LEAVES
CREATE TABLE IF NOT EXISTS leaves (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL REFERENCES drivers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    actual_return_date DATE,
    days INTEGER DEFAULT 0,
    reason TEXT
);

-- 11. ACCESS CONTROL
CREATE TABLE IF NOT EXISTS admin_access (
    email TEXT PRIMARY KEY,
    added_by TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manager_access (
    manager_id TEXT NOT NULL REFERENCES drivers(id),
    child_driver_id TEXT NOT NULL REFERENCES drivers(id),
    PRIMARY KEY (manager_id, child_driver_id)
);
