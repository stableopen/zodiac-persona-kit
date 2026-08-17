import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const launchKit = readFileSync(resolve(root, "docs", "LAUNCH_KIT.md"), "utf8");
const gifPath = resolve(root, "docs", "assets", "persona-kit-flow.gif");

describe("GitHub launch contract", () => {
  it("keeps the current claim, GitHub entry, repository bridge and demo asset", () => {
    expect(readme).toContain("给 AI 设置一个更懂你的星座");
    expect(readme).toContain("https://github.com/stableopen/zodiac-persona-kit");
    expect(readme).toContain("https://github.com/stableopen/zodiac-communication-skill");
    expect(readme).toContain("docs/assets/persona-kit-flow.gif");
    expect(readme).toContain("动图展示本仓库的实际使用流程");
    expect(readme).toContain("不是经过科学验证的人格测量");
    expect(readme).not.toContain("chatgpt.site");
    expect(launchKit).not.toContain("chatgpt.site");
  });

  it("ships one truthful shared launch kit", () => {
    expect(launchKit).toContain("统一事实底稿");
    expect(launchKit).toContain("视频号");
    expect(launchKit).toContain("小红书");
    expect(launchKit).toContain("B站");
    expect(launchKit).toContain("V2EX");
    expect(launchKit).toContain("掘金");
    expect(launchKit).toContain("### X");
    expect(launchKit).toContain("Reddit");
    expect(launchKit).toContain("禁用说法");
  });

  it("ships a GitHub-sized animated flow asset", () => {
    const size = statSync(gifPath).size;
    expect(size).toBeGreaterThan(1_000);
    expect(size).toBeLessThan(5 * 1024 * 1024);
  });
});
