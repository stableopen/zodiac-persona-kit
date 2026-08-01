import { describe, expect, it } from "vitest";
import { PERSONAS } from "../src/lib/personas";
import {
  buildDuelSharePath,
  createDuelRound,
  getDuelDifference,
  matchForDuelChoice,
  parseDuelShareParams,
} from "../src/lib/duel";

describe("同题双声道", () => {
  it("为目标人格稳定选择不同的对照人格和同一条审核情境", () => {
    const first = createDuelRound("virgo", "busy-day");
    const second = createDuelRound("virgo", "busy-day");

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      scenarioId: "busy-day",
      leftId: "virgo",
      rightId: "pisces",
    });
    expect(first.leftReply).not.toBe(first.rightReply);
    expect(first.leftReply.length).toBeLessThanOrEqual(80);
    expect(first.rightReply.length).toBeLessThanOrEqual(80);
  });

  it("十二人格都能进入不调用模型的预置双声道", () => {
    for (const persona of PERSONAS) {
      const round = createDuelRound(persona.id);
      expect(round.leftId).toBe(persona.id);
      expect(round.rightId).not.toBe(persona.id);
      expect(round.prompt.length).toBeGreaterThan(0);
      expect(round.leftReply.length).toBeGreaterThan(0);
      expect(round.rightReply.length).toBeGreaterThan(0);
    }
  });

  it("选择后用普通话说明两种沟通方式差异", () => {
    const difference = getDuelDifference("virgo", "pisces");
    expect(difference).toContain("处女座");
    expect(difference).toContain("双鱼座");
    expect(difference.length).toBeLessThanOrEqual(90);
  });

  it("只有保留问卷主推荐时才沿用推荐默契度", () => {
    const round = createDuelRound("virgo", "busy-day");

    expect(matchForDuelChoice(round, "virgo", 87)).toBe(87);
    expect(matchForDuelChoice(round, "pisces", 87)).toBeNull();
    expect(matchForDuelChoice(round, "virgo", null)).toBeNull();
  });
});

describe("互动分享深链", () => {
  const safeParams = {
    scenario: "busy-day",
    left: "virgo",
    right: "pisces",
    pick: "virgo",
    ref: "share_12345678",
  };

  it("只编码情境、两个人格、分享方选择和匿名来源", () => {
    const round = createDuelRound("virgo", "busy-day");
    expect(buildDuelSharePath(round, "virgo", "share_12345678")).toBe(
      "/?scenario=busy-day&left=virgo&right=pisces&pick=virgo&ref=share_12345678",
    );
  });

  it("恢复同一情境、两条回复和分享方选择", () => {
    const parsed = parseDuelShareParams(safeParams);
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      scenarioId: "busy-day",
      leftId: "virgo",
      rightId: "pisces",
      sharedChoiceId: "virgo",
      sourceId: "share_12345678",
    });
    expect(parsed?.leftReply).not.toBe(parsed?.rightReply);
  });

  it("拒绝正文键、非法ID、相同人格和不属于本轮的选择", () => {
    expect(
      parseDuelShareParams({ ...safeParams, question: "这是用户正文" }),
    ).toBeNull();
    expect(parseDuelShareParams({ ...safeParams, left: "unknown" })).toBeNull();
    expect(parseDuelShareParams({ ...safeParams, right: "virgo" })).toBeNull();
    expect(parseDuelShareParams({ ...safeParams, pick: "aries" })).toBeNull();
    expect(parseDuelShareParams({ ...safeParams, ref: "bad value" })).toBeNull();
  });
});
