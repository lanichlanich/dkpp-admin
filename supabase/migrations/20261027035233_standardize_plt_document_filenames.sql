-- Rename only document metadata. Storage object identifiers and bytes stay valid.
-- Keep normalization aligned with src/lib/plt-filename.ts.
do $$
declare
  document record;
  employee_part text;
  position_part text;
  extension text;
  expected_name text;
  original_records jsonb;
  invalid_characters text := '[' || chr(1) || '-' || chr(32) || chr(127) || '<>:"/\\|?*]+';
begin
  lock table adminflow.plt_assignments in share row exclusive mode;
  select jsonb_agg(to_jsonb(record) - 'file_name' - 'updated_at' order by record.id)
    into original_records from adminflow.plt_assignments record;
  for document in
    select id, employee_name, acting_position, start_date, storage_name
    from adminflow.plt_assignments
    where storage_name ~* '\.(pdf|doc|docx)$'
  loop
    employee_part := btrim(regexp_replace(document.employee_name, invalid_characters, ' ', 'g'), ' .');
    position_part := btrim(regexp_replace(document.acting_position, invalid_characters, ' ', 'g'), ' .');
    while octet_length(employee_part) > 80 loop
      employee_part := left(employee_part, length(employee_part) - 1);
    end loop;
    while octet_length(position_part) > 140 loop
      position_part := left(position_part, length(position_part) - 1);
    end loop;
    employee_part := coalesce(nullif(btrim(employee_part, ' .'), ''), 'Pegawai');
    position_part := coalesce(nullif(btrim(position_part, ' .'), ''), 'Jabatan');
    extension := lower(substring(document.storage_name from '\.([^.]+)$'));
    expected_name := employee_part || '_' || position_part || '_' || to_char(document.start_date, 'YYYY-MM-DD') || '.' || extension;
    update adminflow.plt_assignments
      set file_name = expected_name, updated_at = now()
      where id = document.id and file_name is distinct from expected_name;
  end loop;
  if original_records is distinct from (
    select jsonb_agg(to_jsonb(record) - 'file_name' - 'updated_at' order by record.id)
    from adminflow.plt_assignments record
  ) then
    raise exception 'Plt filename migration changed unrelated assignment data';
  end if;
end;
$$;
