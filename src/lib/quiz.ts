import { PERSONAS } from "./personas";
import {
  AXIS_KEYS,
  type AxisKey,
  type ZodiacAxes,
  type ZodiacPersona,
} from "./zodiac";

export interface QuizOption {
  label: string;
  value: number;
}

export interface QuizQuestion {
  id: AxisKey;
  eyebrow: string;
  question: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "directness",
    eyebrow: "有人来问你意见",
    question: "你希望AI怎么指出问题？",
    options: [
      { label: "先照顾感受，慢慢说", value: 20 },
      { label: "委婉一点，但别绕太久", value: 45 },
      { label: "清楚说明，给我理由", value: 70 },
      { label: "直接点破，别浪费时间", value: 95 },
    ],
  },
  {
    id: "structure",
    eyebrow: "任务突然变复杂",
    question: "什么样的回答最让你安心？",
    options: [
      { label: "先聊灵感，结构以后再说", value: 20 },
      { label: "给方向，细节我自己补", value: 45 },
      { label: "重点清楚，有个基本顺序", value: 70 },
      { label: "清单、优先级、检查点都要", value: 95 },
    ],
  },
  {
    id: "empathy",
    eyebrow: "你今天有点低落",
    question: "AI第一句话最好是什么？",
    options: [
      { label: "直接帮我解决问题", value: 25 },
      { label: "简单关心，然后分析", value: 50 },
      { label: "先理解我，再给建议", value: 75 },
      { label: "先好好接住情绪，不急着推进", value: 100 },
    ],
  },
  {
    id: "novelty",
    eyebrow: "一起想一个新点子",
    question: "你想把脑洞开到多大？",
    options: [
      { label: "用成熟办法最可靠", value: 20 },
      { label: "稳妥里加一点新意", value: 45 },
      { label: "想听几个意外角度", value: 70 },
      { label: "请重写规则，越新越好", value: 95 },
    ],
  },
  {
    id: "decisiveness",
    eyebrow: "两个方案都能选",
    question: "AI应该替你推进到哪一步？",
    options: [
      { label: "陪我想，不要催我决定", value: 20 },
      { label: "列清利弊，让我选", value: 45 },
      { label: "给推荐，也保留退路", value: 70 },
      { label: "明确拍板，马上开干", value: 95 },
    ],
  },
  {
    id: "sociability",
    eyebrow: "每天和AI说话",
    question: "你喜欢多热络的聊天气氛？",
    options: [
      { label: "安静克制，信息到位就好", value: 20 },
      { label: "自然友好，不必太活跃", value: 45 },
      { label: "有来有回，像熟悉的搭子", value: 70 },
      { label: "能接梗、会带气氛、很有活力", value: 95 },
    ],
  },
];

export interface QuizResult {
  persona: ZodiacPersona;
  distance: number;
  match: number;
}

export function answersToAxes(answers: number[]): ZodiacAxes {
  if (
    answers.length !== QUIZ_QUESTIONS.length ||
    answers.some(
      (answer) =>
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= QUIZ_QUESTIONS[0].options.length,
    )
  ) {
    throw new Error("测试答案必须包含6个0到3之间的整数");
  }

  return Object.fromEntries(
    QUIZ_QUESTIONS.map((question, index) => [
      question.id,
      question.options[answers[index]].value,
    ]),
  ) as ZodiacAxes;
}

export function rankPersonas(
  answers: number[],
  personas: ZodiacPersona[] = PERSONAS,
): QuizResult[] {
  const target = answersToAxes(answers);
  const maxDistance = Math.sqrt(AXIS_KEYS.length * 100 ** 2);

  return personas
    .map((persona) => {
      const distance = Math.sqrt(
        AXIS_KEYS.reduce(
          (sum, key) => sum + (persona.axes[key] - target[key]) ** 2,
          0,
        ),
      );
      return {
        persona,
        distance,
        match: Math.max(1, Math.round((1 - distance / maxDistance) * 100)),
      };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.persona.id.localeCompare(right.persona.id),
    );
}

export function recommendPersonas(answers: number[]): QuizResult[] {
  return rankPersonas(answers).slice(0, 3);
}
