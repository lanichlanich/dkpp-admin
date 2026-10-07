create table if not exists adminflow.organization_units (
  id text primary key,
  name text not null,
  parent_id text references adminflow.organization_units(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_units_name_idx
  on adminflow.organization_units (lower(name));
create index if not exists organization_units_parent_idx
  on adminflow.organization_units (parent_id);

alter table adminflow.job_positions
  add column if not exists organization_unit_id text
  references adminflow.organization_units(id) on delete restrict;

insert into adminflow.organization_units (id, name, created_at, updated_at)
select gen_random_uuid()::text, source.name, now(), now()
from (
  select unit as name from adminflow.employees where trim(unit) <> ''
  union
  select unit as name from adminflow.job_positions where trim(unit) <> ''
) as source
on conflict do nothing;

update adminflow.job_positions as position
set organization_unit_id = unit.id
from adminflow.organization_units as unit
where position.organization_unit_id is null
  and lower(unit.name) = lower(position.unit);

create index if not exists job_positions_organization_unit_idx
  on adminflow.job_positions (organization_unit_id);

revoke all on adminflow.organization_units from public, anon, authenticated;
alter table adminflow.organization_units enable row level security;
