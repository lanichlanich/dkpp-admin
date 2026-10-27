create table adminflow.plt_assignments (
  id text primary key,
  employee_nip text not null check (employee_nip ~ '^[0-9]{18}$'),
  employee_name text not null,
  acting_position text not null,
  acting_unit text not null,
  sk_number text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  notes text not null default '',
  previous_id text unique references adminflow.plt_assignments(id) on delete restrict,
  closed_at timestamptz,
  created_by text references adminflow.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plt_assignments_end_idx on adminflow.plt_assignments(end_date);
create index plt_assignments_employee_idx on adminflow.plt_assignments(employee_nip);
create index plt_assignments_creator_idx on adminflow.plt_assignments(created_by);
create unique index plt_assignments_period_idx
  on adminflow.plt_assignments(lower(acting_position), lower(acting_unit), start_date) where closed_at is null;

-- Existing app sessions/menu permissions authorize server-side PostgreSQL access.
-- Employee identity is a snapshot so staff edits do not erase assignment history.
revoke all on adminflow.plt_assignments from public, anon, authenticated;
alter table adminflow.plt_assignments enable row level security;
