import { handleChatRequest } from "@/src/server/chat";
import { runtimeEnvFromProcess } from "@/src/server/runtime";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  return handleChatRequest(request, runtimeEnvFromProcess());
}
