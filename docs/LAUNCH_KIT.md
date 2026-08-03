# Zodiac Persona Kit × Communication Skill Launch Kit

这是一份两仓共用、可直接发布的首发素材底稿。发布前只需替换日期或按平台压缩字数，不得添加未经验证的数据主张。

## 统一事实底稿

- 核心主张：**让 AI 换一种说法，不换事实。**
- [AI星座搭子 / Persona Kit](https://github.com/stableye/zodiac-persona-kit) 是真实互动体验与 12 套人格语义源：匿名比较同一道题的两种审核预置回答，选择后揭示差异，再由用户主动确认 AI 搭子。
- [十二星座沟通风格 / Communication Skill](https://github.com/stableye/zodiac-communication-skill) 是可安装、可审计的 12 套中文 Agent 沟通协议，支持指定人格、按任务透明推荐、双人格并排比较。
- 两边只改变语气、推理组织、回答结构、鼓励和分歧方式；不改变事实、证据、不确定性、安全要求、风险等级或用户任务。
- 星座只是方便记忆的协议标签，不是运势、占星预测、真人性格推断、心理诊断或科学人格测量。
- Persona Kit 的核心 A/B 路径无需登录，也不会为比较额外调用两个模型；只有在线聊天需要自行配置兼容 OpenAI Chat Completions 的模型服务。
- Communication Skill 运行时只用 Python 标准库，不需要网络、账号、API 密钥、UI 或长期记忆。
- 两个仓库均为 MIT 开源。公开体验站是 Persona Kit 的网页体验，不是 Skill 的执行环境。
- README 动图边界：Persona 动图是基于当前 `main` 的同版本本地可复现流程示意，不是公开站录屏；Skill 动图来自真实安装与 CLI 命令输出，不仿任何 Agent 产品界面。

## 约 15–22 秒短视频脚本

### 脚本 1：先听表达，再看标签（约 18 秒）

| 时间 | 画面 | 字幕/口播 |
| --- | --- | --- |
| 0–3 秒 | 首页主张，进入匿名 A/B | 同一道题，两种 AI 回答。你更想听哪一种？ |
| 3–8 秒 | 并排显示声道 A / B | 先不看标签，只凭表达盲选。 |
| 8–13 秒 | 点击一边，揭示处女座 / 双鱼座差异 | 选择后才揭示：一个结构审查，一个先接住感受。 |
| 13–18 秒 | 确认 AI 搭子，出现双仓 CTA | 让 AI 换一种说法，不换事实。先体验，再把协议装进 Agent。 |

### 脚本 2：同一个任务，三种调用方式（约 20 秒）

| 时间 | 画面 | 字幕/口播 |
| --- | --- | --- |
| 0–4 秒 | 安装命令成功 | 一条命令，装入 12 套中文沟通协议。 |
| 4–9 秒 | `render --persona virgo` | 指定处女座：结论、清单、检查点更清楚。 |
| 9–14 秒 | `recommend --task ...` | 不知道选谁？按当前任务透明推荐，并解释命中理由。 |
| 14–20 秒 | `compare --left aries --right pisces` | 也能同事实并排比较：直接行动，或温柔共情。风格变，事实不变。 |

### 脚本 3：好玩，但边界认真（约 17 秒）

| 时间 | 画面 | 字幕/口播 |
| --- | --- | --- |
| 0–4 秒 | 12 人格卡片快速切换 | 星座在这里不是算命，是 12 个容易记住的沟通协议标签。 |
| 4–10 秒 | A/B 揭示 + CLI compare | 网页负责真实体验，Skill 负责可安装、可审计。 |
| 10–14 秒 | 边界文字：事实 / 安全 / 不确定性不变 | 语气可以换，事实、安全和风险不能换。 |
| 14–17 秒 | GitHub 与体验站 CTA | 两仓 MIT 开源。来选一个更对味的 AI 搭子。 |

## 各平台可直接发布文案

### 视频号

同一道题，两种 AI 回答，你会选哪一种？我做了一个匿名 A/B：先凭表达盲选，再揭示两套沟通协议的差异，最后由你确认 AI 搭子。配套 Skill 还能把 12 套中文沟通协议装进 Agent。星座只是好记的标签，不做运势或真人性格判断。让 AI 换一种说法，不换事实。在线体验：<https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site/>；源码见评论区 GitHub。

### 小红书

标题：我把 AI 的“说话方式”做成了 12 套可安装协议

正文：不是给人贴星座标签，也不是算命。这个开源小项目让你先匿名听同一道题的两种 AI 回答，选完才揭示差异；喜欢哪一种，还能把对应沟通协议装进 Agent。支持指定人格、按任务推荐、双人格比较。核心边界只有一句：**让 AI 换一种说法，不换事实。**

体验：<https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site/><br>
源码：<https://github.com/stableye/zodiac-persona-kit> / <https://github.com/stableye/zodiac-communication-skill>

#AI开源 #AgentSkill #提示词工程 #AI工具

### B站

标题：让 AI 换一种说法，不换事实｜12 套中文沟通协议开源了

简介：这次做了两个配套开源项目：Persona Kit 用匿名同题 A/B 帮你找到更对味的表达；Communication Skill 把相同语义做成 12 套可安装、可审计的 Agent 沟通协议。视频演示指定人格、任务推荐和双人格比较。星座仅为协议标签，不用于占星、真人性格推断或科学测量。

体验：<https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site/><br>
GitHub：<https://github.com/stableye/zodiac-persona-kit> / <https://github.com/stableye/zodiac-communication-skill>

### V2EX

标题：[开源] 同题双声道 + 12 套可安装中文 Agent 沟通协议

正文：做了两个 MIT 项目。Persona Kit 先隐藏身份，让用户比较同一道题的两条审核预置回答，选完再揭示差异；Communication Skill 用本地 Python CLI 提供指定人格、任务推荐和双人格比较。设计边界是只改表达，不改事实、证据、安全、不确定性和任务。星座仅是方便记忆的协议标签。欢迎从 README 的动图和本地运行路径开始看：<https://github.com/stableye/zodiac-persona-kit> / <https://github.com/stableye/zodiac-communication-skill>

### 掘金

标题：把 AI 沟通风格从 Prompt 文案做成可审计协议：12 人格、匿名 A/B 与本地 CLI

正文：这个开源实验拆成两层：体验层用匿名同题 A/B 验证表达偏好；协议层用 JSON + 标准库 Python 固定事实、安全和不确定性边界，再支持 render、recommend、compare 三种调用。推荐是可解释的关键词匹配，不冒充语义模型；A/B 是审核预置内容，不额外调用双模型。代码与验收：<https://github.com/stableye/zodiac-persona-kit> / <https://github.com/stableye/zodiac-communication-skill>

### X

I open-sourced a Chinese AI communication-persona pair: an anonymous same-prompt A/B experience plus 12 installable, auditable Agent protocols. Tone and answer shape can change; facts, safety, uncertainty, risk, and the user task cannot. Zodiac names are labels—not astrology or personality science. Demo: <https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site/> Code: <https://github.com/stableye/zodiac-persona-kit> + <https://github.com/stableye/zodiac-communication-skill>

### Reddit

**Title:** I open-sourced an anonymous A/B experience and 12 auditable Chinese communication protocols for AI agents

**Body:** The project separates experience from runtime. Persona Kit lets people compare two reviewed answers to the same prompt before revealing their labels. Communication Skill installs the same semantics as 12 local, auditable protocols with explicit persona rendering, transparent task-based recommendation, and side-by-side comparison. The invariant is simple: presentation may change; facts, evidence, safety, uncertainty, risk level, and the user task may not. Zodiac names are mnemonic labels, not astrology, diagnosis, or scientifically validated personality measurement. Demo: <https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site/> Repos: <https://github.com/stableye/zodiac-persona-kit> and <https://github.com/stableye/zodiac-communication-skill>

## 统一 CTA

主 CTA：**先在 Persona Kit 匿名盲选一次：<https://zodiac-persona-kit.clear-gnome-6249.chatgpt.site/>**

次 CTA：**把 12 套协议装进 Agent：`npx skills add stableye/zodiac-communication-skill@apply-zodiac-communication-style`**

源码 CTA：<https://github.com/stableye/zodiac-persona-kit> · <https://github.com/stableye/zodiac-communication-skill>

## 禁用说法

- 不说“已经有大量用户”“广受欢迎”“安装量领先”“Stars 暴涨”，除非未来附上同口径公开证据。
- 不说“已上架/已通过 OpenAI、ClawHub、Kilo 或任何市场审核”；当前只确认公开 GitHub 源码。
- 不说“科学测出你是什么人格”“根据生日识别真人性格”“改善心理问题”或任何占星、诊断、疗效主张。
- 不说“不会出错”“绝对安全”“完全保护隐私”；应使用仓库中已经验证的具体边界。
- 不把公开体验站说成 Skill 执行环境，也不把本地流程动图说成公开站录屏。
- 不把任务关键词推荐说成语义模型、个性化画像或长期记忆。
- 不伪造用户评价、平台背书、使用量、转化率、Star、Fork、下载或收入数据。
