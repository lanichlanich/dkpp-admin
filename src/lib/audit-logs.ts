import "server-only";

import { database as db } from "@/lib/database";

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  actorName: string;
  actorUsername: string;
  action: string;
  entity: string;
  route: string | null;
  ipAddress: string | null;
  osName: string;
  browserName: string;
  deviceType: string;
  requestId: string | null;
  countryCode: string | null;
  timezone: string | null;
  changedFields: string[];
  affectedRows: number;
  operationCount: number;
};

function parseFields(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function listAuditLogs(offset = 0, limit = 100) {
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const rows = await db.prepare(`SELECT id, created_at, actor_name, actor_username, action, entity,
    route, ip_address, os_name, browser_name, device_type, request_id, country_code, timezone,
    changed_fields, affected_rows, operation_count
    FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(safeLimit + 1, safeOffset) as Array<{
      id: string; created_at: string; actor_name: string; actor_username: string; action: string; entity: string;
      route: string | null; ip_address: string | null; os_name: string; browser_name: string; device_type: string;
      request_id: string | null; country_code: string | null; timezone: string | null;
      changed_fields: string | string[]; affected_rows: number; operation_count: number;
    }>;
  const hasMore = rows.length > safeLimit;
  return {
    logs: rows.slice(0, safeLimit).map((row): AuditLogEntry => ({
      id: row.id, createdAt: row.created_at, actorName: row.actor_name, actorUsername: row.actor_username,
      action: row.action, entity: row.entity, route: row.route, ipAddress: row.ip_address,
      osName: row.os_name, browserName: row.browser_name, deviceType: row.device_type,
      requestId: row.request_id, countryCode: row.country_code, timezone: row.timezone,
      changedFields: parseFields(row.changed_fields), affectedRows: row.affected_rows, operationCount: row.operation_count,
    })),
    hasMore,
    nextOffset: safeOffset + safeLimit,
  };
}
