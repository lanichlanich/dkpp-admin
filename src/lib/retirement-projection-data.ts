import "server-only";
import { cache } from "react";
import { database } from "@/lib/database";
import { requireMenuAccess } from "@/lib/authorization";
import type { ProjectionEmployee } from "@/lib/retirement-projection";

export const getProjectionEmployees = cache(async (): Promise<ProjectionEmployee[]> => {
  await requireMenuAccess("proyeksi-pensiun");
  return database.prepare(`SELECT e.nip, e.name, e.position, e.position_type AS positionType,
    e.echelon, COALESCE(NULLIF(ou.name, ''), NULLIF(jp.unit, ''), e.unit) AS unit,
    e.asn_type AS asnType, e.rank, e.status
    FROM employees e LEFT JOIN job_positions jp ON jp.id = e.job_position_id
    LEFT JOIN organization_units ou ON ou.id = jp.organization_unit_id
    WHERE e.status = 'Aktif' ORDER BY e.name COLLATE NOCASE`).all<ProjectionEmployee>();
});
