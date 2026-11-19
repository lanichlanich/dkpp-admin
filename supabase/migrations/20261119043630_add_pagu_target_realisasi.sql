CREATE TABLE IF NOT EXISTS adminflow.planning_catalog (
  source_system TEXT PRIMARY KEY CHECK (source_system = 'sipena'),
  data_json JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS adminflow.planning_years (
  year INTEGER PRIMARY KEY CHECK (year BETWEEN 2025 AND 2030),
  revision INTEGER NOT NULL CHECK (revision >= 0)
);
CREATE TABLE IF NOT EXISTS adminflow.planning_records (
  year INTEGER NOT NULL REFERENCES adminflow.planning_years(year),
  kind TEXT NOT NULL CHECK (kind IN ('budget','financial','target','evaluation','node_assignment','indicator_assignment','period','evidence')),
  subject TEXT NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 0 AND 4),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  data_json JSONB NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (year, kind, subject, quarter),
  CHECK ((kind IN ('budget','target','node_assignment','indicator_assignment') AND quarter = 0)
    OR (kind IN ('financial','evaluation','period','evidence') AND quarter BETWEEN 1 AND 4))
);
CREATE TABLE IF NOT EXISTS adminflow.planning_access (
  user_id TEXT PRIMARY KEY REFERENCES adminflow.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('head','operator','observer')),
  department TEXT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  CHECK (role = 'observer' OR department IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS adminflow.planning_audit (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  actor TEXT NOT NULL,
  at_utc TEXT NOT NULL,
  reason TEXT NOT NULL,
  old_json JSONB,
  new_json JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS planning_audit_subject_idx ON adminflow.planning_audit(year, kind, subject, quarter, at_utc);
CREATE TABLE IF NOT EXISTS adminflow.planning_uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES adminflow.users(id) ON DELETE CASCADE,
  data_json JSONB NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS planning_uploads_user_idx ON adminflow.planning_uploads(user_id, expires_at);
ALTER TABLE adminflow.planning_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.planning_catalog FROM public, anon, authenticated;
ALTER TABLE adminflow.planning_years ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.planning_years FROM public, anon, authenticated;
ALTER TABLE adminflow.planning_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.planning_records FROM public, anon, authenticated;
ALTER TABLE adminflow.planning_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.planning_access FROM public, anon, authenticated;
ALTER TABLE adminflow.planning_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.planning_audit FROM public, anon, authenticated;
ALTER TABLE adminflow.planning_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.planning_uploads FROM public, anon, authenticated;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dkpp-planning', 'dkpp-planning', false, 10485760, ARRAY[
  'application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
