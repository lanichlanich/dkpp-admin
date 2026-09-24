alter table adminflow.employees
  add column if not exists gender text not null default 'Tidak diketahui';

create index if not exists employees_gender_idx on adminflow.employees(gender);
