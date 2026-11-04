import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { database as db } from "@/lib/database";
import { deleteStorageObject, downloadStorageObject, isStorageConfigured, uploadStorageObject } from "@/lib/storage";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { validPeriod, type ScheduleEntry } from "@/lib/wfh-schedule";
import { createSchedulePdf } from "@/lib/wfh-schedule-export";

const directory = path.join(process.cwd(), "data", "wfh-schedule-letters");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ScheduleLetterError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export type ScheduleLetter = {
  id: string;
  originalName: string;
  fileSize: number;
  pageCount: number;
  createdAt: string;
};

async function readPdf(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_SIZE_BYTES)
    throw new ScheduleLetterError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new ScheduleLetterError("Surat tugas harus berupa PDF yang valid.");
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
    if (!document.getPageCount()) throw new Error("Empty PDF");
    return document;
  } catch {
    throw new ScheduleLetterError("PDF tidak dapat dibaca. Gunakan PDF yang tidak rusak dan tidak dilindungi kata sandi.");
  }
}

export async function getScheduleLetters(period: string): Promise<ScheduleLetter[]> {
  if (!validPeriod(period)) return [];
  return db.prepare(`SELECT id, original_file_name AS originalName, file_size AS fileSize,
    page_count AS pageCount, CAST(created_at AS TEXT) AS createdAt FROM wfh_schedule_letters
    WHERE period = ? ORDER BY created_at DESC, id DESC`).all<ScheduleLetter>(period);
}

export async function saveScheduleLetter(period: string, userId: string, originalName: string, bytes: Buffer) {
  if (!validPeriod(period)) throw new ScheduleLetterError("Bulan tidak valid.", 400);
  if (!await db.prepare("SELECT period FROM wfh_schedule_months WHERE period = ?").get(period))
    throw new ScheduleLetterError("Jadwal bulan tidak ditemukan.", 404);
  const document = await readPdf(bytes);
  const id = randomUUID(), storageName = `${id}.pdf`, createdAt = new Date().toISOString();
  const safeName = originalName.replaceAll("\\", "/").split("/").pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "Surat-Tugas-WFH-WFO.pdf";
  const local = !isStorageConfigured(), filePath = path.join(directory, storageName);
  try {
    if (local) {
      await mkdir(directory, { recursive: true });
      await writeFile(filePath, bytes, { flag: "wx" });
    } else await uploadStorageObject(storageName, bytes, "application/pdf");
    await db.prepare(`INSERT INTO wfh_schedule_letters
      (id, period, user_id, original_file_name, storage_name, file_size, page_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, period, userId, safeName, storageName, bytes.length, document.getPageCount(), createdAt);
  } catch (error) {
    await (local ? rm(filePath, { force: true }) : deleteStorageObject(storageName))
      .catch(() => console.error("Pembersihan unggahan surat tugas WFH/WFO belum berhasil."));
    throw error;
  }
  return { id, originalName: safeName, fileSize: bytes.length, pageCount: document.getPageCount(), createdAt };
}

export async function readScheduleLetter(period: string, id: string) {
  if (!validPeriod(period) || !uuid.test(id)) return null;
  const row = await db.prepare(`SELECT storage_name FROM wfh_schedule_letters WHERE id = ? AND period = ?`)
    .get<{ storage_name: string }>(id, period);
  if (!row || row.storage_name !== `${id}.pdf`) return null;
  return downloadStorageObject(row.storage_name, path.join(directory, row.storage_name));
}

export async function combineScheduleLetter(period: string, letter: Buffer, entries: ScheduleEntry[]) {
  const original = await readPdf(letter);
  const attachment = await PDFDocument.load(await createSchedulePdf(period, entries));
  const result = await PDFDocument.create();
  for (const document of [original, attachment]) {
    const pages = await result.copyPages(document, document.getPageIndices());
    for (const page of pages) result.addPage(page);
  }
  result.setTitle(`Surat Tugas dan Daftar Pegawai WFH/WFO ${period}`);
  return Buffer.from(await result.save());
}
