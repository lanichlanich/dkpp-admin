import "server-only";

import { gzipSync } from "node:zlib";
import { createBackupSnapshot } from "@/lib/database";
import { downloadStorageObject } from "@/lib/storage";
import { kakDocumentRows } from "@/lib/kak-file-metadata";

const ROOT_FOLDER_ID = "18c2-AWmf2K0GKDRgv_g3AQUCicv7J1j4";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

type Category = "Kepegawaian" | "Persuratan" | "Umum" | "Perencanaan" | "Sistem";
type ArchiveFile = { path: string; bytes: Buffer };

const TABLE_CATEGORY: Record<string, Category> = {
  employees: "Kepegawaian",
  organization_units: "Kepegawaian",
  job_positions: "Kepegawaian",
  hukdis_records: "Kepegawaian",
  employee_documents: "Kepegawaian",
  kgb_documents: "Kepegawaian",
  dpcp_documents: "Kepegawaian",
  pak_documents: "Kepegawaian",
  kerjaku_request_documents: "Kepegawaian",
  kak_documents: "Perencanaan",
  official_statement_documents: "Kepegawaian",
  wfh_documents: "Umum",
  wfh_reports: "Umum",
  wfh_schedule_months: "Umum",
  wfh_schedule_entries: "Umum",
  surat_pengantar_documents: "Persuratan",
  surat_lupa_absen_documents: "Persuratan",
  service_archive_documents: "Persuratan",
  users: "Sistem",
  app_roles: "Sistem",
  notifications: "Sistem",
  audit_logs: "Sistem",
};

const DOCUMENT_TABLES = new Set([
  "kak_documents",
  "employee_documents",
  "kgb_documents",
  "dpcp_documents",
  "pak_documents",
  "wfh_documents",
  "surat_pengantar_documents",
  "surat_lupa_absen_documents",
  "kerjaku_request_documents",
  "official_statement_documents",
  "service_archive_documents",
  "wfh_reports",
]);

const LOCAL_DOCUMENT_DIRECTORIES: Record<string, string> = {
  kak_documents: "kak-documents",
  employee_documents: "employee-documents",
  kgb_documents: "kgb-documents",
  dpcp_documents: "dpcp-documents",
  pak_documents: "pak-documents",
  wfh_documents: "wfh-documents",
  surat_pengantar_documents: "surat-pengantar-documents",
  surat_lupa_absen_documents: "surat-lupa-absen-documents",
  kerjaku_request_documents: "kerjaku-request-documents",
  official_statement_documents: "official-statement-documents",
  service_archive_documents: "service-archive-documents",
  wfh_reports: "wfh-reports",
};

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Konfigurasi ${name} belum diisi pada environment aplikasi.`);
  return value;
}

export function googleDriveBackupReady() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID?.trim()
    && process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()
    && process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim(),
  );
}

function destinationFolderId() {
  return process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim() || ROOT_FOLDER_ID;
}

export function googleDriveBackupAllowed(username: string) {
  const allowedUsernames = process.env.GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES
    ?.split(",")
    .map((value) => value.trim().toLocaleLowerCase("id-ID"))
    .filter(Boolean) ?? [];
  return allowedUsernames.includes(username.trim().toLocaleLowerCase("id-ID"));
}

export function googleDriveBackupAdminConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES?.trim());
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function tokenFailure(response: Response) {
  const result: unknown = await response.json().catch(() => null);
  const code = result && typeof result === "object" && "error" in result ? result.error : undefined;
  // Only known error codes reach the UI. Never return Google's raw body or credentials.
  if (code === "invalid_client") {
    return "OAuth Google menolak Client ID atau Client Secret (invalid_client). Isi ulang GOOGLE_DRIVE_CLIENT_ID dan GOOGLE_DRIVE_CLIENT_SECRET dari client OAuth yang sama di Vercel Production, lalu redeploy.";
  }
  if (code === "invalid_grant") {
    return "Google menolak refresh token (invalid_grant). Salin kolom Refresh token dari OAuth Playground dengan Client ID dan Client Secret yang sama, isi ulang GOOGLE_DRIVE_REFRESH_TOKEN di Vercel Production, lalu redeploy. Token mungkin tidak cocok, kedaluwarsa, atau telah dicabut.";
  }
  if (code === "deleted_client" || code === "unauthorized_client") {
    return "Client OAuth Google tidak tersedia atau tidak diizinkan. Periksa client di Google Cloud, lalu perbarui kredensial dan refresh token di Vercel Production dan redeploy.";
  }
  return `Token Google Drive gagal diperbarui (HTTP ${response.status}). Periksa ketiga variabel OAuth di Vercel Production atau coba lagi jika layanan Google sedang bermasalah.`;
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;
  const body = new URLSearchParams({
    client_id: requiredEnvironment("GOOGLE_DRIVE_CLIENT_ID"),
    client_secret: requiredEnvironment("GOOGLE_DRIVE_CLIENT_SECRET"),
    refresh_token: requiredEnvironment("GOOGLE_DRIVE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(await tokenFailure(response));
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error("Google tidak mengembalikan token akses Drive.");
  cachedToken = { accessToken: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  return result.access_token;
}

async function driveRequest(url: string, init: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const status = response.status;
    const message = status === 403
      ? "Google Drive menolak akses. Pastikan akun OAuth memiliki izin editor pada folder backup dan Drive API aktif."
      : `Permintaan Google Drive gagal (HTTP ${status}).`;
    throw new Error(message);
  }
  return response;
}

async function createDriveFolder(name: string, parentId: string) {
  const response = await driveRequest(`${DRIVE_API}/files?supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const folder = await response.json() as { id?: string; webViewLink?: string };
  if (!folder.id) throw new Error("Google Drive tidak mengembalikan ID folder backup.");
  return folder;
}

async function validateDestinationFolder() {
  const folderId = destinationFolderId();
  const fields = "id,mimeType,capabilities(canAddChildren),permissions(type)";
  const response = await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`);
  const folder = await response.json() as {
    mimeType?: string;
    capabilities?: { canAddChildren?: boolean };
    permissions?: Array<{ type?: string }>;
  };
  if (folder.mimeType !== "application/vnd.google-apps.folder" || !folder.capabilities?.canAddChildren) {
    throw new Error("Akun OAuth tidak memiliki akses tulis ke folder backup Google Drive yang dikonfigurasi.");
  }
  if (!Array.isArray(folder.permissions)) {
    throw new Error("Izin folder backup tidak dapat diperiksa. Gunakan folder milik akun OAuth agar akses backup tanpa enkripsi dapat diverifikasi.");
  }
  if (folder.permissions.some((permission) => permission.type === "anyone" || permission.type === "domain")) {
    throw new Error("Backup tanpa enkripsi memerlukan folder privat. Ubah Akses umum folder Google Drive menjadi Dibatasi sebelum menjalankan backup.");
  }
  return folderId;
}

export async function checkGoogleDriveBackupConnection() {
  await validateDestinationFolder();
}

async function uploadDriveFile(name: string, parentId: string, bytes: Buffer) {
  const session = await driveRequest(`${UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "application/gzip",
      "x-upload-content-length": String(bytes.length),
    },
    body: JSON.stringify({ name, parents: [parentId], mimeType: "application/gzip" }),
  });
  const uploadUrl = session.headers.get("location");
  if (!uploadUrl) throw new Error("Google Drive tidak mengembalikan URL upload resumable.");
  await driveRequest(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/gzip",
      "content-length": String(bytes.length),
    },
    body: new Uint8Array(bytes),
  });
}

async function mapLimit<T, U>(values: T[], concurrency: number, map: (value: T, index: number) => Promise<U>) {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await map(values[index], index);
    }
  }));
  return results;
}

function padOctal(value: number, length: number) {
  return `${Math.max(0, value).toString(8).padStart(length - 1, "0")}\0`;
}

function writeTarString(header: Buffer, value: string, offset: number, length: number) {
  header.write(value.slice(0, length), offset, length, "utf8");
}

export function tarArchive(files: ArchiveFile[]) {
  const blocks: Buffer[] = [];
  for (const file of files) {
    const header = Buffer.alloc(512);
    const normalizedPath = file.path.replaceAll("\\", "/");
    const slash = normalizedPath.lastIndexOf("/");
    const name = slash >= 0 ? normalizedPath.slice(slash + 1) : normalizedPath;
    const prefix = slash >= 0 ? normalizedPath.slice(0, slash) : "";
    if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error("Nama item dalam arsip backup terlalu panjang.");
    writeTarString(header, name, 0, 100);
    writeTarString(header, padOctal(0o600, 8), 100, 8);
    writeTarString(header, padOctal(0, 8), 108, 8);
    writeTarString(header, padOctal(0, 8), 116, 8);
    writeTarString(header, padOctal(file.bytes.length, 12), 124, 12);
    writeTarString(header, padOctal(Math.floor(Date.now() / 1000), 12), 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeTarString(header, "ustar\0", 257, 6);
    writeTarString(header, "00", 263, 2);
    writeTarString(header, prefix, 345, 155);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeTarString(header, `${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
    blocks.push(header, file.bytes);
    const remainder = file.bytes.length % 512;
    if (remainder) blocks.push(Buffer.alloc(512 - remainder));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 6 });
}

function safeId(value: unknown, index: number) {
  const id = String(value ?? index + 1).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return id || String(index + 1);
}

function extensionFor(row: Record<string, unknown>, table: string) {
  if (table === "wfh_reports") return "docx";
  const candidate = String(row.original_file_name ?? row.file_name ?? row.storage_name ?? "");
  const extension = /\.([a-zA-Z0-9]{1,10})$/.exec(candidate)?.[1]?.toLowerCase();
  return extension ?? "bin";
}

export function jakartaBackupName(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (name: string) => values.find((value) => value.type === name)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}_${part("hour")}-${part("minute")}-${part("second")}`;
}

export async function createBackupContent() {
  const { tables: snapshot, storageObjects } = await createBackupSnapshot();
  const filesByCategory = new Map<Category, ArchiveFile[]>([
    ["Kepegawaian", []], ["Persuratan", []], ["Umum", []], ["Perencanaan", []], ["Sistem", []],
  ]);

  for (const [table, rows] of Object.entries(snapshot)) {
    const category = TABLE_CATEGORY[table];
    if (!category) throw new Error(`Tabel ${table} belum dimasukkan ke kategori backup.`);
    filesByCategory.get(category)!.push({
      path: `database/${table}.json`,
      bytes: Buffer.from(`${JSON.stringify(rows, null, 2)}\n`, "utf8"),
    });
  }

  const documents = Object.entries(snapshot).flatMap(([table, rows]) => DOCUMENT_TABLES.has(table)
    ? rows.flatMap((row, index) => table === "kak_documents"
      ? kakDocumentRows(row).map((documentRow) => ({ table, index, row: documentRow }))
      : [{ table, row, index }])
    : []);
  const referencedStorageNames = new Set(documents.map(({ table, row }) =>
    table === "wfh_reports" ? `${String(row.id)}.docx` : String(row.storage_name ?? ""),
  ));
  const orphanedStorageObjects = storageObjects.filter((object) => !referencedStorageNames.has(object.name));
  const downloadedDocuments = await mapLimit(documents, 5, async ({ table, row, index }) => {
    const storageName = table === "wfh_reports" ? `${String(row.id)}.docx` : String(row.storage_name ?? "");
    if (!storageName) throw new Error(`Referensi file pada ${table} tidak memiliki storage_name.`);
    const fallbackDirectory = LOCAL_DOCUMENT_DIRECTORIES[table];
    const filePath = fallbackDirectory ? `data/${fallbackDirectory}/${storageName}` : undefined;
    const bytes = await downloadStorageObject(storageName, filePath);
    return {
      category: TABLE_CATEGORY[table]!,
      storageName,
      archiveFile: { path: `files/${table}/record-${safeId(row.id, index)}.${extensionFor(row, table)}`, bytes },
    };
  });
  for (const item of downloadedDocuments) filesByCategory.get(item.category)!.push(item.archiveFile);
  const downloadedOrphans = await mapLimit(orphanedStorageObjects, 5, async (object, index) => {
    const bytes = await downloadStorageObject(object.name);
    const archivePath = `files/unlinked-storage/object-${String(index + 1).padStart(5, "0")}.${extensionFor({ storage_name: object.name }, "")}`;
    return { archivePath, bytes, storageName: object.name, metadata: object.metadata };
  });
  const systemFiles = filesByCategory.get("Sistem")!;
  systemFiles.push(...downloadedOrphans.map((item) => ({ path: item.archivePath, bytes: item.bytes })));
  systemFiles.push({
    path: "database/unlinked-storage-index.json",
    bytes: Buffer.from(`${JSON.stringify(downloadedOrphans.map(({ archivePath, storageName, metadata }) => ({
      path: archivePath, storageName, metadata,
    })), null, 2)}\n`, "utf8"),
  });

  return {
    filesByCategory,
    tableCount: Object.keys(snapshot).length,
    documentCount: downloadedDocuments.length,
    unlinkedStorageObjectCount: downloadedOrphans.length,
    storageFiles: [
      ...downloadedDocuments.map(item => ({ path: `${item.category}/${item.archiveFile.path}`, storageName: item.storageName })),
      ...downloadedOrphans.map(item => ({ path: `Sistem/${item.archivePath}`, storageName: item.storageName })),
    ],
  };
}

export async function createGoogleDriveBackup() {
  // Check OAuth and folder access before reading the database or downloading files.
  const folderId = await validateDestinationFolder();
  const { filesByCategory, tableCount, documentCount, unlinkedStorageObjectCount } = await createBackupContent();
  const backupTime = new Date();
  const backupId = jakartaBackupName(backupTime);
  const categoryArchives = [...filesByCategory.entries()].map(([category, files]) => ({
    category,
    fileCount: files.length,
    bytes: tarArchive(files),
  }));

  const timestampFolder = await createDriveFolder(`Backup ${backupId}`, folderId);
  const categoryFolders = await Promise.all(categoryArchives.map(async ({ category }) => ({
    category,
    folder: await createDriveFolder(category, timestampFolder.id!),
  })));
  await Promise.all(categoryArchives.map(({ category, bytes }) => {
    const folder = categoryFolders.find((item) => item.category === category)!.folder;
    return uploadDriveFile(`backup-${category.toLowerCase()}.tar.gz`, folder.id!, bytes);
  }));

  return {
    backupId,
    folderUrl: timestampFolder.webViewLink ?? `https://drive.google.com/drive/folders/${timestampFolder.id}`,
    tableCount,
    documentCount,
    unlinkedStorageObjectCount,
    archiveCount: categoryArchives.length,
  };
}
