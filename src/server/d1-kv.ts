import type { KeyValueStore } from "./runtime";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1KeyValueRow {
  value: unknown;
  expires_at: unknown;
}

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "zodiac_kv" (
  "key" TEXT PRIMARY KEY NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" INTEGER,
  "updated_at" INTEGER NOT NULL
)
`.trim();

const CREATE_EXPIRY_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS "zodiac_kv_expires_at_idx"
ON "zodiac_kv" ("expires_at")
`.trim();

const SELECT_VALUE_SQL = `
SELECT "value", "expires_at"
FROM "zodiac_kv"
WHERE "key" = ?
LIMIT 1
`.trim();

const DELETE_EXPIRED_ROWS_SQL = `
DELETE FROM "zodiac_kv"
WHERE "expires_at" <= ?
`.trim();

const DELETE_EXPIRED_KEY_SQL = `
DELETE FROM "zodiac_kv"
WHERE "key" = ? AND "expires_at" = ?
`.trim();

const UPSERT_VALUE_SQL = `
INSERT INTO "zodiac_kv" ("key", "value", "expires_at", "updated_at")
VALUES (?, ?, ?, ?)
ON CONFLICT("key") DO UPDATE SET
  "value" = excluded."value",
  "expires_at" = excluded."expires_at",
  "updated_at" = excluded."updated_at"
`.trim();

const schemaInitialization = new WeakMap<D1Database, Promise<void>>();

async function ensureD1KeyValueSchema(database: D1Database): Promise<void> {
  const existing = schemaInitialization.get(database);
  if (existing) return existing;

  // Drizzle migrations remain the authoritative schema history. These
  // idempotent statements only bootstrap a fresh local/Sites binding before
  // the first request and are cached for the lifetime of the D1 binding.
  const initialization = (async () => {
    await database.prepare(CREATE_TABLE_SQL).run();
    await database.prepare(CREATE_EXPIRY_INDEX_SQL).run();
  })();
  schemaInitialization.set(database, initialization);

  try {
    await initialization;
  } catch (error) {
    if (schemaInitialization.get(database) === initialization) {
      schemaInitialization.delete(database);
    }
    throw error;
  }
}

export function createD1KeyValueStore(
  database: D1Database,
  now: () => number = Date.now,
): KeyValueStore {
  return {
    async get(key) {
      await ensureD1KeyValueSchema(database);
      const checkedAt = now();
      const row = await database
        .prepare(SELECT_VALUE_SQL)
        .bind(key)
        .first<D1KeyValueRow>();
      if (!row || typeof row.value !== "string") return null;
      if (
        row.expires_at !== null &&
        (typeof row.expires_at !== "number" || row.expires_at <= checkedAt)
      ) {
        if (typeof row.expires_at === "number") {
          await database
            .prepare(DELETE_EXPIRED_KEY_SQL)
            .bind(key, row.expires_at)
            .run();
        }
        return null;
      }
      return row.value;
    },

    async put(key, value, options) {
      await ensureD1KeyValueSchema(database);
      const ttlSeconds = options?.expirationTtl;
      if (
        ttlSeconds !== undefined &&
        (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)
      ) {
        throw new RangeError("expirationTtl 必须是正数");
      }
      const updatedAt = now();
      const expiresAt =
        ttlSeconds === undefined
          ? null
          : updatedAt + Math.ceil(ttlSeconds * 1000);
      await database
        .prepare(DELETE_EXPIRED_ROWS_SQL)
        .bind(updatedAt)
        .run();
      await database
        .prepare(UPSERT_VALUE_SQL)
        .bind(key, value, expiresAt, updatedAt)
        .run();
    },
  };
}
