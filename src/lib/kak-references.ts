import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KakDraft, KakReference } from "@/lib/kak-types";

type Passage = { id: string; locator: string; role: string; code?: string; text: string; figures?: { year: number; target: string; budget: string }[] };
type Law = { id: string; locator: string; text: string; needsVerification: boolean };
type Source = { id: string; title: string; fileName: string; startYear: number; endYear: number; sha256: string; chunks: Passage[]; legal: Law[] };
let sources: Promise<Source[]> | undefined;
function loadSources() {
  sources ??= Promise.all([
    readFile(path.join(process.cwd(), "src/data/kak-references/renja-dkpp-2027.json"), "utf8"),
    readFile(path.join(process.cwd(), "src/data/kak-references/renstra-dkpp-2025-2029.json"), "utf8"),
  ]).then((files) => files.map((file) => JSON.parse(file) as Source)).catch((error) => { sources = undefined; throw error; });
  return sources;
}
const normalize = (value: string) => value.toLocaleLowerCase("id-ID").replace(/\s+/g, " ").trim();
const codeSuffix = (value: string) => value.replace(/\s+/g, "").match(/\d{2}\.2\.\d{2}(?:\.\d{4})?$/)?.[0] ?? "";
export async function getKakReferenceContext(metadata: KakDraft["metadata"]) {
  const all = await loadSources();
  const dkpp = /ketahanan\s+pangan/i.test(metadata.perangkatDaerah) && /pertanian/i.test(metadata.perangkatDaerah);
  const eligible = dkpp ? all.filter((s) => metadata.tahunAnggaran >= s.startYear && metadata.tahunAnggaran <= s.endYear) : [];
  const warnings: string[] = [];
  if (!dkpp) warnings.push("Referensi Renstra/Renja DKPP tidak diterapkan karena perangkat daerah pada RKA berbeda.");
  else for (const source of all) if (!eligible.includes(source)) warnings.push(`${source.title} tidak diterapkan pada KAK TA ${metadata.tahunAnggaran} karena periode berbeda.`);
  const references: KakReference[] = [];
  const laws: Array<Law & { source: string }> = [];
  const contexts: string[] = [];
  const suffix = codeSuffix(metadata.kodeSubKegiatan);
  for (const source of eligible) {
    const selected = new Map<string, Passage>();
    const add = (chunk: Passage) => selected.set(chunk.id, chunk);
    if (source.id.startsWith("renja")) {
      source.chunks.filter((c) => ["background", "goals", "strategy"].includes(c.role)).forEach(add);
      source.chunks.filter((c) => /^renja-t7-r[012]$/.test(c.id)).forEach(add);
    } else {
      // Narrative goals, indicators and policy directions; skip the table of contents.
      source.chunks.filter((c) => /^renstra-p(?:89|90|91|92|93|94|95|96)$/.test(c.id)).forEach(add);
    }
    const exact = source.chunks.filter((c) => c.role === "program" && suffix && codeSuffix(c.code || "") === suffix);
    const matched = exact.length ? exact : source.chunks.filter((c) => c.role === "program" && normalize(c.text).includes(normalize(metadata.subKegiatan)));
    matched.forEach(add);
    const parentCode = suffix.replace(/\.\d{4}$/, "");
    source.chunks.filter((c) => c.role === "program" && c.code && parentCode && codeSuffix(c.code) === parentCode).forEach(add);
    const programCode = suffix.split(".")[0];
    if (programCode) source.chunks.filter((c) => c.role === "program" && c.code && new RegExp(`^(?:X\\.XX|\\d\\.\\d{2})\\.${programCode}$`).test(c.code)).forEach(add);
    if (!matched.length) {
      const tokens = normalize(metadata.subKegiatan).match(/[a-z]{4,}/g) || [];
      source.chunks.filter((c) => c.role === "page").map((c) => ({ c, score: tokens.filter((t) => normalize(c.text).includes(t)).length }))
        .filter((c) => c.score >= Math.min(3, tokens.length || 3)).sort((a, b) => b.score - a.score).slice(0, 2).forEach(({ c }) => add(c));
      warnings.push(`Sub kegiatan belum cocok secara pasti pada ${source.title}; keterkaitan narasi perlu ditinjau.`);
    }
    for (const passage of matched) {
      const figures = passage.figures?.find((f) => f.year === metadata.tahunAnggaran);
      if (figures && Number(figures.budget) !== Number(metadata.paguAnggaran)) warnings.push(`${source.title} (${passage.locator}) memuat pagu ${new Intl.NumberFormat("id-ID").format(Number(figures.budget))} yang berbeda dari RKA. Pagu KAK tetap mengikuti RKA.`);
      const target = metadata.targetKeluaran.match(/^\d+(?:[.,]\d+)?/)?.[0];
      if (figures && target && figures.target.replace(",", ".") !== target.replace(",", ".")) warnings.push(`${source.title} (${passage.locator}) memuat target ${figures.target}, berbeda dari RKA ${metadata.targetKeluaran}. Target KAK tetap mengikuti RKA.`);
    }
    const usableLaws = source.legal.filter((law) => !law.needsVerification);
    if (usableLaws.length !== source.legal.length) warnings.push(`Sebagian kutipan dasar hukum pada ${source.title} memerlukan pemeriksaan redaksi/status perubahan dan tidak dimasukkan ke pilihan otomatis.`);
    laws.push(...usableLaws.map((law) => ({ ...law, source: source.title })));
    references.push({ id: source.id, title: source.title, sha256: source.sha256, locators: [...new Set([...selected.values()].map((c) => c.locator))] });
    contexts.push(`${source.title}\n${[...selected.values()].map((c) => `[${c.id}; ${c.locator}]\n${c.text}${c.figures ? `\nKolom target/pagu menurut tahun: ${JSON.stringify(c.figures)}` : ""}`).join("\n\n")}`);
  }
  return { references, laws, warnings, text: contexts.join("\n\n") };
}
export function formatKakLegalBasis(ids: string[], context: Awaited<ReturnType<typeof getKakReferenceContext>>) {
  const unique = [...new Set(ids)];
  const chosen = unique.map((id) => context.laws.find((law) => law.id === id));
  if (chosen.some((law) => !law)) throw new Error("Dasar hukum tidak terdapat pada referensi sumber.");
  const seen = new Set<string>();
  const lines = chosen.filter((law) => {
    const text = normalize(law!.text).replace(/\bno\./g, "nomor");
    const key = text.match(/^(.+?)\s+nomor\s+(\d+)\s+tahun\s+(\d{4})/)?.slice(1).join("|") || text;
    if (seen.has(key)) return false; seen.add(key); return true;
  })
    .map((law, index) => `${index + 1}. ${law!.text.replace(/\s*;$/, ".")}`);
  const plans = context.references.map((r) => r.title).join("; ");
  return `${lines.length ? lines.join("\n") : "[Dasar hukum yang relevan perlu dilengkapi dan diverifikasi.]"}${plans ? `\nAcuan perencanaan: ${plans}.` : ""}`;
}
