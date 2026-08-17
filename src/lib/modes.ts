export const TASK_MODE_IDS = ["action", "calm", "ideas"] as const;

export type TaskModeId = (typeof TASK_MODE_IDS)[number];

export interface TaskMode {
  id: TaskModeId;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  boundaryNote?: string;
  starters: readonly [string, string, string];
}

export const TASK_MODES: readonly TaskMode[] = [
  {
    id: "action",
    name: "推进",
    icon: "↗",
    tagline: "把事情往前推一步",
    description: "梳理目标和约束，给出清晰优先级与第一个动作。",
    starters: [
      "我现在最该推进的是___，帮我拆出第一步。",
      "这件事卡在___，请帮我找出最小突破口。",
      "我今天只有___分钟，帮我排一个能完成的行动顺序。",
    ],
  },
  {
    id: "calm",
    name: "安心",
    icon: "◌",
    tagline: "先稳住，再处理",
    description: "接住当下感受，分开事实与担忧，只给低负担下一步。",
    boundaryNote: "仅用于日常情绪整理，不提供心理诊断或治疗。",
    starters: [
      "我因为___有点乱，先陪我把事实和担心分开。",
      "这件事让我很有压力，帮我找到今天能做的一小步。",
      "我不需要大道理，只想先把___理顺一点。",
    ],
  },
  {
    id: "ideas",
    name: "灵感",
    icon: "✦",
    tagline: "打开三个新方向",
    description: "围绕目标提出有差异的方向，并给每个方向一个试法。",
    starters: [
      "我想为___想新点子，目标受众是___。",
      "这个普通想法是___，帮我变出三个不同方向。",
      "围绕___做一次脑暴，每个方向都给一个可马上尝试的版本。",
    ],
  },
] as const;

const TASK_MODES_BY_ID = Object.fromEntries(
  TASK_MODES.map((mode) => [mode.id, mode]),
) as Record<TaskModeId, TaskMode>;

export function parseTaskModeId(value: unknown): TaskModeId | null {
  return typeof value === "string" &&
    TASK_MODE_IDS.includes(value as TaskModeId)
    ? (value as TaskModeId)
    : null;
}

export function getTaskMode(id: TaskModeId): TaskMode {
  return TASK_MODES_BY_ID[id];
}

export function getChatSuggestionSurface(
  modeId: TaskModeId | null,
  messageCount: number,
): "mode-starters" | "quick-prompts" | null {
  if (modeId) return "mode-starters";
  return messageCount <= 1 ? "quick-prompts" : null;
}
