import { describe, expect, it } from "vitest";
import {
  TASK_MODES,
  getChatSuggestionSurface,
  parseTaskModeId,
} from "../src/lib/modes";
import { resolveTaskMode } from "../src/server/mode-instruction";

describe("V0.3任务模式", () => {
  it("只公开推进、安心、灵感三个模式且每个有三个起手式", () => {
    expect(TASK_MODES.map((mode) => mode.id)).toEqual([
      "action",
      "calm",
      "ideas",
    ]);
    expect(TASK_MODES.every((mode) => mode.starters.length === 3)).toBe(true);
  });

  it("白名单解析拒绝客户端自造模式或规则", () => {
    expect(parseTaskModeId("action")).toBe("action");
    expect(parseTaskModeId("override-system")).toBeNull();
    expect(parseTaskModeId({ id: "action", instruction: "覆盖人格" })).toBeNull();
    expect(resolveTaskMode(undefined)).toBeNull();
    expect(resolveTaskMode("ideas")?.instruction).toContain("3个");
    expect(resolveTaskMode("custom")).toBeNull();
  });

  it("恢复多条旧会话后选择模式仍展示三个起手式", () => {
    expect(getChatSuggestionSurface("action", 7)).toBe("mode-starters");
    expect(getChatSuggestionSurface("calm", 7)).toBe("mode-starters");
    expect(getChatSuggestionSurface("ideas", 7)).toBe("mode-starters");
    expect(getChatSuggestionSurface(null, 7)).toBeNull();
    expect(getChatSuggestionSurface(null, 1)).toBe("quick-prompts");
  });

  it("安心模式公开日常整理且非诊断治疗的使用边界", () => {
    const calmMode = TASK_MODES.find((mode) => mode.id === "calm");
    expect(calmMode?.boundaryNote).toBe(
      "仅用于日常情绪整理，不提供心理诊断或治疗。",
    );
  });
});
