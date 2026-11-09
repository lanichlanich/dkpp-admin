ALTER TABLE adminflow.library_books
  ADD COLUMN cover_storage_name TEXT
  CHECK (cover_storage_name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dkpp-library-covers', 'dkpp-library-covers', false, 2097152, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;
