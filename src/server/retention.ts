import { getPersona } from "../lib/personas";
import type { KeyValueStore, RuntimeEnv } from "./runtime";

const RETENTION_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEVICE_STATE_TTL_SECONDS = 10 * 24 * 60 * 60;
const COHORT_METRIC_TTL_SECONDS = 35 * 24 * 60 * 60;
const MAX_DEVICE_ID_LENGTH = 256;

export type RetentionErrorCode =
  | "RETENTION_NOT_CONFIGURED"
  | "MISSING_DEVICE_ID";

export class RetentionIdentityError extends Error {
  constructor(
    public readonly code: RetentionErrorCode,
    public readonly status: 400 | 503,
  ) {
    super(
      code === "RETENTION_NOT_CONFIGURED"
        ? "留存统计尚未安全配置"
        : "缺少匿名设备标识",
    );
    this.name = "RetentionIdentityError";
  }
}

interface RetentionDeviceState {
  version: typeof RETENTION_VERSION;
  confirmedPersonaId: string;
  confirmationDay: string;
  baselinePersonaId?: string;
  baselineDay?: string;
  followupDay?: string;
  followupSuccessCount?: number;
  qualifiedDay?: string;
}

interface RetentionCohortState {
  version: typeof RETENTION_VERSION;
  denominator: number;
  numerator: number;
}

export interface RetentionMetric {
  denominator: number;
  numerator: number;
  rate: number;
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function isUtcDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && utcDay(parsed) === value;
}

function dayDifference(laterDay: string, earlierDay: string): number {
  return (
    (Date.parse(`${laterDay}T00:00:00.000Z`) -
      Date.parse(`${earlierDay}T00:00:00.000Z`)) /
    DAY_MS
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function parseDeviceState(value: string | null): RetentionDeviceState | null {
  if (!value) return null;
  try {
    const state: unknown = JSON.parse(value);
    if (
      !isRecord(state) ||
      state.version !== RETENTION_VERSION ||
      typeof state.confirmedPersonaId !== "string" ||
      !getPersona(state.confirmedPersonaId) ||
      !isUtcDay(state.confirmationDay)
    ) {
      return null;
    }
    if (
      (state.baselinePersonaId !== undefined &&
        (typeof state.baselinePersonaId !== "string" ||
          !getPersona(state.baselinePersonaId))) ||
      (state.baselineDay !== undefined && !isUtcDay(state.baselineDay)) ||
      (state.followupDay !== undefined && !isUtcDay(state.followupDay)) ||
      (state.qualifiedDay !== undefined && !isUtcDay(state.qualifiedDay)) ||
      (state.followupSuccessCount !== undefined &&
        !isNonNegativeInteger(state.followupSuccessCount))
    ) {
      return null;
    }
    if (
      (state.baselinePersonaId === undefined) !==
      (state.baselineDay === undefined)
    ) {
      return null;
    }
    return state as unknown as RetentionDeviceState;
  } catch {
    return null;
  }
}

function emptyCohort(): RetentionCohortState {
  return {
    version: RETENTION_VERSION,
    denominator: 0,
    numerator: 0,
  };
}

function parseCohortState(value: string | null): RetentionCohortState {
  if (!value) return emptyCohort();
  try {
    const state: unknown = JSON.parse(value);
    if (
      !isRecord(state) ||
      state.version !== RETENTION_VERSION ||
      !isNonNegativeInteger(state.denominator) ||
      !isNonNegativeInteger(state.numerator) ||
      state.numerator > state.denominator
    ) {
      return emptyCohort();
    }
    return state as unknown as RetentionCohortState;
  } catch {
    return emptyCohort();
  }
}

function retentionStore(env: RuntimeEnv): KeyValueStore {
  if (!env.ZODIAC_KV) {
    throw new RetentionIdentityError("RETENTION_NOT_CONFIGURED", 503);
  }
  return env.ZODIAC_KV;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveRetentionDeviceHash(
  request: Request,
  env: RuntimeEnv,
): Promise<string> {
  const salt = env.RATE_LIMIT_SALT?.trim();
  if (!salt) {
    throw new RetentionIdentityError("RETENTION_NOT_CONFIGURED", 503);
  }
  const deviceId = request.headers.get("x-zodiac-device")?.trim();
  if (!deviceId || deviceId.length > MAX_DEVICE_ID_LENGTH) {
    throw new RetentionIdentityError("MISSING_DEVICE_ID", 400);
  }
  return sha256(`zodiac-retention-v${RETENTION_VERSION}|${salt}|${deviceId}`);
}

function deviceKey(deviceHash: string): string {
  return `retention:v${RETENTION_VERSION}:device:${deviceHash}`;
}

function cohortKey(baselineDay: string): string {
  return `retention:v${RETENTION_VERSION}:cohort:${baselineDay}`;
}

async function putDeviceState(
  store: KeyValueStore,
  key: string,
  state: RetentionDeviceState,
): Promise<void> {
  await store.put(key, JSON.stringify(state), {
    expirationTtl: DEVICE_STATE_TTL_SECONDS,
  });
}

async function updateCohort(
  store: KeyValueStore,
  baselineDay: string,
  delta: { denominator?: number; numerator?: number },
): Promise<void> {
  const key = cohortKey(baselineDay);
  const current = parseCohortState(await store.get(key));
  const next: RetentionCohortState = {
    version: RETENTION_VERSION,
    denominator: current.denominator + (delta.denominator ?? 0),
    numerator: current.numerator + (delta.numerator ?? 0),
  };
  await store.put(key, JSON.stringify(next), {
    expirationTtl: COHORT_METRIC_TTL_SECONDS,
  });
}

function assertPersona(personaId: string): void {
  if (!getPersona(personaId)) {
    throw new RangeError("无效人格ID");
  }
}

export async function recordPersonaConfirmation(
  request: Request,
  env: RuntimeEnv,
  personaId: string,
  now: number = Date.now(),
): Promise<void> {
  assertPersona(personaId);
  const store = retentionStore(env);
  const hash = await deriveRetentionDeviceHash(request, env);
  const key = deviceKey(hash);
  const current = parseDeviceState(await store.get(key));
  const next: RetentionDeviceState = {
    ...current,
    version: RETENTION_VERSION,
    confirmedPersonaId: personaId,
    confirmationDay: utcDay(now),
  };
  await putDeviceState(store, key, next);
}

export async function recordSuccessfulChatReply(
  request: Request,
  env: RuntimeEnv,
  personaId: string,
  now: number = Date.now(),
): Promise<void> {
  assertPersona(personaId);
  const store = retentionStore(env);
  const hash = await deriveRetentionDeviceHash(request, env);
  const key = deviceKey(hash);
  const currentDay = utcDay(now);
  const storedState = parseDeviceState(await store.get(key));
  const confirmedPersonaClaim = request.headers
    .get("x-zodiac-confirmed-persona")
    ?.trim();
  let state = storedState;
  let recoveredConfirmation = false;
  if (!state || state.confirmedPersonaId !== personaId) {
    if (confirmedPersonaClaim !== personaId) return;
    state = {
      ...state,
      version: RETENTION_VERSION,
      confirmedPersonaId: personaId,
      confirmationDay: currentDay,
    };
    recoveredConfirmation = true;
  }

  if (!state.baselineDay || !state.baselinePersonaId) {
    if (dayDifference(currentDay, state.confirmationDay) < 0) return;
    await updateCohort(store, currentDay, { denominator: 1 });
    await putDeviceState(store, key, {
      ...state,
      baselinePersonaId: personaId,
      baselineDay: currentDay,
    });
    return;
  }

  if (state.baselinePersonaId !== personaId || state.qualifiedDay) {
    if (recoveredConfirmation) await putDeviceState(store, key, state);
    return;
  }
  const offset = dayDifference(currentDay, state.baselineDay);
  if (offset < 1 || offset > 7) return;

  const followupSuccessCount =
    state.followupDay === currentDay
      ? Math.min(2, (state.followupSuccessCount ?? 0) + 1)
      : 1;
  if (followupSuccessCount < 2) {
    await putDeviceState(store, key, {
      ...state,
      followupDay: currentDay,
      followupSuccessCount,
    });
    return;
  }

  await updateCohort(store, state.baselineDay, { numerator: 1 });
  await putDeviceState(store, key, {
    ...state,
    followupDay: currentDay,
    followupSuccessCount,
    qualifiedDay: currentDay,
  });
}

export async function readRetentionMetric(
  baselineDay: string,
  env: RuntimeEnv,
): Promise<RetentionMetric> {
  if (!isUtcDay(baselineDay)) {
    throw new RangeError("基准日必须是有效的 YYYY-MM-DD UTC 日期");
  }
  const store = retentionStore(env);
  const cohort = parseCohortState(await store.get(cohortKey(baselineDay)));
  return {
    denominator: cohort.denominator,
    numerator: cohort.numerator,
    rate:
      cohort.denominator === 0 ? 0 : cohort.numerator / cohort.denominator,
  };
}
