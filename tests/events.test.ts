import { describe, expect, it } from "vitest";
import { handleEventRequest } from "../src/server/events";
import type { KeyValueStore, RuntimeEnv } from "../src/server/runtime";

class FakeKv implements KeyValueStore {
  readonly values = new Map<string, string>();
  readonly ttls = new Map<string, number | undefined>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) {
    this.values.set(key, value);
    this.ttls.set(key, options?.expirationTtl);
  }
}

function eventRequest(body: unknown, device?: string): Request {
  return new Request("https://zodiac.example/api/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(device ? { "x-zodiac-device": device } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("匿名事件安全白名单", () => {
  it("只按服务端日期桶写入允许的事件和安全维度", async () => {
    const kv = new FakeKv();
    const env: RuntimeEnv = { ZODIAC_KV: kv };
    const response = await handleEventRequest(
      eventRequest({
        event: "share_generated",
        personaId: "virgo",
        scenarioId: "busy-day",
        sourceId: "share_12345678",
      }),
      env,
      { now: () => Date.UTC(2026, 7, 1, 12) },
    );

    expect(response.status).toBe(204);
    expect([...kv.values.keys()]).toEqual([
      "event:2026-08-01:share_generated:virgo:busy-day:share_12345678",
    ]);
    expect([...kv.ttls.values()]).toEqual([35 * 24 * 60 * 60]);
  });

  it("继续接受V0.1事件但不虚构正文维度", async () => {
    const kv = new FakeKv();
    const response = await handleEventRequest(
      eventRequest({ event: "quiz_completed" }),
      { ZODIAC_KV: kv },
      { now: () => Date.UTC(2026, 7, 1, 12) },
    );
    expect(response.status).toBe(204);
    expect([...kv.values.keys()]).toEqual([
      "event:2026-08-01:quiz_completed:-:-:-",
    ]);
  });

  it("模式事件只写入白名单人格和modeId且不接受正文", async () => {
    const kv = new FakeKv();
    const env: RuntimeEnv = { ZODIAC_KV: kv };
    const selected = await handleEventRequest(
      eventRequest({
        event: "mode_selected",
        personaId: "pisces",
        modeId: "calm",
      }),
      env,
      { now: () => Date.UTC(2026, 7, 1, 12) },
    );
    expect(selected.status).toBe(204);
    expect([...kv.values.keys()]).toEqual([
      "event:2026-08-01:mode_selected:pisces:-:-:calm",
    ]);

    const withContent = await handleEventRequest(
      eventRequest({
        event: "mode_starter_used",
        personaId: "pisces",
        modeId: "calm",
        content: "不能记录的起手式正文",
      }),
      env,
    );
    expect(withContent.status).toBe(400);
  });

  it("拒绝未知事件、正文键和非法安全维度", async () => {
    const valid = {
      event: "referred_choice",
      personaId: "virgo",
      scenarioId: "busy-day",
      sourceId: "share_12345678",
    };
    const invalidBodies = [
      { ...valid, event: "unknown" },
      { ...valid, content: "用户聊天正文" },
      { ...valid, personaId: "unknown" },
      { ...valid, scenarioId: "private-question" },
      { ...valid, sourceId: "bad value" },
      { event: "referral_open", personaId: "virgo" },
      { event: "mode_selected", personaId: "virgo", modeId: "custom" },
      { event: "mode_selected", personaId: "virgo" },
    ];

    for (const body of invalidBodies) {
      const response = await handleEventRequest(eventRequest(body), {});
      expect(response.status).toBe(400);
    }
  });

  it("人格确认缺少留存配置或设备标识时明确失败", async () => {
    const noSalt = await handleEventRequest(
      eventRequest({ event: "persona_confirmed", personaId: "aries" }, "device-a"),
      { ZODIAC_KV: new FakeKv() },
    );
    expect(noSalt.status).toBe(503);
    expect(await noSalt.text()).toContain("RETENTION_NOT_CONFIGURED");

    const noDevice = await handleEventRequest(
      eventRequest({ event: "persona_confirmed", personaId: "aries" }),
      { RATE_LIMIT_SALT: "test-salt", ZODIAC_KV: new FakeKv() },
    );
    expect(noDevice.status).toBe(400);
    expect(await noDevice.text()).toContain("MISSING_DEVICE_ID");
  });

  it("Public Beta 严格模式缺少共享存储时返回 503", async () => {
    const response = await handleEventRequest(
      eventRequest({ event: "quiz_completed" }),
      { REQUIRE_PERSISTENT_STORE: "true" },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("PERSISTENT_STORE_NOT_CONFIGURED");
  });

  it("共享存储故障返回可重试的 503 而不是请求格式错误", async () => {
    const failingKv: KeyValueStore = {
      async get() {
        throw new Error("D1 unavailable");
      },
      async put() {},
    };
    const response = await handleEventRequest(
      eventRequest({ event: "quiz_completed" }),
      { ZODIAC_KV: failingKv },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("EVENT_UNAVAILABLE");
  });
});
