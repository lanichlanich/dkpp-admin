import "server-only";

import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pltFileName } from "@/lib/plt-filename";
export { mapPublicUser } from "@/lib/db-types";
export type { Employee, PublicUser } from "@/lib/db-types";

const dataDirectory = path.join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "admin.db");

const globalForDatabase = globalThis as unknown as {
  adminDatabase?: Database.Database;
};

export const db =
  globalForDatabase.adminDatabase ?? new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS kak_documents (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tahun_anggaran INTEGER NOT NULL, sub_kegiatan TEXT NOT NULL, kode_sub_kegiatan TEXT NOT NULL,
    pagu_anggaran TEXT NOT NULL, source_name TEXT NOT NULL, source_storage_name TEXT NOT NULL UNIQUE,
    source_file_size INTEGER NOT NULL, file_name TEXT NOT NULL, storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL, draft_json TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS kak_documents_created_idx ON kak_documents(created_at DESC);
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS employees (
    nip TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_unit TEXT NOT NULL,
    unit TEXT NOT NULL,
    position TEXT NOT NULL,
    position_type TEXT NOT NULL,
    echelon TEXT NOT NULL,
    rank TEXT NOT NULL,
    asn_type TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'Tidak diketahui',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS employees_name_idx ON employees(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS employees_unit_idx ON employees(unit COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);

  CREATE TABLE IF NOT EXISTS organization_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES organization_units(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS organization_units_name_idx ON organization_units(lower(name));
  CREATE INDEX IF NOT EXISTS organization_units_parent_idx ON organization_units(parent_id);

  CREATE TABLE IF NOT EXISTS job_positions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    position_type TEXT NOT NULL,
    echelon TEXT NOT NULL,
    organization_unit_id TEXT REFERENCES organization_units(id) ON DELETE RESTRICT,
    parent_id TEXT REFERENCES job_positions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(name, unit, position_type, echelon)
  );
  CREATE INDEX IF NOT EXISTS job_positions_parent_idx ON job_positions(parent_id);
  CREATE INDEX IF NOT EXISTS job_positions_name_idx ON job_positions(name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS wfh_schedule_months (
    period TEXT PRIMARY KEY,
    source_period TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS wfh_schedule_entries (
    period TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    position TEXT NOT NULL,
    unit TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 9999,
    friday_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('WFH', 'WFO')),
    updated_by TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (period, employee_nip, friday_date),
    FOREIGN KEY (period) REFERENCES wfh_schedule_months(period) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS wfh_schedule_entries_period_date_idx
    ON wfh_schedule_entries(period, friday_date, status);

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('success', 'warning', 'error', 'info')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON notifications(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS plt_assignments (
    id TEXT PRIMARY KEY,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    acting_position TEXT NOT NULL,
    acting_unit TEXT NOT NULL,
    sk_number TEXT NOT NULL,
    file_name TEXT,
    storage_name TEXT UNIQUE,
    file_size INTEGER CHECK (file_size BETWEEN 1 AND 2097152),
    mime_type TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL CHECK (end_date >= start_date),
    notes TEXT NOT NULL DEFAULT '',
    previous_id TEXT UNIQUE REFERENCES plt_assignments(id) ON DELETE RESTRICT,
    closed_at TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS plt_assignments_end_idx ON plt_assignments(end_date);
  CREATE INDEX IF NOT EXISTS plt_assignments_employee_idx ON plt_assignments(employee_nip);
  CREATE INDEX IF NOT EXISTS plt_assignments_creator_idx ON plt_assignments(created_by);
  CREATE UNIQUE INDEX IF NOT EXISTS plt_assignments_period_idx
    ON plt_assignments(lower(acting_position), lower(acting_unit), start_date) WHERE closed_at IS NULL;

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    actor_name TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'BATCH')),
    entity TEXT NOT NULL,
    route TEXT,
    ip_address TEXT,
    os_name TEXT NOT NULL,
    browser_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    request_id TEXT,
    country_code TEXT,
    timezone TEXT,
    changed_fields TEXT NOT NULL,
    affected_rows INTEGER NOT NULL,
    operation_count INTEGER NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity, created_at DESC);

  CREATE TABLE IF NOT EXISTS kgb_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    nomor_surat TEXT NOT NULL,
    tgl_surat TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS kgb_documents_created_idx
    ON kgb_documents(created_at DESC);
  CREATE INDEX IF NOT EXISTS kgb_documents_employee_idx
    ON kgb_documents(employee_nip, created_at DESC);

  CREATE TABLE IF NOT EXISTS dpcp_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    tgl_dpcp TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS dpcp_documents_created_idx
    ON dpcp_documents(created_at DESC);
  CREATE INDEX IF NOT EXISTS dpcp_documents_employee_idx
    ON dpcp_documents(employee_nip, created_at DESC);

  CREATE TABLE IF NOT EXISTS pak_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_status TEXT NOT NULL,
    nomor TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    period TEXT NOT NULL,
    total REAL NOT NULL,
    input_json TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS pak_documents_created_idx ON pak_documents(created_at DESC);
  CREATE INDEX IF NOT EXISTS pak_documents_employee_idx ON pak_documents(employee_nip, created_at DESC);

  CREATE TABLE IF NOT EXISTS wfh_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nomor_surat TEXT NOT NULL,
    bulan_wfh TEXT NOT NULL,
    tanggal_surat TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS wfh_documents_created_idx
    ON wfh_documents(created_at DESC);

  CREATE TABLE IF NOT EXISTS surat_pengantar_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nomor_surat TEXT NOT NULL,
    tanggal_surat TEXT NOT NULL,
    nomor_urut INTEGER NOT NULL,
    file_yang_dikirim TEXT NOT NULL,
    jumlah INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS surat_pengantar_documents_created_idx
    ON surat_pengantar_documents(created_at DESC);

  CREATE TABLE IF NOT EXISTS kerjaku_request_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nomor_surat TEXT NOT NULL,
    tanggal_surat TEXT NOT NULL,
    bulan_dibuka TEXT NOT NULL,
    employees_json TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS kerjaku_request_documents_created_idx
    ON kerjaku_request_documents(created_at DESC);

  CREATE TABLE IF NOT EXISTS surat_perbantuan_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_rank TEXT NOT NULL,
    employee_grade TEXT NOT NULL,
    employee_position TEXT NOT NULL,
    employee_unit TEXT NOT NULL,
    nomor_surat TEXT NOT NULL,
    tanggal_surat TEXT NOT NULL,
    jabatan_perbantuan TEXT NOT NULL,
    unit_kerja_perbantuan TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 2097152),
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS surat_perbantuan_documents_date_idx
    ON surat_perbantuan_documents(tanggal_surat DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS surat_perbantuan_documents_user_idx
    ON surat_perbantuan_documents(user_id);

  CREATE TABLE IF NOT EXISTS surat_lupa_absen_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_position TEXT NOT NULL,
    absence_date TEXT NOT NULL,
    letter_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    supervisor_nip TEXT NOT NULL,
    supervisor_name TEXT NOT NULL,
    supervisor_position TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 2097152),
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS surat_lupa_absen_documents_created_idx
    ON surat_lupa_absen_documents(created_at DESC);
  CREATE INDEX IF NOT EXISTS surat_lupa_absen_documents_date_idx
    ON surat_lupa_absen_documents(absence_date DESC, created_at DESC);

  CREATE TABLE IF NOT EXISTS service_archive_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nama_dokumen TEXT NOT NULL,
    nomor TEXT NOT NULL DEFAULT '',
    jenis_dokumen TEXT NOT NULL,
    tgl_dokumen TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS service_archive_documents_date_idx
    ON service_archive_documents(tgl_dokumen DESC, created_at DESC);

  CREATE TABLE IF NOT EXISTS service_archive_uploads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS service_archive_uploads_expiry_idx ON service_archive_uploads(expires_at);

  CREATE TABLE IF NOT EXISTS official_statement_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('hukdis', 'hukda')),
    employee_nip TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    nomor_surat TEXT NOT NULL,
    tanggal_surat TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS official_statement_documents_created_idx
    ON official_statement_documents(created_at DESC);
  CREATE INDEX IF NOT EXISTS official_statement_documents_employee_idx
    ON official_statement_documents(employee_nip, created_at DESC);

  CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY,
    employee_nip TEXT NOT NULL,
    user_id TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN (
      'sk_cpns',
      'sk_pns_pertama',
      'sk_kontrak_pppk',
      'dokumen_lainnya',
      'sasaran_kinerja_pegawai'
    )),
    nomor_surat TEXT NOT NULL,
    tgl_surat TEXT NOT NULL,
    tmt_surat TEXT NOT NULL,
    masa_kerja TEXT,
    tahun INTEGER CHECK (tahun IS NULL OR tahun BETWEEN 1900 AND 2100),
    penilaian_kinerja TEXT CHECK (penilaian_kinerja IS NULL OR penilaian_kinerja IN (
      'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
    )),
    penilaian_perilaku TEXT CHECK (penilaian_perilaku IS NULL OR penilaian_perilaku IN (
      'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
    )),
    predikat_skp TEXT CHECK (predikat_skp IS NULL OR predikat_skp IN (
      'BAIK', 'SANGAT BAIK', 'KURANG'
    )),
    original_file_name TEXT NOT NULL,
    storage_name TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (employee_nip) REFERENCES employees(nip) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS employee_documents_employee_idx
    ON employee_documents(employee_nip, created_at DESC);
  CREATE INDEX IF NOT EXISTS employee_documents_type_idx
    ON employee_documents(document_type, created_at DESC);

  CREATE TABLE IF NOT EXISTS hukdis_records (
    employee_nip TEXT NOT NULL,
    report_period TEXT NOT NULL,
    sanction_code TEXT NOT NULL CHECK (sanction_code IN (
      'written_warning',
      'written_dissatisfaction',
      'salary_raise_delay',
      'promotion_delay',
      'demotion_medium',
      'demotion_heavy',
      'position_transfer',
      'dismissal_from_position'
    )),
    decision_number TEXT NOT NULL,
    decision_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (employee_nip, report_period),
    FOREIGN KEY (employee_nip) REFERENCES employees(nip) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS hukdis_records_period_idx
    ON hukdis_records(report_period);
`);

const pltColumns = db.prepare("PRAGMA table_info(plt_assignments)").all() as Array<{ name: string }>;
for (const [name, definition] of [["file_name", "TEXT"], ["storage_name", "TEXT"], ["file_size", "INTEGER CHECK (file_size BETWEEN 1 AND 2097152)"], ["mime_type", "TEXT"]]) {
  if (!pltColumns.some(column => column.name === name)) db.exec(`ALTER TABLE plt_assignments ADD COLUMN ${name} ${definition}`);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS plt_assignments_storage_idx ON plt_assignments(storage_name)");
db.transaction(() => {
  const documents = db.prepare("SELECT id, employee_name, acting_position, start_date, storage_name, file_name FROM plt_assignments WHERE storage_name IS NOT NULL").all() as Array<{ id: string; employee_name: string; acting_position: string; start_date: string; storage_name: string; file_name: string }>;
  const rename = db.prepare("UPDATE plt_assignments SET file_name = ?, updated_at = ? WHERE id = ?");
  for (const document of documents) {
    const fileName = pltFileName(document.employee_name, document.acting_position, document.start_date, document.storage_name);
    if (fileName && fileName !== document.file_name) rename.run(fileName, new Date().toISOString(), document.id);
  }
}).immediate();

let employeeDocumentsTable = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'employee_documents'",
).get() as { sql: string } | undefined;

if (employeeDocumentsTable && !employeeDocumentsTable.sql.includes("'dokumen_lainnya'")) {
  db.transaction(() => {
    db.exec(`
      ALTER TABLE employee_documents RENAME TO employee_documents_legacy;

      CREATE TABLE employee_documents (
        id TEXT PRIMARY KEY,
        employee_nip TEXT NOT NULL,
        user_id TEXT NOT NULL,
        document_type TEXT NOT NULL CHECK (document_type IN (
          'sk_cpns',
          'sk_pns_pertama',
          'sk_kontrak_pppk',
          'dokumen_lainnya',
          'sasaran_kinerja_pegawai'
        )),
        nomor_surat TEXT NOT NULL,
        tgl_surat TEXT NOT NULL,
        tmt_surat TEXT NOT NULL,
        masa_kerja TEXT,
        tahun INTEGER CHECK (tahun IS NULL OR tahun BETWEEN 1900 AND 2100),
        penilaian_kinerja TEXT CHECK (penilaian_kinerja IS NULL OR penilaian_kinerja IN (
          'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
        )),
        penilaian_perilaku TEXT CHECK (penilaian_perilaku IS NULL OR penilaian_perilaku IN (
          'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
        )),
        predikat_skp TEXT CHECK (predikat_skp IS NULL OR predikat_skp IN (
          'BAIK', 'SANGAT BAIK', 'KURANG'
        )),
        original_file_name TEXT NOT NULL,
        storage_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (employee_nip) REFERENCES employees(nip) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO employee_documents (
        id, employee_nip, user_id, document_type, nomor_surat, tgl_surat,
        tmt_surat, masa_kerja, tahun, penilaian_kinerja, penilaian_perilaku,
        predikat_skp, original_file_name, storage_name, mime_type,
        file_size, created_at
      )
      SELECT
        id, employee_nip, user_id, document_type, nomor_surat, tgl_surat,
        tmt_surat, masa_kerja, NULL, NULL, NULL, NULL,
        original_file_name, storage_name, mime_type,
        file_size, created_at
      FROM employee_documents_legacy;

      DROP TABLE employee_documents_legacy;

      CREATE INDEX employee_documents_employee_idx
        ON employee_documents(employee_nip, created_at DESC);
      CREATE INDEX employee_documents_type_idx
        ON employee_documents(document_type, created_at DESC);
    `);
  })();
}

employeeDocumentsTable = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'employee_documents'",
).get() as { sql: string } | undefined;

if (employeeDocumentsTable && !employeeDocumentsTable.sql.includes("'sasaran_kinerja_pegawai'")) {
  db.transaction(() => {
    db.exec(`
      ALTER TABLE employee_documents RENAME TO employee_documents_legacy;

      CREATE TABLE employee_documents (
        id TEXT PRIMARY KEY,
        employee_nip TEXT NOT NULL,
        user_id TEXT NOT NULL,
        document_type TEXT NOT NULL CHECK (document_type IN (
          'sk_cpns',
          'sk_pns_pertama',
          'sk_kontrak_pppk',
          'dokumen_lainnya',
          'sasaran_kinerja_pegawai'
        )),
        nomor_surat TEXT NOT NULL,
        tgl_surat TEXT NOT NULL,
        tmt_surat TEXT NOT NULL,
        masa_kerja TEXT,
        tahun INTEGER CHECK (tahun IS NULL OR tahun BETWEEN 1900 AND 2100),
        penilaian_kinerja TEXT CHECK (penilaian_kinerja IS NULL OR penilaian_kinerja IN (
          'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
        )),
        penilaian_perilaku TEXT CHECK (penilaian_perilaku IS NULL OR penilaian_perilaku IN (
          'SESUAI EKSPEKTASI', 'DIATAS EKSPEKTASI', 'DIBAWAH EKSPEKTASI'
        )),
        predikat_skp TEXT CHECK (predikat_skp IS NULL OR predikat_skp IN (
          'BAIK', 'SANGAT BAIK', 'KURANG'
        )),
        original_file_name TEXT NOT NULL,
        storage_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (employee_nip) REFERENCES employees(nip) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO employee_documents (
        id, employee_nip, user_id, document_type, nomor_surat, tgl_surat,
        tmt_surat, masa_kerja, tahun, penilaian_kinerja, penilaian_perilaku,
        predikat_skp, original_file_name, storage_name, mime_type,
        file_size, created_at
      )
      SELECT
        id, employee_nip, user_id, document_type, nomor_surat, tgl_surat,
        tmt_surat, masa_kerja, NULL, NULL, NULL, NULL,
        original_file_name, storage_name, mime_type, file_size, created_at
      FROM employee_documents_legacy;

      DROP TABLE employee_documents_legacy;

      CREATE INDEX employee_documents_employee_idx
        ON employee_documents(employee_nip, created_at DESC);
      CREATE INDEX employee_documents_type_idx
        ON employee_documents(document_type, created_at DESC);
    `);
  })();
}

const employeeDocumentColumns = db.prepare("PRAGMA table_info(employee_documents)").all() as Array<{ name: string }>;
if (!employeeDocumentColumns.some(column => column.name === "nama_dokumen")) {
  db.exec("ALTER TABLE employee_documents ADD COLUMN nama_dokumen TEXT NOT NULL DEFAULT ''");
}

type EmployeeSeedRow = {
  NIP: string;
  Nama: string;
  "Unor Induk": string;
  Unor: string;
  Jabatan: string;
  "Jenis Jabatan": string;
  Eselon: string;
  "Gol/Pkt": string;
  ASN: string;
  "Jenis Kelamin"?: string;
  Status: string;
};

// Production employee records are restored from the database backup and are
// intentionally excluded from the public source repository.
const employeeSeed: EmployeeSeedRow[] = [];

db.transaction(() => {
db.exec(`CREATE TABLE IF NOT EXISTS app_roles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, is_administrator INTEGER NOT NULL DEFAULT 0 CHECK (is_administrator IN (0,1)),
  menu_permissions TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
); CREATE INDEX IF NOT EXISTS app_roles_name_idx ON app_roles(name);`);
const roleTimestamp = new Date().toISOString();
for (const [id, name, administrator, permissions] of [
  ["administrator", "Administrator", 1, "[]"], ["perencana", "Perencana", 0, '["pembuatan-kak"]'], ["unassigned", "Belum ditetapkan", 0, "[]"],
] as const) {
  db.prepare("INSERT INTO app_roles (id, name, is_administrator, menu_permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .run(id, name, administrator, permissions, roleTimestamp, roleTimestamp);
}
const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
for (const [name, definition] of [
  ["role_id", "TEXT NOT NULL DEFAULT 'unassigned'"], ["menu_permissions", "TEXT"],
  ["is_active", "INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))"], ["protected_administrator", "INTEGER NOT NULL DEFAULT 0 CHECK (protected_administrator IN (0,1))"],
]) {
  if (!userColumns.some(column => column.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
}
if (!userColumns.some(column => column.name === "protected_administrator")) {
  db.prepare("UPDATE users SET role_id = 'administrator', is_active = 1, protected_administrator = 1 WHERE lower(email) = ?").run("admin1@dkpp.com");
}
db.exec("CREATE INDEX IF NOT EXISTS users_role_id_idx ON users(role_id)");
db.exec(`CREATE TRIGGER IF NOT EXISTS users_role_insert_guard BEFORE INSERT ON users
  WHEN NOT EXISTS (SELECT 1 FROM app_roles WHERE id = NEW.role_id)
  BEGIN SELECT RAISE(ABORT, 'Role tidak ditemukan'); END;
  CREATE TRIGGER IF NOT EXISTS users_role_update_guard BEFORE UPDATE OF role_id ON users
  WHEN NOT EXISTS (SELECT 1 FROM app_roles WHERE id = NEW.role_id)
  BEGIN SELECT RAISE(ABORT, 'Role tidak ditemukan'); END;`);
}).immediate();
const employeeColumns = db.prepare("PRAGMA table_info(employees)").all() as Array<{ name: string }>;
if (!employeeColumns.some((column) => column.name === "birth_place")) {
  db.exec("ALTER TABLE employees ADD COLUMN birth_place TEXT NOT NULL DEFAULT ''");
}
if (!employeeColumns.some((column) => column.name === "gender")) {
  db.exec("ALTER TABLE employees ADD COLUMN gender TEXT NOT NULL DEFAULT 'Tidak diketahui'");
}
if (!employeeColumns.some((column) => column.name === "job_position_id")) {
  db.exec("ALTER TABLE employees ADD COLUMN job_position_id TEXT REFERENCES job_positions(id) ON DELETE SET NULL");
}
const jobPositionColumns = db.prepare("PRAGMA table_info(job_positions)").all() as Array<{ name: string }>;
if (!jobPositionColumns.some((column) => column.name === "organization_unit_id")) {
  try {
    db.exec("ALTER TABLE job_positions ADD COLUMN organization_unit_id TEXT REFERENCES organization_units(id) ON DELETE RESTRICT");
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate column name: organization_unit_id/i.test(error.message)) throw error;
  }
}

const employeeCount = (
  db.prepare("SELECT COUNT(*) AS count FROM employees").get() as { count: number }
).count;

if (employeeCount === 0) {
  const now = new Date().toISOString();
  const insertEmployee = db.prepare(
    `INSERT INTO employees (
      nip, name, parent_unit, unit, position, position_type,
      echelon, rank, asn_type, gender, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const importEmployees = db.transaction((rows: EmployeeSeedRow[]) => {
    for (const row of rows) {
      insertEmployee.run(
        row.NIP,
        row.Nama,
        row["Unor Induk"],
        row.Unor,
        row.Jabatan,
        row["Jenis Jabatan"],
        row.Eselon,
        row["Gol/Pkt"],
        row.ASN,
        row["Jenis Kelamin"]?.trim() || "Tidak diketahui",
        row.Status,
        now,
        now,
      );
    }
  });

  importEmployees(employeeSeed as EmployeeSeedRow[]);

  const users = db.prepare("SELECT id FROM users").all() as Array<{ id: string }>;
  const insertNotification = db.prepare(
    `INSERT OR IGNORE INTO notifications
      (id, user_id, type, title, description, created_at)
     VALUES (?, ?, 'info', ?, ?, ?)`,
  );
  for (const user of users) {
    insertNotification.run(
      `employee-import:${user.id}`,
      user.id,
      "Data pegawai diimpor",
      `${employeeSeed.length} data pegawai berhasil dimuat dari workbook.`,
      now,
    );
  }
}

const initialPositions = db.prepare(`
  SELECT position AS name, unit, position_type, echelon
  FROM employees GROUP BY position, unit, position_type, echelon ORDER BY position, unit, position_type, echelon
`).all() as Array<{ name: string; unit: string; position_type: string; echelon: string }>;
const initialUnits = db.prepare(`
  SELECT unit AS name FROM employees WHERE trim(unit) <> ''
  UNION SELECT unit AS name FROM job_positions WHERE trim(unit) <> ''
`).all() as Array<{ name: string }>;
const insertOrganizationUnit = db.prepare(`
  INSERT OR IGNORE INTO organization_units (id, name, created_at, updated_at)
  VALUES (?, ?, ?, ?)
`);
const now = new Date().toISOString();
for (const unit of initialUnits) {
  const existingUnit = db.prepare("SELECT id FROM organization_units WHERE lower(name) = lower(?) LIMIT 1").get(unit.name);
  if (!existingUnit) insertOrganizationUnit.run(randomUUID(), unit.name.trim(), now, now);
}
const addPosition = db.prepare(`
  INSERT OR IGNORE INTO job_positions (id, name, unit, position_type, echelon, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
for (const position of initialPositions) {
  addPosition.run(randomUUID(), position.name, position.unit, position.position_type, position.echelon, now, now);
}
db.prepare(`UPDATE job_positions SET organization_unit_id = (
  SELECT unit.id FROM organization_units unit WHERE lower(unit.name) = lower(job_positions.unit) LIMIT 1
) WHERE organization_unit_id IS NULL`).run();
db.prepare(`UPDATE employees SET job_position_id = (
  SELECT jp.id FROM job_positions jp
  WHERE jp.name = employees.position AND jp.unit = employees.unit
    AND jp.position_type = employees.position_type AND jp.echelon = employees.echelon LIMIT 1
) WHERE job_position_id IS NULL`).run();

const positionsForHierarchy = db.prepare("SELECT id, name, unit, parent_id FROM job_positions").all() as Array<{
  id: string; name: string; unit: string; parent_id: string | null;
}>;
const findPosition = (predicate: (position: typeof positionsForHierarchy[number]) => boolean) =>
  positionsForHierarchy.find(predicate);
const rootPosition = findPosition((position) => position.name.toLocaleUpperCase("id-ID").startsWith("KEPALA DINAS"));
const secretaryPosition = findPosition((position) => position.name.toLocaleUpperCase("id-ID").startsWith("SEKRETARIS DINAS"));
const setPositionParent = db.prepare("UPDATE job_positions SET parent_id = ?, updated_at = ? WHERE id = ? AND parent_id IS NULL");
for (const position of positionsForHierarchy) {
  const name = position.name.toLocaleUpperCase("id-ID");
  let parent: typeof position | undefined;
  if (rootPosition && position.id !== rootPosition.id) {
    if (name.startsWith("KEPALA SUB BAGIAN TU UPTD ")) {
      const expectedName = `KEPALA ${name.slice("KEPALA SUB BAGIAN TU ".length)}`;
      parent = findPosition((candidate) => candidate.name.toLocaleUpperCase("id-ID") === expectedName);
    } else if (name.startsWith("SEKRETARIS DINAS") || name.startsWith("KEPALA BIDANG") || name.startsWith("KEPALA UPTD")) {
      parent = rootPosition;
    } else if (name.startsWith("KEPALA SUB BAGIAN")) {
      parent = secretaryPosition;
    } else {
      parent = findPosition((candidate) => candidate.id !== position.id && candidate.unit === position.unit && (
        candidate.name.toLocaleUpperCase("id-ID").startsWith("KEPALA ") ||
        candidate.name.toLocaleUpperCase("id-ID").startsWith("SEKRETARIS DINAS")
      ));
      parent ??= rootPosition;
    }
  }
  if (parent && parent.id !== position.id) setPositionParent.run(parent.id, now, position.id);
}

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.adminDatabase = db;
}
