import type { Metadata } from "next";
import { GoogleDriveBackupPanel } from "@/components/backups/google-drive-backup-panel";
import { googleDriveBackupAdminConfigured, googleDriveBackupAllowed, googleDriveBackupReady } from "@/lib/google-drive-backup";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Backup Google Drive" };
export const maxDuration = 300;

export default async function BackupPage() {
  const user = await requireUser();
  const authorized = googleDriveBackupAllowed(user.username);
  const adminListConfigured = googleDriveBackupAdminConfigured();
  return <div className="mx-auto max-w-5xl space-y-6">
    <div>
      <p className="text-sm font-medium text-emerald-700">Perlindungan data</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Backup Google Drive</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Cadangkan data aplikasi dan berkas yang tersimpan di Supabase ke folder Drive DKPP-Admin. Setiap proses membuat folder bertanggal sendiri agar riwayat backup mudah ditemukan.</p>
    </div>
    {!authorized && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
      <p className="font-semibold">Backup hanya tersedia untuk administrator yang ditetapkan.</p>
      <p className="mt-1">{adminListConfigured ? "Akun Anda belum masuk daftar GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES." : "Atur GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES di environment Vercel sebelum menjalankan backup."}</p>
    </div>}
    <GoogleDriveBackupPanel configured={authorized && googleDriveBackupReady()} />
  </div>;
}
