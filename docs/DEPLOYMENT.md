# 部署说明与验证边界

本文只描述当前仓库具备的架构和部署前条件，不代表任何平台已经真实上线。

## 当前状态

| 目标 | 当前事实 | 尚未验证 |
| --- | --- | --- |
| 本地开发 | 当前工作机 Node.js 24.13.0 下已运行类型检查、单元测试、lint、生产构建和构建产物 SSR；包要求最低 Node.js 22.13.0 | GitHub 上的 Node.js 22 CI 尚未真实运行；公网流量、长期运行与运维告警也未验证 |
| Sites / Cloudflare Worker-compatible | 仓库保留 `.openai/hosting.json`、Sites Vite 插件、Cloudflare Vite 插件和 `worker/index.ts`；Worker-compatible ESM 构建已在本地通过 | 真实 Sites/Cloudflare 部署、域名、平台资源和生产密钥注入 |
| EdgeOne Pages Functions | `edge-functions/api/chat.ts` 与 `edge-functions/api/events.ts` 已提供薄适配器，共用服务端处理函数 | EdgeOne 实际路由、构建产物发布、环境变量/KV 绑定和端到端请求均未部署验证 |

因此不能把当前仓库描述为“EdgeOne 一键部署已通过”或“生产环境已上线”。

## 本地运行

```bash
npm ci
npm run dev
```

核心的测试、双声道、人格浏览、Prompt 复制和 JSON 下载不依赖模型。在线聊天需要配置兼容 OpenAI Chat Completions 的服务：

```text
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
```

可选运行参数：

```text
PER_VISITOR_DAILY_LIMIT
GLOBAL_DAILY_LIMIT
MAX_OUTPUT_TOKENS
```

启用在线聊天前必须配置非空、稳定且私密的 `RATE_LIMIT_SALT`；缺失时聊天会在调用模型前安全返回 `503 QUOTA_NOT_CONFIGURED`。V0.2 留存指标还需要平台把持久 KV 以 `ZODIAC_KV` 绑定到运行时；它不是可公开到浏览器的环境变量。没有持久 KV 时，本地/单实例仍可使用进程内聊天限额，但不会写入留存指标，也不能把该限额描述为多实例生产级保障。

限额会分别哈希并计数平台 IP 与浏览器匿名设备标识，任一身份达到上限即拒绝。生产入口必须由可信平台设置或清洗 `cf-connecting-ip` / `x-forwarded-for`，并在应用前移除客户端自带的同名头；否则攻击者可伪造 IP 身份。原始 IP 和设备标识不会写入应用 KV 或返回响应。

## Sites / Cloudflare Worker-compatible 架构

- [`vite.config.ts`](../vite.config.ts) 组合 vinext、Sites 和 Cloudflare Vite 插件。
- [`worker/index.ts`](../worker/index.ts) 是 Worker-compatible 入口，负责应用路由和平台图片处理入口。
- Worker 对 GET/HEAD 请求根据实际 `Request.url` 无条件覆写内部 `x-zodiac-request-origin`；metadata 只读取这个内部值，不信任客户端或代理传入的 host/proto 头。
- [`.openai/hosting.json`](../.openai/hosting.json) 当前没有声明 D1 或 R2；不要为留存指标误称已有 D1/R2 数据库。
- [`app/api/chat/route.ts`](../app/api/chat/route.ts) 与 [`app/api/events/route.ts`](../app/api/events/route.ts) 以 Edge Runtime 路由复用 `src/server` 处理函数。

本地 `npm run build` 只证明代码可以生成 Worker-compatible 构建产物，不等于平台部署成功。真实部署前仍需由目标平台提供静态资源、图片服务、环境变量和 KV 绑定，并重新执行公网端到端验证。

## EdgeOne 适配器

[`edge-functions/api/`](../edge-functions/api/) 中两个文件仅做请求与环境对象转发：

```text
POST /api/chat   -> handleChatRequest
POST /api/events -> handleEventRequest
```

适配器本身已参加 TypeScript 检查；主应用构建也已通过，但该构建不等于 EdgeOne 适配器已被平台打包。以下事项尚未在 EdgeOne 上验证：

- Pages Functions 的目录/路由映射是否与目标项目配置完全一致；
- `LLM_*`、限额配置和 `RATE_LIMIT_SALT` 的安全注入；
- `ZODIAC_KV` 是否满足本项目的 `get/put/expirationTtl` 接口；
- 静态页面、API、分享深链、模型请求和匿名留存的公网端到端行为。

完成这些验证前，不应宣称 EdgeOne 部署可用。

## 部署前检查

1. 使用 Node.js 22 执行 `npm ci`。
2. 运行 `npm run typecheck`、`npm test`、`npm run lint`、`npm run build` 和 `node --test tests/rendered-html.test.mjs`。
3. 仅在平台的服务端秘密管理中配置 `LLM_API_KEY` 与非空 `RATE_LIMIT_SALT`；不要写入 Git、README、前端变量或构建日志。
4. 确认入口会清洗并由可信平台重写客户端 IP 头；验证轮换设备不能绕过同 IP 限额、轮换 IP 不能绕过同设备限额。
5. 确认生产限额，绑定持久 `ZODIAC_KV`，再验证留存指标口径。
6. 使用真实部署 URL 验证首页、`/explore`、分享深链、`/api/chat`、`/api/events` 和 `/og.png`。
7. 验证失败响应不泄漏密钥，双声道卡片不显示人格/选择结果，分享与遥测不包含问卷答案或聊天正文。

本项目当前没有自动发布工作流；[GitHub CI](../.github/workflows/ci.yml) 只做构建与测试。
