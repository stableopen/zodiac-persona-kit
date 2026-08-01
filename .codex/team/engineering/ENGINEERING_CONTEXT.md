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
- 原始 IP 和设备 ID 不进入额度 KV 或响应；留存写入失败仍不得影响已成功聊天。

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
- 留存边界覆盖：同日不计、后续第 1/7 日、错人格、分散单次、超过 7 日、失败回复、确认竞态、缺盐/设备/KV 降级与隐私扫描。
- 关键测试：`tests/duel.test.ts`、`tests/local-state.test.ts`、`tests/events.test.ts`、`tests/retention.test.ts`、`tests/chat-api.test.ts`、`tests/telemetry.test.ts`、`tests/rendered-html.test.mjs`。

## 已知限制

- KV 接口只有 get/put，cohort 聚合为读后写；高并发可能丢失增量。
- 访客额度同样是读后写；高并发可能竞态，且共享公网 IP 可能让同一网络用户共享限额。
- 来源 IP 可信度依赖生产代理正确覆盖连接来源头；OG origin 依赖页面请求经过当前 Worker。
- 尚未用真实线上模型完成生产聊天验证，也未全面验证真实手机 Web Share。
- 本地源码已提交；Sites 源提交 `9442e73` 已打包为版本 1，并于 2026-08-01 成功部署为仅所有者可见的生产站。
- 当前 Sites 环境变量修订为初始空配置；在线聊天、私盐限额和持久留存尚未在生产启用或验证。
- GitHub CLI 尚未安装，公开 GitHub 仓库与远程 Node 22 CI 尚未创建或运行。
- 2026-08-02 实时审计：Sites 访问模式为 `custom`，仅 1 个所有者、0 个组和 0 个外部访客；环境变量 revision=0、entries=[]；本地 `localhost:3000` 返回 200。
- 当前 HEAD 与 Sites 版本 1 的运行时代码一致，差异仅为后续 `.codex` 上下文文档；生产版本源提交为 `9442e73`。
- `ZODIAC_KV` 目前只是运行时抽象接口，不是已配置的 Sites 持久资源；需要先选择存储并实现平台绑定适配。
- 当前项目没有真实 `.env` 模型配置，进程环境中的 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`、`RATE_LIMIT_SALT` 均未设置，也未发现可安全复用的 localhost OpenAI-compatible 服务；`POST /api/chat` 返回 503 `MODEL_NOT_CONFIGURED`。

## 下一步

1. 保留现有架构和 V0.1/V0.2 路径；先通过项目外秘密配置接入所有者的 OpenAI-compatible 上游并验证一条真实本地回复，不实现假回复。
2. 获得所有者明确授权后切换公开访问并验证未登录请求；启用生产聊天前设置稳定私盐和费用硬限制。
3. 完成持久存储选型与适配后，再验证可信代理 IP、双限额、留存和 Worker origin；用第二台未登录设备验证互动分享二维码。
4. 安装并登录 GitHub CLI 后运行远程 Node 22 CI；正式放量前把访客额度和留存 cohort 更新迁移到原子计数、事务存储或单写者聚合。
