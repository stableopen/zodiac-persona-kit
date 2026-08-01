# 技术负责人上下文

更新日期：2026-08-01

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
- 留存边界覆盖：同日不计、后续第 1/7 日、错人格、分散单次、超过 7 日、失败回复、确认竞态、缺盐/设备/KV 降级与隐私扫描。
- 关键测试：`tests/duel.test.ts`、`tests/local-state.test.ts`、`tests/events.test.ts`、`tests/retention.test.ts`、`tests/chat-api.test.ts`、`tests/telemetry.test.ts`、`tests/rendered-html.test.mjs`。

## 已知限制

- KV 接口只有 get/put，cohort 聚合为读后写；高并发可能丢失增量。
- 访客额度同样是读后写；高并发可能竞态，且共享公网 IP 可能让同一网络用户共享限额。
- 来源 IP 可信度依赖生产代理正确覆盖连接来源头；OG origin 依赖页面请求经过当前 Worker。
- 尚未用真实线上模型完成生产聊天验证，也未全面验证真实手机 Web Share。
- 当前工作树为初始未提交状态，尚未推送或部署。

## 下一步

1. 保留现有架构和 V0.1/V0.2 路径，创建本地首次提交并部署精确提交。
2. 部署时设置稳定私盐、持久 KV、模型配置和费用硬限制，并验证可信代理 IP 头与 Worker origin 覆盖。
3. 在真实平台验证双限额和互动分享二维码；GitHub 登录工具可用后运行远程 Node 22 CI。
4. 正式放量前把访客额度和留存 cohort 更新迁移到原子计数、事务存储或单写者聚合。
