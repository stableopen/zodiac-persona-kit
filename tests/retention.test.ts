import { describe, expect, it } from "vitest";
import {
  readRetentionMetric,
  recordPersonaConfirmation,
  recordSuccessfulChatReply,
} from "../src/server/retention";
import type { KeyValueStore, RuntimeEnv } from "../src/server/runtime";

class FakeKv implements KeyValueStore {
  readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }
}

const BASELINE = Date.UTC(2026, 7, 1, 12);
const DAY = 24 * 60 * 60 * 1000;

function request(device = "private-device-123456"): Request {
  return new Request("https://zodiac.example/api/chat", {
    headers: {
      "x-zodiac-device": device,
      "x-forwarded-for": "203.0.113.10",
    },
  });
}

function env(kv = new FakeKv()): RuntimeEnv {
  return {
    RATE_LIMIT_SALT: "retention-test-salt",
    ZODIAC_KV: kv,
  };
}

async function establishBaseline(
  runtimeEnv: RuntimeEnv,
  device: string,
  personaId = "aries",
) {
  await recordPersonaConfirmation(
    request(device),
    runtimeEnv,
    personaId,
    BASELINE,
  );
  await recordSuccessfulChatReply(
    request(device),
    runtimeEnv,
    personaId,
    BASELINE,
  );
}

describe("7日同人格有效复用率", () => {
  it("确认后首次同人格成功回复只进入基准日分母", async () => {
    const runtimeEnv = env();

    await recordPersonaConfirmation(
      request(),
      runtimeEnv,
      "aries",
      BASELINE,
    );
    expect(await readRetentionMetric("2026-08-01", runtimeEnv)).toEqual({
      denominator: 0,
      numerator: 0,
      rate: 0,
    });

    await recordSuccessfulChatReply(
      request(),
      runtimeEnv,
      "aries",
      BASELINE,
    );
    expect(await readRetentionMetric("2026-08-01", runtimeEnv)).toEqual({
      denominator: 1,
      numerator: 0,
      rate: 0,
    });
  });

  it("基准日内多次成功回复不进入分子", async () => {
    const runtimeEnv = env();
    await establishBaseline(runtimeEnv, "same-day-device");

    await recordSuccessfulChatReply(
      request("same-day-device"),
      runtimeEnv,
      "aries",
      BASELINE + 60_000,
    );
    await recordSuccessfulChatReply(
      request("same-day-device"),
      runtimeEnv,
      "aries",
      BASELINE + 120_000,
    );

    expect(await readRetentionMetric("2026-08-01", runtimeEnv)).toEqual({
      denominator: 1,
      numerator: 0,
      rate: 0,
    });
  });

  it("后续第1至7日同人格同日两次成功回复进入分子且只计一次", async () => {
    const runtimeEnv = env();
    await establishBaseline(runtimeEnv, "qualified-device");
    await establishBaseline(runtimeEnv, "day-seven-device");

    await recordSuccessfulChatReply(
      request("qualified-device"),
      runtimeEnv,
      "aries",
      BASELINE + DAY,
    );
    expect(await readRetentionMetric("2026-08-01", runtimeEnv)).toMatchObject({
      numerator: 0,
    });

    await recordSuccessfulChatReply(
      request("qualified-device"),
      runtimeEnv,
      "aries",
      BASELINE + DAY + 60_000,
    );
    await recordSuccessfulChatReply(
      request("qualified-device"),
      runtimeEnv,
      "aries",
      BASELINE + DAY + 120_000,
    );
    await recordSuccessfulChatReply(
      request("qualified-device"),
      runtimeEnv,
      "aries",
      BASELINE + 2 * DAY,
    );
    await recordSuccessfulChatReply(
      request("qualified-device"),
      runtimeEnv,
      "aries",
      BASELINE + 2 * DAY + 60_000,
    );
    await recordSuccessfulChatReply(
      request("day-seven-device"),
      runtimeEnv,
      "aries",
      BASELINE + 7 * DAY,
    );
    await recordSuccessfulChatReply(
      request("day-seven-device"),
      runtimeEnv,
      "aries",
      BASELINE + 7 * DAY + 60_000,
    );

    expect(await readRetentionMetric("2026-08-01", runtimeEnv)).toEqual({
      denominator: 2,
      numerator: 2,
      rate: 1,
    });
  });

  it("不同人格、后续日仅一次和超过7日均不进入分子", async () => {
    const runtimeEnv = env();
    await establishBaseline(runtimeEnv, "wrong-persona-device");
    await establishBaseline(runtimeEnv, "one-reply-device");
    await establishBaseline(runtimeEnv, "late-device");

    await recordSuccessfulChatReply(
      request("wrong-persona-device"),
      runtimeEnv,
      "virgo",
      BASELINE + DAY,
    );
    await recordSuccessfulChatReply(
      request("wrong-persona-device"),
      runtimeEnv,
      "virgo",
      BASELINE + DAY + 60_000,
    );
    await recordSuccessfulChatReply(
      request("one-reply-device"),
      runtimeEnv,
      "aries",
      BASELINE + 3 * DAY,
    );
    await recordSuccessfulChatReply(
      request("one-reply-device"),
      runtimeEnv,
      "aries",
      BASELINE + 4 * DAY,
    );
    await recordSuccessfulChatReply(
      request("late-device"),
      runtimeEnv,
      "aries",
      BASELINE + 8 * DAY,
    );
    await recordSuccessfulChatReply(
      request("late-device"),
      runtimeEnv,
      "aries",
      BASELINE + 8 * DAY + 60_000,
    );

    expect(await readRetentionMetric("2026-08-01", runtimeEnv)).toEqual({
      denominator: 3,
      numerator: 0,
      rate: 0,
    });
  });

  it("KV键和值不包含原始设备标识、IP或聊天正文", async () => {
    const kv = new FakeKv();
    const runtimeEnv = env(kv);
    const rawDevice = "private-device-raw-987654";

    await establishBaseline(runtimeEnv, rawDevice, "pisces");

    const serializedStore = JSON.stringify([...kv.values.entries()]);
    expect(serializedStore).not.toContain(rawDevice);
    expect(serializedStore).not.toContain("203.0.113.10");
    expect(serializedStore).not.toContain("这是不能保存的聊天正文");
  });

  it("缺少盐、设备标识或持久KV时拒绝确认写入", async () => {
    await expect(
      recordPersonaConfirmation(
        request(),
        { ZODIAC_KV: new FakeKv() },
        "aries",
        BASELINE,
      ),
    ).rejects.toMatchObject({ code: "RETENTION_NOT_CONFIGURED" });

    await expect(
      recordPersonaConfirmation(
        request(""),
        env(),
        "aries",
        BASELINE,
      ),
    ).rejects.toMatchObject({ code: "MISSING_DEVICE_ID" });

    await expect(
      recordPersonaConfirmation(
        request(),
        { RATE_LIMIT_SALT: "retention-test-salt" },
        "aries",
        BASELINE,
      ),
    ).rejects.toMatchObject({ code: "RETENTION_NOT_CONFIGURED" });
  });
});
