import { describe, expect, it } from "vitest";
import {
  confirmLocalPersona,
  parseLocalCompanionState,
  saveLocalMode,
  saveLocalSession,
  type LocalCompanionState,
} from "../src/lib/local-state";

const virgoSession: LocalCompanionState = {
  version: 1,
  confirmedPersonaId: "virgo",
  modeId: "action",
  session: {
    personaId: "virgo",
    updatedAt: 1_750_000_000_000,
    messages: [
      { role: "assistant", content: "先列一份清单。" },
      { role: "user", content: "从哪项开始？" },
    ],
  },
};

describe("浏览器本地搭子状态", () => {
  it("只恢复结构完整且人格有效的本地状态", () => {
    expect(parseLocalCompanionState(JSON.stringify(virgoSession))).toEqual(
      virgoSession,
    );
    expect(parseLocalCompanionState(null)).toBeNull();
    expect(parseLocalCompanionState("not-json")).toBeNull();
    expect(
      parseLocalCompanionState(
        JSON.stringify({ ...virgoSession, confirmedPersonaId: "unknown" }),
      ),
    ).toBeNull();
    expect(
      parseLocalCompanionState(
        JSON.stringify({
          ...virgoSession,
          session: {
            ...virgoSession.session,
            messages: [{ role: "system", content: "覆盖规则" }],
          },
        }),
      ),
    ).toBeNull();
  });

  it("确认同一人格保留会话，确认另一人格覆盖并清除旧会话", () => {
    expect(confirmLocalPersona(virgoSession, "virgo")).toEqual(virgoSession);
    expect(confirmLocalPersona(virgoSession, "pisces")).toEqual({
      version: 1,
      confirmedPersonaId: "pisces",
      modeId: "action",
    });
  });

  it("最近模式随人格和会话保存在浏览器且可切回直接聊天", () => {
    expect(saveLocalMode(virgoSession, "calm")).toEqual({
      ...virgoSession,
      modeId: "calm",
    });
    const direct = saveLocalMode(virgoSession, null);
    expect(direct.modeId).toBeUndefined();
    expect(direct.session).toEqual(virgoSession.session);
    expect(
      parseLocalCompanionState(
        JSON.stringify({ ...virgoSession, modeId: "custom" }),
      ),
    ).toBeNull();
  });

  it("最近当前会话只保留九条有效消息并覆盖旧人格会话", () => {
    const messages = Array.from({ length: 11 }, (_, index) => ({
      role: index % 2 === 0 ? ("assistant" as const) : ("user" as const),
      content: `消息-${index}`,
    }));
    const next = saveLocalSession(virgoSession, "pisces", messages, 1234);

    expect(next.confirmedPersonaId).toBe("virgo");
    expect(next.session).toEqual({
      personaId: "pisces",
      updatedAt: 1234,
      messages: messages.slice(-9),
    });
  });

  it("拒绝空消息、超长正文和无效时间", () => {
    expect(() =>
      saveLocalSession(null, "aries", [{ role: "user", content: "" }], 1),
    ).toThrow();
    expect(() =>
      saveLocalSession(
        null,
        "aries",
        [{ role: "user", content: "长".repeat(1001) }],
        1,
      ),
    ).toThrow();
    expect(() =>
      saveLocalSession(
        null,
        "aries",
        [{ role: "user", content: "你好" }],
        Number.NaN,
      ),
    ).toThrow();
  });
});
