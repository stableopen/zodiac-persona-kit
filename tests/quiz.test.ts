import { describe, expect, it } from "vitest";
import { PERSONAS } from "../src/lib/personas";
import { recommendPersonas } from "../src/lib/quiz";

function enumerateAnswers(length: number): number[][] {
  const total = 4 ** length;
  return Array.from({ length: total }, (_, index) => {
    let value = index;
    return Array.from({ length }, () => {
      const answer = value % 4;
      value = Math.floor(value / 4);
      return answer;
    });
  });
}

describe("六题推荐算法", () => {
  it("相同输入始终返回相同主推荐和两个备选", () => {
    const answers = [3, 2, 1, 3, 3, 2];
    const first = recommendPersonas(answers).map((item) => item.persona.id);
    const second = recommendPersonas(answers).map((item) => item.persona.id);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
  });

  it("拒绝缺失或越界答案", () => {
    expect(() => recommendPersonas([0, 1])).toThrow();
    expect(() => recommendPersonas([0, 1, 2, 3, 4, 0])).toThrow();
  });

  it("十二人格均存在可到达的答案组合", () => {
    const reachable = new Set(
      enumerateAnswers(6).map(
        (answers) => recommendPersonas(answers)[0].persona.id,
      ),
    );
    expect([...reachable].sort()).toEqual(
      PERSONAS.map((persona) => persona.id).sort(),
    );
  });
});
