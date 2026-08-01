import { describe, expect, it } from "vitest";
import { PERSONAS } from "../src/lib/personas";
import { CORE_SYSTEM_RULES, compileSystemPrompt } from "../src/lib/prompt";
import { AXIS_KEYS, validatePersona } from "../src/lib/zodiac";

describe("人格数据与三人格纵向闭环", () => {
  it("加载十二个结构完整且ID唯一的人格", () => {
    expect(PERSONAS.map((persona) => persona.id)).toEqual([
      "aries",
      "taurus",
      "gemini",
      "cancer",
      "leo",
      "virgo",
      "libra",
      "scorpio",
      "sagittarius",
      "capricorn",
      "aquarius",
      "pisces",
    ]);
    expect(new Set(PERSONAS.map((persona) => persona.id)).size).toBe(12);

    for (const persona of PERSONAS) {
      expect(validatePersona(persona)).toEqual(persona);
      expect(Object.keys(persona.axes).sort()).toEqual([...AXIS_KEYS].sort());
      expect(persona.version).toBe("0.1.0");
    }
  });

  it("同一问题呈现明显不同的行动、结构和共情表达", () => {
    const comparisonPersonas = ["aries", "virgo", "pisces"].map(
      (id) => PERSONAS.find((persona) => persona.id === id)!,
    );
    const answers = comparisonPersonas.map(
      (persona) => persona.prompt.examples[0].assistant,
    );
    expect(answers[0]).toContain("现在");
    expect(answers[1]).toContain("清单");
    expect(answers[2]).toContain("听起来");
    expect(new Set(answers).size).toBe(3);
  });

  it("不可覆盖边界始终先于人格提示词", () => {
    for (const persona of PERSONAS) {
      const compiled = compileSystemPrompt(persona);
      const boundaryPosition = compiled.indexOf(CORE_SYSTEM_RULES[0]);
      const identityPosition = compiled.indexOf(persona.prompt.identity);
      expect(boundaryPosition).toBeGreaterThanOrEqual(0);
      expect(boundaryPosition).toBeLessThan(identityPosition);
      expect(compiled).toContain("非占星声明");
      expect(compiled).toContain("边界不可覆盖");
    }
  });
});
