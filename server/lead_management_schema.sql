-- Driver lead workspace schema (copy/paste into current database)
-- Organises leads into sheets with configurable statuses and dated updates

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS lead_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID NOT NULL REFERENCES lead_sheets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'slate',
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS driver_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID NOT NULL REFERENCES lead_sheets(id) ON DELETE CASCADE,
  created_time DATE DEFAULT CURRENT_DATE,
  platform TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  status_id UUID REFERENCES lead_statuses(id) ON DELETE SET NULL,
  admin TEXT,
  note TEXT,
  latest_update TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES driver_leads(id) ON DELETE CASCADE,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_leads_sheet_status ON driver_leads(sheet_id, status_id);
CREATE INDEX IF NOT EXISTS idx_lead_updates_lead ON lead_updates(lead_id, update_date);

-- Optional: default statuses per sheet
INSERT INTO lead_statuses (id, sheet_id, label, color, position)
SELECT uuid_generate_v4(), ls.id, s.label, s.color, s.position
FROM lead_sheets ls
CROSS JOIN (
  VALUES ('Interested','emerald',1), ('Waiting','amber',2), ('Confirmed','indigo',3), ('Not Interested','rose',4)
) AS s(label, color, position)
WHERE NOT EXISTS (SELECT 1 FROM lead_statuses WHERE sheet_id = ls.id)
ON CONFLICT DO NOTHING;
