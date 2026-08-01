import { getPersona } from "./personas";
import type { ZodiacId } from "./zodiac";

export const LOCAL_COMPANION_KEY = "zodiac-persona-kit:local-companion:v1";
export const MAX_LOCAL_MESSAGES = 9;

export interface LocalChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LocalChatSession {
  personaId: ZodiacId;
  messages: LocalChatMessage[];
  updatedAt: number;
}

export interface LocalCompanionState {
  version: 1;
  confirmedPersonaId?: ZodiacId;
  session?: LocalChatSession;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requirePersonaId(value: unknown): ZodiacId {
  if (typeof value !== "string" || !getPersona(value)) {
    throw new Error("本地人格无效");
  }
  return value as ZodiacId;
}

function normalizeMessages(value: unknown): LocalChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("本地会话不能为空");
  }
  const messages = value.map((message): LocalChatMessage => {
    if (!isRecord(message)) throw new Error("本地消息格式无效");
    if (message.role !== "user" && message.role !== "assistant") {
      throw new Error("本地消息角色无效");
    }
    if (
      typeof message.content !== "string" ||
      message.content.trim() === "" ||
      message.content.length > 1000
    ) {
      throw new Error("本地消息正文无效");
    }
    return { role: message.role, content: message.content.trim() };
  });
  return messages.slice(-MAX_LOCAL_MESSAGES);
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("本地会话时间无效");
  }
  return value;
}

export function parseLocalCompanionState(
  raw: string | null,
): LocalCompanionState | null {
  if (!raw) return null;
  try {
    const input = JSON.parse(raw) as unknown;
    if (!isRecord(input) || input.version !== 1) return null;
    const state: LocalCompanionState = { version: 1 };
    if (input.confirmedPersonaId !== undefined) {
      state.confirmedPersonaId = requirePersonaId(input.confirmedPersonaId);
    }
    if (input.session !== undefined) {
      if (!isRecord(input.session)) return null;
      state.session = {
        personaId: requirePersonaId(input.session.personaId),
        messages: normalizeMessages(input.session.messages),
        updatedAt: normalizeTimestamp(input.session.updatedAt),
      };
    }
    return state;
  } catch {
    return null;
  }
}

export function confirmLocalPersona(
  current: LocalCompanionState | null,
  personaId: ZodiacId,
): LocalCompanionState {
  requirePersonaId(personaId);
  const matchingSession =
    current?.session?.personaId === personaId ? current.session : undefined;
  return {
    version: 1,
    confirmedPersonaId: personaId,
    ...(matchingSession ? { session: matchingSession } : {}),
  };
}

export function saveLocalSession(
  current: LocalCompanionState | null,
  personaId: ZodiacId,
  messages: LocalChatMessage[],
  updatedAt: number,
): LocalCompanionState {
  requirePersonaId(personaId);
  return {
    version: 1,
    ...(current?.confirmedPersonaId
      ? { confirmedPersonaId: current.confirmedPersonaId }
      : {}),
    session: {
      personaId,
      messages: normalizeMessages(messages),
      updatedAt: normalizeTimestamp(updatedAt),
    },
  };
}
