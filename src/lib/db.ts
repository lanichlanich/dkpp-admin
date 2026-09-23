import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
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
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS employees_name_idx ON employees(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS employees_unit_idx ON employees(unit COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);

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
  Status: string;
};

// Production employee records are restored from the database backup and are
// intentionally excluded from the public source repository.
const employeeSeed: EmployeeSeedRow[] = [];

const employeeCount = (
  db.prepare("SELECT COUNT(*) AS count FROM employees").get() as { count: number }
).count;

if (employeeCount === 0) {
  const now = new Date().toISOString();
  const insertEmployee = db.prepare(
    `INSERT INTO employees (
      nip, name, parent_unit, unit, position, position_type,
      echelon, rank, asn_type, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.adminDatabase = db;
}
