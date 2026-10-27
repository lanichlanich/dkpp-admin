import { validPltDate } from "@/lib/plt-dates";

function filenamePart(value: string, maxBytes: number, fallback: string) {
  // Match the filename backfill migration, including Unicode byte limits.
  let part = value.replace(/[\x00-\x20\x7f<>:"/\\|?*]+/g, " ").replace(/^[ .]+|[ .]+$/g, "");
  const characters = Array.from(part);
  while (new TextEncoder().encode(characters.join("")).length > maxBytes) characters.pop();
  part = characters.join("").replace(/^[ .]+|[ .]+$/g, "");
  return part || fallback;
}

export function pltFileName(employeeName: string, actingPosition: string, startDate: string, sourceName: string) {
  const extension = /\.(pdf|doc|docx)$/i.exec(sourceName)?.[1].toLowerCase();
  if (!extension || !validPltDate(startDate)) return "";
  return `${filenamePart(employeeName, 80, "Pegawai")}_${filenamePart(actingPosition, 140, "Jabatan")}_${startDate}.${extension}`;
}
