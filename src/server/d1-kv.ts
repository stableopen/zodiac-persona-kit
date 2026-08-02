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

const SELECT_VALUE_SQL = `
SELECT "value", "expires_at"
FROM "zodiac_kv"
WHERE "key" = ?1
LIMIT 1
`.trim();

const DELETE_EXPIRED_ROWS_SQL = `
DELETE FROM "zodiac_kv"
WHERE "expires_at" <= ?1
`.trim();

const DELETE_EXPIRED_KEY_SQL = `
DELETE FROM "zodiac_kv"
WHERE "key" = ?1 AND "expires_at" = ?2
`.trim();

const UPSERT_VALUE_SQL = `
INSERT INTO "zodiac_kv" ("key", "value", "expires_at", "updated_at")
VALUES (?1, ?2, ?3, ?4)
ON CONFLICT("key") DO UPDATE SET
  "value" = excluded."value",
  "expires_at" = excluded."expires_at",
  "updated_at" = excluded."updated_at"
`.trim();

export function createD1KeyValueStore(
  database: D1Database,
  now: () => number = Date.now,
): KeyValueStore {
  return {
    async get(key) {
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
