create table if not exists adminflow.anjab_abk_plans (
  year integer primary key check (year between 2000 and 2099),
  data_json jsonb not null check (jsonb_typeof(data_json) = 'object'),
  revision integer not null check (revision >= 1),
  updated_by text references adminflow.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists anjab_abk_plans_user_idx on adminflow.anjab_abk_plans(updated_by);

-- The application uses custom sessions and a private server connection.
revoke all on adminflow.anjab_abk_plans from public, anon, authenticated;
alter table adminflow.anjab_abk_plans enable row level security;
