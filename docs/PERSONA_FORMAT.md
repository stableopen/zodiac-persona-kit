# 人格 JSON 格式说明

AI星座搭子 V0.2 使用 [`personas/`](../personas/) 中的 12 个 JSON 文件作为沟通人格源数据。应用包版本是 `0.2.0`；当前人格内容和格式版本仍为 `0.1.0`，本轮不批量升级人格文件。

## 固定人格 ID

当前只接受以下 12 个 `id`：

```text
aries, taurus, gemini, cancer, leo, virgo,
libra, scorpio, sagittarius, capricorn, aquarius, pisces
```

V0.2 的页面、测试和双声道数据都以这组 ID 为边界。新增第 13 种人格不仅是新增 JSON，还需要同步修改类型、导入、产品范围和测试。

## 字段

| 字段 | 类型与约束 | 用途 |
| --- | --- | --- |
| `id` | 上述 12 个英文 ID 之一 | 稳定标识与 URL/事件安全维度 |
| `version` | 非空字符串 | 人格内容/格式版本，当前为 `0.1.0` |
| `nameZh` | 非空字符串 | 中文名称 |
| `element` | `fire`、`earth`、`air`、`water` | 视觉与分类元素 |
| `symbol` | 非空字符串 | 展示符号 |
| `tagline` | 非空字符串 | 一句话风格 |
| `traits` | 至少一个非空字符串 | 简短特征标签 |
| `axes` | 六个 0–100 整数 | 沟通风格轴 |
| `communication` | 五个非空字符串 | 语气、推理、回答结构、鼓励和分歧方式 |
| `prompt` | 见下文 | System Prompt 的身份、规则、禁区和示例 |
| `visual` | 两个六位十六进制颜色 | `primary` 与 `secondary` 主题色 |

`axes` 必须完整包含：

```text
directness, structure, empathy, novelty, decisiveness, sociability
```

`communication` 必须完整包含：

```text
tone, reasoning, answerShape, encouragement, disagreement
```

`prompt` 结构：

- `identity`：非空字符串；描述该 AI 搭子的职责与优势。
- `rules`：至少一个非空字符串；生成回答时必须遵循的规则。
- `avoid`：至少一个非空字符串；需要避免的表达或行为。
- `examples`：至少一个 `{ "user": string, "assistant": string }` 示例。

完整示例见 [`personas/aries.json`](../personas/aries.json)，TypeScript 定义与运行时校验见 [`src/lib/zodiac.ts`](../src/lib/zodiac.ts)。当前校验器会抽取已知字段；贡献者不应依赖未声明字段。

## 加载与校验

[`src/lib/personas.ts`](../src/lib/personas.ts) 静态导入全部 12 个 JSON，并在模块加载时调用 `validatePersona`。以下测试会检查字段、颜色、轴值、ID 唯一性和版本：

```bash
npm test -- tests/personas.test.ts
```

完整交付前仍应运行 README 中的全部验证命令。

## 修改原则

1. `id` 是稳定标识，不因文案调整而改变。
2. 修改内容或格式时明确评估人格 `version`，不要用应用包版本替代人格版本。
3. 保持回答风格差异，但不要加入歧视、伤害、操控或确定性命运判断。
4. 示例不得包含真实个人信息、密钥、内部数据或未经许可的受版权保护文本。
5. 星座仅作为沟通风格载体；不得把这些 JSON 描述为科学人格诊断、心理评估或占星预测。
