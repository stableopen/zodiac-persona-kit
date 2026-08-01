import {
  getCounterStore,
  parsePositiveInt,
  type RuntimeEnv,
} from "./runtime";

export type QuotaReason = "visitor" | "global";
type QuotaIdentityKind = "ip" | "device";

const MAX_IP_IDENTITY_LENGTH = 128;
const MAX_DEVICE_IDENTITY_LENGTH = 256;

export class QuotaConfigurationError extends Error {
  constructor() {
    super("服务端限额尚未安全配置");
    this.name = "QuotaConfigurationError";
  }
}

export class QuotaIdentityError extends Error {
  constructor() {
    super("暂时无法识别匿名访问身份");
    this.name = "QuotaIdentityError";
  }
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly reason: QuotaReason,
    public readonly resetAt: string,
  ) {
    super(reason === "visitor" ? "访客今日额度已用完" : "今日体验额度已用完");
    this.name = "QuotaExceededError";
  }
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function nextUtcDay(now: number): string {
  const date = new Date(now);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1,
    ),
  ).toISOString();
}

function secondsUntilReset(now: number): number {
  return Math.max(
    60,
    Math.ceil((Date.parse(nextUtcDay(now)) - now) / 1000) + 3600,
  );
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveQuotaIdentities(
  request: Request,
  env: RuntimeEnv,
): Promise<Array<{ kind: QuotaIdentityKind; hash: string }>> {
  const salt = env.RATE_LIMIT_SALT?.trim();
  if (!salt) throw new QuotaConfigurationError();

  const forwardedIp = request.headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  const platformIp = request.headers.get("cf-connecting-ip")?.trim();
  const candidateIp = platformIp || forwardedIp || "";
  const ip =
    candidateIp.length <= MAX_IP_IDENTITY_LENGTH ? candidateIp : "";
  const candidateDevice = request.headers.get("x-zodiac-device")?.trim() ?? "";
  const device =
    candidateDevice.length <= MAX_DEVICE_IDENTITY_LENGTH ? candidateDevice : "";
  const values: Array<{ kind: QuotaIdentityKind; value: string }> = [];
  if (ip) values.push({ kind: "ip", value: ip });
  if (device) values.push({ kind: "device", value: device });
  if (values.length === 0) throw new QuotaIdentityError();

  return Promise.all(
    values.map(async ({ kind, value }) => ({
      kind,
      hash: await sha256(`zodiac-quota-v1|${salt}|${kind}|${value}`),
    })),
  );
}

export interface QuotaState {
  remaining: number;
  resetAt: string;
}

export async function consumeQuota(
  request: Request,
  env: RuntimeEnv,
  now: number = Date.now(),
): Promise<QuotaState> {
  const visitorLimit = parsePositiveInt(env.PER_VISITOR_DAILY_LIMIT, 5, 1000);
  const globalLimit = parsePositiveInt(env.GLOBAL_DAILY_LIMIT, 300);
  const store = getCounterStore(env, () => now);
  const day = utcDay(now);
  const resetAt = nextUtcDay(now);
  const ttl = secondsUntilReset(now);
  const identities = await deriveQuotaIdentities(request, env);
  const visitorKeys = identities.map(
    ({ kind, hash }) => `quota:${day}:visitor:${kind}:${hash}`,
  );
  const globalKey = `quota:${day}:global`;

  const counts = await Promise.all([
    ...visitorKeys.map((key) => store.get(key)),
    store.get(globalKey),
  ]);
  const visitorCounts = counts.slice(0, visitorKeys.length);
  const globalCount = counts.at(-1) ?? 0;

  if (visitorCounts.some((count) => count >= visitorLimit)) {
    throw new QuotaExceededError("visitor", resetAt);
  }
  if (globalCount >= globalLimit) {
    throw new QuotaExceededError("global", resetAt);
  }

  await Promise.all([
    ...visitorKeys.map((key, index) =>
      store.set(key, visitorCounts[index] + 1, ttl),
    ),
    store.set(globalKey, globalCount + 1, ttl),
  ]);

  return {
    remaining: Math.max(
      0,
      Math.min(
        ...visitorCounts.map((count) => visitorLimit - count - 1),
      ),
    ),
    resetAt,
  };
}

export async function incrementAnonymousEvent(
  eventName: string,
  env: RuntimeEnv,
  now: number = Date.now(),
  dimensions: {
    personaId?: string;
    scenarioId?: string;
    sourceId?: string;
  } = {},
): Promise<void> {
  const store = getCounterStore(env, () => now);
  const key = [
    "event",
    utcDay(now),
    eventName,
    dimensions.personaId ?? "-",
    dimensions.scenarioId ?? "-",
    dimensions.sourceId ?? "-",
  ].join(":");
  const current = await store.get(key);
  await store.set(key, current + 1, secondsUntilReset(now));
}
