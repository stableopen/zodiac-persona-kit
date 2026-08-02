# 技术负责人上下文

更新日期：2026-08-02

## 架构事实

- Web：React、TypeScript、vinext/Vite，移动端优先。
- 人格数据：`personas/*.json`，由 `src/lib/personas.ts` 加载与校验；系统提示词由服务端编译。
- 双声道：`src/lib/duel.ts` 保存 2 个审核情境、12 人格短回复、确定性对照、差异说明和五字段安全深链。
- 默契度归属：`matchForDuelChoice` 只在用户保留问卷主推荐时沿用分数；改选对照人格返回 `null`。
- 分享卡：普通结果使用人格卡；双声道使用独立匿名 A/B Canvas 卡，只绘制题目、两条回答、二维码和娱乐声明。
- 本地状态：`src/lib/local-state.ts` 保存确认人格和最近 9 条当前会话；不上传本地历史。
- 聊天：`src/server/chat.ts` 调用 OpenAI 兼容接口，只接受 user/assistant，最多发送最近 4 轮，默认最多 300 tokens。
- 运行时桥接：`worker/index.ts` 优先沿用 `ZODIAC_KV`，否则由 `worker/runtime-env.ts` 把 Sites `DB` 包装为 `KeyValueStore`；`bridgeRuntimeEnv` 只把字符串白名单和最终 KV 写入应用全局，不扩散 DB/ASSETS/IMAGES 等平台对象。
- Sites 持久化：`db/schema.ts` 定义 `zodiac_kv(key,value,expires_at,updated_at)` 与 `expires_at` 索引；`drizzle/0000_square_vanisher.sql`、`0001_pink_captain_midlands.sql` 由 Drizzle Kit 生成并随构建打包。业务模块不直接依赖 D1；D1 KV 首次读写前用两条幂等单语句建立最小表/索引，并用绑定级 Promise 缓存避免同一 isolate 重复初始化，失败会清缓存后允许重试。Drizzle migration 仍是权威结构历史。
- 本地开发配置：`vite.config.ts` 仅在 `command === "serve"` 时传入已有配置；普通字段进入 Wrangler `vars`，`LLM_API_KEY` 与 `RATE_LIMIT_SALT` 只以 `secrets.required` 名称声明并由 Wrangler 从父进程读取，build 不嵌入秘密。
- 事件：`src/server/events.ts` 使用事件与安全元数据白名单；拒绝正文和额外字段。
- 留存：`src/server/retention.ts` 使用 `RATE_LIMIT_SALT + x-zodiac-device` 的 SHA-256 匿名关联，不含 IP；设备状态 TTL 10 天，cohort TTL 35 天。
- 访客限额：`src/server/quota.ts` 对 IP 和设备分别做带私盐、域分隔的 SHA-256 并分别计数，任一达到上限即拒绝；缺私盐或无有效身份时在模型调用前安全失败。
- OG origin：Worker 对 GET/HEAD 从真实 `Request.url.origin` 覆盖内部头；Layout 只接受该内部头的纯 `http/https` origin，不读取公开 forwarded/host 头。

## 安全与降级

- 原始设备 ID、IP、问卷答案和聊天正文不得进入留存 KV。
- 只有模型上游成功且回复非空时记录成功回复。
- 留存配置或写入失败不得把正常聊天变成失败。
- 分享 URL 只允许 `scenario/left/right/pick/ref`，严格校验且不接受额外键。
- 生产必须配置稳定且保密的 `RATE_LIMIT_SALT`、持久 `ZODIAC_KV` 和模型环境变量；密钥不得进入仓库。
- Public Beta 生产必须设置 `REQUIRE_PERSISTENT_STORE=true`；缺共享 KV/D1 时限额和事件返回 503，不允许静默回退内存。
- 原始 IP 和设备 ID 不进入额度 KV 或响应；留存写入失败仍不得影响已成功聊天。
- 不创建含模型密钥或私盐的 `.env.local`；当前本地接入只使用服务进程环境，Context 只记录字段名和验收结果。

## 常用命令

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node --test tests/rendered-html.test.mjs`

## 验收历史与证据

- 2026-08-01：全量 34/34 单元测试、类型检查、lint、生产构建和 3/3 服务端渲染通过。
- 2026-08-01 外部审计修复后：全量 40/40 单元测试、类型检查、lint、生产构建和 4/4 服务端渲染通过；CEO 独立复跑本轮相关 19/19、4/4 服务端渲染和类型检查。
- 2026-08-02 本地优先复核：相关 4 个测试文件 22/22 通过；`/` 与 `/explore` 为 200；浏览器实走直选处女座、双声道选 B、揭示双鱼座、确认与导出入口。`ZodiacApp.tsx` 在 duel 结果使用 `createDuelShareCard`，旧人格结果卡只用于普通结果页回退。
- 2026-08-02 提交 `aea5a1c` 的完整门禁通过：typecheck、Vitest 9 文件 40/40、lint、vinext production build、SSR 4/4。
- 2026-08-02 提交 `3d03825` 完成运行时环境桥接：测试先以缺少桥接函数 2/2 RED，再转为 2/2 GREEN；CEO 重启后 `/api/chat` 返回 200、`personaVersion=0.1.0`、非空双鱼人格回复、`quota.remaining=4`，回复先共情再给轻量行动建议。
- 2026-08-02 Hero 密度优化验证：1440×900 标题 2 行、主 CTA 底部约 663px；390×844 标题 3 行、返回用户继续聊天与 Hero 主 CTA 均在首屏；两视口无横向溢出、控制台 error=0。最终 typecheck、Vitest 10 文件 42/42、lint、production build、SSR 4/4 通过。
- 2026-08-02 提交 `3038320` 的 Public Beta 持久化基线曾通过 typecheck、Vitest 55/55、lint、production build、SSR 4/4，并以真实 SQLite 覆盖 migration、upsert、到期清理和索引。
- 2026-08-02 空 D1 运行缺口修复：新增测试先以 `no such table: zodiac_kv` 失败，再验证首次 get/put 前仅初始化一次表与索引；修复提交为 `5070ddd`。当前 HEAD `b5ac30f` 已通过 typecheck、全量 Vitest 13 文件 56/56、lint、production build、SSR 4/4 和 `git diff --check`。
- 留存边界覆盖：同日不计、后续第 1/7 日、错人格、分散单次、超过 7 日、失败回复、确认竞态、缺盐/设备/KV 降级与隐私扫描。
- 关键测试：`tests/duel.test.ts`、`tests/local-state.test.ts`、`tests/events.test.ts`、`tests/retention.test.ts`、`tests/chat-api.test.ts`、`tests/telemetry.test.ts`、`tests/rendered-html.test.mjs`。

## 已知限制

- KV 接口只有 get/put，cohort 聚合为读后写；高并发可能丢失增量。
- D1 每个 put 先按 `expires_at` 索引清理到期行，再 upsert；过期 get 做条件删除。停流期间物理删除要等后续请求，且并行计数写会重复清理，仅适合小流量 Beta。
- 访客额度同样是读后写；高并发可能竞态，且共享公网 IP 可能让同一网络用户共享限额。
- 来源 IP 可信度依赖生产代理正确覆盖连接来源头；OG origin 依赖页面请求经过当前 Worker。
- 尚未全面验证真实手机 Web Share；公开匿名与第二会话/设备传播链路仍是 Public Beta P1。
- Sites version 3 已于 2026-08-02 部署，来源提交为 `5070ddd`；站点 active，访问模式为 `custom`，仅 1 个所有者、0 个外部访客。
- 生产 `/`、`/explore`、真实 DeepSeek 非空聊天、事件写入已通过；额度从 version 2 的 3 延续到 version 3 的 2，证明 D1 持久状态跨部署延续。
- 环境变量 revision=1 已包含模型、私盐、限额和严格存储键；只读取键名与 secret 标志，没有读取、回显或保存值。
- GitHub remote、公开仓库、远程 Node.js 22 CI、全新克隆复现和正式标签均未完成。
- 当前没有仓库内 `.env` 模型配置；本地 DeepSeek 仅由 dev 服务进程持有，重启时若未再次注入会安全降级为 503。仅 `.env.example` 被跟踪，`.env*`、`.wrangler/`、本地日志和临时输出均保持忽略。

## 下一步

1. 保留现有架构和 V0.1/V0.2 路径；本地重启继续使用项目外进程配置，不创建秘密文件、不实现假回复。
2. 建立 GitHub remote 后运行 Node.js 22 远程 CI，并从全新克隆按 README 复现完整门禁。
3. 获得所有者明确授权后切换公开访问；用未登录浏览器走完核心路径，用第二会话/设备验证真实分享链接并读回一次生产事件聚合。
4. 正式放量前把访客额度和留存 cohort 更新迁移到原子计数、事务存储或单写者聚合；真实数据出现前不宣称市场、传播、留存或商业成立。
