import {
  createD1KeyValueStore,
  type D1Database,
} from "../src/server/d1-kv";
import type { RuntimeEnv } from "../src/server/runtime";

export interface WorkerStorageEnv extends RuntimeEnv {
  DB?: D1Database;
}

export function resolveWorkerRuntimeEnv<T extends WorkerStorageEnv>(
  env: T,
): RuntimeEnv {
  if (env.ZODIAC_KV || !env.DB) return env;
  return {
    ...env,
    ZODIAC_KV: createD1KeyValueStore(env.DB),
  };
}
