import { describe, expect, it } from "vitest";
import {
  createD1KeyValueStore,
  type D1Database,
  type D1PreparedStatement,
} from "../src/server/d1-kv";

interface StoredRow {
  value: string;
  expires_at: number | null;
  updated_at: number;
}

class FakeStatement implements D1PreparedStatement {
  private bindings: unknown[] = [];

  constructor(
    private readonly database: FakeD1,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.bindings = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (!/^\s*SELECT\b/i.test(this.sql)) {
      throw new Error("first() 只允许 SELECT");
    }
    const row = this.database.rows.get(String(this.bindings[0]));
    return (row ?? null) as T | null;
  }

  async run(): Promise<unknown> {
    if (/^\s*DELETE\b/i.test(this.sql)) {
      if (this.sql.includes('"key" = ?1')) {
        const [key, expiresAt] = this.bindings;
        const row = this.database.rows.get(String(key));
        if (row?.expires_at === Number(expiresAt)) {
          this.database.rows.delete(String(key));
        }
      } else {
        const [cutoff] = this.bindings;
        for (const [key, row] of this.database.rows) {
          if (row.expires_at !== null && row.expires_at <= Number(cutoff)) {
            this.database.rows.delete(key);
          }
        }
      }
      return { success: true };
    }
    if (!/^\s*INSERT\b/i.test(this.sql)) {
      throw new Error("run() 只允许 DELETE/INSERT/UPSERT");
    }
    const [key, value, expiresAt, updatedAt] = this.bindings;
    this.database.rows.set(String(key), {
      value: String(value),
      expires_at: expiresAt === null ? null : Number(expiresAt),
      updated_at: Number(updatedAt),
    });
    return { success: true };
  }
}

class FakeD1 implements D1Database {
  readonly rows = new Map<string, StoredRow>();
  readonly preparedSql: string[] = [];

  prepare(sql: string): D1PreparedStatement {
    this.preparedSql.push(sql);
    return new FakeStatement(this, sql);
  }
}

describe("Sites D1 KV 适配", () => {
  it("缺失键返回 null，且键只通过绑定参数传入", async () => {
    const database = new FakeD1();
    const store = createD1KeyValueStore(database, () => 1_000);

    await expect(store.get("key-'--")).resolves.toBeNull();
    expect(database.preparedSql).toHaveLength(1);
    expect(database.preparedSql[0]).not.toContain("key-'--");
  });

  it("以单条 UPSERT 写入并覆盖已有值", async () => {
    const database = new FakeD1();
    let now = 10_000;
    const store = createD1KeyValueStore(database, () => now);

    await store.put("quota:day:global", "1");
    expect(database.rows.get("quota:day:global")).toEqual({
      value: "1",
      expires_at: null,
      updated_at: 10_000,
    });

    now = 20_000;
    await store.put("quota:day:global", "2", { expirationTtl: 60 });
    expect(database.rows.get("quota:day:global")).toEqual({
      value: "2",
      expires_at: 80_000,
      updated_at: 20_000,
    });
    await expect(store.get("quota:day:global")).resolves.toBe("2");

    for (const sql of database.preparedSql) {
      expect(sql.replace(/;\s*$/, "")).not.toContain(";");
    }
  });

  it("读取到期值时返回 null", async () => {
    const database = new FakeD1();
    let now = 1_000;
    const store = createD1KeyValueStore(database, () => now);

    await store.put("event:2026-08-02:first_chat:-:-:-", "3", {
      expirationTtl: 35,
    });
    now = 35_999;
    await expect(
      store.get("event:2026-08-02:first_chat:-:-:-"),
    ).resolves.toBe("3");
    now = 36_000;
    await expect(
      store.get("event:2026-08-02:first_chat:-:-:-"),
    ).resolves.toBeNull();
    expect(
      database.rows.has("event:2026-08-02:first_chat:-:-:-"),
    ).toBe(false);
  });

  it("新写入会清理此前未再次读取的过期行", async () => {
    const database = new FakeD1();
    let now = 1_000;
    const store = createD1KeyValueStore(database, () => now);

    await store.put("expired", "old", { expirationTtl: 1 });
    now = 2_000;
    await store.put("current", "new", { expirationTtl: 60 });

    expect(database.rows.has("expired")).toBe(false);
    expect(database.rows.get("current")?.value).toBe("new");
  });
});
