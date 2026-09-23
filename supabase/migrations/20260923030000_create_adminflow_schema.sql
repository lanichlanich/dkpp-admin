create schema if not exists adminflow;

revoke all on schema adminflow from public, anon, authenticated;

create table adminflow.users (
  id text primary key,
  name text not null,
  username text not null,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index users_username_lower_key on adminflow.users (lower(username));
create unique index users_email_lower_key on adminflow.users (lower(email));

create table adminflow.sessions (
  token_hash text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null
);

create index sessions_user_id_idx on adminflow.sessions(user_id);
create index sessions_expires_at_idx on adminflow.sessions(expires_at);

create table adminflow.employees (
  nip text primary key,
  name text not null,
  parent_unit text not null,
  unit text not null,
  position text not null,
  position_type text not null,
  echelon text not null,
  rank text not null,
  asn_type text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index employees_name_lower_idx on adminflow.employees (lower(name));
create index employees_unit_lower_idx on adminflow.employees (lower(unit));
create index employees_status_idx on adminflow.employees(status);

create table adminflow.notifications (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  type text not null check (type in ('success', 'warning', 'error', 'info')),
  title text not null,
  description text not null,
  read_at timestamptz,
  created_at timestamptz not null
);

create index notifications_user_created_idx
  on adminflow.notifications(user_id, created_at desc);

create table adminflow.kgb_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  employee_nip text not null,
  employee_name text not null,
  nomor_surat text not null,
  tgl_surat date not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null
);

create index kgb_documents_user_id_idx on adminflow.kgb_documents(user_id);
create index kgb_documents_created_idx on adminflow.kgb_documents(created_at desc);
create index kgb_documents_employee_idx on adminflow.kgb_documents(employee_nip, created_at desc);

create table adminflow.dpcp_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  employee_nip text not null,
  employee_name text not null,
  tgl_dpcp date not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null
);

create index dpcp_documents_user_id_idx on adminflow.dpcp_documents(user_id);
create index dpcp_documents_created_idx on adminflow.dpcp_documents(created_at desc);
create index dpcp_documents_employee_idx on adminflow.dpcp_documents(employee_nip, created_at desc);

create table adminflow.pak_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  employee_nip text not null,
  employee_name text not null,
  employee_status text not null,
  nomor text not null,
  tanggal date not null,
  period text not null,
  total numeric(15, 3) not null,
  input_json jsonb not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null
);

create index pak_documents_user_id_idx on adminflow.pak_documents(user_id);
create index pak_documents_created_idx on adminflow.pak_documents(created_at desc);
create index pak_documents_employee_idx on adminflow.pak_documents(employee_nip, created_at desc);

create table adminflow.wfh_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  nomor_surat text not null,
  bulan_wfh text not null,
  tanggal_surat date not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null
);

create index wfh_documents_user_id_idx on adminflow.wfh_documents(user_id);
create index wfh_documents_created_idx on adminflow.wfh_documents(created_at desc);

create table adminflow.surat_pengantar_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  nomor_surat text not null,
  tanggal_surat date not null,
  nomor_urut integer not null,
  file_yang_dikirim text not null,
  jumlah integer not null check (jumlah >= 0),
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null
);

create index surat_pengantar_documents_user_id_idx on adminflow.surat_pengantar_documents(user_id);
create index surat_pengantar_documents_created_idx
  on adminflow.surat_pengantar_documents(created_at desc);

create table adminflow.official_statement_documents (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  document_type text not null check (document_type in ('hukdis', 'hukda')),
  employee_nip text not null,
  employee_name text not null,
  nomor_surat text not null,
  tanggal_surat date not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null
);

create index official_statement_documents_user_id_idx on adminflow.official_statement_documents(user_id);
create index official_statement_documents_created_idx
  on adminflow.official_statement_documents(created_at desc);
create index official_statement_documents_employee_idx
  on adminflow.official_statement_documents(employee_nip, created_at desc);

create table adminflow.employee_documents (
  id text primary key,
  employee_nip text not null references adminflow.employees(nip) on delete cascade,
  user_id text not null references adminflow.users(id) on delete cascade,
  document_type text not null check (document_type in (
    'sk_cpns',
    'sk_pns_pertama',
    'sk_kontrak_pppk',
    'dokumen_lainnya',
    'sasaran_kinerja_pegawai'
  )),
  nomor_surat text not null,
  tgl_surat date not null,
  tmt_surat date not null,
  masa_kerja text,
  tahun integer check (tahun is null or tahun between 1900 and 2100),
  penilaian_kinerja text check (penilaian_kinerja is null or penilaian_kinerja in (
    'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
  )),
  penilaian_perilaku text check (penilaian_perilaku is null or penilaian_perilaku in (
    'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
  )),
  predikat_skp text check (predikat_skp is null or predikat_skp in (
    'BAIK', 'SANGAT BAIK', 'KURANG'
  )),
  original_file_name text not null,
  storage_name text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null
);

create index employee_documents_user_id_idx on adminflow.employee_documents(user_id);
create index employee_documents_employee_idx
  on adminflow.employee_documents(employee_nip, created_at desc);
create index employee_documents_type_idx
  on adminflow.employee_documents(document_type, created_at desc);

create table adminflow.hukdis_records (
  employee_nip text not null references adminflow.employees(nip) on delete cascade,
  report_period text not null,
  sanction_code text not null check (sanction_code in (
    'written_warning',
    'written_dissatisfaction',
    'salary_raise_delay',
    'promotion_delay',
    'demotion_medium',
    'demotion_heavy',
    'position_transfer',
    'dismissal_from_position'
  )),
  decision_number text not null,
  decision_date date not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (employee_nip, report_period)
);

create index hukdis_records_period_idx on adminflow.hukdis_records(report_period);

create table adminflow.wfh_reports (
  id text primary key,
  user_id text not null references adminflow.users(id) on delete cascade,
  nip text not null,
  employee_name text not null,
  report_date date not null,
  payload jsonb not null,
  file_name text not null,
  created_at timestamptz not null
);

create index wfh_reports_user_date_idx on adminflow.wfh_reports(user_id, created_at desc);

revoke all on all tables in schema adminflow from public, anon, authenticated;
