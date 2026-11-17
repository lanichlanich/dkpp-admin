import { getBirthDateIsoFromNip, getRetirementAge, getRetirementTmt } from "@/lib/retirement-age";

export const POSITION_KINDS = ["Fungsional", "Pelaksana", "Struktural"] as const;
export type PositionKind = typeof POSITION_KINDS[number];
export type PositionRequirement = {
  id: string; sourceRow: string; page: number; name: string; unit: string;
  kind: string; echelon: string; required: number;
};
export type ProjectionEmployee = {
  nip: string; name: string; position: string; positionType: string; echelon: string;
  unit: string; asnType: string; rank: string; status: string;
};
export type ProjectionFilters = { startYear: number; kind: string; unit: string; asn: string; search: string };
export type ProjectedEmployee = ProjectionEmployee & {
  kind: string; requirementId: string | null; mappedUnit: string;
  birthDate: string | null; retirementAge: number | null; retirementTmt: string | null; issues: string[];
};
export type ProjectionRow = PositionRequirement & {
  active: number; retirements: number[]; totalRetirements: number; remaining: number[];
  shortage: number[]; surplus: number[]; beforePeriod: number; employees: ProjectedEmployee[];
};

export function normalizePosition(value: string) {
  let name = value.toUpperCase().trim().replace(/^JF\s+/, "").replace(/\bTU\b/g, "TATA USAHA");
  name = name.replace(/\s*\(ALSINTAN\)/g, "").replace(/ALAT DAN MESIN PERTANIAN/g, "ALAT MESIN PERTANIAN");
  if (name.startsWith("SEKRETARIS DINAS ")) name = "SEKRETARIS DINAS";
  name = name.replace(/^(AHLI (?:PERTAMA|MUDA|MADYA|UTAMA)|TERAMPIL|MAHIR|PENYELIA|PEMULA)\s*-\s*(.+)$/, "$2 $1");
  if (name.startsWith("KEPALA SUB BAGIAN TATA USAHA UPTD ")) name = "KEPALA SUB BAGIAN TATA USAHA";
  return name.replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function normalizeProjectionUnit(value: string) {
  return value.toUpperCase().replace(/\bTU\b/g, "TATA USAHA").replace(/\s*\(ALSINTAN\)/g, "")
    .replace(/ALAT DAN MESIN PERTANIAN/g, "ALAT MESIN PERTANIAN").replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function projectionKind(value: string) {
  const type = value.trim().toUpperCase();
  if (["JF", "FUNGSIONAL", "JABATAN FUNGSIONAL"].includes(type)) return "Fungsional";
  if (["JS", "STRUKTURAL", "JABATAN STRUKTURAL", "JPT", "PIMPINAN TINGGI", "JABATAN PIMPINAN TINGGI"].includes(type)) return "Struktural";
  if (["JFU", "PELAKSANA", "ADMINISTRASI", "JABATAN ADMINISTRASI"].includes(type)) return "Pelaksana";
  return "Belum diketahui";
}

export function buildRetirementProjection(requirements: PositionRequirement[], input: ProjectionEmployee[], filters: ProjectionFilters, today: string) {
  const years = Array.from({ length: 5 }, (_, i) => filters.startYear + i);
  const start = `${years[0]}-01-01`, end = `${years[4]}-12-31`;
  const index = new Map<string, PositionRequirement[]>();
  const nameKinds = new Map<string, Set<string>>();
  for (const row of requirements) {
    const name = normalizePosition(row.name), key = `${name}|${normalizeProjectionUnit(row.unit)}`;
    index.set(key, [...(index.get(key) ?? []), row]);
    nameKinds.set(name, new Set([...(nameKinds.get(name) ?? []), row.kind]));
  }
  const employees: ProjectedEmployee[] = input.filter(e => e.status === "Aktif").map(employee => {
    const name = normalizePosition(employee.position);
    const matches = index.get(`${name}|${normalizeProjectionUnit(employee.unit)}`) ?? [];
    const mapped = matches.length === 1 ? matches[0] : null;
    const knownKinds = nameKinds.get(name);
    const kind = mapped?.kind ?? (knownKinds?.size === 1 ? [...knownKinds][0] : projectionKind(employee.positionType));
    const issues: string[] = [];
    if (!mapped) issues.push(matches.length > 1 ? "Pemetaan jabatan dan unit ambigu" : "Jabatan/unit belum cocok dengan peta jabatan");
    if (projectionKind(employee.positionType) !== kind) issues.push("Jenis jabatan data pegawai berbeda; proyeksi mengikuti peta jabatan");
    const retirementAge = getRetirementAge({ position: normalizePosition(employee.position), positionType: kind,
      echelon: mapped?.kind === "Struktural" ? mapped.echelon : employee.echelon });
    const birthDate = /^\d{18}$/.test(employee.nip) ? getBirthDateIsoFromNip(employee.nip) : null;
    const retirementTmt = birthDate ? getRetirementTmt(employee.nip, retirementAge) : null;
    if (!birthDate) issues.push("NIP/tanggal lahir tidak valid");
    if (retirementAge === null) issues.push("BUP belum dapat ditentukan");
    if (retirementTmt && retirementTmt < today) issues.push("TMT pensiun sudah lewat, status pegawai masih aktif");
    return { ...employee, kind, requirementId: mapped?.id ?? null, mappedUnit: mapped?.unit ?? employee.unit,
      birthDate, retirementAge, retirementTmt, issues };
  });
  const search = filters.search.trim().toLocaleLowerCase("id-ID");
  const matchesKind = (kind: string) => filters.kind === "all" || filters.kind === kind;
  const matchesUnit = (unit: string) => !filters.unit || normalizeProjectionUnit(unit) === normalizeProjectionUnit(filters.unit);
  const matchesEmployee = (e: ProjectedEmployee) => matchesKind(e.kind) && matchesUnit(e.mappedUnit)
    && (filters.asn === "all" || e.asnType === filters.asn);
  const scoped = employees.filter(matchesEmployee);
  const rows: ProjectionRow[] = requirements.filter(row => matchesKind(row.kind) && matchesUnit(row.unit)).map(row => {
    const members = scoped.filter(e => e.requirementId === row.id);
    const retirements = years.map(year => members.filter(e => e.retirementTmt?.startsWith(`${year}-`)).length);
    const remaining = years.map(year => members.filter(e => !e.retirementTmt || e.retirementTmt > `${year}-12-31`).length);
    return { ...row, active: members.length, retirements, remaining,
      shortage: remaining.map(count => Math.max(0, row.required - count)),
      surplus: remaining.map(count => Math.max(0, count - row.required)),
      totalRetirements: retirements.reduce((a, b) => a + b, 0),
      beforePeriod: members.filter(e => e.retirementTmt && e.retirementTmt < start).length, employees: members };
  }).filter(row => !search || `${row.name} ${row.unit} ${row.kind}`.toLocaleLowerCase("id-ID").includes(search)
    || row.employees.some(e => `${e.name} ${e.nip}`.toLocaleLowerCase("id-ID").includes(search)));
  const included = new Set(rows.map(row => row.id));
  const selectedEmployees = scoped.filter(e => e.requirementId ? included.has(e.requirementId)
    : !search || `${e.name} ${e.nip} ${e.position} ${e.unit}`.toLocaleLowerCase("id-ID").includes(search));
  const retirees = selectedEmployees.filter(e => e.retirementTmt && e.retirementTmt >= start && e.retirementTmt <= end)
    .sort((a, b) => a.retirementTmt!.localeCompare(b.retirementTmt!) || a.name.localeCompare(b.name, "id"));
  const review = selectedEmployees.filter(e => e.issues.length > 0);
  const summaries = POSITION_KINDS.map(kind => {
    const group = rows.filter(row => row.kind === kind), members = selectedEmployees.filter(e => e.kind === kind);
    return { kind, required: group.reduce((a, row) => a + row.required, 0), active: members.length,
      mappedActive: group.reduce((a, row) => a + row.active, 0),
      retirements: years.map(year => retirees.filter(e => e.kind === kind && e.retirementTmt?.startsWith(`${year}-`)).length),
      remaining: years.map((_, i) => group.reduce((n, row) => n + row.remaining[i], 0)),
      shortage: years.map((_, i) => group.reduce((a, row) => a + row.shortage[i], 0)),
      surplus: years.map((_, i) => group.reduce((a, row) => a + row.surplus[i], 0)) };
  });
  return { today, filters, years, rows, employees: selectedEmployees, retirees, review, summaries,
    required: rows.reduce((a, row) => a + row.required, 0),
    mappedActive: rows.reduce((a, row) => a + row.active, 0),
    beforePeriod: selectedEmployees.filter(e => e.retirementTmt && e.retirementTmt < start).length,
    unmapped: selectedEmployees.filter(e => !e.requirementId).length,
    unknownDates: selectedEmployees.filter(e => !e.retirementTmt).length };
}
export type RetirementProjection = ReturnType<typeof buildRetirementProjection>;
