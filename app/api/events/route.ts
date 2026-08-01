import { handleEventRequest } from "@/src/server/events";
import { runtimeEnvFromProcess } from "@/src/server/runtime";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  return handleEventRequest(request, runtimeEnvFromProcess());
}
