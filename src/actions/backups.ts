"use server";

import { requireMenuAccess } from "@/lib/authorization";
import { checkGoogleDriveBackupConnection, createGoogleDriveBackup, googleDriveBackupAllowed } from "@/lib/google-drive-backup";

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

export async function checkGoogleDriveBackupAction(): Promise<BackupActionResult> {
  const user = await requireMenuAccess("backup");
  if (!googleDriveBackupAllowed(user)) {
    return { status: "error", message: "Akun ini tidak termasuk administrator yang diizinkan menjalankan backup." };
  }
  try {
    await checkGoogleDriveBackupConnection();
    return { status: "success", message: "Koneksi Google Drive berhasil. Folder tujuan privat dan dapat menerima backup." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Pemeriksaan koneksi Google Drive gagal." };
  }
}

export async function runGoogleDriveBackupAction(): Promise<BackupActionResult> {
  const user = await requireMenuAccess("backup");
  if (!googleDriveBackupAllowed(user)) {
    return { status: "error", message: "Akun ini tidak termasuk administrator yang diizinkan menjalankan backup." };
  }
  try {
    const result = await createGoogleDriveBackup();
    return {
      status: "success",
      message: "Backup selesai dan semua arsip .tar.gz sudah tersimpan di Google Drive.",
      ...result,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Backup Google Drive gagal.",
    };
  }
}
