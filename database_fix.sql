-- PostgreSQL schema for lead management
-- Requires: CREATE EXTENSION IF NOT EXISTS "pgcrypto"; (for gen_random_uuid)

CREATE TABLE IF NOT EXISTS lead_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
  lead_capture_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'Walk-in',
  source TEXT,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  city TEXT,
  status_id UUID REFERENCES lead_statuses(id) ON DELETE SET NULL,
  action_template_id UUID,
  follow_up_at TIMESTAMPTZ,
  assigned_to TEXT,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional structured updates instead of JSON array inside custom_fields
CREATE TABLE IF NOT EXISTS lead_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  occurred_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_list_id ON leads(list_id);
CREATE INDEX IF NOT EXISTS idx_leads_status_id ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized ON leads(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_list_id ON lead_statuses(list_id);
