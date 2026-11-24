CREATE TABLE IF NOT EXISTS adminflow.surat_tugas_documents (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT REFERENCES adminflow.users(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL,
    nomor_surat TEXT NOT NULL,
    tanggal_surat DATE NOT NULL,
    penugasan TEXT NOT NULL,
    recipient_count INTEGER NOT NULL CHECK (recipient_count BETWEEN 1 AND 20),
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 4194304),
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS surat_tugas_documents_created_idx
    ON adminflow.surat_tugas_documents(created_at DESC, id DESC);

REVOKE ALL ON adminflow.surat_tugas_documents FROM PUBLIC;
ALTER TABLE adminflow.surat_tugas_documents ENABLE ROW LEVEL SECURITY;
