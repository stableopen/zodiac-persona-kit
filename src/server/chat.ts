import { getPersona } from "../lib/personas";
import { compileSystemPrompt } from "../lib/prompt";
import type { TaskModeId } from "../lib/modes";
import {
  consumeQuota,
  QuotaConfigurationError,
  QuotaExceededError,
  QuotaIdentityError,
} from "./quota";
import { recordSuccessfulChatReply } from "./retention";
import { resolveTaskMode } from "./mode-instruction";
import {
  parsePositiveInt,
  PersistentStoreConfigurationError,
  type RuntimeEnv,
} from "./runtime";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  personaId: string;
  messages: ChatMessage[];
  modeId?: TaskModeId;
}

interface FetchLike {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

export interface ChatDependencies {
  fetch?: FetchLike;
  now?: () => number;
  requestId?: () => string;
}

class RequestValidationError extends Error {}

function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}

function parseBody(input: unknown): ChatRequestBody {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RequestValidationError("请求格式不正确");
  }
  const body = input as Record<string, unknown>;
  if (typeof body.personaId !== "string" || !getPersona(body.personaId)) {
    throw new RequestValidationError("请选择有效的星座人格");
  }
  const mode = resolveTaskMode(body.modeId);
  if (body.modeId !== undefined && !mode) {
    throw new RequestValidationError("请选择有效的任务模式");
  }
  if (
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > 40
  ) {
    throw new RequestValidationError("消息数量不正确");
  }

  const messages: ChatMessage[] = body.messages.map((message): ChatMessage => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new RequestValidationError("消息格式不正确");
    }
    const candidate = message as Record<string, unknown>;
    const role = candidate.role;
    if (role !== "user" && role !== "assistant") {
      throw new RequestValidationError("消息角色只允许user或assistant");
    }
    if (
      typeof candidate.content !== "string" ||
      candidate.content.trim() === "" ||
      candidate.content.length > 1000
    ) {
      throw new RequestValidationError("每条消息必须为1到1000个字符");
    }
    return {
      role,
      content: candidate.content.trim(),
    };
  });

  if (messages.at(-1)?.role !== "user") {
    throw new RequestValidationError("最后一条消息必须来自用户");
  }

  return {
    personaId: body.personaId,
    messages,
    ...(mode ? { modeId: mode.id } : {}),
  };
}

function chatCompletionEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function upstreamErrorBody(
  code: "MODEL_TIMEOUT" | "MODEL_UNAVAILABLE" | "MODEL_NOT_CONFIGURED",
  requestId: string,
): Record<string, string> {
  const messages = {
    MODEL_TIMEOUT: "AI这次思考太久了，请稍后重试。人格卡和提示词仍可正常使用。",
    MODEL_UNAVAILABLE:
      "AI线路暂时繁忙，请稍后重试。你仍可复制人格提示词到自己的AI。",
    MODEL_NOT_CONFIGURED:
      "在线聊天尚未配置模型。你可以先测试、浏览人格并复制提示词。",
  };
  return { error: messages[code], code, requestId };
}

export async function handleChatRequest(
  request: Request,
  env: RuntimeEnv,
  dependencies: ChatDependencies = {},
): Promise<Response> {
  const requestId =
    dependencies.requestId?.() ??
    (typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `req_${Date.now().toString(36)}`);
  let body: ChatRequestBody;
  const now = dependencies.now?.() ?? Date.now();

  try {
    body = parseBody(await request.json());
  } catch (error) {
    const message =
      error instanceof RequestValidationError
        ? error.message
        : "请求不是有效的JSON";
    return jsonResponse(
      { error: message, code: "INVALID_REQUEST", requestId },
      400,
      requestId,
    );
  }

  const persona = getPersona(body.personaId)!;
  const mode = resolveTaskMode(body.modeId);
  if (!env.LLM_BASE_URL || !env.LLM_API_KEY || !env.LLM_MODEL) {
    return jsonResponse(
      upstreamErrorBody("MODEL_NOT_CONFIGURED", requestId),
      503,
      requestId,
    );
  }

  let quota;
  try {
    quota = await consumeQuota(
      request,
      env,
      now,
    );
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return jsonResponse(
        {
          error: error.message,
          code:
            error.reason === "visitor"
              ? "VISITOR_LIMIT_REACHED"
              : "GLOBAL_LIMIT_REACHED",
          quota: { remaining: 0, resetAt: error.resetAt },
          requestId,
        },
        429,
        requestId,
      );
    }
    if (
      error instanceof QuotaConfigurationError ||
      error instanceof PersistentStoreConfigurationError
    ) {
      return jsonResponse(
        {
          error: error.message,
          code: "QUOTA_NOT_CONFIGURED",
          requestId,
        },
        503,
        requestId,
      );
    }
    if (error instanceof QuotaIdentityError) {
      return jsonResponse(
        {
          error: error.message,
          code: "QUOTA_IDENTITY_UNAVAILABLE",
          requestId,
        },
        503,
        requestId,
      );
    }
    return jsonResponse(
      {
        error: "体验额度服务暂不可用，请稍后重试。",
        code: "QUOTA_UNAVAILABLE",
        requestId,
      },
      503,
      requestId,
    );
  }

  const recentMessages = body.messages.slice(-8);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const fetcher = dependencies.fetch ?? fetch;

  try {
    const upstream = await fetcher(chatCompletionEndpoint(env.LLM_BASE_URL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.LLM_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages: [
          {
            role: "system",
            content: compileSystemPrompt(persona, mode?.instruction),
          },
          ...recentMessages,
        ],
        max_tokens: parsePositiveInt(env.MAX_OUTPUT_TOKENS, 300, 2000),
        temperature: 0.8,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return jsonResponse(
        upstreamErrorBody("MODEL_UNAVAILABLE", requestId),
        502,
        requestId,
      );
    }

    const result = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || reply.trim() === "") {
      return jsonResponse(
        upstreamErrorBody("MODEL_UNAVAILABLE", requestId),
        502,
        requestId,
      );
    }

    try {
      await recordSuccessfulChatReply(request, env, body.personaId, now);
    } catch {
      // Anonymous retention must never make an otherwise successful chat fail.
    }

    return jsonResponse(
      {
        reply: reply.trim(),
        quota,
        personaVersion: persona.version,
        requestId,
      },
      200,
      requestId,
    );
  } catch (error) {
    const timedOut =
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError");
    return jsonResponse(
      upstreamErrorBody(
        timedOut ? "MODEL_TIMEOUT" : "MODEL_UNAVAILABLE",
        requestId,
      ),
      timedOut ? 504 : 502,
      requestId,
    );
  } finally {
    clearTimeout(timeout);
  }
}
