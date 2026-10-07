"use server";

import { requireUser } from "@/lib/session";
import { createGoogleDriveBackup, googleDriveBackupAllowed } from "@/lib/google-drive-backup";

export type BackupActionResult = {
  status: "success" | "error";
  message: string;
  backupId?: string;
  folderUrl?: string;
  tableCount?: number;
  documentCount?: number;
  unlinkedStorageObjectCount?: number;
  archiveCount?: number;
};

export async function runGoogleDriveBackupAction(): Promise<BackupActionResult> {
  const user = await requireUser();
  if (!googleDriveBackupAllowed(user.username)) {
    return { status: "error", message: "Akun ini tidak termasuk administrator yang diizinkan menjalankan backup." };
  }
  try {
    const result = await createGoogleDriveBackup();
    return {
      status: "success",
      message: "Backup selesai dan semua arsip terenkripsi sudah tersimpan di Google Drive.",
      ...result,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Backup Google Drive gagal.",
    };
  }
}
