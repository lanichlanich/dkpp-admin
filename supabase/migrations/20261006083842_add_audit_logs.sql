create table if not exists adminflow.audit_logs (
  id text primary key,
  user_id text,
  actor_name text not null,
  actor_username text not null default '',
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'BATCH')),
  entity text not null,
  route text,
  ip_address text,
  os_name text not null,
  browser_name text not null,
  device_type text not null,
  user_agent text not null default '',
  request_id text,
  country_code text,
  timezone text,
  changed_fields text not null default '[]',
  affected_rows integer not null default 0,
  operation_count integer not null default 1,
  details text not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on adminflow.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx
  on adminflow.audit_logs(entity, created_at desc);
create index if not exists audit_logs_actor_idx
  on adminflow.audit_logs(user_id, created_at desc);

revoke all on adminflow.audit_logs from public, anon, authenticated;
alter table adminflow.audit_logs enable row level security;
