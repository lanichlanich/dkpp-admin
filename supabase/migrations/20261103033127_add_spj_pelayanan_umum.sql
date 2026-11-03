-- SPJ attendance and receipt records. Private server access uses the application menu permission.
-- Seed follows the supplied templates, with the requested 10 active days.

CREATE TABLE IF NOT EXISTS adminflow.spj_service_types (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  day_mode TEXT NOT NULL CHECK (day_mode IN ('quota', 'all')),
  active_days INTEGER NOT NULL CHECK (active_days BETWEEN 1 AND 31),
  daily_rate BIGINT NOT NULL CHECK (daily_rate BETWEEN 0 AND 1000000000),
  weekdays_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS spj_service_types_name_idx ON adminflow.spj_service_types(lower(name));
CREATE TABLE IF NOT EXISTS adminflow.spj_service_workers (
  id TEXT PRIMARY KEY, type_id TEXT NOT NULL REFERENCES adminflow.spj_service_types(id) ON DELETE RESTRICT,
  name TEXT NOT NULL, bank TEXT NOT NULL DEFAULT '', account_number TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS spj_service_workers_type_idx ON adminflow.spj_service_workers(type_id);
CREATE TABLE IF NOT EXISTS adminflow.spj_service_reports (
  id TEXT PRIMARY KEY, type_id TEXT REFERENCES adminflow.spj_service_types(id) ON DELETE SET NULL,
  type_name TEXT NOT NULL, period TEXT NOT NULL, snapshot_json TEXT NOT NULL,
  active_count INTEGER NOT NULL, worker_count INTEGER NOT NULL, total BIGINT NOT NULL,
  created_by TEXT REFERENCES adminflow.users(id) ON DELETE SET NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS spj_service_reports_period_idx ON adminflow.spj_service_reports(period, created_at);
CREATE INDEX IF NOT EXISTS spj_service_reports_type_idx ON adminflow.spj_service_reports(type_id);
CREATE INDEX IF NOT EXISTS spj_service_reports_creator_idx ON adminflow.spj_service_reports(created_by);

ALTER TABLE adminflow.spj_service_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.spj_service_types FROM PUBLIC, anon, authenticated;
CREATE POLICY spj_service_types_api_deny ON adminflow.spj_service_types AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
ALTER TABLE adminflow.spj_service_workers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.spj_service_workers FROM PUBLIC, anon, authenticated;
CREATE POLICY spj_service_workers_api_deny ON adminflow.spj_service_workers AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
ALTER TABLE adminflow.spj_service_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.spj_service_reports FROM PUBLIC, anon, authenticated;
CREATE POLICY spj_service_reports_api_deny ON adminflow.spj_service_reports AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO adminflow.spj_service_types (id,name,day_mode,active_days,daily_rate,weekdays_json,created_at,updated_at)
VALUES ('penyemprot','Tenaga Penyemprot','quota',10,125000,'[1,2,3,4,5]','2026-11-03T00:00:00.000Z','2026-11-03T00:00:00.000Z');
INSERT INTO adminflow.spj_service_workers (id,type_id,name,bank,account_number,is_active,created_at,updated_at) VALUES
('penyemprot-daryono','penyemprot','DARYONO','BJB','',1,'2026-11-03T00:00:00.000Z','2026-11-03T00:00:00.000Z'),
('penyemprot-syafier','penyemprot','SYAFIER NADZIR UBAIDILLAH','BJB','',1,'2026-11-03T00:00:00.000Z','2026-11-03T00:00:00.000Z');
