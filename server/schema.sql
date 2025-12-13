-- Enable UUID extension for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 2. DAILY ENTRIES TABLE (Collections & Fuel)
CREATE TABLE IF NOT EXISTS daily_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 3. WEEKLY WALLETS TABLE (Calculated weekly snapshots)
CREATE TABLE IF NOT EXISTS weekly_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
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

-- 4. DRIVER BILLINGS TABLE (Finalized Bills)
CREATE TABLE IF NOT EXISTS driver_billings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID,
  driver_name TEXT NOT NULL,
  qr_code TEXT,
  week_start_date DATE,
  week_end_date DATE,
  days_worked INT,
  trips INT,
  rent_per_day NUMERIC DEFAULT 0,
  rent_total NUMERIC DEFAULT 0,
  collection NUMERIC DEFAULT 0,
  fuel NUMERIC DEFAULT 0,
  wallet NUMERIC DEFAULT 0,
  wallet_overdue NUMERIC DEFAULT 0,
  adjustments NUMERIC DEFAULT 0,
  payout NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Finalized',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ASSETS POOL (Vehicles & QR Codes)
CREATE TABLE IF NOT EXISTS assets (
  type TEXT NOT NULL, -- 'vehicle' or 'qrcode'
  value TEXT NOT NULL
);

-- 6. RENTAL SLABS (Rent Rules)
CREATE TABLE IF NOT EXISTS rental_slabs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slab_type TEXT, -- 'driver' or 'company'
  min_trips INT,
  max_trips INT, -- NULL represents Infinity
  rent_amount NUMERIC DEFAULT 0,
  notes TEXT
);

-- 7. LEAVES TABLE
CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  actual_return_date DATE,
  days INT,
  reason TEXT
);

-- 8. SHIFTS HISTORY
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id TEXT NOT NULL,
  shift TEXT,
  start_date DATE,
  end_date DATE
);

-- 9. COMPANY WEEKLY SUMMARIES (Import Metadata)
CREATE TABLE IF NOT EXISTS company_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  start_date DATE,
  end_date DATE,
  file_name TEXT,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);

-- 10. COMPANY SUMMARY ROWS (Import Data)
CREATE TABLE IF NOT EXISTS company_summary_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  summary_id UUID REFERENCES company_summaries(id) ON DELETE CASCADE,
  vehicle_number TEXT,
  onroad_days NUMERIC,
  daily_rent_applied NUMERIC,
  weekly_indemnity_fees NUMERIC,
  net_weekly_lease_rental NUMERIC,
  performance_day NUMERIC,
  uber_trips NUMERIC,
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

-- 11. IMPORT HEADER MAPPINGS
CREATE TABLE IF NOT EXISTS header_mappings (
  internal_key TEXT PRIMARY KEY,
  label TEXT,
  excel_header TEXT,
  required BOOLEAN DEFAULT FALSE
);

-- 12. ADMIN ACCESS (Super Admin & Staff)
CREATE TABLE IF NOT EXISTS admin_access (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. MANAGER ACCESS (Team Mapping)
CREATE TABLE IF NOT EXISTS manager_access (
  manager_id TEXT NOT NULL,
  child_driver_id TEXT NOT NULL,
  PRIMARY KEY (manager_id, child_driver_id)
);

-- --- INITIAL SEED DATA (Optional) ---

-- Default Header Mappings
INSERT INTO header_mappings (internal_key, label, excel_header, required) VALUES
('vehicleNumber', 'Vehicle Number', 'Vehicle Number', true),
('onroadDays', 'Onroad Days', 'Onroad Days', true),
('dailyRentApplied', 'Daily Rent Applied', 'Daily Rent Applied', true),
('weeklyIndemnityFees', 'Weekly Indemnity Fees', 'Weekly Indemnity Fees', true),
('netWeeklyLeaseRental', 'Net Weekly Lease Rental', 'Net Weekly Lease Rental', true),
('performanceDay', 'Performance Day', 'Performance Day', false),
('uberTrips', 'Uber Trips', 'Uber Trips', true),
('totalEarning', 'Total Earning', 'Total Earning', true),
('uberCashCollection', 'Uber Cash Collection', 'Uber Cash Collection', true),
('toll', 'Toll', 'Toll', true),
('driverSubscriptionCharge', 'Driver Subscription Charge', 'Driver subscription charge', true),
('uberIncentive', 'Uber Incentive', 'Uber Incentive', true),
('uberWeekOs', 'Uber Week O/s', 'Uber Week O/s', true),
('olaWeekOs', 'OLA Week O/s', 'OLA Week O/s', false),
('vehicleLevelAdjustment', 'Vehicle Level Adjustment', 'Vehicle Level Adjustment', true),
('tds', 'TDS', 'TDS', true),
('challan', 'Challan', 'Challan', true),
('accident', 'Accident', 'Accident', true),
('deadMile', 'DeadMile', 'DeadMile', true),
('currentOs', 'Current O/S', 'Current O/S', true)
ON CONFLICT (internal_key) DO NOTHING;

-- Default Rental Slabs (Driver)
INSERT INTO rental_slabs (slab_type, min_trips, max_trips, rent_amount, notes) VALUES
('driver', 0, 49, 957, 'Base Driver Rent'),
('driver', 50, 54, 885, 'Tier 1'),
('driver', 55, 59, 842, 'Tier 2'),
('driver', 60, 64, 772, 'Tier 3'),
('driver', 65, 69, 700, 'Tier 4'),
('driver', 70, NULL, 550, 'Top Tier')
ON CONFLICT DO NOTHING; -- Note: UUID gen makes conflict unlikely, run only once.
