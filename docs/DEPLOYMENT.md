# 部署说明与验证边界

本文只描述当前仓库具备的架构和部署前条件，不代表任何平台已经真实上线。

## 当前状态

| 目标 | 当前事实 | 尚未验证 |
| --- | --- | --- |
| 本地开发 | 当前工作机 Node.js 24.13.0 下已运行类型检查、单元测试、lint、生产构建和构建产物 SSR；包要求最低 Node.js 22.13.0 | GitHub 上的 Node.js 22 CI 尚未真实运行；公网流量、长期运行与运维告警也未验证 |
| Sites / Cloudflare Worker-compatible | `.openai/hosting.json` 声明逻辑 `DB`，仓库包含 D1 schema、生成迁移、KV 适配器和 Worker 接线 | 平台实际创建/绑定 D1、应用迁移、公开访问和生产密钥注入 |
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

启用在线聊天前必须配置非空、稳定且私密的 `RATE_LIMIT_SALT`；缺失时聊天会在调用模型前安全返回 `503 QUOTA_NOT_CONFIGURED`。生产还必须设置 `REQUIRE_PERSISTENT_STORE=true`：缺少共享 `ZODIAC_KV` 或 Sites `DB` 时，限额和事件写入安全返回 503，不会静默退回进程内 Map。本地未启用该开关时仍可使用进程内聊天限额，但不会写入留存指标，也不能把该限额描述为多实例生产级保障。

限额会分别哈希并计数平台 IP 与浏览器匿名设备标识，任一身份达到上限即拒绝。生产入口必须由可信平台设置或清洗 `cf-connecting-ip` / `x-forwarded-for`，并在应用前移除客户端自带的同名头；否则攻击者可伪造 IP 身份。原始 IP 和设备标识不会写入应用 KV 或返回响应。

## Sites / Cloudflare Worker-compatible 架构

- [`vite.config.ts`](../vite.config.ts) 组合 vinext、Sites 和 Cloudflare Vite 插件。
- [`worker/index.ts`](../worker/index.ts) 是 Worker-compatible 入口，负责应用路由和平台图片处理入口。
- Worker 对 GET/HEAD 请求根据实际 `Request.url` 无条件覆写内部 `x-zodiac-request-origin`；metadata 只读取这个内部值，不信任客户端或代理传入的 host/proto 头。
- [`.openai/hosting.json`](../.openai/hosting.json) 声明逻辑 D1 绑定 `DB`；真实资源由 Sites 在部署时创建和接线，仓库配置不等于生产数据库已经存在。
- [`db/schema.ts`](../db/schema.ts) 定义最小 `zodiac_kv` 表；[`drizzle/`](../drizzle/) 保存生成的 SQL migration，并由构建插件复制到 `dist/.openai/drizzle/`。
- Worker 优先使用已有 `env.ZODIAC_KV`，否则把 `env.DB` 包装成业务 `KeyValueStore`；`DB`、静态资源和图片等平台对象不会进入应用运行时白名单。
- [`app/api/chat/route.ts`](../app/api/chat/route.ts) 与 [`app/api/events/route.ts`](../app/api/events/route.ts) 以 Edge Runtime 路由复用 `src/server` 处理函数。

本地 `npm run build` 只证明代码可以生成 Worker-compatible 构建产物，不等于平台部署成功。真实部署前仍需由目标平台提供静态资源、图片服务、环境变量和 KV 绑定，并重新执行公网端到端验证。

### D1 数据形状与运营读回

`zodiac_kv` 只保存业务层已经匿名化的键值、毫秒级到期时间和更新时间。额度键至少保留到下一个 UTC 重置点后一小时；匿名事件与 cohort 聚合逻辑保留 35 天；设备留存状态逻辑保留 10 天。到期值在应用读取时立即视为不存在；D1 适配器在每次写入时通过 `expires_at` 索引清理全部到期行，读取到期键时也会做条件删除。低流量或停流期间的物理删除是后续请求触发的最终一致清理，不应描述成平台定时删除保证。

仓库不提供公开指标 API。小流量 Public Beta 可在平台 D1 控制台用只读查询检查事件聚合，例如：

```sql
SELECT key, value, updated_at
FROM zodiac_kv
WHERE key LIKE 'event:%'
  AND (expires_at IS NULL OR expires_at > unixepoch('now') * 1000)
ORDER BY updated_at DESC;
```

该值是读后写的方向性计数，不是精确计费或高并发性能数据；每次写入附带一次过期清理，仅适用于当前小流量 Public Beta。查询结果也不应导出到公开前端。

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
- `REQUIRE_PERSISTENT_STORE=true` 时缺 KV 是否按预期安全失败；
- 静态页面、API、分享深链、模型请求和匿名留存的公网端到端行为。

完成这些验证前，不应宣称 EdgeOne 部署可用。

## 部署前检查

1. 使用 Node.js 22 执行 `npm ci`。
2. 运行 `npm run typecheck`、`npm test`、`npm run lint`、`npm run build` 和 `node --test tests/rendered-html.test.mjs`。
3. 检查 `dist/.openai/hosting.json` 和 `dist/.openai/drizzle/`；让 Sites 创建/绑定 `DB` 并应用仓库 migration，或在 EdgeOne 绑定兼容的 `ZODIAC_KV`。
4. 仅在平台的服务端秘密管理中配置 `LLM_API_KEY` 与非空 `RATE_LIMIT_SALT`；设置 `REQUIRE_PERSISTENT_STORE=true`，不要把任何秘密写入 Git、README、前端变量或构建日志。
5. 确认入口会清洗并由可信平台重写客户端 IP 头；验证轮换设备不能绕过同 IP 限额、轮换 IP 不能绕过同设备限额。
6. 验证限额和事件经过重启或跨实例后仍可读回，再按本文只读查询核对匿名事件 TTL 与留存口径。
7. 使用真实部署 URL 验证首页、`/explore`、分享深链、`/api/chat`、`/api/events` 和 `/og.png`。
8. 验证失败响应不泄漏密钥，双声道卡片不显示人格/选择结果，分享与遥测不包含问卷答案或聊天正文。

本项目当前没有自动发布工作流；[GitHub CI](../.github/workflows/ci.yml) 只做构建与测试。
