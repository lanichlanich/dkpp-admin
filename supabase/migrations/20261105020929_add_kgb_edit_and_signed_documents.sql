alter table adminflow.kgb_documents
  add column input_json jsonb check (input_json is null or jsonb_typeof(input_json) = 'object'),
  add column revision integer not null default 1 check (revision >= 1),
  add column updated_at timestamptz,
  add column updated_by text references adminflow.users(id) on delete set null;
create index kgb_documents_updated_by_idx on adminflow.kgb_documents(updated_by);

create table adminflow.kgb_signed_documents (
  id text primary key,
  document_id text not null references adminflow.kgb_documents(id) on delete cascade,
  document_revision integer not null check (document_revision >= 1),
  user_id text references adminflow.users(id) on delete set null,
  original_file_name text not null,
  file_name text not null,
  storage_name text not null unique,
  file_size bigint not null check (file_size > 0),
  page_count integer not null check (page_count > 0),
  created_at timestamptz not null default now()
);
create index kgb_signed_document_idx on adminflow.kgb_signed_documents(document_id, created_at desc, id);
create index kgb_signed_user_idx on adminflow.kgb_signed_documents(user_id);
revoke all on adminflow.kgb_signed_documents from public, anon, authenticated;
alter table adminflow.kgb_signed_documents enable row level security;
