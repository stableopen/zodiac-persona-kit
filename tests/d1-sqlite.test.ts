import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  createD1KeyValueStore,
  type D1Database,
  type D1PreparedStatement,
} from "../src/server/d1-kv";

class SqliteStatement implements D1PreparedStatement {
  private bindings: SQLInputValue[] = [];

  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.bindings = values.map((value) => {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "bigint" ||
        ArrayBuffer.isView(value)
      ) {
        return value as SQLInputValue;
      }
      throw new TypeError("SQLite 测试绑定只接受标量或二进制值");
    });
    return this;
  }

  async first<T>(): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...this.bindings);
    return (row ?? null) as T | null;
  }

  async run(): Promise<unknown> {
    return this.database.prepare(this.sql).run(...this.bindings);
  }
}

class SqliteD1 implements D1Database {
  constructor(readonly database: DatabaseSync) {}

  prepare(sql: string): D1PreparedStatement {
    return new SqliteStatement(this.database, sql);
  }
}

function applyGeneratedMigrations(database: DatabaseSync): void {
  const migrationDirectory = resolve(process.cwd(), "drizzle");
  const files = readdirSync(migrationDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    database.exec(
      readFileSync(resolve(migrationDirectory, file), "utf8"),
    );
  }
}

describe("生成迁移与真实 SQLite", () => {
  it("可应用迁移，并执行 upsert、到期和索引清理", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      applyGeneratedMigrations(sqlite);
      let now = 1_000;
      const store = createD1KeyValueStore(new SqliteD1(sqlite), () => now);

      await store.put("expired", "old", { expirationTtl: 1 });
      await store.put("current", "1", { expirationTtl: 60 });
      await store.put("current", "2", { expirationTtl: 60 });
      await expect(store.get("current")).resolves.toBe("2");

      now = 2_000;
      await store.put("new", "3", { expirationTtl: 60 });
      expect(
        sqlite
          .prepare("SELECT COUNT(*) AS count FROM zodiac_kv WHERE key = ?")
          .get("expired"),
      ).toEqual({ count: 0 });
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
          )
          .get("zodiac_kv_expires_at_idx"),
      ).toEqual({ name: "zodiac_kv_expires_at_idx" });
    } finally {
      sqlite.close();
    }
  });
});
