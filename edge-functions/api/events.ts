import { handleEventRequest } from "../../src/server/events";
import type { RuntimeEnv } from "../../src/server/runtime";

interface EdgeOneContext {
  request: Request;
  env: RuntimeEnv;
}

export function onRequestPost(context: EdgeOneContext): Promise<Response> {
  return handleEventRequest(context.request, context.env);
}
