import "server-only";
import { cache } from "react";
import { database } from "@/lib/database";
import { requireMenuAccess } from "@/lib/authorization";
import type { StaffProfileInput } from "@/lib/staff-profile";

// This menu has its own authorization. Do not depend on access to other menus.
export const getStaffProfileData = cache(async (): Promise<StaffProfileInput> => {
  await requireMenuAccess("profil-kepegawaian");
  const [employees, units, documents, kgb, acting] = await Promise.all([
    database.prepare(`SELECT e.nip, e.name, e.position, e.position_type AS positionType,
      e.echelon, COALESCE(NULLIF(ou.name, ''), NULLIF(jp.unit, ''), e.unit) AS unit,
      e.asn_type AS asnType, e.rank, e.status, e.gender,
      jp.organization_unit_id AS organizationUnitId
      FROM employees e LEFT JOIN job_positions jp ON jp.id = e.job_position_id
      LEFT JOIN organization_units ou ON ou.id = jp.organization_unit_id
      ORDER BY e.name COLLATE NOCASE`).all<StaffProfileInput["employees"][number]>(),
    database.prepare("SELECT id, name, parent_id AS parentId FROM organization_units ORDER BY name COLLATE NOCASE")
      .all<StaffProfileInput["units"][number]>(),
    database.prepare(`SELECT d.employee_nip AS nip, d.document_type AS type, COUNT(*) AS count
      FROM employee_documents d INNER JOIN employees e ON e.nip = d.employee_nip
      WHERE e.status = 'Aktif' GROUP BY d.employee_nip, d.document_type`).all<StaffProfileInput["documents"][number]>(),
    database.prepare(`SELECT s.employee_nip AS nip, CAST(MAX(s.tmt_kgb) AS TEXT) AS tmt, COUNT(*) AS count
      FROM kgb_signed_documents s INNER JOIN employees e ON e.nip = s.employee_nip
      WHERE e.status = 'Aktif' GROUP BY s.employee_nip`).all<StaffProfileInput["kgb"][number]>(),
    database.prepare(`SELECT CAST(p.start_date AS TEXT) AS startDate, CAST(p.end_date AS TEXT) AS endDate, p.closed_at AS closedAt,
      (SELECT CAST(MIN(n.start_date) AS TEXT) FROM plt_assignments n WHERE n.previous_id = p.id) AS nextStartDate
      FROM plt_assignments p`).all<StaffProfileInput["acting"][number]>(),
  ]);
  return { employees, units, documents, kgb, acting };
});
