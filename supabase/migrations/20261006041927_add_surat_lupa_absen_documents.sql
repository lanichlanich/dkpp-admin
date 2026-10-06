create table if not exists adminflow.surat_lupa_absen_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  employee_nip text not null,
  employee_name text not null,
  employee_position text not null,
  absence_date date not null,
  letter_date date not null,
  reason text not null,
  supervisor_nip text not null,
  supervisor_name text not null,
  supervisor_position text not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size between 1 and 2097152),
  created_at timestamptz not null default now()
);

create index if not exists surat_lupa_absen_documents_date_idx
  on adminflow.surat_lupa_absen_documents(absence_date desc, created_at desc);

create index if not exists surat_lupa_absen_documents_user_idx
  on adminflow.surat_lupa_absen_documents(user_id);

revoke all on adminflow.surat_lupa_absen_documents from public, anon, authenticated;
alter table adminflow.surat_lupa_absen_documents enable row level security;
