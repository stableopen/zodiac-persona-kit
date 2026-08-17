import { describe, expect, it } from "vitest";
import {
  TASK_MODES,
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
});
