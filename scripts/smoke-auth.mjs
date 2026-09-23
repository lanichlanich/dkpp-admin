import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const database = new Database(path.join(process.cwd(), "data", "admin.db"));
const userId = `smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date();
const expiresAt = new Date(now.getTime() + 60_000);
const employeeTotal = database.prepare("SELECT COUNT(*) AS total FROM employees").get().total;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  database.prepare(
    `INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, "Pengguna Smoke Test", userId, `${userId}@example.test`, "not-used", now.toISOString(), now.toISOString());

  database.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(tokenHash, userId, expiresAt.toISOString(), now.toISOString());

  const loginResponse = await fetch(`${baseUrl}/login`);
  assert(loginResponse.status === 200, `Halaman login mengembalikan ${loginResponse.status}`);

  const anonymousResponse = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  assert([303, 307, 308].includes(anonymousResponse.status), `Dashboard anonim tidak dialihkan (${anonymousResponse.status})`);
  assert(new URL(anonymousResponse.headers.get("location"), baseUrl).pathname === "/login", "Dashboard anonim tidak diarahkan ke /login");

  const authenticatedResponse = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  const body = await authenticatedResponse.text();
  assert(authenticatedResponse.status === 200, `Dashboard terautentikasi mengembalikan ${authenticatedResponse.status}`);
  assert(body.includes("Pengguna Smoke Test"), "Identitas pengguna tidak tampil di dashboard");
  assert(body.includes("Statistik Pegawai"), "Judul statistik pegawai tidak tampil");
  assert(body.includes("Komposisi Status"), "Chart komposisi status tidak tampil");
  assert(body.includes("Komposisi ASN"), "Chart komposisi ASN tidak tampil");

  const employeesResponse = await fetch(`${baseUrl}/dashboard/pegawai`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  const employeesBody = await employeesResponse.text();
  assert(employeesResponse.status === 200, `Daftar pegawai mengembalikan ${employeesResponse.status}`);
  assert(employeesBody.includes("Daftar Pegawai"), "Judul daftar pegawai tidak tampil");
  assert(
    employeesBody.includes("Kelola") &&
      employeesBody.includes(String(employeeTotal)) &&
      employeesBody.includes("data pegawai"),
    "Jumlah pegawai tidak tampil sesuai isi basis data",
  );
  assert(employeesBody.includes("196609231987091001"), "NIP sumber tidak tampil pada tabel pegawai");

  console.log(`Smoke test berhasil: autentikasi, proteksi route, dashboard, dan ${employeeTotal} data pegawai tervalidasi.`);
} finally {
  database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  database.close();
}
