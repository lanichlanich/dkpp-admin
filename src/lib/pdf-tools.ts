import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { PDF_TOOLS_MAX_BYTES, PDF_TOOLS_MAX_FILES, type PdfTool } from "./pdf-tools-config";

const exec = promisify(execFile);
const MAX_PAGES = 150;
const MAX_OUTPUT = 32 * 1024 * 1024;
type Result = { name: string; bytes: Buffer; pages: number; originalSize?: number };
export class PdfToolError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const documentTitles = [
  [/\bPENETAPAN ANGKA KREDIT\b|\bPAK INTEGRASI\b/i, "Penetapan Angka Kredit"],
  [/\bKENAIKAN GAJI BERKALA\b|\bSK KGB\b/i, "Kenaikan Gaji Berkala"],
  [/\bSURAT TUGAS\b/i, "Surat Tugas"], [/\bSURAT PERINTAH\b/i, "Surat Perintah"],
  [/\bSURAT KETERANGAN\b/i, "Surat Keterangan"], [/\bSURAT PENGANTAR\b/i, "Surat Pengantar"],
  [/\bSURAT UNDANGAN\b|^UNDANGAN\b/i, "Undangan"], [/\bBERITA ACARA\b/i, "Berita Acara"],
  [/\bDAFTAR HADIR\b/i, "Daftar Hadir"], [/\bSURAT KEPUTUSAN\b|^KEPUTUSAN\b/i, "Surat Keputusan"],
  [/\bTRANSKRIP NILAI\b/i, "Transkrip Nilai"], [/\bIJAZAH\b/i, "Ijazah"],
  [/\bSERTIFIKAT\b/i, "Sertifikat"], [/\bPIAGAM\b/i, "Piagam"],
  [/\bKARTU TANDA PENDUDUK\b/i, "KTP"], [/\bKARTU KELUARGA\b/i, "Kartu Keluarga"],
] as const;
const short = (value: string, size: number) => [...value.normalize("NFC").replace(/[^\p{L}\p{M}\p{N} .&'’()-]+/gu, " ").replace(/\s+/g, " ").trim().replace(/^[. -]+|[. -]+$/g,"" )].slice(0, size).join("").trim();
const titleCase = (value: string) => value === value.toUpperCase() && value.length > 5 ? value.toLocaleLowerCase("id-ID").replace(/(^|[\s-])\p{L}/gu, m => m.toLocaleUpperCase("id-ID")) : value;
const label = /^(?:nama(?:\s+lengkap|\s+pegawai)?|atas\s+nama)\s*[:：]\s*(.*)$/i;
function describe(text: string) {
  const lines = text.split(/[\r\n\f]+/).map(line => line.trim()).filter(Boolean).slice(0, 55);
  const title = lines.slice(0, 18).flatMap(line => {
    const known = documentTitles.find(([pattern]) => pattern.test(line.replace(/\s+/g, " ")));
    return known ? [known[1]] : [];
  })[0] ?? "";
  const heading = lines.slice(0, 12).find(line => /^(?:laporan|proposal|notulen|agenda|rencana|rekapitulasi|daftar|pedoman|panduan|ringkasan|kontrak|perjanjian|surat|bukti|kuitansi|faktur|invoice)\s+\p{L}/iu.test(line));
  const people = new Map<string,string>();
  // Do not infer a subject from the author metadata, letterhead or signature block.
  // A roster / report can mention people without being issued in their name.
  if (!/^(?:Undangan|Daftar Hadir|Kartu Keluarga|Berita Acara)$/.test(title) && (title || !heading)) {
    for (const line of lines) {
      if (/^(?:yang bertanda tangan|ditandatangani|mengetahui|disahkan oleh|hormat kami|kepala dinas\b)/i.test(line) && people.size) break;
      const match = label.exec(line) ?? /^(?:diberikan|dianugerahkan|diserahkan)\s+kepada\s*[:：]?\s+(.+)$/i.exec(line);
      if (!match) continue;
      const value = match[1].split(/\s{2,}|\s+(?:NIP|NIK|Jabatan)\s*[:：]/i)[0].trim();
      if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’,-]{1,54}$/u.test(value) || /^(?:pemerintah|dinas|kabupaten|kecamatan|pt |cv |tim |kelompok|sekolah|bupati|kepala |ketua |sekretaris )/i.test(value)) continue;
      const person = titleCase(short(value, 54));
      if (person) people.set(person.toLocaleLowerCase("id-ID"), person);
    }
  }
  return { title: title || titleCase(short(heading ?? "", 54)), person: people.size === 1 ? [...people.values()][0] : "", ambiguous: people.size > 1 };
}

function ranges(value: string, count: number) {
  const parts = value.trim().split(";");
  if (value.length > 160 || parts.length > 8) throw new PdfToolError("Maksimal 8 bagian per proses.");
  const used = new Set<number>();
  return parts.map(part => {
    const match = /^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/.exec(part.trim());
    if (!match) throw new PdfToolError("Gunakan rentang halaman seperti 1-3; 4-6; 8.");
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > count) throw new PdfToolError(`Rentang harus antara halaman 1 dan ${count}.`);
    for (let p = first; p <= last; p++) {
      if (used.has(p)) throw new PdfToolError(`Halaman ${p} dipilih lebih dari sekali.`);
      used.add(p);
    }
    return { first, last, count: last - first + 1, range: first === last ? `${first}` : `${first}-${last}` };
  });
}

export async function processPdf(operation: PdfTool["operation"], files: File[], options: { ranges?: string; profile?: string; signal?: AbortSignal } = {}): Promise<Result[]> {
  if (operation === "merge" && (files.length < 2 || files.length > PDF_TOOLS_MAX_FILES)) throw new PdfToolError("Gabungkan minimal 2 dan maksimal 8 PDF.");
  if (operation !== "merge" && files.length !== 1) throw new PdfToolError("Pilih satu berkas PDF.");
  if (files.some(file => file.size === 0)) throw new PdfToolError("Salah satu PDF kosong.");
  if (files.reduce((sum, file) => sum + file.size, 0) > PDF_TOOLS_MAX_BYTES) throw new PdfToolError("Total ukuran PDF maksimal 20 MB.", 413);
  const profile = options.profile ?? "balanced";
  if (profile !== "balanced" && profile !== "small") throw new PdfToolError("Tingkat kompresi tidak valid.");
  const signal = AbortSignal.any([AbortSignal.timeout(65_000), ...(options.signal ? [options.signal] : [])]);
  const dir = await mkdtemp(join(tmpdir(), "dkpp-pdf-"));
  const run = async (program: string, args: string[], timeout = 10_000) => {
    signal.throwIfAborted();
    const result = await exec("/usr/bin/prlimit", ["--as=536870912", "--fsize=33554432", "--cpu=30", "--", `/usr/bin/${program}`, ...args], {
      cwd: dir, env: { NODE_ENV: "production", PATH: "/usr/bin:/bin", LANG: "C.UTF-8", TMPDIR: dir, HOME: dir, OMP_THREAD_LIMIT: "1" },
      encoding: "utf8", maxBuffer: 3 * 1024 * 1024, signal, timeout, killSignal: "SIGKILL",
    });
    return result.stdout;
  };
  const inspect = async (path: string) => {
    try {
      const raw = await run("qpdf", ["--json", "--json-key=encrypt", "--json-key=qpdf", "--json-stream-data=none", path]);
      if (JSON.parse(raw).encrypt?.encrypted) throw new PdfToolError("PDF dengan sandi atau enkripsi tidak didukung.");
      if (/"\/(?:ByteRange|DocMDP|Sig|DocTimeStamp)"/.test(raw)) throw new PdfToolError("PDF berisi tanda tangan digital atau kolom TTE dan tidak dapat diolah.");
      if (/"\/(?:JavaScript|Launch|RichMedia|EmbeddedFile|XFA|SubmitForm|ImportData)"/.test(raw)) throw new PdfToolError("PDF dengan aksi aktif, formulir XFA, atau berkas tersemat tidak didukung.");
      return Number((await run("qpdf", ["--show-npages", path])).trim());
    } catch (error) {
      if (error instanceof PdfToolError || signal.aborted) throw error;
      if ((error as { stderr?: string }).stderr?.includes("invalid password")) throw new PdfToolError("PDF dengan sandi atau enkripsi tidak didukung.");
      throw new PdfToolError("PDF tidak dapat dibaca, rusak, atau terlalu kompleks.", 422);
    }
  };
  const extract = async (path: string, first: number, last: number) => {
    let text = "";
    try {
      text = await run("pdftotext", ["-f", `${first}`, "-l", `${last}`, "-layout", path, "-"], 3_000);
      if (text.replace(/[^\p{L}]/gu, "").length < 16) {
        await run("pdftoppm", ["-f", `${first}`, "-l", `${first}`, "-scale-to", "1900", "-singlefile", "-png", path, "ocr"], 4_000);
        text = await run("tesseract", ["ocr.png", "stdout", "-l", "ind+eng", "--psm", "6"], 6_000);
      }
    } catch { signal.throwIfAborted(); /* The result can still be named manually. */ }
    return describe(text);
  };
  const nameFor = (title: string, person: string, suffix = "") => `${title}${person ? ` - ${person}` : ""}${suffix}.pdf`;
  let produced = 0;
  const output = async (path: string, pages: number, name: string, originalSize?: number) => {
    const size = (await stat(path)).size;
    produced += size;
    if (produced > MAX_OUTPUT) throw new PdfToolError("Hasil melebihi 32 MB. Kurangi jumlah halaman atau dokumen.", 413);
    if (Number((await run("qpdf", ["--show-npages", path])).trim()) !== pages) throw new PdfToolError("Jumlah halaman hasil tidak sesuai.", 422);
    return { name, bytes: await readFile(path), pages, originalSize };
  };
  try {
    const sources = [];
    let totalPages = 0;
    for (const [i, file] of files.entries()) {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!bytes.subarray(0, 8).toString("ascii").startsWith("%PDF-")) throw new PdfToolError("Pilih berkas PDF yang valid.");
      const path = `input-${i}.pdf`;
      await writeFile(join(dir, path), bytes, {mode: 0o600});
      const pages = await inspect(path);
      if (!Number.isSafeInteger(pages) || pages < 1) throw new PdfToolError("PDF tidak memiliki halaman yang valid.");
      totalPages += pages;
      if (totalPages > MAX_PAGES) throw new PdfToolError("Total maksimal 150 halaman per proses.", 413);
      sources.push({ path, pages, size: file.size });
    }
    const source = sources[0];
    if (operation === "merge") {
      const descriptors = [];
      for (const item of sources) descriptors.push(await extract(item.path, 1, Math.min(item.pages, 2)));
      const titles = [...new Set(descriptors.map(item => item.title).filter(Boolean))];
      const identified = descriptors[0].person;
      const person = identified && descriptors.every(item => item.person.toLowerCase() === identified.toLowerCase()) ? identified : "";
      const title = titles.length === 1 ? titles[0] : titles.length === 2 ? short(titles.join(" dan "), 64) : "Gabungan Dokumen";
      await run("qpdf", ["--empty", "--pages", ...sources.flatMap(item => [item.path, "1-z"]), "--", "merged.pdf"], 20_000);
      return [await output(join(dir, "merged.pdf"), totalPages, nameFor(title, person))];
    }
    const selection = operation === "split" ? ranges(options.ranges ?? "", source.pages) : [];
    const descriptor = await extract(source.path, 1, Math.min(source.pages, 2));
    if (operation === "split") {
      const results = [];
      for (const [i, part] of selection.entries()) {
        const detail = part.first === 1 && part.last > 1 ? descriptor : await extract(source.path, part.first, Math.min(part.last, part.first + 1));
        const sameDocument = !detail.title || detail.title === descriptor.title;
        const person = detail.person || (sameDocument && !detail.ambiguous ? descriptor.person : "");
        const path = `part-${i}.pdf`;
        await run("qpdf", ["--empty", "--pages", source.path, part.range, "--", path]);
        results.push(await output(join(dir,path), part.count, nameFor(detail.title || descriptor.title || "Dokumen", person, ` - Hal ${part.range}`)));
      }
      return results;
    }
    await run("gs", ["-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dPDFSTOPONERROR", "-sDEVICE=pdfwrite", `-dPDFSETTINGS=/${profile === "small" ? "screen" : "ebook"}`, "-dAutoRotatePages=/None", "-sOutputFile=compressed.pdf", "-f", source.path], 30_000);
    const compressed = join(dir, "compressed.pdf");
    return [await output((await stat(compressed)).size < source.size ? compressed : join(dir,source.path), source.pages, nameFor(descriptor.title || "Dokumen", descriptor.person), source.size)];
  } catch (error) {
    if (error instanceof PdfToolError) throw error;
    if (signal.aborted || (error as { killed?: boolean }).killed) throw new PdfToolError("Waktu pemrosesan habis. Coba dengan PDF lebih kecil.", 422);
    throw new PdfToolError("PDF gagal diproses. Periksa kondisi dan ukuran berkas.", 422);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}
