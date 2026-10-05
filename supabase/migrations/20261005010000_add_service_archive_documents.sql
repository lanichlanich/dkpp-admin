create table adminflow.service_archive_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  nama_dokumen text not null,
  nomor text not null default '',
  jenis_dokumen text not null,
  tgl_dokumen date not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size between 1 and 2097152),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index service_archive_documents_date_idx
  on adminflow.service_archive_documents(tgl_dokumen desc, created_at desc);

create index service_archive_documents_user_idx
  on adminflow.service_archive_documents(user_id);
