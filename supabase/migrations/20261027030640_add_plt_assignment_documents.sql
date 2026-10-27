alter table adminflow.plt_assignments
  add column file_name text,
  add column storage_name text,
  add column file_size bigint check (file_size between 1 and 2097152),
  add column mime_type text,
  add constraint plt_assignments_file_metadata_check check (
    (file_name is null and storage_name is null and file_size is null and mime_type is null)
    or (file_name is not null and storage_name is not null and file_size is not null
      and mime_type is not null and mime_type in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
  );
create unique index plt_assignments_storage_idx on adminflow.plt_assignments(storage_name);
