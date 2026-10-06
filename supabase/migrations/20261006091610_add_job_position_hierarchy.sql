create table if not exists adminflow.job_positions (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  unit text not null,
  position_type text not null,
  echelon text not null,
  parent_id text references adminflow.job_positions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table adminflow.employees
  add column if not exists job_position_id text;

create unique index if not exists job_positions_catalog_key_idx
  on adminflow.job_positions (lower(name), lower(unit), position_type, echelon);
create index if not exists job_positions_parent_idx
  on adminflow.job_positions(parent_id);
create index if not exists job_positions_name_idx
  on adminflow.job_positions(lower(name));
create index if not exists employees_job_position_id_idx
  on adminflow.employees(job_position_id);

insert into adminflow.job_positions (id, name, unit, position_type, echelon, created_at, updated_at)
select gen_random_uuid()::text, selected.name, selected.unit, selected.position_type, selected.echelon, now(), now()
from (
  select distinct on (lower(position), lower(unit), position_type, echelon)
    position as name, unit, position_type, echelon
  from adminflow.employees
  order by lower(position), lower(unit), position_type, echelon, position, unit
) as selected
on conflict do nothing;

update adminflow.employees as employee
set job_position_id = position.id
from adminflow.job_positions as position
where lower(position.name) = lower(employee.position)
  and lower(position.unit) = lower(employee.unit)
  and position.position_type = employee.position_type
  and position.echelon = employee.echelon
  and employee.job_position_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_job_position_id_fkey'
      and conrelid = 'adminflow.employees'::regclass
  ) then
    alter table adminflow.employees
      add constraint employees_job_position_id_fkey
      foreign key (job_position_id) references adminflow.job_positions(id)
      on delete set null;
  end if;
end $$;

update adminflow.job_positions as child
set parent_id = (
  select parent.id
  from adminflow.job_positions as parent
  where parent.id <> child.id
    and (
      (
        child.name ilike 'KEPALA SUB BAGIAN TU UPTD %'
        and upper(parent.name) = 'KEPALA ' || substr(upper(child.name), length('KEPALA SUB BAGIAN TU ') + 1)
      )
      or (
        (child.name ilike 'SEKRETARIS DINAS%' or child.name ilike 'KEPALA BIDANG%' or child.name ilike 'KEPALA UPTD%')
        and parent.name ilike 'KEPALA DINAS%'
      )
      or (
        child.name ilike 'KEPALA SUB BAGIAN%'
        and parent.name ilike 'SEKRETARIS DINAS%'
      )
      or (
        upper(parent.unit) = upper(child.unit)
        and (
          parent.name ilike 'KEPALA %'
          or parent.name ilike 'SEKRETARIS DINAS%'
        )
      )
      or parent.name ilike 'KEPALA DINAS%'
    )
  order by case
    when child.name ilike 'KEPALA SUB BAGIAN TU UPTD %' and upper(parent.name) = 'KEPALA ' || substr(upper(child.name), length('KEPALA SUB BAGIAN TU ') + 1) then 0
    when child.name ilike 'KEPALA SUB BAGIAN%' and parent.name ilike 'SEKRETARIS DINAS%' then 0
    when upper(parent.unit) = upper(child.unit) then 0
    when parent.name ilike 'KEPALA DINAS%' then 1
    else 2
  end, parent.name, parent.unit
  limit 1
)
where child.parent_id is null
  and child.name not ilike 'KEPALA DINAS%';

revoke all on adminflow.job_positions from public, anon, authenticated;
alter table adminflow.job_positions enable row level security;
