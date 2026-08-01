# Project Context

## Overview

- AI星座搭子是中文 AI 沟通人格体验站；V0.1 的测试、结果、聊天、分享、Prompt/JSON 和 `/explore` 必须保持可用。
- V0.2（2026-08-01）唯一核心体验是“同题双声道”：先隐藏身份比较两条审核预置回复，再揭示差异并由用户主动确认搭子。
- 应用包版本为 `0.2.0`；12 个人格 JSON 自身版本继续保持 `0.1.0`，二者独立演进。

## Commands

- Windows PowerShell 使用 `npm.cmd`，避免本机执行策略拦截 `npm.ps1`。
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run test:render`

## Architecture

- `src/lib/duel.ts`：审核预置情境/回复、确定性对照人格、安全分享深链构建与解析。
- `src/lib/local-state.ts`：版本化本地确认人格与最近九条当前会话的校验、覆盖和裁剪；不直接访问浏览器 API。
- `app/components/ZodiacApp.tsx`：页面状态、localStorage 副作用、聊天重试与分享交互；问卷主推荐被对照人格覆盖时会清除原推荐默契度。
- `src/client/share-card.ts`：结果页人格卡与双声道匿名 A/B 邀请卡是两条独立 Canvas 生成路径。
- `app/layout.tsx`：动态 metadata 只读取 Worker 根据实际 Request URL 覆写的内部 origin 头，为 Open Graph/X 生成绝对 `/og.png` URL。
- `src/server/events.ts`：事件名和元数据精确白名单；`src/server/quota.ts` 按服务端日期桶及安全维度计数。
- `src/server/retention.ts`：用严格匿名设备哈希关联确认与服务端成功回复，按 UTC 基准日计算 7 日同人格有效复用率；口径见 `docs/V0.2_RETENTION_METRIC.md`。
- `README.md` 是中文主入口并含简短 English summary；人格格式与部署边界分别见 `docs/PERSONA_FORMAT.md`、`docs/DEPLOYMENT.md`。
- `.github/workflows/ci.yml` 配置为在 Node.js 22 上执行安装、类型、单测、lint、构建和构建产物 SSR；没有发布步骤或密钥，尚未在 GitHub 真实运行。

## Decisions

- 不增加双模型调用；双声道只使用人工审核的公开预置内容。
- 分享 URL 仅允许 `scenario/left/right/pick/ref`；双声道卡片只绘制题目和匿名 A/B 回答，不绘制人格、选择、问卷答案或聊天正文。
- 确认人格和最近会话只保存在当前浏览器；确认另一人格会覆盖旧确认并清除不匹配会话。
- 不做关系匹配、付费、账户、云端历史、社区、更多人格或重型 Agent 运行时。
- 聊天限额要求非空私密 `RATE_LIMIT_SALT`，分别哈希并限制平台 IP 与匿名设备标识；缺盐或两种身份都缺失时在模型调用前返回 503。留存关联仍只使用盐与设备标识，不包含 IP；缺少持久 KV 时聊天可用内存限额继续，但跳过留存。
- 社交预览固定使用已检查的 `public/og.png`；Worker 从实际 Request URL 无条件覆写内部 `x-zodiac-request-origin`，metadata 只接受该内部头中的纯 http/https origin，不信任 forwarded/host 输入，也不硬编码生产域名。

## Deploy / Run Notes

- 远程 CI 与生产部署状态以当前仓库 Actions 和部署记录为准；Sites 版本 1 已于 2026-08-01 部署到 `https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site`，截至 2026-08-02 访问模式仍为 `custom`，仅所有者可见。
- `.openai/hosting.json` 继续保持无 D1/R2 绑定；浏览器本地状态不上传。
- 实际计算留存指标前必须选择持久存储、实现 `ZODIAC_KV` 平台适配并配置稳定的 `RATE_LIMIT_SALT`；当前没有已绑定的持久资源、公开指标 API 或看板。
- 本地 Worker-compatible 构建与 Sites 打包/发布已验证；Sites 环境变量 revision=0、entries=[]，生产站尚未配置模型或私盐，也未做生产聊天与限额验收。EdgeOne 尚未真实部署验证，`edge-functions/api/*` 只视为适配器。
- 2026-08-02 本地优先复核：`http://localhost:3000/` 与 `/explore` 返回 200；双声道分享入口使用匿名 `createDuelShareCard` 路径，聚焦测试 22/22 通过。当前没有项目级 `LLM_*`/`RATE_LIMIT_SALT` 配置或可安全复用的 localhost 模型上游，`POST /api/chat` 返回 503 `MODEL_NOT_CONFIGURED`，因此只能称“本地可看、玩法可体验”，不能称真实聊天可用。
- 提交 `aea5a1c` 的本地最终门禁已通过：typecheck、Vitest 40/40、lint、生产构建和 SSR 4/4；本地完整可用只剩真实模型非空回复证据。
- 最小开源发布准备完成了本地文件、CI 配置和私有 Sites 部署；GitHub 建库、公开推送与远程 CI 仍未完成，本机缺少 GitHub CLI。

## Known Pitfalls

- Vitest/esbuild 在受限沙箱可能因父目录读取被拒，需要在获准的项目执行环境中运行。
- 在线聊天仍依赖既有 `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`；双声道和深链不依赖模型。
- 生产代理必须清洗并可信设置 `cf-connecting-ip` / `x-forwarded-for`；直接信任客户端自带转发头会削弱 IP 限额。
- 市场、留存和商业判断仍是假设；事件已具备安全区分，但尚无真实用户数据。
- 当前 KV 接口只有 `get/put`，cohort 聚合不是原子计数；适合 V0.2 小流量验证，正式放量前需换成原子计数或事务存储。
- `headers()` 会使 metadata 进入动态渲染；SSR 已验证恶意 forwarded/internal origin 输入会被 Worker 覆写，`https://zodiac.example/` 仍生成该 origin 的绝对 `/og.png`，无 `pages.dev` 回退。
- 当前本地门禁运行于 Node.js 24.13.0；最低 Node.js 22.13.0 与 CI 的 Node.js 22 目标仍需由真实 GitHub Actions 运行复验。
- `ZODIAC_KV` 是项目内部 KV 接口，不是可直接假定存在的平台绑定；生产启用前必须有真实存储资源和适配实现证据。

## Verification Pointers

- 冻结范围：`docs/V0.2_PRODUCT_DECISION.md`
- 双声道/深链/推荐默契度归属：`tests/duel.test.ts`
- 双声道匿名邀请卡：`tests/share-card.test.ts`
- 本地状态：`tests/local-state.test.ts`
- 事件白名单：`tests/events.test.ts`
- 留存口径、隐私与聊天成功接线：`tests/retention.test.ts`、`tests/chat-api.test.ts`、`tests/telemetry.test.ts`
- 服务端渲染、深链和绝对 OG/X URL：`tests/rendered-html.test.mjs`
- 开源入口与格式：`README.md`、`docs/PERSONA_FORMAT.md`、`docs/DEPLOYMENT.md`
- 社交图：`public/og.png`，源/目标 SHA-256 均为 `42FC24286C72628CE98FBFC9E8E0ED873C9A4E0047E19911BC8B42992FD68E07`
