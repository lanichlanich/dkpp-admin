import "server-only";

import { cache } from "react";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

export type JobPosition = {
  id: string;
  name: string;
  unit: string;
  positionType: string;
  echelon: string;
  parentId: string | null;
  parentName: string | null;
  employeeCount: number;
  activeEmployeeCount: number;
};

export const getJobPositions = cache(async (): Promise<JobPosition[]> => {
  await requireUser();
  return await db.prepare(`SELECT jp.id, jp.name, jp.unit, jp.position_type AS positionType,
    jp.echelon, jp.parent_id AS parentId, parent.name AS parentName,
    (SELECT COUNT(*) FROM employees e WHERE e.job_position_id = jp.id) AS employeeCount,
    (SELECT COUNT(*) FROM employees e WHERE e.job_position_id = jp.id AND e.status = 'Aktif') AS activeEmployeeCount
    FROM job_positions jp LEFT JOIN job_positions parent ON parent.id = jp.parent_id
    ORDER BY jp.name COLLATE NOCASE, jp.unit COLLATE NOCASE`).all() as JobPosition[];
});
