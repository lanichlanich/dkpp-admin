create table if not exists adminflow.wfh_schedule_letters (
  id text primary key,
  period text not null references adminflow.wfh_schedule_months(period) on delete cascade,
  user_id text references adminflow.users(id) on delete set null,
  original_file_name text not null,
  storage_name text not null unique,
  file_size integer not null check (file_size > 0 and file_size <= 2097152),
  page_count integer not null check (page_count > 0),
  created_at timestamptz not null default now()
);

create index if not exists wfh_schedule_letters_period_created_idx
  on adminflow.wfh_schedule_letters(period, created_at desc, id desc);
create index if not exists wfh_schedule_letters_user_idx
  on adminflow.wfh_schedule_letters(user_id);

-- Custom application sessions authorize access through the server, not the Data API.
revoke all on adminflow.wfh_schedule_letters from public, anon, authenticated;
alter table adminflow.wfh_schedule_letters enable row level security;
