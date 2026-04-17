-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drivers Table
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

-- 3. Daily Entries Table (Daily Logs)
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
  due_label TEXT DEFAULT 'Due',
  payout NUMERIC DEFAULT 0,
  payout_date DATE,
  notes TEXT
);

-- Strict: only one entry per driver per date (case-insensitive on driver name)
CREATE UNIQUE INDEX IF NOT EXISTS daily_entries_driver_date_key ON daily_entries (LOWER(driver), date);
CREATE INDEX IF NOT EXISTS daily_entries_date_idx ON daily_entries (date);
CREATE INDEX IF NOT EXISTS daily_entries_driver_idx ON daily_entries (LOWER(driver));

-- 4. Weekly Wallets Table (Calculations & Manual Overrides)
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

CREATE INDEX IF NOT EXISTS weekly_wallets_start_date_idx ON weekly_wallets (week_start_date);
CREATE INDEX IF NOT EXISTS weekly_wallets_end_date_idx ON weekly_wallets (week_end_date);
CREATE INDEX IF NOT EXISTS weekly_wallets_date_range_idx ON weekly_wallets (week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS weekly_wallets_driver_idx ON weekly_wallets (LOWER(driver));

-- 5. Driver Expenses (Shared deductions split by driver)
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

CREATE INDEX IF NOT EXISTS driver_expenses_group_idx ON driver_expenses (group_id);
CREATE INDEX IF NOT EXISTS driver_expenses_date_idx ON driver_expenses (expense_date);
CREATE INDEX IF NOT EXISTS driver_expenses_driver_idx ON driver_expenses (LOWER(driver));

-- 6. Driver Billings Table (Finalized/Saved Bills)
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

-- Add Unique Constraint to prevent duplicate finalized bills for same driver/week
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='driver_billings' AND constraint_name='unique_driver_week'
    ) THEN
        ALTER TABLE driver_billings ADD CONSTRAINT unique_driver_week UNIQUE (driver_name, week_start_date);
    END IF;
END $$;

-- 7. Rental Slabs Table (Configuration)
CREATE TABLE IF NOT EXISTS rental_slabs (
  id UUID PRIMARY KEY,
  slab_type TEXT DEFAULT 'company', -- 'company' or 'driver'
  min_trips INTEGER,
  max_trips INTEGER,
  rent_amount NUMERIC,
  notes TEXT
);

-- 8. Company Summaries Table (Import Metadata)
CREATE TABLE IF NOT EXISTS company_summaries (
  id UUID PRIMARY KEY,
  start_date DATE,
  end_date DATE,
  file_name TEXT,
  imported_at TIMESTAMP,
  note TEXT
);

-- 9. Company Summary Rows Table (Imported Data)
CREATE TABLE IF NOT EXISTS company_summary_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  summary_id UUID,
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

-- 10. Leaves Table
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

CREATE INDEX IF NOT EXISTS leaves_start_date_idx ON leaves (start_date);
CREATE INDEX IF NOT EXISTS leaves_end_date_idx ON leaves (end_date);

-- 11. Shifts Table (History)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY,
  driver_id UUID,
  shift TEXT,
  start_date DATE,
  end_date DATE
);

-- 11. Header Mappings Table (Excel Import Config)
CREATE TABLE IF NOT EXISTS header_mappings (
  internal_key TEXT PRIMARY KEY,
  label TEXT,
  excel_header TEXT,
  required BOOLEAN
);

-- 12. Admin Access Table (Auth)
CREATE TABLE IF NOT EXISTS admin_access (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TIMESTAMP
);

-- 13. Manager Access Table (Team Assignments)
CREATE TABLE IF NOT EXISTS manager_access (
  manager_id UUID,
  child_driver_id UUID,
  PRIMARY KEY (manager_id, child_driver_id)
);

-- 14. Assets Table (Dropdown Options)
CREATE TABLE IF NOT EXISTS assets (
  type TEXT, -- 'vehicle' or 'qrcode'
  value TEXT,
  PRIMARY KEY (type, value)
);

-- 15. System Flags (Feature Toggles)
CREATE TABLE IF NOT EXISTS system_flags (
  flag_key TEXT PRIMARY KEY,
  flag_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 16. Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
