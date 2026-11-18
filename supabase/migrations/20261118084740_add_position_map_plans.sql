create table adminflow.position_map_plans (
  year integer primary key check (year between 2000 and 2099),
  data_json jsonb not null check (jsonb_typeof(data_json) = 'object'),
  revision integer not null check (revision >= 1),
  updated_by text references adminflow.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index position_map_plans_user_idx on adminflow.position_map_plans(updated_by);

-- Custom application sessions authorize the private server connection.
-- This planner is not exposed through Supabase's public Data API roles.
revoke all on adminflow.position_map_plans from public, anon, authenticated;
alter table adminflow.position_map_plans enable row level security;
