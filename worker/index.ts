/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { bridgeRuntimeEnv, type RuntimeEnv } from "../src/server/runtime";
import type { D1Database } from "../src/server/d1-kv";
import { resolveWorkerRuntimeEnv } from "./runtime-env";

interface Env extends RuntimeEnv {
  DB?: D1Database;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const REQUEST_ORIGIN_HEADER = "x-zodiac-request-origin";

function withRequestOriginHeaders(request: Request): Request {
  if (request.method !== "GET" && request.method !== "HEAD") return request;
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ORIGIN_HEADER, url.origin);
  return new Request(request, { headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // A Worker isolate receives platform bindings through `env`, while the app
    // router reads a process-compatible global. Copy only the application
    // whitelist; the deployment environment is stable within an isolate.
    bridgeRuntimeEnv(resolveWorkerRuntimeEnv(env));
    return handler.fetch(withRequestOriginHeaders(request), env, ctx);
  },
};

export default worker;
