-- Lead management schema
CREATE TABLE IF NOT EXISTS lead_lists (
  id UUID PRIMARY KEY,
  company_id UUID NULL,
  name TEXT NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_statuses (
  id UUID PRIMARY KEY,
  list_id UUID REFERENCES lead_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_list_order ON lead_statuses(list_id, sort_order);

CREATE TABLE IF NOT EXISTS lead_action_templates (
  id UUID PRIMARY KEY,
  list_id UUID REFERENCES lead_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_days INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY,
  list_id UUID REFERENCES lead_lists(id) ON DELETE CASCADE,
  lead_capture_at TIMESTAMPTZ NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  phone TEXT,
  phone_normalized TEXT NOT NULL,
  city TEXT,
  source TEXT,
  status_id UUID REFERENCES lead_statuses(id) ON DELETE SET NULL,
  action_template_id UUID REFERENCES lead_action_templates(id) ON DELETE SET NULL,
  follow_up_at TIMESTAMPTZ,
  assigned_to TEXT,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_list_status ON leads(list_id, status_id);
CREATE INDEX IF NOT EXISTS idx_leads_list_followup ON leads(list_id, follow_up_at);
CREATE INDEX IF NOT EXISTS idx_leads_list_capture ON leads(list_id, lead_capture_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_list_phone_unique ON leads(list_id, phone_normalized);

CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  actor_email TEXT,
  event_type TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
