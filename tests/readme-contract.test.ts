import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const launchKit = readFileSync(resolve(root, "docs", "LAUNCH_KIT.md"), "utf8");
const gifPath = resolve(root, "docs", "assets", "persona-kit-flow.gif");

describe("GitHub launch contract", () => {
  it("keeps the frozen claim, primary CTA, repository bridge and honest demo boundary", () => {
    expect(readme).toContain("让 AI 换一种说法，不换事实");
    expect(readme).toContain("https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site/");
    expect(readme).toContain("https://github.com/yewending/zodiac-communication-skill");
    expect(readme).toContain("docs/assets/persona-kit-flow.gif");
    expect(readme).toContain("基于当前 `main` 的同版本本地可复现流程示意");
    expect(readme).toContain("不是公开站录屏");
    expect(readme).toContain("不是经过科学验证的人格测量");
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
