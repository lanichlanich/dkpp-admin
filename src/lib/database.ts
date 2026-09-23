import "server-only";

import { Pool, types } from "pg";

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
  "official_statement_documents",
  "employee_documents",
  "hukdis_records",
  "wfh_reports",
]);

type QueryValue = string | number | boolean | null | Buffer;

export type RunResult = { changes: number };

type PreparedQuery = {
  get<T = Record<string, unknown>>(...values: QueryValue[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(...values: QueryValue[]): Promise<T[]>;
  run(...values: QueryValue[]): Promise<RunResult>;
};

type DatabaseAdapter = {
  prepare(sql: string): PreparedQuery;
};

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
          const result = await pool.query(statement, values);
          return { changes: result.rowCount ?? 0 };
        },
      };
    },
  };
}

function createSqliteAdapter(): DatabaseAdapter {
  const sqliteDatabase = import("@/lib/db").then((module) => module.db);

  return {
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
          const result = database.prepare(sql).run(...values);
          return { changes: result.changes };
        },
      };
    },
  };
}

export const database = connectionString
  ? createPostgresAdapter(connectionString)
  : createSqliteAdapter();
