import "server-only";

import { cache } from "react";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

export type OrganizationUnit = {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  positionCount: number;
  employeeCount: number;
};

export const getOrganizationUnits = cache(async (): Promise<OrganizationUnit[]> => {
  await requireUser();
  return await db.prepare(`SELECT unit.id, unit.name, unit.parent_id AS parentId,
    parent.name AS parentName,
    (SELECT COUNT(*) FROM job_positions position WHERE position.organization_unit_id = unit.id) AS positionCount,
    (SELECT COUNT(*) FROM employees employee
      JOIN job_positions position ON position.id = employee.job_position_id
      WHERE position.organization_unit_id = unit.id) AS employeeCount
    FROM organization_units unit
    LEFT JOIN organization_units parent ON parent.id = unit.parent_id
    ORDER BY unit.name COLLATE NOCASE`).all() as OrganizationUnit[];
});
