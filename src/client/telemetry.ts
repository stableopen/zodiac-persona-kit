export type AnonymousEvent =
  | "quiz_completed"
  | "first_chat"
  | "prompt_copied"
  | "share_clicked"
  | "duel_view"
  | "duel_choice"
  | "persona_confirmed"
  | "share_generated"
  | "referral_open"
  | "referred_choice"
  | "mode_selector_view"
  | "mode_selected"
  | "mode_starter_used"
  | "mode_chat_success";

export interface AnonymousEventMetadata {
  personaId?: string;
  scenarioId?: string;
  sourceId?: string;
  modeId?: string;
}

const DEVICE_KEY = "zodiac-persona-kit:anonymous-device";

export function getAnonymousDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_KEY, generated);
  return generated;
}

export function trackAnonymousEvent(
  event: AnonymousEvent,
  metadata: AnonymousEventMetadata = {},
): void {
  if (typeof window === "undefined") return;
  void fetch("/api/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-zodiac-device": getAnonymousDeviceId(),
    },
    body: JSON.stringify({ event, ...metadata }),
    keepalive: true,
  }).catch(() => undefined);
}
