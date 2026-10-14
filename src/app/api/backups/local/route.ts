import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { createLocalBackup, localBackupAllowed } from "@/lib/local-backup";

export const runtime = "nodejs";
export const maxDuration = 300;
const active = new Set<string>();
export async function POST(request: Request) {
  const accessDenied = await checkApiAccess(["backup-lokal"]);
  if (accessDenied) return accessDenied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!localBackupAllowed(user)) return Response.json({ error: "Anda tidak memiliki izin backup lokal." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Permintaan backup tidak diizinkan." }, { status: 403 });
  if (active.has(user.id)) return Response.json({ error: "Backup lokal masih berlangsung. Tunggu hingga selesai." }, { status: 429 });
  active.add(user.id);
  try {
    const backup = await createLocalBackup();
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === backup.bytes.length) { controller.close(); active.delete(user.id); return; }
        const end = Math.min(offset + 65536, backup.bytes.length);
        controller.enqueue(new Uint8Array(backup.bytes.subarray(offset, end)));
        offset = end;
      },
      cancel() { active.delete(user.id); },
    });
    // No Content-Length: stream the archive to support large backups on Vercel.
    return new Response(stream, { headers: {
      "content-type": "application/gzip", "content-disposition": `attachment; filename="${backup.fileName}"`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff",
      "x-backup-bytes": String(backup.bytes.length), "x-backup-sha256": backup.sha256,
      "x-backup-tables": String(backup.tableCount), "x-backup-documents": String(backup.documentCount + backup.unlinkedStorageObjectCount),
    } });
  } catch {
    active.delete(user.id);
    console.error("Local backup failed");
    return Response.json({ error: "Backup gagal disiapkan. Pastikan database dan semua berkas bisa diakses, lalu coba kembali." }, { status: 500 });
  }
}
