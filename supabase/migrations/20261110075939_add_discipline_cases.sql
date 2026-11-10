create table adminflow.discipline_cases (
  id text primary key,
  employee_nip text not null,
  employee_name text not null,
  reference text not null,
  reference_key text not null unique,
  status text not null,
  data_json jsonb not null check (jsonb_typeof(data_json) = 'object'),
  revision integer not null check (revision >= 1),
  updated_by text references adminflow.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discipline_cases_updated_idx on adminflow.discipline_cases(updated_at desc, id desc);
create index discipline_cases_actor_idx on adminflow.discipline_cases(updated_by);

-- Authorized application sessions are checked by the server. Data API roles have no access.
revoke all on adminflow.discipline_cases from public, anon, authenticated;
alter table adminflow.discipline_cases enable row level security;
