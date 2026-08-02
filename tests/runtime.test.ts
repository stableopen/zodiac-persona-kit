import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bridgeRuntimeEnv,
  getCounterStore,
  localDevRuntimeBindings,
  PersistentStoreConfigurationError,
  runtimeEnvFromProcess,
  type KeyValueStore,
  type RuntimeEnv,
} from "../src/server/runtime";

const STRING_KEYS = [
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "RATE_LIMIT_SALT",
  "PER_VISITOR_DAILY_LIMIT",
  "GLOBAL_DAILY_LIMIT",
  "MAX_OUTPUT_TOKENS",
  "REQUIRE_PERSISTENT_STORE",
] as const;

const originalProcessValues = Object.fromEntries(
  STRING_KEYS.map((key) => [key, process.env[key]]),
);

function runtimeGlobal(): typeof globalThis & {
  __ZODIAC_ENV__?: RuntimeEnv;
} {
  return globalThis as typeof globalThis & { __ZODIAC_ENV__?: RuntimeEnv };
}

beforeEach(() => {
  delete runtimeGlobal().__ZODIAC_ENV__;
  for (const key of STRING_KEYS) delete process.env[key];
});

afterEach(() => {
  delete runtimeGlobal().__ZODIAC_ENV__;
  for (const key of STRING_KEYS) {
    const original = originalProcessValues[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("运行时环境桥接", () => {
  it("只把聊天、限额和 KV 白名单桥接到应用运行时", () => {
    expect(runtimeEnvFromProcess().LLM_BASE_URL).toBeUndefined();

    const kv: KeyValueStore = {
      async get() {
        return null;
      },
      async put() {},
    };
    const platformEnv = {
      LLM_BASE_URL: "https://api.example.test/v1",
      LLM_API_KEY: "fake-api-key",
      LLM_MODEL: "deepseek-chat",
      RATE_LIMIT_SALT: "fake-rate-limit-salt",
      PER_VISITOR_DAILY_LIMIT: "5",
      GLOBAL_DAILY_LIMIT: "50",
      MAX_OUTPUT_TOKENS: "300",
      REQUIRE_PERSISTENT_STORE: "true",
      ZODIAC_KV: kv,
      ASSETS: { fetch: async () => new Response("asset") },
      IMAGES: { input: () => ({}) },
      UNRELATED: "must-not-cross",
    } satisfies RuntimeEnv & Record<string, unknown>;

    bridgeRuntimeEnv(platformEnv);

    expect(runtimeEnvFromProcess()).toEqual({
      LLM_BASE_URL: "https://api.example.test/v1",
      LLM_API_KEY: "fake-api-key",
      LLM_MODEL: "deepseek-chat",
      RATE_LIMIT_SALT: "fake-rate-limit-salt",
      PER_VISITOR_DAILY_LIMIT: "5",
      GLOBAL_DAILY_LIMIT: "50",
      MAX_OUTPUT_TOKENS: "300",
      REQUIRE_PERSISTENT_STORE: "true",
      ZODIAC_KV: kv,
    });
    expect(runtimeGlobal().__ZODIAC_ENV__).not.toHaveProperty("ASSETS");
    expect(runtimeGlobal().__ZODIAC_ENV__).not.toHaveProperty("IMAGES");
    expect(runtimeGlobal().__ZODIAC_ENV__).not.toHaveProperty("UNRELATED");
  });

  it("开发服务只声明已有白名单，并把密钥保留为 secret_text", () => {
    const processValues = {
      LLM_BASE_URL: "https://api.example.test/v1",
      LLM_API_KEY: "fake-api-key",
      LLM_MODEL: "deepseek-chat",
      RATE_LIMIT_SALT: "fake-rate-limit-salt",
      MAX_OUTPUT_TOKENS: "300",
      REQUIRE_PERSISTENT_STORE: "true",
      UNRELATED: "must-not-cross",
    };

    expect(localDevRuntimeBindings("build", processValues)).toEqual({});
    const bindings = localDevRuntimeBindings("serve", processValues);
    expect(bindings).toEqual({
      vars: {
        LLM_BASE_URL: "https://api.example.test/v1",
        LLM_MODEL: "deepseek-chat",
        MAX_OUTPUT_TOKENS: "300",
        REQUIRE_PERSISTENT_STORE: "true",
      },
      secrets: { required: ["LLM_API_KEY", "RATE_LIMIT_SALT"] },
    });
    expect(JSON.stringify(bindings)).not.toContain("fake-api-key");
    expect(JSON.stringify(bindings)).not.toContain("fake-rate-limit-salt");
  });

  it("仅严格模式禁止无共享 KV 的进程内计数", async () => {
    const localStore = getCounterStore({}, () => 1_000);
    await localStore.set("local:key", 1, 60);
    await expect(localStore.get("local:key")).resolves.toBe(1);

    expect(() =>
      getCounterStore({ REQUIRE_PERSISTENT_STORE: "true" }),
    ).toThrow(PersistentStoreConfigurationError);
  });
});
