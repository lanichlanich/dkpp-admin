create table if not exists adminflow.wfh_schedule_months (
  period text primary key check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  source_period text,
  created_by text references adminflow.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists adminflow.wfh_schedule_entries (
  period text not null references adminflow.wfh_schedule_months(period) on delete cascade,
  employee_nip text not null,
  employee_name text not null,
  position text not null,
  unit text not null,
  sort_order integer not null default 9999,
  friday_date date not null,
  status text not null check (status in ('WFH', 'WFO')),
  updated_by text references adminflow.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (period, employee_nip, friday_date),
  check (to_char(friday_date, 'YYYY-MM') = period),
  check (extract(isodow from friday_date) = 5)
);

create index if not exists wfh_schedule_entries_period_date_idx
  on adminflow.wfh_schedule_entries (period, friday_date, status);

revoke all on adminflow.wfh_schedule_months from public, anon, authenticated;
revoke all on adminflow.wfh_schedule_entries from public, anon, authenticated;
alter table adminflow.wfh_schedule_months enable row level security;
alter table adminflow.wfh_schedule_entries enable row level security;
