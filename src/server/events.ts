import { incrementAnonymousEvent } from "./quota";
import type { RuntimeEnv } from "./runtime";
import { getPersona } from "../lib/personas";
import { isDuelScenarioId, isSafeShareSourceId } from "../lib/duel";
import {
  recordPersonaConfirmation,
  RetentionIdentityError,
} from "./retention";

export const ANONYMOUS_EVENTS = [
  "quiz_completed",
  "first_chat",
  "prompt_copied",
  "share_clicked",
  "duel_view",
  "duel_choice",
  "persona_confirmed",
  "share_generated",
  "referral_open",
  "referred_choice",
] as const;

type AnonymousEvent = (typeof ANONYMOUS_EVENTS)[number];

interface EventDependencies {
  now?: () => number;
}

interface SafeEventPayload {
  event: AnonymousEvent;
  personaId?: string;
  scenarioId?: string;
  sourceId?: string;
}

const ALLOWED_KEYS = new Set([
  "event",
  "personaId",
  "scenarioId",
  "sourceId",
]);

const REQUIRED_FIELDS: Partial<
  Record<AnonymousEvent, Array<keyof Omit<SafeEventPayload, "event">>>
> = {
  duel_view: ["personaId", "scenarioId"],
  duel_choice: ["personaId", "scenarioId"],
  persona_confirmed: ["personaId"],
  share_generated: ["personaId", "scenarioId", "sourceId"],
  referral_open: ["personaId", "scenarioId", "sourceId"],
  referred_choice: ["personaId", "scenarioId", "sourceId"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEventPayload(input: unknown): SafeEventPayload | null {
  if (!isRecord(input) || Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) {
    return null;
  }
  if (
    typeof input.event !== "string" ||
    !ANONYMOUS_EVENTS.includes(input.event as AnonymousEvent)
  ) {
    return null;
  }
  if (
    (input.personaId !== undefined &&
      (typeof input.personaId !== "string" || !getPersona(input.personaId))) ||
    (input.scenarioId !== undefined &&
      (typeof input.scenarioId !== "string" ||
        !isDuelScenarioId(input.scenarioId))) ||
    (input.sourceId !== undefined &&
      (typeof input.sourceId !== "string" ||
        !isSafeShareSourceId(input.sourceId)))
  ) {
    return null;
  }

  const payload: SafeEventPayload = {
    event: input.event as AnonymousEvent,
    ...(typeof input.personaId === "string"
      ? { personaId: input.personaId }
      : {}),
    ...(typeof input.scenarioId === "string"
      ? { scenarioId: input.scenarioId }
      : {}),
    ...(typeof input.sourceId === "string" ? { sourceId: input.sourceId } : {}),
  };
  if (REQUIRED_FIELDS[payload.event]?.some((field) => !payload[field])) {
    return null;
  }
  return payload;
}

export async function handleEventRequest(
  request: Request,
  env: RuntimeEnv,
  dependencies: EventDependencies = {},
): Promise<Response> {
  try {
    const body = parseEventPayload(await request.json());
    if (!body) {
      return Response.json(
        { error: "未知事件", code: "INVALID_EVENT" },
        { status: 400 },
      );
    }
    const now = dependencies.now?.() ?? Date.now();
    if (body.event === "persona_confirmed") {
      try {
        await recordPersonaConfirmation(
          request,
          env,
          body.personaId!,
          now,
        );
      } catch (error) {
        if (error instanceof RetentionIdentityError) {
          return Response.json(
            { error: error.message, code: error.code },
            { status: error.status },
          );
        }
        return Response.json(
          { error: "留存统计暂不可用", code: "RETENTION_UNAVAILABLE" },
          { status: 503 },
        );
      }
    }
    await incrementAnonymousEvent(
      body.event,
      env,
      now,
      {
        personaId: body.personaId,
        scenarioId: body.scenarioId,
        sourceId: body.sourceId,
      },
    );
    return new Response(null, { status: 204 });
  } catch {
    return Response.json(
      { error: "事件记录失败", code: "EVENT_FAILED" },
      { status: 400 },
    );
  }
}
