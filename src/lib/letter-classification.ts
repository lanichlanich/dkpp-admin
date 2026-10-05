import catalog from "@/data/letter-classifications.json";

export type LetterClassification = { code: string; label: string; page: number; group: string; path: string };
export const classificationSource = { ...catalog.source, url: "/references/kode-klasifikasi-arsip-indramayu.pdf" };
const labels = new Map(catalog.entries.map((entry) => [entry.code, entry.label]));

function groupOf(code: string) { return code.startsWith("00.") ? "000" : code.split(".")[0]; }
function pathOf(code: string) {
  const parts = code.split(".");
  const parents: string[] = [];
  const group = groupOf(code);
  if (code !== group && labels.has(group)) parents.push(labels.get(group)!);
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(0, i).join(".");
    if (parent !== group && labels.has(parent)) parents.push(labels.get(parent)!);
  }
  return parents.join(" › ");
}

export const letterClassifications: LetterClassification[] = catalog.entries.map((entry) => ({
  ...entry, group: groupOf(entry.code), path: pathOf(entry.code),
}));
export const classificationGroups = letterClassifications.filter((entry) => !entry.code.includes("."));
const byCode = new Map(letterClassifications.map((entry) => [entry.code, entry]));
export function getLetterClassification(code: string) { return byCode.get(code); }
export function splitLetterNumber(value: string) {
  const slash = value.indexOf("/");
  if (slash < 0) return { code: "", body: value };
  const prefix = value.slice(0, slash).trim();
  return { code: prefix, body: value.slice(slash + 1) };
}
export function composeLetterNumber(code: string, body: string) { return code ? `${code}/${body}` : body; }

const normalized = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("id-ID");
const searchIndex = letterClassifications.map((entry) => ({ entry, text: normalized(`${entry.code} ${entry.label} ${entry.path}`) }));
export function searchLetterClassifications(query: string, group = "") {
  const words = normalized(query).trim().split(/\s+/).filter(Boolean);
  return searchIndex.filter(({ entry, text }) => (!group || entry.group === group) && words.every((word) => text.includes(word)))
    .map(({ entry }) => entry)
    .sort((a, b) => Number(b.code === query.trim()) - Number(a.code === query.trim()));
}

// Suggestions reflect the subject of each template; users can review the source and select another code.
export const letterClassificationDefaults = {
  wfh: "800.1.11.1", kgb: "800.1.11.13", pak: "800.1.4.5",
  kerjaku: "800.1.5.2", hukdis: "800.1.6.2", hukda: "800.1.6",
} as const;

export function suggestPengantarClassification(subject: string) {
  if (/pensiun|dpcp/i.test(subject)) return "800.1.6.6";
  if (/gaji berkala|\bkgb\b/i.test(subject)) return "800.1.11.13";
  if (/angka kredit|\bpak\b|\bdupak\b/i.test(subject)) return "800.1.4.5";
  if (/kenaikan pangkat/i.test(subject)) return "800.1.3.2";
  if (/disiplin|hukdis/i.test(subject)) return "800.1.6.2";
  if (/kerjaku|aplikasi kinerja/i.test(subject)) return "800.1.5.2";
  if (/\bwfh\b|surat tugas/i.test(subject)) return "800.1.11.1";
  return "";
}

export function displayKgbLetterNumber(value: string) {
  return /^\d+$/.test(value) ? `800.1.11.13/${value}-Sekre` : value;
}
