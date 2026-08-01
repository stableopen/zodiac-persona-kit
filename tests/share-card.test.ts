import { afterEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import {
  buildDuelShareCardData,
  createDuelShareCard,
} from "../src/client/share-card";
import { createDuelRound } from "../src/lib/duel";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,qr"),
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("双声道匿名邀请卡", () => {
  const round = createDuelRound("virgo", "busy-day");
  const shareUrl =
    "https://zodiac.example/?scenario=busy-day&left=virgo&right=pisces&pick=pisces&ref=share_12345678";

  it("纯数据只包含题目、匿名 A/B 回答、链接和娱乐声明", () => {
    const data = buildDuelShareCardData(round, shareUrl);

    expect(Object.keys(data).sort()).toEqual(
      ["disclaimer", "prompt", "replies", "title", "url"].sort(),
    );
    expect(data).toMatchObject({
      title: "同一道题，你会选哪种 AI 回答？",
      prompt: round.prompt,
      replies: [
        { channel: "A", text: round.leftReply },
        { channel: "B", text: round.rightReply },
      ],
      url: shareUrl,
    });
    expect(data.disclaimer).toContain("仅供娱乐");
    expect(data.replies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ personaId: expect.anything() }),
      ]),
    );
  });

  it("Canvas 和二维码生成同一张匿名 Blob，不绘制人格或选择结果", async () => {
    const fillText = vi.fn();
    const gradient = { addColorStop: vi.fn() };
    const context = new Proxy(
      {
        createLinearGradient: vi.fn(() => gradient),
        fillText,
      } as unknown as CanvasRenderingContext2D,
      {
        get(target, property) {
          if (property in target) {
            return Reflect.get(target, property);
          }
          return vi.fn();
        },
        set(target, property, value) {
          return Reflect.set(target, property, value);
        },
      },
    );
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) =>
        callback(new Blob(["anonymous-duel-card"], { type: "image/png" })),
      ),
    };
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });
    vi.stubGlobal("Image", MockImage);

    const blob = await createDuelShareCard(round, shareUrl);
    const renderedText = fillText.mock.calls
      .map(([value]) => String(value))
      .join(" ");

    expect(blob.type).toBe("image/png");
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      shareUrl,
      expect.objectContaining({ width: 220 }),
    );
    expect(renderedText).toContain("声道 A");
    expect(renderedText).toContain("声道 B");
    expect(renderedText).not.toMatch(
      /处女座|双鱼座|virgo|pisces|你选了|默契度/,
    );
  });
});
