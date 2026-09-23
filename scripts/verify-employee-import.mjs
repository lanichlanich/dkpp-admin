import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const projectRoot = process.cwd();
const source = JSON.parse(
  readFileSync(join(projectRoot, "src", "data", "pegawai.json"), "utf8"),
);
const database = new Database(join(projectRoot, "data", "admin.db"), {
  readonly: true,
});

try {
  const columns = database.prepare("PRAGMA table_info(employees)").all();
  const nipColumn = columns.find((column) => column.name === "nip");
  assert.ok(nipColumn, "Kolom nip tidak ditemukan");
  assert.equal(nipColumn.type, "TEXT", "Kolom nip harus bertipe TEXT");
  assert.equal(nipColumn.pk, 1, "Kolom nip harus menjadi primary key");

  const rows = database
    .prepare(
      `SELECT nip, name, parent_unit, unit, position, position_type,
              echelon, rank, asn_type, status
       FROM employees
       ORDER BY nip`,
    )
    .all();

  const expected = source
    .map((employee) => ({
      nip: employee.NIP,
      name: employee.Nama,
      parent_unit: employee["Unor Induk"],
      unit: employee.Unor,
      position: employee.Jabatan,
      position_type: employee["Jenis Jabatan"],
      echelon: employee.Eselon,
      rank: employee["Gol/Pkt"],
      asn_type: employee.ASN,
      status: employee.Status,
    }))
    .sort((left, right) => left.nip.localeCompare(right.nip));

  assert.equal(rows.length, expected.length, "Jumlah baris database tidak sama dengan sumber");
  assert.equal(new Set(rows.map((row) => row.nip)).size, rows.length, "NIP database tidak unik");

  for (let index = 0; index < expected.length; index += 1) {
    assert.deepEqual(rows[index], expected[index], `Data tidak cocok pada NIP ${expected[index].nip}`);
  }

  console.log(`OK: ${rows.length} pegawai cocok pada 10 kolom; NIP TEXT PRIMARY KEY.`);
} finally {
  database.close();
}
