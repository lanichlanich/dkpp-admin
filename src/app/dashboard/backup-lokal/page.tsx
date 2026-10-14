import { requireMenuAccess } from "@/lib/authorization";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { localBackupAllowed } from "@/lib/local-backup";
import { LocalBackupPanel } from "@/components/backups/local-backup-panel";

export const metadata: Metadata = { title: "Backup ke Lokal" };
export default async function LocalBackupPage() {
  await requireMenuAccess("backup-lokal");
  const user = await requireUser();
  return <div className="mx-auto max-w-5xl space-y-6"><div><p className="text-sm font-medium text-emerald-700">Perlindungan data</p><h1 className="mt-1 text-2xl font-semibold md:text-3xl">Backup ke Lokal</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Cadangkan data aplikasi ke komputer Anda tanpa koneksi Google Drive. File memakai nama dengan tanggal dan waktu WIB.</p></div><LocalBackupPanel authorized={localBackupAllowed(user.username)} /></div>;
}
