-- 1. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  join_date DATE,
  termination_date DATE,
  deposit NUMERIC DEFAULT 0,
  qr_code TEXT,
  vehicle TEXT,
  status TEXT,
  current_shift TEXT,
  default_rent NUMERIC,
  notes TEXT,
  is_manager BOOLEAN DEFAULT FALSE
);

-- 2. Daily Entries
CREATE TABLE IF NOT EXISTS daily_entries (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  day TEXT,
  vehicle TEXT,
  driver TEXT NOT NULL,
  shift TEXT,
  qr_code TEXT,
  rent NUMERIC DEFAULT 0,
  collection NUMERIC DEFAULT 0,
  fuel NUMERIC DEFAULT 0,
  due NUMERIC DEFAULT 0,
  payout NUMERIC DEFAULT 0,
  notes TEXT
);

-- 3. Weekly Wallets
CREATE TABLE IF NOT EXISTS weekly_wallets (
  id TEXT PRIMARY KEY,
  driver TEXT NOT NULL,
  week_start_date DATE,
  week_end_date DATE,
  earnings NUMERIC DEFAULT 0,
  refund NUMERIC DEFAULT 0,
  diff NUMERIC DEFAULT 0,
  cash NUMERIC DEFAULT 0,
  charges NUMERIC DEFAULT 0,
  trips NUMERIC DEFAULT 0,
  wallet_week NUMERIC DEFAULT 0,
  notes TEXT
);

-- 4. Assets (Vehicles & QRs)
CREATE TABLE IF NOT EXISTS assets (
  type TEXT NOT NULL, -- 'vehicle' or 'qrcode'
  value TEXT NOT NULL
);

-- 5. Rental Slabs
CREATE TABLE IF NOT EXISTS rental_slabs (
  id TEXT PRIMARY KEY,
  slab_type TEXT NOT NULL, -- 'driver' or 'company'
  min_trips INTEGER,
  max_trips INTEGER,
  rent_amount NUMERIC,
  notes TEXT
);

-- 6. Company Summaries (Headers)
CREATE TABLE IF NOT EXISTS company_summaries (
  id TEXT PRIMARY KEY,
  start_date DATE,
  end_date DATE,
  file_name TEXT,
  imported_at TIMESTAMP,
  note TEXT
);

-- 7. Company Summary Rows (Data)
CREATE TABLE IF NOT EXISTS company_summary_rows (
  summary_id TEXT REFERENCES company_summaries(id) ON DELETE CASCADE,
  vehicle_number TEXT,
  onroad_days INTEGER,
  daily_rent_applied NUMERIC,
  weekly_indemnity_fees NUMERIC,
  net_weekly_lease_rental NUMERIC,
  performance_day INTEGER,
  uber_trips INTEGER,
  total_earning NUMERIC,
  uber_cash_collection NUMERIC,
  toll NUMERIC,
  driver_subscription_charge NUMERIC,
  uber_incentive NUMERIC,
  uber_week_os NUMERIC,
  ola_week_os NUMERIC,
  vehicle_level_adjustment NUMERIC,
  tds NUMERIC,
  challan NUMERIC,
  accident NUMERIC,
  dead_mile NUMERIC,
  current_os NUMERIC
);

-- 8. Leaves
CREATE TABLE IF NOT EXISTS leaves (
  id TEXT PRIMARY KEY,
  driver_id TEXT,
  start_date DATE,
  end_date DATE,
  actual_return_date DATE,
  days INTEGER,
  reason TEXT
);

-- 9. Shifts History
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  driver_id TEXT,
  shift TEXT,
  start_date DATE,
  end_date DATE
);

-- 10. Header Mappings (For Excel Import)
CREATE TABLE IF NOT EXISTS header_mappings (
  internal_key TEXT PRIMARY KEY,
  label TEXT,
  excel_header TEXT,
  required BOOLEAN
);

-- 11. Admin Access
CREATE TABLE IF NOT EXISTS admin_access (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TIMESTAMP
);

-- 12. Manager Access
CREATE TABLE IF NOT EXISTS manager_access (
  manager_id TEXT,
  child_driver_id TEXT
);
