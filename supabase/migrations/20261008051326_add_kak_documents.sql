create table if not exists adminflow.kak_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  tahun_anggaran integer not null check (tahun_anggaran between 2000 and 2100),
  sub_kegiatan text not null,
  kode_sub_kegiatan text not null,
  pagu_anggaran text not null,
  source_name text not null,
  source_storage_name text not null unique,
  source_file_size integer not null check (source_file_size > 0 and source_file_size <= 2097152),
  file_name text not null,
  storage_name text not null unique,
  file_size integer not null check (file_size > 0),
  draft_json text not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists kak_documents_created_idx on adminflow.kak_documents(created_at desc);
revoke all on adminflow.kak_documents from public, anon, authenticated;
alter table adminflow.kak_documents enable row level security;
