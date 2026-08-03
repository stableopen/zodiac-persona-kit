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
- `src/server/d1-kv.ts`、`worker/runtime-env.ts` 与 `worker/index.ts`：Worker 优先沿用 `ZODIAC_KV`，否则把 Sites `DB` 包装为相同业务接口；首次 D1 读写前以两条幂等单语句建立最小表/索引并按绑定缓存初始化，Drizzle migration 仍是权威结构历史；应用桥接只接收字符串白名单和最终 KV，不接收 D1/资源平台对象。
- `db/schema.ts` 与 `drizzle/`：定义最小 `zodiac_kv` 表和 `expires_at` 清理索引并保存生成迁移；Sites 构建会把 migration 打包到 `dist/.openai/drizzle/`。
- `src/server/runtime.ts`：本地 `vite serve` 通过 Wrangler `vars` 传普通配置，通过 `secrets.required` 从父进程加载密钥与私盐；`REQUIRE_PERSISTENT_STORE=true` 时缺共享存储安全失败，生产构建不注入配置值。
- `README.md` 是中文主入口并含简短 English summary；人格格式与部署边界分别见 `docs/PERSONA_FORMAT.md`、`docs/DEPLOYMENT.md`。
- `.github/workflows/ci.yml` 在 Node.js 22.13.0 上执行安装、类型、单测、lint、构建和构建产物 SSR；没有发布步骤或密钥。公开仓库 Actions run `30783329298` 已在提交 `765036a` 上真实通过。

## Decisions

- 不增加双模型调用；双声道只使用人工审核的公开预置内容。
- 分享 URL 仅允许 `scenario/left/right/pick/ref`；双声道卡片只绘制题目和匿名 A/B 回答，不绘制人格、选择、问卷答案或聊天正文。
- 确认人格和最近会话只保存在当前浏览器；确认另一人格会覆盖旧确认并清除不匹配会话。
- 不做关系匹配、付费、账户、云端历史、社区、更多人格或重型 Agent 运行时。
- 聊天限额要求非空私密 `RATE_LIMIT_SALT`，分别哈希并限制平台 IP 与匿名设备标识；缺盐或两种身份都缺失时在模型调用前返回 503。留存关联仍只使用盐与设备标识，不包含 IP；本地默认可在缺 KV 时用内存限额继续，但 Public Beta 必须设置 `REQUIRE_PERSISTENT_STORE=true` 禁止该降级。
- 社交预览固定使用已检查的 `public/og.png`；Worker 从实际 Request URL 无条件覆写内部 `x-zodiac-request-origin`，metadata 只接受该内部头中的纯 http/https origin，不信任 forwarded/host 输入，也不硬编码生产域名。

## Deploy / Run Notes

- 2026-08-03 用户将当前交付范围收敛为“GitHub `main` 源码正常 + README 本地运行路径”；在线 Sites 仅作可选预览，不承诺网络或地区可达，不再是当前验收门槛。第二会话分享和生产事件聚合读回转为后续验证项，不再阻断本次 GitHub 交付。
- GitHub 提交 `0ade15d` 的 Node.js 22 Actions run `30784605335` 已通过；同一源码曾保存并部署为 Sites version 4、访问策略沿用 public，但该预览状态不替代 GitHub 源码与本地运行验收。
- `.openai/hosting.json` 已声明逻辑 D1 绑定 `DB`，仓库含 schema、生成 migration 和 Worker 适配；浏览器本地状态仍不上传。
- Sites version 3 的生产 `/`、`/explore`、真实 DeepSeek 聊天和事件写入已通过；同一访客额度从 version 2 的 3 延续到 version 3 的 2，证明共享 D1 在跨部署场景保持状态。公开后匿名真实聊天再次返回非空回复、`personaVersion=0.1.0` 与 `quota.remaining=4`。该证据不等于已有公开指标 API、看板或真实留存数据。
- 生产环境变量 revision=1 已包含模型、私盐、限额与严格持久存储所需键；核对只读取键名和 secret 标志，没有读取或记录值。EdgeOne 尚未真实部署验证，`edge-functions/api/*` 只视为适配器。
- 2026-08-02 本地优先复核：`http://localhost:3000/` 与 `/explore` 返回 200；双声道分享入口使用匿名 `createDuelShareCard` 路径，聚焦测试 22/22 通过。随后通过项目外进程配置接入真实 DeepSeek，补齐本地非空聊天回复证据；重启后仍需重新从项目外注入配置。
- 提交 `aea5a1c` 的本地最终门禁已通过：typecheck、Vitest 40/40、lint、生产构建和 SSR 4/4；本地完整可用只剩真实模型非空回复证据。
- 2026-08-02 提交 `3d03825` 完成本地 Worker 环境桥接；DeepSeek 云端 `deepseek-chat` 通过项目外进程配置接入，`POST /api/chat` 返回 200、`personaVersion=0.1.0`、非空双鱼人格回复和有效剩余额度。仓库、日志和团队档案均不保存密钥或私盐值。
- 同轮首页 Hero 在不改文案、颜色、卡片、动画或流程的前提下收紧信息密度；1440×900 标题固定两行且主 CTA 首屏可见，390×844 标题三行、说明与主 CTA 首屏可见，两视口均无横向溢出、控制台 error 为 0。当前门禁为 typecheck、Vitest 42/42、lint、生产构建和 SSR 4/4。
- 公开 MIT 仓库已迁移到 `https://github.com/stableye/zodiac-persona-kit`，默认分支为 `main`、GitHub homepage 保持为空、完整 Git 历史已保留；尚未创建版本标签。提交 `765036a` 的 Node.js 22 Actions run `30783329298` 已通过全部门禁。
- 2026-08-02 全新本地 D1 首次额度读取曾因 `zodiac_kv` 尚未建表返回 `QUOTA_UNAVAILABLE`；提交 `5070ddd` 以失败测试固定空库路径，并在 KV 首次读写前完成幂等初始化。当时基线 HEAD `b5ac30f` 已通过 typecheck、全量 Vitest 13 文件 56/56、lint、生产构建与 SSR 4/4；`git diff --check` 亦通过。
- 2026-08-03 首次公开 CI 暴露两项跨环境阻断：npm 10 clean install 缺少嵌套锁文件项，以及 Node 22 `node:sqlite` 不接受编号占位符 `?1`。提交 `3243e89` 补齐最小锁文件项，提交 `65f5aea` 改用 D1/SQLite 均支持的裸 `?`；同代 Node 22 本地门禁与远程 CI 均通过。
- 提交 `765036a` 把 Next.js 从 `16.2.6` 更新到安全补丁 `16.2.12`，清除 Next.js 自身的直接高危公告；没有使用 `npm audit fix --force` 或超出上游兼容范围的 dependency override。
- 从公开 GitHub URL 全新克隆 `765036a` 到空目录后，按 README 完成 `npm ci`、typecheck、Vitest 56/56、lint、build 和 SSR 4/4；无密钥启动入口后 `/` 与 `/explore` 均返回 200，验证目录保持 clean。

## Known Pitfalls

- Vitest/esbuild 在受限沙箱可能因父目录读取被拒，需要在获准的项目执行环境中运行。
- 在线聊天仍依赖既有 `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`；双声道和深链不依赖模型。
- 本地 DeepSeek 配置只存在于当前 dev 服务进程；服务重启后必须再次从项目外注入，不得把值写入仓库或 Context。缺配置时接口按既有 503 降级。
- 生产代理必须清洗并可信设置 `cf-connecting-ip` / `x-forwarded-for`；直接信任客户端自带转发头会削弱 IP 限额。
- 市场、留存和商业判断仍是假设；事件已具备安全区分，但尚无真实用户数据。
- Sites、第二会话分享和生产聚合读回可能继续作为后续运营验证，但不得重新表述为当前 GitHub 交付阻断，除非用户再次扩大验收范围。
- 当前 KV 接口只有 `get/put`，cohort 聚合不是原子计数；适合 V0.2 小流量验证，正式放量前需换成原子计数或事务存储。
- D1 每次写入都会按索引清理过期行；停流时物理清理要等后续请求触发，且并行额度写入会重复清理。该方案只适用于小流量 Public Beta，不作高并发或定时删除承诺。
- `headers()` 会使 metadata 进入动态渲染；SSR 已验证恶意 forwarded/internal origin 输入会被 Worker 覆写，`https://zodiac.example/` 仍生成该 origin 的绝对 `/og.png`，无 `pages.dev` 回退。
- Node.js 24.13.0 与 Node.js 22.13.0 门禁均已通过；SQL 绑定必须继续使用 D1 与 Node 22 `node:sqlite` 都支持的裸 `?` 占位符，不得回退到编号占位符 `?1`。
- `npm audit --omit=dev` 在 `765036a` 上仍报告 high=3、critical=0，均由 Next.js 固定的 `postcss@8.4.31` 与兼容范围内 `sharp@0.34.5` 传递；当前没有安全的 non-major 自动修复。项目不接收用户 CSS，Worker 图像转换走平台 `IMAGES`，但仍须跟踪上游兼容更新，不能宣称依赖审计为零。
- `ZODIAC_KV` 是项目内部 KV 接口；EdgeOne 可直接提供兼容绑定，Sites 则由 Worker 把 `DB` 适配为该接口。Sites version 3 已用生产额度跨部署延续证明当前 D1 路径可用；其他平台仍须各自完成真实资源和迁移验收。

## Verification Pointers

- 冻结范围：`docs/V0.2_PRODUCT_DECISION.md`
- 双声道/深链/推荐默契度归属：`tests/duel.test.ts`
- 双声道匿名邀请卡：`tests/share-card.test.ts`
- 本地状态：`tests/local-state.test.ts`
- 事件白名单：`tests/events.test.ts`
- 留存口径、隐私与聊天成功接线：`tests/retention.test.ts`、`tests/chat-api.test.ts`、`tests/telemetry.test.ts`
- Worker 环境白名单与本地开发秘密边界：`tests/runtime.test.ts`
- D1 到期/UPSERT、真实 SQLite migration 与 Worker 存储优先级：`tests/d1-kv.test.ts`、`tests/d1-sqlite.test.ts`、`tests/worker-storage.test.ts`
- 服务端渲染、深链和绝对 OG/X URL：`tests/rendered-html.test.mjs`
- 开源入口与格式：`README.md`、`docs/PERSONA_FORMAT.md`、`docs/DEPLOYMENT.md`
- 社交图：`public/og.png`，源/目标 SHA-256 均为 `42FC24286C72628CE98FBFC9E8E0ED873C9A4E0047E19911BC8B42992FD68E07`

## GitHub Launch Assets (2026-08-03)

- 冻结首发主张：让 AI 换一种说法，不换事实。
- README 首屏以公开体验为主 CTA，以 `zodiac-communication-skill` 安装为次 CTA，并明确星座只是沟通协议标签。
- `docs/assets/persona-kit-flow.gif` 是基于当前 `main` 的同版本本地可复现流程示意，不得表述为公开站录屏；公开站在当前录制环境会被 Cloudflare 拦截。
- 两仓唯一发布素材底稿为本仓库 `docs/LAUNCH_KIT.md`；Skill 仓库只链接，不复制。
- `tests/readme-contract.test.ts` 锁定主张、双向链接、动图诚实边界、非占星边界和唯一 launch kit。
