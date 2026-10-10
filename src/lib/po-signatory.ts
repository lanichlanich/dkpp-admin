import type { KakDraft } from "@/lib/kak-types";
import type { KakOptions } from "@/lib/kak-validation";
import { signatoryRank, type Signatory, type SignatoryOption } from "@/lib/signatory";

export function resolvePoSignatory(metadata: KakDraft["metadata"], options: KakOptions, employees: readonly SignatoryOption[]): Signatory {
  const chosen = options.signatory;
  const nip = chosen?.nip ?? metadata.penandatanganNip;
  const name = chosen?.name ?? metadata.penandatanganNama;
  const title = chosen?.title ?? metadata.penandatanganJabatan;
  const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleUpperCase("id-ID");
  // A supplied NIP must match exactly; name matching is only for sources without a NIP.
  const matches = employees.filter((employee) => nip ? employee.nip === nip : name && normalizeName(employee.name) === normalizeName(name));
  const employee = matches.length === 1 ? matches[0] : undefined;
  return {
    name, nip,
    rank: signatoryRank(employee?.rank || (chosen ? chosen.rank : metadata.penandatanganPangkat) || "").name.trim(),
    title: title.replace(/\bKepala\b/gi, "KEPALA"),
    status: chosen?.status ?? (/^\s*Plt\.?\s/i.test(title) ? "plt" : "definitif"),
  };
}
