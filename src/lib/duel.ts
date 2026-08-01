import { PERSONAS, getPersona } from "./personas";
import { AXIS_KEYS, type ZodiacId } from "./zodiac";

export const DUEL_SCENARIO_IDS = ["busy-day", "hard-feedback"] as const;
export type DuelScenarioId = (typeof DUEL_SCENARIO_IDS)[number];

interface DuelScenario {
  id: DuelScenarioId;
  prompt: string;
  replies: Record<ZodiacId, string>;
}

export interface DuelRound {
  scenarioId: DuelScenarioId;
  prompt: string;
  leftId: ZodiacId;
  rightId: ZodiacId;
  leftReply: string;
  rightReply: string;
}

export interface SharedDuelRound extends DuelRound {
  sharedChoiceId: ZodiacId;
  sourceId: string;
}

type SearchValue = string | string[] | undefined;

const DUEL_SCENARIOS: readonly DuelScenario[] = [
  {
    id: "busy-day",
    prompt: "今天事情堆在一起，你有点乱，不知道先做什么。你希望搭子怎么回应？",
    replies: {
      aries: "先别想完美。把最急的一件写下来，给它20分钟，现在就开第一步。",
      taurus: "先稳住节奏。列出今天必须完成的一件，再安排两件能从容推进的小事。",
      gemini: "先把事情摊开看：急、重要、可顺手做。我们用三个角度快速挑出突破口。",
      cancer: "听起来你已经被很多事压住了。先喘口气，我们一起挑一件最能减轻压力的。",
      leo: "你不是做不到，是任务一下挤在了一起。先拿下最关键的一件，今天就能翻盘。",
      virgo: "先做清单：标出截止时间、影响和预计用时；优先处理最紧急且影响最大的一项。",
      libra: "我们先平衡一下：哪件最急，哪件最重要，哪件可以延后？排好后再行动。",
      scorpio: "先找真正卡住你的那件事。解决核心阻塞，其余任务会一起松动。",
      sagittarius: "别被整张清单困住。选一个最能打开局面的动作，做完再重新看全局。",
      capricorn: "按结果倒排：今天必须交付什么、需要哪三步、第一步几点完成。现在开始。",
      aquarius: "先换个视角：把任务按能量而不是类别排序，用你此刻最适合的状态破局。",
      pisces: "先别责怪自己，事情多时乱很正常。告诉我哪一件最让你挂心，我们从那里轻轻理开。",
    },
  },
  {
    id: "hard-feedback",
    prompt: "你做的方案被指出不少问题，心里有点挫败。你希望搭子怎么回应？",
    replies: {
      aries: "先把情绪放一边看事实：挑最关键的问题马上改，改完的版本会替你说话。",
      taurus: "先确认哪些意见有依据，再按影响逐项修改。稳稳修好，比急着证明自己更重要。",
      gemini: "把反馈拆成三类：必须改、值得试、可以讨论。我们换几个角度看看机会在哪。",
      cancer: "被集中指出问题确实不好受。先别否定自己，我们把反馈和你的价值分开来看。",
      leo: "这份反馈不等于否定你。抓住最有价值的一条升级方案，让下一版更有说服力。",
      virgo: "先逐条核对反馈的证据和影响，整理成修订清单，再按优先级逐项关闭。",
      libra: "先听清对方关注什么，也保留你的理由。我们找一个兼顾目标与现实的调整方案。",
      scorpio: "别只修表面。找出这些问题共同指向的根因，解决它，方案才会真正变强。",
      sagittarius: "反馈只是一次校准，不是终点。挑最能提升结果的建议，大胆改出新版本。",
      capricorn: "先确认验收标准，再把反馈转成负责人、截止时间和交付动作，逐项完成。",
      aquarius: "这些意见也许暴露了旧假设。我们重新定义问题，看能不能用更聪明的方式解决。",
      pisces: "一下听到这么多问题会难受很正常。先接住这份挫败，再挑一条最可控的慢慢改。",
    },
  },
];

const VOICE_SUMMARIES: Record<ZodiacId, string> = {
  aries: "直指下一步，用行动打破停滞",
  taurus: "稳住节奏，用可持续的小步推进",
  gemini: "快速换角度，用新线索打开思路",
  cancer: "先接住感受，再一起寻找安全出口",
  leo: "先恢复信心，再把力量放到关键动作",
  virgo: "核对细节，用清单和优先级降低混乱",
  libra: "兼顾不同因素，再给出平衡的选择",
  scorpio: "穿过表面问题，直接处理真正根因",
  sagittarius: "拉高视角，用大胆尝试推动变化",
  capricorn: "对齐结果，用明确步骤完成交付",
  aquarius: "重构问题，用不同方法寻找突破",
  pisces: "先理解情绪，再温和地陪你理开问题",
};

const SHARE_KEYS = ["scenario", "left", "right", "pick", "ref"] as const;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function getScenario(id: string): DuelScenario | undefined {
  return DUEL_SCENARIOS.find((scenario) => scenario.id === id);
}

export function isDuelScenarioId(value: string): value is DuelScenarioId {
  return DUEL_SCENARIO_IDS.includes(value as DuelScenarioId);
}

function contrastPersonaId(targetId: ZodiacId): ZodiacId {
  const target = getPersona(targetId)!;
  return PERSONAS.filter((persona) => persona.id !== targetId)
    .map((persona) => ({
      id: persona.id,
      distance: AXIS_KEYS.reduce(
        (sum, key) => sum + (persona.axes[key] - target.axes[key]) ** 2,
        0,
      ),
    }))
    .sort(
      (left, right) =>
        right.distance - left.distance || left.id.localeCompare(right.id),
    )[0].id;
}

function roundFromPair(
  scenario: DuelScenario,
  leftId: ZodiacId,
  rightId: ZodiacId,
): DuelRound {
  return {
    scenarioId: scenario.id,
    prompt: scenario.prompt,
    leftId,
    rightId,
    leftReply: scenario.replies[leftId],
    rightReply: scenario.replies[rightId],
  };
}

export function createDuelRound(
  targetId: ZodiacId,
  scenarioId?: DuelScenarioId,
): DuelRound {
  const targetIndex = PERSONAS.findIndex((persona) => persona.id === targetId);
  if (targetIndex < 0) throw new Error("未知人格");
  const scenario = scenarioId
    ? getScenario(scenarioId)
    : DUEL_SCENARIOS[targetIndex % DUEL_SCENARIOS.length];
  if (!scenario) throw new Error("未知双声道情境");
  return roundFromPair(scenario, targetId, contrastPersonaId(targetId));
}

export function matchForDuelChoice(
  round: DuelRound,
  chosenId: ZodiacId,
  recommendedMatch: number | null,
): number | null {
  return chosenId === round.leftId ? recommendedMatch : null;
}

export function getDuelDifference(
  leftId: ZodiacId,
  rightId: ZodiacId,
): string {
  const left = getPersona(leftId);
  const right = getPersona(rightId);
  if (!left || !right || leftId === rightId) throw new Error("无效双声道人格");
  return `${left.nameZh}更偏向${VOICE_SUMMARIES[leftId]}；${right.nameZh}更偏向${VOICE_SUMMARIES[rightId]}。`;
}

export function isSafeShareSourceId(value: string): boolean {
  return SOURCE_ID_PATTERN.test(value);
}

export function buildDuelSharePath(
  round: DuelRound,
  chosenId: ZodiacId,
  sourceId: string,
): string {
  if (
    (chosenId !== round.leftId && chosenId !== round.rightId) ||
    !isSafeShareSourceId(sourceId)
  ) {
    throw new Error("分享参数无效");
  }
  const params = new URLSearchParams();
  params.set("scenario", round.scenarioId);
  params.set("left", round.leftId);
  params.set("right", round.rightId);
  params.set("pick", chosenId);
  params.set("ref", sourceId);
  return `/?${params.toString()}`;
}

function singleValue(value: SearchValue): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseDuelShareParams(
  params: Record<string, SearchValue>,
): SharedDuelRound | null {
  const presentKeys = Object.keys(params).filter(
    (key) => params[key] !== undefined,
  );
  if (
    presentKeys.length !== SHARE_KEYS.length ||
    presentKeys.some(
      (key) => !SHARE_KEYS.includes(key as (typeof SHARE_KEYS)[number]),
    )
  ) {
    return null;
  }

  const scenarioId = singleValue(params.scenario);
  const leftId = singleValue(params.left);
  const rightId = singleValue(params.right);
  const sharedChoiceId = singleValue(params.pick);
  const sourceId = singleValue(params.ref);
  const scenario = scenarioId ? getScenario(scenarioId) : undefined;
  const left = leftId ? getPersona(leftId) : undefined;
  const right = rightId ? getPersona(rightId) : undefined;

  if (
    !scenario ||
    !left ||
    !right ||
    left.id === right.id ||
    (sharedChoiceId !== left.id && sharedChoiceId !== right.id) ||
    !sourceId ||
    !isSafeShareSourceId(sourceId)
  ) {
    return null;
  }

  return {
    ...roundFromPair(scenario, left.id, right.id),
    sharedChoiceId,
    sourceId,
  };
}
