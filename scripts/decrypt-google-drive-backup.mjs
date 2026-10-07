import { createDecipheriv } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Gunakan: node scripts/decrypt-google-drive-backup.mjs <arsip.tar.gz.enc> <hasil.tar.gz>");
  process.exit(2);
}

const encodedKey = process.env.GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY;
if (!encodedKey) {
  console.error("Atur GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY di environment lokal.");
  process.exit(2);
}

const key = Buffer.from(encodedKey, "base64");
if (key.length !== 32 || key.toString("base64") !== encodedKey) {
  console.error("GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY bukan Base64 dari tepat 32 byte.");
  process.exit(2);
}

const encrypted = await readFile(inputPath);
const header = Buffer.from("DKPPBK01");
if (encrypted.length < header.length + 12 + 16 || !encrypted.subarray(0, header.length).equals(header)) {
  console.error("Format arsip tidak dikenali atau berkas terlalu pendek.");
  process.exit(1);
}

const ivStart = header.length;
const tagStart = ivStart + 12;
const dataStart = tagStart + 16;
const decipher = createDecipheriv("aes-256-gcm", key, encrypted.subarray(ivStart, tagStart));
decipher.setAuthTag(encrypted.subarray(tagStart, dataStart));
const archive = Buffer.concat([decipher.update(encrypted.subarray(dataStart)), decipher.final()]);
await writeFile(outputPath, archive, { flag: "wx" });
console.log(`Arsip terdekripsi dan diverifikasi: ${outputPath}`);
