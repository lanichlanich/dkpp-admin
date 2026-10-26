create table if not exists adminflow.surat_perbantuan_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  employee_nip text not null,
  employee_name text not null,
  employee_rank text not null,
  employee_grade text not null,
  employee_position text not null,
  employee_unit text not null,
  nomor_surat text not null,
  tanggal_surat date not null,
  jabatan_perbantuan text not null,
  unit_kerja_perbantuan text not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size between 1 and 2097152),
  created_at timestamptz not null default now()
);

create index if not exists surat_perbantuan_documents_date_idx
  on adminflow.surat_perbantuan_documents(tanggal_surat desc, created_at desc);
create index if not exists surat_perbantuan_documents_user_idx
  on adminflow.surat_perbantuan_documents(user_id);

-- App sessions and menu permissions are checked by the server; no Data API access.
revoke all on adminflow.surat_perbantuan_documents from public, anon, authenticated;
alter table adminflow.surat_perbantuan_documents enable row level security;
