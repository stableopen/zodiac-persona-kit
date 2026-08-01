import { handleChatRequest } from "../../src/server/chat";
import type { RuntimeEnv } from "../../src/server/runtime";

interface EdgeOneContext {
  request: Request;
  env: RuntimeEnv;
}

export function onRequestPost(context: EdgeOneContext): Promise<Response> {
  return handleChatRequest(context.request, context.env);
}
