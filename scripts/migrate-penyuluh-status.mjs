import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";

const shouldApply = process.argv.includes("--apply");
const database = new Database(path.join(process.cwd(), "data", "admin.db"));
const positionPattern = /PENYULUH\s+PERTANIAN/i;

try {
  const employees = database.prepare("SELECT nip, position, status FROM employees").all();
  const targets = employees.filter((employee) => positionPattern.test(employee.position));
  const before = Object.groupBy(targets, (employee) => employee.status);

  assert.ok(targets.length > 0, "Tidak ada jabatan Penyuluh Pertanian yang ditemukan.");
  console.log(`Ditemukan ${targets.length} pegawai Penyuluh Pertanian.`);
  console.log("Status sebelum:", Object.fromEntries(Object.entries(before).map(([status, rows]) => [status, rows.length])));

  if (shouldApply) {
    const now = new Date().toISOString();
    const update = database.prepare("UPDATE employees SET status = 'Mutasi', updated_at = ? WHERE nip = ?");
    const migrate = database.transaction(() => {
      for (const employee of targets) update.run(now, employee.nip);

      const users = database.prepare("SELECT id FROM users").all();
      const notify = database.prepare(
        `INSERT INTO notifications (id, user_id, type, title, description, created_at)
         VALUES (?, ?, 'info', ?, ?, ?)`,
      );
      for (const user of users) {
        notify.run(randomUUID(), user.id, "Status pegawai diperbarui", `${targets.length} pegawai dengan jabatan Penyuluh Pertanian diubah menjadi Mutasi.`, now);
      }
    });
    migrate();
  }

  const remaining = database.prepare("SELECT nip, position, status FROM employees WHERE status <> 'Mutasi'").all().filter((employee) => positionPattern.test(employee.position));
  const mutationCount = database.prepare("SELECT COUNT(*) AS total FROM employees WHERE status = 'Mutasi'").get().total;

  if (shouldApply) assert.equal(remaining.length, 0, "Masih ada Penyuluh Pertanian yang belum berstatus Mutasi.");
  console.log(shouldApply ? `OK: ${targets.length} target telah menjadi Mutasi; total status Mutasi ${mutationCount}.` : "Jalankan dengan --apply untuk menerapkan perubahan.");
} finally {
  database.close();
}
