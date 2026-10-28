-- Only Arsip Dinas accepts 10 MiB. Other feature limits remain unchanged.
ALTER TABLE adminflow.service_archive_documents
  DROP CONSTRAINT service_archive_documents_file_size_check;
ALTER TABLE adminflow.service_archive_documents
  ADD CONSTRAINT service_archive_documents_file_size_check CHECK (file_size BETWEEN 1 AND 10485760);

-- Upload capabilities are bound to the app's authenticated user. No Data API
-- role can enumerate them or mint URLs. Finalization verifies the stored PDF.
CREATE TABLE adminflow.service_archive_uploads (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES adminflow.users(id) ON DELETE CASCADE,
  storage_name text NOT NULL UNIQUE,
  file_size bigint NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX service_archive_uploads_expiry_idx ON adminflow.service_archive_uploads(expires_at);
ALTER TABLE adminflow.service_archive_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.service_archive_uploads FROM PUBLIC, anon, authenticated;
