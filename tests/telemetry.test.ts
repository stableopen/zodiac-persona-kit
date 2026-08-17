import { afterEach, describe, expect, it, vi } from "vitest";
import { trackAnonymousEvent } from "../src/client/telemetry";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("匿名事件客户端接线", () => {
  it("随白名单事件发送本地匿名设备标识且正文不进入请求", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    type FetchLike = (
      input: string | URL | Request,
      init?: RequestInit,
    ) => Promise<Response>;
    const fetchMock = vi.fn<FetchLike>(async () =>
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    trackAnonymousEvent("persona_confirmed", { personaId: "aries" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-zodiac-device"]).toBeTruthy();
    expect(JSON.parse(String(init?.body))).toEqual({
      event: "persona_confirmed",
      personaId: "aries",
    });
    expect(String(init?.body)).not.toContain("content");
  });

  it("模式遥测只发送personaId和modeId", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    type FetchLike = (
      input: string | URL | Request,
      init?: RequestInit,
    ) => Promise<Response>;
    const fetchMock = vi.fn<FetchLike>(async () =>
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    trackAnonymousEvent("mode_starter_used", {
      personaId: "virgo",
      modeId: "action",
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      event: "mode_starter_used",
      personaId: "virgo",
      modeId: "action",
    });
  });
});
