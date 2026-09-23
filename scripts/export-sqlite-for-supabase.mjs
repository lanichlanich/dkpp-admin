import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import path from "node:path";

const databasePath = path.join(process.cwd(), "data", "admin.db");
const database = new Database(databasePath, { readonly: true, fileMustExist: true });
database.pragma("foreign_keys = ON");

const tables = [
  { name: "users", key: (row) => row.id },
  { name: "employees", key: (row) => row.nip },
  { name: "sessions", key: (row) => row.token_hash },
  { name: "notifications", key: (row) => row.id },
  { name: "kgb_documents", key: (row) => row.id },
  { name: "dpcp_documents", key: (row) => row.id },
  { name: "pak_documents", key: (row) => row.id, json: ["input_json"] },
  { name: "wfh_documents", key: (row) => row.id },
  { name: "surat_pengantar_documents", key: (row) => row.id },
  { name: "official_statement_documents", key: (row) => row.id },
  {
    name: "employee_documents",
    key: (row) => row.id,
    emptyDates: ["tgl_surat", "tmt_surat"],
  },
  {
    name: "hukdis_records",
    key: (row) => `${row.employee_nip}\u001f${row.report_period}`,
  },
  { name: "wfh_reports", key: (row) => row.id, json: ["payload"] },
];

const exists = database.prepare(
  "select 1 from sqlite_master where type = 'table' and name = ?",
);

function digestKeys(rows, key) {
  const joined = rows.map(key).sort().join("\n");
  return createHash("md5").update(joined).digest("hex");
}

for (const table of tables) {
  if (!exists.get(table.name)) {
    throw new Error(`Tabel SQLite tidak ditemukan: ${table.name}`);
  }

  const rows = database.prepare(`select * from ${table.name}`).all();
  for (const row of rows) {
    for (const column of table.emptyDates ?? []) {
      if (row[column] === "") row[column] = null;
    }
    for (const column of table.json ?? []) {
      try {
        row[column] = JSON.parse(row[column]);
      } catch (error) {
        throw new Error(
          `JSON tidak valid pada ${table.name}.${column}: ${error.message}`,
        );
      }
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      table: table.name,
      count: rows.length,
      keyDigest: digestKeys(rows, table.key),
      rows,
    })}\n`,
  );
}

const integrity = database.pragma("integrity_check", { simple: true });
const foreignKeyViolations = database.pragma("foreign_key_check");
if (integrity !== "ok" || foreignKeyViolations.length > 0) {
  throw new Error(
    `SQLite gagal pemeriksaan: integrity=${integrity}, fk=${foreignKeyViolations.length}`,
  );
}

database.close();
