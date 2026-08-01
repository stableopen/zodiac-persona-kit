export const ZODIAC_IDS = [
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
] as const;

export type ZodiacId = (typeof ZODIAC_IDS)[number];
export type ZodiacElement = "fire" | "earth" | "air" | "water";

export const AXIS_KEYS = [
  "directness",
  "structure",
  "empathy",
  "novelty",
  "decisiveness",
  "sociability",
] as const;

export type AxisKey = (typeof AXIS_KEYS)[number];
export type ZodiacAxes = Record<AxisKey, number>;

export interface ZodiacPersona {
  id: ZodiacId;
  version: string;
  nameZh: string;
  element: ZodiacElement;
  symbol: string;
  tagline: string;
  traits: string[];
  axes: ZodiacAxes;
  communication: {
    tone: string;
    reasoning: string;
    answerShape: string;
    encouragement: string;
    disagreement: string;
  };
  prompt: {
    identity: string;
    rules: string[];
    avoid: string[];
    examples: Array<{ user: string; assistant: string }>;
  };
  visual: { primary: string; secondary: string };
}

export const AXIS_LABELS: Record<AxisKey, string> = {
  directness: "直接",
  structure: "条理",
  empathy: "共情",
  novelty: "新意",
  decisiveness: "果断",
  sociability: "热络",
};

export class PersonaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonaValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  object: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new PersonaValidationError(`${context}.${key} 必须是非空字符串`);
  }
  return value;
}

function requireStringArray(
  object: Record<string, unknown>,
  key: string,
  context: string,
): string[] {
  const value = object[key];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== "string" || entry.trim() === "")
  ) {
    throw new PersonaValidationError(`${context}.${key} 必须是非空字符串数组`);
  }
  return value;
}

export function validatePersona(input: unknown): ZodiacPersona {
  if (!isRecord(input)) {
    throw new PersonaValidationError("人格文件必须是对象");
  }

  const id = requireString(input, "id", "persona");
  if (!ZODIAC_IDS.includes(id as ZodiacId)) {
    throw new PersonaValidationError(`未知人格ID: ${id}`);
  }

  const element = requireString(input, "element", id);
  if (!["fire", "earth", "air", "water"].includes(element)) {
    throw new PersonaValidationError(`${id}.element 无效`);
  }

  const axesInput = input.axes;
  if (!isRecord(axesInput)) {
    throw new PersonaValidationError(`${id}.axes 必须是对象`);
  }
  const axes = Object.fromEntries(
    AXIS_KEYS.map((key) => {
      const value = axesInput[key];
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 100
      ) {
        throw new PersonaValidationError(`${id}.axes.${key} 必须是0到100的整数`);
      }
      return [key, value];
    }),
  ) as ZodiacAxes;

  const communicationInput = input.communication;
  if (!isRecord(communicationInput)) {
    throw new PersonaValidationError(`${id}.communication 必须是对象`);
  }

  const promptInput = input.prompt;
  if (!isRecord(promptInput)) {
    throw new PersonaValidationError(`${id}.prompt 必须是对象`);
  }
  const examplesInput = promptInput.examples;
  if (
    !Array.isArray(examplesInput) ||
    examplesInput.length === 0 ||
    examplesInput.some(
      (example) =>
        !isRecord(example) ||
        typeof example.user !== "string" ||
        typeof example.assistant !== "string",
    )
  ) {
    throw new PersonaValidationError(`${id}.prompt.examples 格式无效`);
  }

  const visualInput = input.visual;
  if (!isRecord(visualInput)) {
    throw new PersonaValidationError(`${id}.visual 必须是对象`);
  }
  const primary = requireString(visualInput, "primary", `${id}.visual`);
  const secondary = requireString(visualInput, "secondary", `${id}.visual`);
  const hexColor = /^#[0-9a-f]{6}$/i;
  if (!hexColor.test(primary) || !hexColor.test(secondary)) {
    throw new PersonaValidationError(`${id}.visual 颜色必须是六位十六进制`);
  }

  return {
    id: id as ZodiacId,
    version: requireString(input, "version", id),
    nameZh: requireString(input, "nameZh", id),
    element: element as ZodiacElement,
    symbol: requireString(input, "symbol", id),
    tagline: requireString(input, "tagline", id),
    traits: requireStringArray(input, "traits", id),
    axes,
    communication: {
      tone: requireString(communicationInput, "tone", `${id}.communication`),
      reasoning: requireString(
        communicationInput,
        "reasoning",
        `${id}.communication`,
      ),
      answerShape: requireString(
        communicationInput,
        "answerShape",
        `${id}.communication`,
      ),
      encouragement: requireString(
        communicationInput,
        "encouragement",
        `${id}.communication`,
      ),
      disagreement: requireString(
        communicationInput,
        "disagreement",
        `${id}.communication`,
      ),
    },
    prompt: {
      identity: requireString(promptInput, "identity", `${id}.prompt`),
      rules: requireStringArray(promptInput, "rules", `${id}.prompt`),
      avoid: requireStringArray(promptInput, "avoid", `${id}.prompt`),
      examples: examplesInput.map((example) => ({
        user: (example as Record<string, string>).user,
        assistant: (example as Record<string, string>).assistant,
      })),
    },
    visual: { primary, secondary },
  };
}
