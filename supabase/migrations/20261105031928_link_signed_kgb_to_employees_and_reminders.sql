alter table adminflow.kgb_signed_documents
  add column employee_nip text,
  add column nomor_surat text,
  add column tgl_surat date,
  add column tmt_kgb date;

-- Preserve the metadata of the signed revision. Never apply newer draft dates
-- to an older signed PDF. Its original letter date is retained in its filename.
update adminflow.kgb_signed_documents s set
  employee_nip = d.employee_nip,
  nomor_surat = case when s.document_revision = d.revision then d.nomor_surat end,
  tgl_surat = coalesce(substring(s.file_name from '([0-9]{4}-[0-9]{2}-[0-9]{2})-v[0-9]+\.pdf$')::date,
    case when s.document_revision = d.revision then d.tgl_surat end),
  tmt_kgb = case when s.document_revision = d.revision and d.input_json->>'tmtKgbBaru' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then (d.input_json->>'tmtKgbBaru')::date end
from adminflow.kgb_documents d where s.document_id = d.id;

alter table adminflow.kgb_signed_documents alter column employee_nip set not null;
alter table adminflow.kgb_signed_documents add constraint kgb_signed_employee_nip_check check(employee_nip ~ '^[0-9]{18}$');
create index kgb_signed_employee_tmt_idx on adminflow.kgb_signed_documents(employee_nip, tmt_kgb desc, created_at desc);
