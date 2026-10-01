alter table adminflow.employee_documents
  add column if not exists nama_dokumen text not null default '';
