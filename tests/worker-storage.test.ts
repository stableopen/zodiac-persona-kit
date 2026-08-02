import { afterEach, describe, expect, it } from "vitest";
import {
  bridgeRuntimeEnv,
  runtimeEnvFromProcess,
  type KeyValueStore,
  type RuntimeEnv,
} from "../src/server/runtime";
import type {
  D1Database,
  D1PreparedStatement,
} from "../src/server/d1-kv";
import { resolveWorkerRuntimeEnv } from "../worker/runtime-env";

class ProbeD1 implements D1Database {
  readonly sql: string[] = [];
  private bindings: unknown[] = [];

  prepare(sql: string): D1PreparedStatement {
    this.sql.push(sql);
    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        this.bindings = values;
        return statement;
      },
      first: async <T>() => null as T | null,
      run: async () => ({ success: true, bindings: this.bindings }),
    };
    return statement;
  }
}

class FreshD1 implements D1Database {
  readonly sql: string[] = [];
  private hasTable = false;
  private hasExpiryIndex = false;

  prepare(sql: string): D1PreparedStatement {
    this.sql.push(sql);
    const statement: D1PreparedStatement = {
      bind: () => statement,
      first: async <T>() => {
        if (!this.hasTable) throw new Error("no such table: zodiac_kv");
        return null as T | null;
      },
      run: async () => {
        if (/^\s*CREATE TABLE\b/i.test(sql)) {
          this.hasTable = true;
          return { success: true };
        }
        if (/^\s*CREATE INDEX\b/i.test(sql)) {
          if (!this.hasTable) throw new Error("no such table: zodiac_kv");
          this.hasExpiryIndex = true;
          return { success: true };
        }
        if (!this.hasTable) throw new Error("no such table: zodiac_kv");
        return { success: true };
      },
    };
    return statement;
  }

  schemaReady() {
    return this.hasTable && this.hasExpiryIndex;
  }
}

function runtimeGlobal(): typeof globalThis & {
  __ZODIAC_ENV__?: RuntimeEnv;
} {
  return globalThis as typeof globalThis & { __ZODIAC_ENV__?: RuntimeEnv };
}

afterEach(() => {
  delete runtimeGlobal().__ZODIAC_ENV__;
});

describe("Worker 持久存储选择", () => {
  it("已有 EdgeOne/平台 ZODIAC_KV 时优先沿用", () => {
    const kv: KeyValueStore = {
      async get() {
        return null;
      },
      async put() {},
    };
    const database = new ProbeD1();

    const resolved = resolveWorkerRuntimeEnv({
      ZODIAC_KV: kv,
      DB: database,
    });

    expect(resolved.ZODIAC_KV).toBe(kv);
    expect(database.sql).toEqual([]);
  });

  it("没有 ZODIAC_KV 时把 Sites DB 包装为业务 KV", async () => {
    const database = new ProbeD1();
    const resolved = resolveWorkerRuntimeEnv({ DB: database });

    expect(resolved.ZODIAC_KV).toBeDefined();
    await resolved.ZODIAC_KV!.put("event:key", "1", {
      expirationTtl: 60,
    });
    expect(database.sql).toHaveLength(4);
    expect(database.sql[0]).toMatch(/^\s*CREATE TABLE\b/i);
    expect(database.sql[1]).toMatch(/^\s*CREATE INDEX\b/i);
    expect(database.sql[2]).toMatch(/^\s*DELETE\b/i);
    expect(database.sql[3]).toMatch(/^\s*INSERT\b/i);
  });

  it("全新 Sites D1 在第一次读写前自动建立最小 KV 结构", async () => {
    const database = new FreshD1();
    const resolved = resolveWorkerRuntimeEnv({ DB: database });

    await expect(
      resolved.ZODIAC_KV!.get("quota:2026-08-02:global"),
    ).resolves.toBeNull();
    await expect(
      resolved.ZODIAC_KV!.put("quota:2026-08-02:global", "1", {
        expirationTtl: 60,
      }),
    ).resolves.toBeUndefined();

    expect(database.schemaReady()).toBe(true);
    expect(database.sql[0]).toMatch(/^\s*CREATE TABLE\b/i);
    expect(database.sql[1]).toMatch(/^\s*CREATE INDEX\b/i);
    expect(
      database.sql.filter((sql) => /^\s*CREATE\b/i.test(sql)),
    ).toHaveLength(2);
  });

  it("桥接到应用时不泄漏 DB 或其他平台对象", () => {
    const database = new ProbeD1();
    const resolved = resolveWorkerRuntimeEnv({
      DB: database,
      ASSETS: { fetch: async () => new Response("asset") },
      UNRELATED: "must-not-cross",
    });

    bridgeRuntimeEnv(resolved);

    expect(runtimeEnvFromProcess().ZODIAC_KV).toBeDefined();
    expect(runtimeGlobal().__ZODIAC_ENV__).not.toHaveProperty("DB");
    expect(runtimeGlobal().__ZODIAC_ENV__).not.toHaveProperty("ASSETS");
    expect(runtimeGlobal().__ZODIAC_ENV__).not.toHaveProperty("UNRELATED");
  });
});
