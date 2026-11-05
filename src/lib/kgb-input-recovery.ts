import "server-only";
import PizZip from "pizzip";
import { kgbSchema, type KgbInput } from "@/lib/kgb-validation";
import { signatorySchema } from "@/lib/signatory";
import { validPltDate } from "@/lib/plt-dates";

const months = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const decode = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function date(value: string) {
  const m = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(value);
  if (!m || !months.includes(m[2].toLowerCase())) return undefined;
  const iso = `${m[3]}-${String(months.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return validPltDate(iso) ? iso : undefined;
}

/** Recover only recognized fields from the application's legacy Word template; never invent missing values. */
export function recoverKgbInput(bytes: Buffer): Partial<KgbInput> {
  const xml = new PizZip(bytes).file("word/document.xml")?.asText();
  if (!xml) return {};
  const paragraphs = [...xml.matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)].map(m => [...m[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:br|tab)\b[^>]*\/>/g)].map(t => t[1] ? decode(t[1]) : " ").join("").replace(/\s+/g, " ").trim()).filter(Boolean);
  const after = (label: RegExp) => { const i = paragraphs.findIndex(t => label.test(t)); return i < 0 ? "" : paragraphs.slice(i + 1).find(t => t !== ":") ?? ""; };
  const old = /^(\d+)\s+tahun\s+(\d+)\s+bulan$/i.exec(after(/^d\.\s*Masa kerja golongan/i));
  const next = /^(\d+)\s+tahun\s+(\d+)(?:\s+bulan)?$/i.exec(after(/^Berdasarkan masa kerja$/i));
  const values = {
    gajiLama: Number(after(/^Gaji Pokok Lama$/i).split("(")[0].split(",")[0].replace(/\D/g, "")),
    pejabatKgbLama: after(/^a\.\s*Oleh Pejabat$/i), nomorKgbLama: after(/^Nomor$/i),
    tglKgbLama: date(after(/^b\.\s*Tanggal$/i)), tmtKgbLama: date(after(/^c\.\s*Tanggal mulai berlaku Gaji tersebut$/i)),
    mkgTahunLama: old ? Number(old[1]) : undefined, mkgBulanLama: old ? Number(old[2]) : undefined,
    mkgTahunBaru: next ? Number(next[1]) : undefined, mkgBulanBaru: next ? Number(next[2]) : undefined,
    tmtKgbBaru: date(after(/^Mulai tanggal$/i)),
  };
  // The template contains two Nomor labels; use the one following the old decision date.
  const dateAt = paragraphs.findIndex(t => /^b\.\s*Tanggal$/i.test(t));
  const numberAt = paragraphs.findIndex((t, i) => i > dateAt && /^Nomor$/i.test(t));
  if (dateAt >= 0 && numberAt > dateAt) values.nomorKgbLama = paragraphs.slice(numberAt + 1).find(t => t !== ":") ?? "";
  const result: Partial<KgbInput> = {};
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    const parsed = kgbSchema.shape[field as keyof typeof values].safeParse(value);
    if (parsed.success) Object.assign(result, { [field]: parsed.data });
  }
  const at = paragraphs.findIndex(t => /^Ditandatang\S* secara elektronik oleh\s*:/i.test(t));
  if (at >= 0) {
    const [title, name, ...rest] = paragraphs.slice(at + 1).filter(t => !t.includes("${ttd_pengirim}"));
    const nip = rest.find(t => /^NIP[.\s]*\d/i.test(t))?.replace(/\D/g, "") ?? "";
    const signatory = signatorySchema.safeParse({ title: title?.replace(/^Plt\.?\s*/i, ""), name, nip, rank: rest.filter(t => !/^NIP[.\s]*\d/i.test(t)).join(" "), status: /^Plt\.?\s*/i.test(title ?? "") ? "plt" : "definitif" });
    if (signatory.success) result.signatory = signatory.data;
  }
  return result;
}
