import "server-only";
import { createHash } from "node:crypto";
import { createBackupContent, jakartaBackupName, tarArchive } from "@/lib/google-drive-backup";

export function localBackupAllowed(username: string) {
  const configured = process.env.BACKUP_ADMIN_USERNAMES ?? process.env.GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES ?? "";
  return configured.split(",").map(value => value.trim().toLocaleLowerCase("id-ID")).filter(Boolean).includes(username.trim().toLocaleLowerCase("id-ID"));
}
export async function createLocalBackup() {
  const createdAt = new Date();
  const content = await createBackupContent();
  const files = [...content.filesByCategory].flatMap(([category, entries]) => entries.map(file => ({ ...file, path: `${category}/${file.path}` })));
  const manifest = {
    format: "dkpp-admin-local-backup", version: 1, createdAt: createdAt.toISOString(), timeZone: "Asia/Jakarta",
    tableCount: content.tableCount, documentCount: content.documentCount, unlinkedStorageObjectCount: content.unlinkedStorageObjectCount,
    excludedTables: ["sessions"],
    files: files.map(file => ({ path: file.path, size: file.bytes.length, sha256: createHash("sha256").update(file.bytes).digest("hex") })),
    storageFiles: content.storageFiles,
  };
  files.push({ path: "manifest.json", bytes: Buffer.from(JSON.stringify(manifest, null, 2)) });
  files.push({ path: "PEMULIHAN.txt", bytes: Buffer.from([
    "Backup DKPP-Admin", "",
    "Ekstrak arsip .tar.gz menggunakan 7-Zip, WinRAR atau tar -xzf <nama-arsip>.",
    "Database JSON dan berkas tersimpan dalam folder Kepegawaian, Persuratan, Umum, Perencanaan, dan Sistem.",
    "manifest.json mencatat ukuran dan SHA-256 setiap item, serta nama asli objek Storage untuk pemulihan.",
    "Untuk pemulihan: siapkan database dengan migrasi skema aplikasi, impor JSON tabel sesuai urutan foreign key, kemudian unggah berkas sesuai storageFiles pada manifest ke bucket aplikasi.",
    "Verifikasi hash, jumlah baris tabel, seluruh file, dan akses unduh sebelum mengalihkan aplikasi ke hasil pemulihan.",
    "Sesi login tidak dicadangkan; pengguna harus login kembali setelah pemulihan.",
    "Variabel environment dan kredensial layanan tidak disertakan. Konfigurasikan kembali secara terpisah.", "",
  ].join("\n")) });
  if (new Set(files.map(file => file.path)).size !== files.length) throw new Error("Path item backup berulang.");
  const bytes = tarArchive(files);
  return { bytes, fileName: `backup-dkpp-admin-${jakartaBackupName(createdAt)}.tar.gz`, sha256: createHash("sha256").update(bytes).digest("hex"), tableCount: content.tableCount, documentCount: content.documentCount, unlinkedStorageObjectCount: content.unlinkedStorageObjectCount };
}
