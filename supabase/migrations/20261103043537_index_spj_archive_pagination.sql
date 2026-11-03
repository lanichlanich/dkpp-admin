-- Supports stable, numbered SPJ archive pagination by newest creation time and ID.
CREATE INDEX IF NOT EXISTS spj_service_reports_archive_idx
ON adminflow.spj_service_reports (created_at DESC, id DESC);
