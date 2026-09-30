create table if not exists adminflow.kerjaku_request_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  nomor_surat text not null,
  tanggal_surat date not null,
  bulan_dibuka text not null check (bulan_dibuka ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  employees_json text not null,
  file_name text not null,
  storage_name text not null unique,
  file_size integer not null,
  created_at timestamptz not null default now()
);
create index if not exists kerjaku_request_documents_created_idx
  on adminflow.kerjaku_request_documents (created_at desc);
revoke all on adminflow.kerjaku_request_documents from public, anon, authenticated;
alter table adminflow.kerjaku_request_documents enable row level security;
