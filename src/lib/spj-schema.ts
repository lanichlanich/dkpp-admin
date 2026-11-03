// Portable SQL for SQLite and the private PostgreSQL schema.
export const SPJ_SCHEMA = `
CREATE TABLE IF NOT EXISTS spj_service_types (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  day_mode TEXT NOT NULL CHECK (day_mode IN ('quota', 'all')),
  active_days INTEGER NOT NULL CHECK (active_days BETWEEN 1 AND 31),
  daily_rate BIGINT NOT NULL CHECK (daily_rate BETWEEN 0 AND 1000000000),
  weekdays_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS spj_service_types_name_idx ON spj_service_types(lower(name));
CREATE TABLE IF NOT EXISTS spj_service_workers (
  id TEXT PRIMARY KEY, type_id TEXT NOT NULL REFERENCES spj_service_types(id) ON DELETE RESTRICT,
  name TEXT NOT NULL, bank TEXT NOT NULL DEFAULT '', account_number TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS spj_service_workers_type_idx ON spj_service_workers(type_id);
CREATE TABLE IF NOT EXISTS spj_service_reports (
  id TEXT PRIMARY KEY, type_id TEXT REFERENCES spj_service_types(id) ON DELETE SET NULL,
  type_name TEXT NOT NULL, period TEXT NOT NULL, snapshot_json TEXT NOT NULL,
  active_count INTEGER NOT NULL, worker_count INTEGER NOT NULL, total BIGINT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS spj_service_reports_period_idx ON spj_service_reports(period, created_at);
CREATE INDEX IF NOT EXISTS spj_service_reports_archive_idx ON spj_service_reports(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS spj_service_reports_type_idx ON spj_service_reports(type_id);
CREATE INDEX IF NOT EXISTS spj_service_reports_creator_idx ON spj_service_reports(created_by);
`;
// Source: supplied September 2026 attendance/receipt templates. User requested 10 days, overriding the template's 12.
export const SPJ_SEED = `
INSERT INTO spj_service_types (id,name,day_mode,active_days,daily_rate,weekdays_json,created_at,updated_at)
VALUES ('penyemprot','Tenaga Penyemprot','quota',10,125000,'[1,2,3,4,5]','2026-11-03T00:00:00.000Z','2026-11-03T00:00:00.000Z');
INSERT INTO spj_service_workers (id,type_id,name,bank,account_number,is_active,created_at,updated_at) VALUES
('penyemprot-daryono','penyemprot','DARYONO','BJB','',1,'2026-11-03T00:00:00.000Z','2026-11-03T00:00:00.000Z'),
('penyemprot-syafier','penyemprot','SYAFIER NADZIR UBAIDILLAH','BJB','',1,'2026-11-03T00:00:00.000Z','2026-11-03T00:00:00.000Z');
`;
