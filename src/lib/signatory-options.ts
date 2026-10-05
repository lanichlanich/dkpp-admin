import "server-only";
import { cache } from "react";
import { database } from "@/lib/database";
import { DEFAULT_SIGNATORY, signatoryRank, type SignatoryOption } from "@/lib/signatory";

export const getSignatoryOptions = cache(async (): Promise<SignatoryOption[]> => {
  const employees = await database.prepare("SELECT nip, name, rank, position FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE")
    .all<{ nip: string; name: string; rank: string; position: string }>();
  const current = employees.find((employee) => /RORY\s+FIRMANSYAH/i.test(employee.name));
  const primary: SignatoryOption = { ...DEFAULT_SIGNATORY, ...(current ? { nip: current.nip, rank: signatoryRank(current.rank).full } : {}), id: "current-head" };
  return [primary, ...employees.filter((employee) => employee.nip !== current?.nip && employee.nip !== "196609231987091001")
    .map((employee): SignatoryOption => ({ id: employee.nip, name: employee.name, nip: employee.nip, rank: signatoryRank(employee.rank).full, title: employee.position, status: "definitif" }))];
});
