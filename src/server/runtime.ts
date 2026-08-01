export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface RuntimeEnv {
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  RATE_LIMIT_SALT?: string;
  PER_VISITOR_DAILY_LIMIT?: string;
  GLOBAL_DAILY_LIMIT?: string;
  MAX_OUTPUT_TOKENS?: string;
  ZODIAC_KV?: KeyValueStore;
}

export interface CounterStore {
  get(key: string): Promise<number>;
  set(key: string, value: number, ttlSeconds: number): Promise<void>;
}

const memoryCounters = new Map<
  string,
  { value: number; expiresAt: number }
>();

function createMemoryCounterStore(now: () => number): CounterStore {
  return {
    async get(key) {
      const entry = memoryCounters.get(key);
      if (!entry || entry.expiresAt <= now()) {
        memoryCounters.delete(key);
        return 0;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      memoryCounters.set(key, {
        value,
        expiresAt: now() + ttlSeconds * 1000,
      });
    },
  };
}

function createKvCounterStore(kv: KeyValueStore): CounterStore {
  return {
    async get(key) {
      const value = await kv.get(key);
      const parsed = Number.parseInt(value ?? "0", 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    },
    async set(key, value, ttlSeconds) {
      await kv.put(key, String(value), { expirationTtl: ttlSeconds });
    },
  };
}

export function getCounterStore(
  env: RuntimeEnv,
  now: () => number = Date.now,
): CounterStore {
  return env.ZODIAC_KV
    ? createKvCounterStore(env.ZODIAC_KV)
    : createMemoryCounterStore(now);
}

export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  maximum = 100_000,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}

export function runtimeEnvFromProcess(): RuntimeEnv {
  const processValues =
    typeof process !== "undefined" ? process.env : ({} as NodeJS.ProcessEnv);
  const globalValues = (
    globalThis as typeof globalThis & { __ZODIAC_ENV__?: RuntimeEnv }
  ).__ZODIAC_ENV__;

  return {
    LLM_BASE_URL:
      globalValues?.LLM_BASE_URL ?? processValues.LLM_BASE_URL ?? undefined,
    LLM_API_KEY:
      globalValues?.LLM_API_KEY ?? processValues.LLM_API_KEY ?? undefined,
    LLM_MODEL:
      globalValues?.LLM_MODEL ?? processValues.LLM_MODEL ?? undefined,
    RATE_LIMIT_SALT:
      globalValues?.RATE_LIMIT_SALT ??
      processValues.RATE_LIMIT_SALT ??
      undefined,
    PER_VISITOR_DAILY_LIMIT:
      globalValues?.PER_VISITOR_DAILY_LIMIT ??
      processValues.PER_VISITOR_DAILY_LIMIT ??
      undefined,
    GLOBAL_DAILY_LIMIT:
      globalValues?.GLOBAL_DAILY_LIMIT ??
      processValues.GLOBAL_DAILY_LIMIT ??
      undefined,
    MAX_OUTPUT_TOKENS:
      globalValues?.MAX_OUTPUT_TOKENS ??
      processValues.MAX_OUTPUT_TOKENS ??
      undefined,
    ZODIAC_KV: globalValues?.ZODIAC_KV,
  };
}
