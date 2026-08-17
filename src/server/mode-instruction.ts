import { parseTaskModeId, type TaskModeId } from "../lib/modes";

const MODE_INSTRUCTIONS: Record<TaskModeId, string> = {
  action:
    "先确认用户这次要推进的目标和约束。信息足够时，给出不超过3个按优先级排列的具体步骤，每步以动词开头，并明确现在就能做的第一个动作；信息不足时只问一个最关键的问题。",
  calm:
    "先用一句话接住用户当下的感受，再区分已知事实与可能的担忧，最后只给一个低负担、可完成的下一步。不要做心理诊断，不要用空泛安慰，也不要一次堆很多建议。",
  ideas:
    "先识别这次创意的目标或受众。信息足够时给出3个彼此有明显差异的方向，每个方向包含核心点和一个可立即尝试的小版本；不要只罗列同义点子。",
};

export interface ResolvedTaskMode {
  id: TaskModeId;
  instruction: string;
}

export function resolveTaskMode(value: unknown): ResolvedTaskMode | null {
  if (value === undefined) return null;
  const id = parseTaskModeId(value);
  return id ? { id, instruction: MODE_INSTRUCTIONS[id] } : null;
}
