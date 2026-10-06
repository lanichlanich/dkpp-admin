import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { Pool, types, type PoolClient } from "pg";

const TABLES = new Set([
  "users",
  "sessions",
  "employees",
  "notifications",
  "kgb_documents",
  "dpcp_documents",
  "pak_documents",
  "wfh_documents",
  "surat_pengantar_documents",
  "surat_lupa_absen_documents",
  "kerjaku_request_documents",
  "official_statement_documents",
  "service_archive_documents",
  "employee_documents",
  "hukdis_records",
  "wfh_reports",
  "wfh_schedule_months",
  "wfh_schedule_entries",
  "audit_logs",
]);

const AUDITED_TABLES = new Set([...TABLES].filter((table) => ![
  "sessions", "notifications", "audit_logs",
].includes(table)));

type QueryValue = string | number | boolean | null | Buffer;

export type RunResult = { changes: number };

type PreparedQuery = {
  get<T = Record<string, unknown>>(...values: QueryValue[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(...values: QueryValue[]): Promise<T[]>;
  run(...values: QueryValue[]): Promise<RunResult>;
};

type DatabaseAdapter = {
  prepare(sql: string): PreparedQuery;
  transaction(statements: Array<{ sql: string; values: QueryValue[] }>): Promise<void>;
};

type AuditOperation = {
  action: "INSERT" | "UPDATE" | "DELETE";
  entity: string;
  changedFields: string[];
  affectedRows: number;
};

type AuditRequest = {
  sessionToken: string | null;
  ipAddress: string | null;
  osName: string;
  browserName: string;
  deviceType: string;
  userAgent: string;
  route: string | null;
  requestId: string | null;
  countryCode: string | null;
  timezone: string | null;
};

type AuditActor = { id: string; name: string; username: string } | null;

const connectionString = process.env.POSTGRES_URL?.trim();

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);
types.setTypeParser(1184, (value) => value);

const globalForDatabase = globalThis as unknown as {
  adminflowPostgresPool?: Pool;
};

function qualifyTables(sql: string) {
  return sql
    .replace(/\s+COLLATE\s+NOCASE\b/gi, "")
    .replace(
      /\b(FROM|JOIN|UPDATE|INTO)\s+([a-z_][a-z0-9_]*)\b/gi,
      (match, keyword: string, table: string) =>
        TABLES.has(table.toLowerCase())
          ? `${keyword} adminflow.${table}`
          : match,
    );
}

function postgresPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function resultAliases(sql: string) {
  const aliases = new Map<string, string>();
  for (const match of sql.matchAll(/\bAS\s+([a-z_][a-z0-9_]*)\b/gi)) {
    const alias = match[1];
    aliases.set(alias.toLowerCase(), alias);
  }
  return aliases;
}

function restoreAliases<T>(row: T, aliases: Map<string, string>) {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  for (const [postgresKey, alias] of aliases) {
    if (postgresKey !== alias && postgresKey in record) {
      record[alias] = record[postgresKey];
      delete record[postgresKey];
    }
  }
  return row;
}

function parseMutation(sql: string): Omit<AuditOperation, "affectedRows"> | null {
  const match = /^\s*(INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:(?:adminflow|public)\.)?["`]?([a-z_][a-z0-9_]*)/i.exec(sql);
  if (!match) return null;
  const table = match[2].toLowerCase();
  if (!AUDITED_TABLES.has(table)) return null;
  const prefix = match[1].toUpperCase();
  const action = prefix.startsWith("INSERT") || prefix.startsWith("REPLACE")
    ? "INSERT"
    : prefix === "UPDATE" ? "UPDATE" : "DELETE";
  let changedFields: string[] = [];
  if (action === "INSERT") {
    const columns = /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO)\s+(?:(?:adminflow|public)\.)?["`]?[a-z_][a-z0-9_]*["`]??\s*\(([^)]+)\)/i.exec(sql)?.[1];
    if (columns) changedFields = columns.split(",").map((column) => column.trim().replace(/["`]/g, ""));
  } else if (action === "UPDATE") {
    const setClause = /\bSET\s+([\s\S]*?)(?:\bWHERE\b|$)/i.exec(sql)?.[1] ?? "";
    changedFields = [...setClause.matchAll(/(?:^|,)\s*["`]?([a-z_][a-z0-9_]*)["`]?\s*=/gi)].map((item) => item[1]);
  }
  return { action, entity: table, changedFields: [...new Set(changedFields)].sort() };
}

function parseUserAgent(userAgent: string) {
  const osName = /Windows NT/i.test(userAgent) ? "Windows"
    : /Android/i.test(userAgent) ? "Android"
      : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS"
        : /Mac OS X|Macintosh/i.test(userAgent) ? "macOS"
          : /Linux/i.test(userAgent) ? "Linux" : "Tidak diketahui";
  const browserName = /Edg\//i.test(userAgent) ? "Microsoft Edge"
    : /OPR\//i.test(userAgent) ? "Opera"
      : /Firefox\//i.test(userAgent) ? "Firefox"
        : /Chrome\//i.test(userAgent) ? "Chrome"
          : /Safari\//i.test(userAgent) ? "Safari" : "Tidak diketahui";
  const deviceType = /iPad|Tablet/i.test(userAgent) ? "Tablet"
    : /Mobile|Android|iPhone|iPod/i.test(userAgent) ? "Ponsel" : "Desktop";
  return { osName, browserName, deviceType };
}

async function getAuditRequest(): Promise<AuditRequest | null> {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie") ?? "";
    const tokenValue = /(?:^|;\s*)admin_session=([^;]+)/.exec(cookie)?.[1];
    let sessionToken: string | null = null;
    if (tokenValue) {
      try { sessionToken = decodeURIComponent(tokenValue); }
      catch { sessionToken = tokenValue; }
    }
    const userAgent = (requestHeaders.get("user-agent") ?? "").slice(0, 1000);
    const parsedAgent = parseUserAgent(userAgent);
    const host = requestHeaders.get("host");
    const referer = requestHeaders.get("referer");
    let route: string | null = null;
    if (referer && host) {
      try {
        const source = new URL(referer);
        if (source.host === host) route = source.pathname.slice(0, 300);
      } catch { /* Ignore invalid or cross-origin referrers. */ }
    }
    const platformRequest = Boolean(requestHeaders.get("x-vercel-id"));
    const forwardedIp = platformRequest ? requestHeaders.get("x-forwarded-for")?.trim() : null;
    const ipAddress = forwardedIp && isIP(forwardedIp) ? forwardedIp : null;
    return {
      sessionToken, ipAddress, ...parsedAgent, userAgent,
      route,
      requestId: (requestHeaders.get("x-vercel-id") ?? requestHeaders.get("x-request-id") ?? "").slice(0, 200) || null,
      countryCode: (requestHeaders.get("x-vercel-ip-country") ?? "").slice(0, 2) || null,
      timezone: (requestHeaders.get("x-vercel-ip-timezone") ?? "").slice(0, 80) || null,
    };
  } catch {
    return null;
  }
}

function summarizeOperations(operations: AuditOperation[]) {
  const grouped = new Map<string, { action: string; entity: string; changedFields: Set<string>; affectedRows: number; statements: number }>();
  for (const operation of operations) {
    const key = `${operation.action}:${operation.entity}`;
    const group = grouped.get(key) ?? {
      action: operation.action, entity: operation.entity, changedFields: new Set<string>(), affectedRows: 0, statements: 0,
    };
    for (const field of operation.changedFields) group.changedFields.add(field);
    group.affectedRows += operation.affectedRows;
    group.statements += 1;
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => ({
    action: group.action,
    entity: group.entity,
    changedFields: [...group.changedFields].sort(),
    affectedRows: group.affectedRows,
    statements: group.statements,
  }));
}

async function getPostgresActor(client: PoolClient, request: AuditRequest): Promise<AuditActor> {
  if (!request.sessionToken) return null;
  const tokenHash = createHash("sha256").update(request.sessionToken).digest("hex");
  const result = await client.query<{ id: string; name: string; username: string }>(
    `SELECT u.id, u.name, u.username FROM adminflow.sessions AS s
     JOIN adminflow.users AS u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2 LIMIT 1`,
    [tokenHash, new Date().toISOString()],
  );
  return result.rows[0] ?? null;
}

async function writePostgresAudit(client: PoolClient, request: AuditRequest, actor: AuditActor, operations: AuditOperation[]) {
  const groups = summarizeOperations(operations);
  if (!groups.length) return;
  const actions = [...new Set(groups.map((group) => group.action))];
  const entities = [...new Set(groups.map((group) => group.entity))];
  const changedFields = [...new Set(groups.flatMap((group) => group.changedFields))].sort();
  const affectedRows = groups.reduce((total, group) => total + group.affectedRows, 0);
  await client.query(`INSERT INTO adminflow.audit_logs (
    id, user_id, actor_name, actor_username, action, entity, route, ip_address,
    os_name, browser_name, device_type, user_agent, request_id, country_code,
    timezone, changed_fields, affected_rows, operation_count, details, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`, [
    randomUUID(), actor?.id ?? null, actor?.name ?? "Pengguna tidak teridentifikasi", actor?.username ?? "",
    actions.length === 1 ? actions[0] : "BATCH", entities.join(", ").slice(0, 300), request.route,
    request.ipAddress, request.osName, request.browserName, request.deviceType, request.userAgent,
    request.requestId, request.countryCode, request.timezone, JSON.stringify(changedFields),
    affectedRows, operations.length, JSON.stringify(groups), new Date().toISOString(),
  ]);
}

function getSqliteActor(database: import("better-sqlite3").Database, request: AuditRequest): AuditActor {
  if (!request.sessionToken) return null;
  const tokenHash = createHash("sha256").update(request.sessionToken).digest("hex");
  return database.prepare(`SELECT u.id, u.name, u.username FROM sessions AS s
    JOIN users AS u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`)
    .get(tokenHash, new Date().toISOString()) as AuditActor;
}

function writeSqliteAudit(database: import("better-sqlite3").Database, request: AuditRequest, actor: AuditActor, operations: AuditOperation[]) {
  const groups = summarizeOperations(operations);
  if (!groups.length) return;
  const actions = [...new Set(groups.map((group) => group.action))];
  const entities = [...new Set(groups.map((group) => group.entity))];
  const changedFields = [...new Set(groups.flatMap((group) => group.changedFields))].sort();
  const affectedRows = groups.reduce((total, group) => total + group.affectedRows, 0);
  database.prepare(`INSERT INTO audit_logs (
    id, user_id, actor_name, actor_username, action, entity, route, ip_address,
    os_name, browser_name, device_type, user_agent, request_id, country_code,
    timezone, changed_fields, affected_rows, operation_count, details, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(randomUUID(), actor?.id ?? null, actor?.name ?? "Pengguna tidak teridentifikasi", actor?.username ?? "",
      actions.length === 1 ? actions[0] : "BATCH", entities.join(", ").slice(0, 300), request.route,
      request.ipAddress, request.osName, request.browserName, request.deviceType, request.userAgent,
      request.requestId, request.countryCode, request.timezone, JSON.stringify(changedFields),
      affectedRows, operations.length, JSON.stringify(groups), new Date().toISOString());
}

function createPostgresAdapter(url: string): DatabaseAdapter {
  const certificateAuthority = process.env.POSTGRES_SSL_CA?.replace(/\\n/g, "\n");
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.delete("sslmode");
  parsedUrl.searchParams.delete("uselibpqcompat");
  const pool =
    globalForDatabase.adminflowPostgresPool ??
    new Pool({
      connectionString: parsedUrl.toString(),
      ssl: certificateAuthority
        ? { ca: certificateAuthority, rejectUnauthorized: true }
        : { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.adminflowPostgresPool = pool;
  }

  return {
    async transaction(statements) {
      const mutations = statements.map((statement) => parseMutation(statement.sql));
      const request = mutations.some(Boolean) ? await getAuditRequest() : null;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const actor = request ? await getPostgresActor(client, request) : null;
        const operations: AuditOperation[] = [];
        for (let index = 0; index < statements.length; index += 1) {
          const statement = statements[index];
          const result = await client.query(postgresPlaceholders(qualifyTables(statement.sql)), statement.values);
          const mutation = mutations[index];
          if (mutation && (result.rowCount ?? 0) > 0) operations.push({ ...mutation, affectedRows: result.rowCount ?? 0 });
        }
        if (request && operations.length) await writePostgresAudit(client, request, actor, operations);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    prepare(sql) {
      const statement = postgresPlaceholders(qualifyTables(sql));
      const aliases = resultAliases(sql);
      return {
        async get<T>(...values: QueryValue[]) {
          const result = await pool.query<T & Record<string, unknown>>(statement, values);
          return result.rows[0]
            ? restoreAliases(result.rows[0] as T, aliases)
            : undefined;
        },
        async all<T>(...values: QueryValue[]) {
          const result = await pool.query<T & Record<string, unknown>>(statement, values);
          return result.rows.map((row) => restoreAliases(row as T, aliases));
        },
        async run(...values: QueryValue[]) {
          const mutation = parseMutation(sql);
          if (!mutation) {
            const result = await pool.query(statement, values);
            return { changes: result.rowCount ?? 0 };
          }
          const request = await getAuditRequest();
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const actor = request ? await getPostgresActor(client, request) : null;
            const result = await client.query(statement, values);
            const changes = result.rowCount ?? 0;
            if (request && changes > 0) {
              await writePostgresAudit(client, request, actor, [{ ...mutation, affectedRows: changes }]);
            }
            await client.query("COMMIT");
            return { changes };
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          } finally {
            client.release();
          }
        },
      };
    },
  };
}

function createSqliteAdapter(): DatabaseAdapter {
  const sqliteDatabase = import("@/lib/db").then((module) => module.db);

  return {
    async transaction(statements) {
      const database = await sqliteDatabase;
      const mutations = statements.map((statement) => parseMutation(statement.sql));
      const request = mutations.some(Boolean) ? await getAuditRequest() : null;
      const actor = request ? getSqliteActor(database, request) : null;
      database.transaction(() => {
        const operations: AuditOperation[] = [];
        for (let index = 0; index < statements.length; index += 1) {
          const statement = statements[index];
          const result = database.prepare(statement.sql).run(...statement.values);
          const mutation = mutations[index];
          if (mutation && result.changes > 0) operations.push({ ...mutation, affectedRows: result.changes });
        }
        if (request && operations.length) writeSqliteAudit(database, request, actor, operations);
      })();
    },
    prepare(sql) {
      return {
        async get<T>(...values: QueryValue[]) {
          const database = await sqliteDatabase;
          return database.prepare(sql).get(...values) as T | undefined;
        },
        async all<T>(...values: QueryValue[]) {
          const database = await sqliteDatabase;
          return database.prepare(sql).all(...values) as T[];
        },
        async run(...values: QueryValue[]) {
          const database = await sqliteDatabase;
          const mutation = parseMutation(sql);
          if (!mutation) {
            const result = database.prepare(sql).run(...values);
            return { changes: result.changes };
          }
          const request = await getAuditRequest();
          const actor = request ? getSqliteActor(database, request) : null;
          return database.transaction(() => {
            const result = database.prepare(sql).run(...values);
            if (request && result.changes > 0) {
              writeSqliteAudit(database, request, actor, [{ ...mutation, affectedRows: result.changes }]);
            }
            return { changes: result.changes };
          })();
        },
      };
    },
  };
}

export const database = connectionString
  ? createPostgresAdapter(connectionString)
  : createSqliteAdapter();
