import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KakDraft, KakReference } from "@/lib/kak-types";

type Entry = { number: number; code: string; name: string; row: number };
type Catalog = { id: string; title: string; year: number; fileName: string; sheet: string; sha256: string; entries: Entry[] };
type Sequence = { number: string; reference?: KakReference; warning?: string };
let catalog: Promise<Catalog> | undefined;
function loadCatalog() {
  catalog ??= readFile(path.join(process.cwd(), "src/data/kak-sub-kegiatan-2027.json"), "utf8")
    .then((file) => JSON.parse(file) as Catalog).catch((error) => { catalog = undefined; throw error; });
  return catalog;
}
const normalizeName = (value: string) => value.normalize("NFKC").toLocaleLowerCase("id-ID")
  .replace(/^\s*\.?\d+(?:\.\d+)+\s*[-–:]?\s+/, "").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();

/** Resolve cover numbering from the user-supplied list; never infer it from the last code digits. */
export async function resolveKakSequence(metadata: KakDraft["metadata"], manual?: string): Promise<Sequence> {
  if (manual?.trim()) return { number: manual.trim() };
  const source = await loadCatalog();
  const missing = (reason: string): Sequence => ({ number: "", warning: `${reason} Nomor urut cover belum diisi; lengkapi secara manual sebelum digunakan.` });
  if (metadata.tahunAnggaran !== source.year) return missing(`Daftar nomor urut tersedia untuk TA ${source.year}, sedangkan RKA memakai TA ${metadata.tahunAnggaran}.`);
  if (!/ketahanan\s+pangan/i.test(metadata.perangkatDaerah) || !/pertanian/i.test(metadata.perangkatDaerah)) return missing("Daftar nomor urut DKPP tidak diterapkan karena perangkat daerah pada RKA berbeda.");
  const code = metadata.kodeSubKegiatan.replace(/\s+/g, "").replace(/^\./, "");
  const name = normalizeName(metadata.subKegiatan);
  const names = source.entries.filter((entry) => normalizeName(entry.name) === name);
  // Food and agriculture can share a short code; require an exact name to disambiguate.
  const codeMatches = code ? source.entries.filter((entry) => entry.code === code || (/^\d{2}\.\d\.\d{2}\.\d{4}$/.test(code) && entry.code.endsWith(`.${code}`))) : names;
  const candidates = codeMatches.length > 1 ? codeMatches.filter((entry) => names.some((named) => named.code === entry.code)) : codeMatches;
  if (candidates.length !== 1) return missing("Sub kegiatan RKA belum cocok secara pasti dengan daftar nomor urut DKPP 2027.");
  const entry = candidates[0];
  if (names.length && !names.some((named) => named.code === entry.code)) return missing("Kode dan nama sub kegiatan RKA menunjuk nomor urut yang berbeda pada daftar DKPP 2027.");
  return {
    number: String(entry.number),
    reference: { id: source.id, title: source.title, sha256: source.sha256, locators: [`${source.fileName}, sheet ${source.sheet}, A${entry.row}:C${entry.row}; ${entry.code} — ${entry.name}`] },
  };
}
