if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL wajib diisi untuk verifikasi PostgreSQL.");
}

const { database } = await import("../src/lib/database.ts");

const users = await database
  .prepare("SELECT COUNT(*) AS count FROM users")
  .get();
const employees = await database
  .prepare("SELECT COUNT(*) AS count FROM employees")
  .get();
const sample = await database
  .prepare(
    "SELECT nip, parent_unit AS parentUnit, position_type AS positionType FROM employees ORDER BY nip LIMIT 1",
  )
  .get();
const joined = await database
  .prepare(
    `SELECT notifications.id, users.name AS createdBy
     FROM notifications
     INNER JOIN users ON users.id = notifications.user_id
     ORDER BY notifications.created_at DESC
     LIMIT 1`,
  )
  .get();
const firstUser = await database
  .prepare("SELECT id FROM users ORDER BY id LIMIT 1")
  .get();
const noOpWrite = firstUser
  ? await database
      .prepare("UPDATE users SET updated_at = updated_at WHERE id = ?")
      .run(firstUser.id)
  : { changes: 0 };

if (users?.count !== 2 || employees?.count !== 291) {
  throw new Error(
    `Jumlah data PostgreSQL tidak sesuai: users=${users?.count}, employees=${employees?.count}`,
  );
}
if (!sample?.nip || !("parentUnit" in sample) || !("positionType" in sample)) {
  throw new Error("Pemetaan alias kolom PostgreSQL gagal.");
}
if (!joined?.id || !("createdBy" in joined)) {
  throw new Error("Query JOIN PostgreSQL gagal.");
}
if (noOpWrite.changes !== 1) {
  throw new Error("Query perubahan PostgreSQL gagal.");
}

console.log("Runtime PostgreSQL tervalidasi: baca, tulis, placeholder, alias, dan JOIN berhasil.");
