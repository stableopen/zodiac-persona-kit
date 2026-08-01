import QRCode from "qrcode";
import type { DuelRound } from "../lib/duel";
import { AXIS_KEYS, AXIS_LABELS, type ZodiacPersona } from "../lib/zodiac";

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

export interface DuelShareCardData {
  title: string;
  prompt: string;
  replies: Array<{
    channel: "A" | "B";
    text: string;
  }>;
  url: string;
  disclaimer: string;
}

export function buildDuelShareCardData(
  round: DuelRound,
  shareUrl: string,
): DuelShareCardData {
  const parsedUrl = new URL(shareUrl);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("分享链接无效");
  }

  return {
    title: "同一道题，你会选哪种 AI 回答？",
    prompt: round.prompt,
    replies: [
      { channel: "A", text: round.leftReply },
      { channel: "B", text: round.rightReply },
    ],
    url: parsedUrl.toString(),
    disclaimer: "星座文化灵感 · 仅供娱乐 · 不含问卷答案或聊天正文",
  };
}

function fillWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxCharacters: number,
  lineHeight: number,
  maxLines: number,
) {
  const characters = Array.from(text);
  for (let index = 0; index < maxLines; index += 1) {
    const start = index * maxCharacters;
    if (start >= characters.length) break;
    const isLastLine = index === maxLines - 1;
    const hasOverflow = characters.length > start + maxCharacters;
    const visibleCharacters = characters.slice(start, start + maxCharacters);
    if (isLastLine && hasOverflow) {
      visibleCharacters.splice(-1, 1, "…");
    }
    context.fillText(visibleCharacters.join(""), x, y + index * lineHeight);
  }
}

export async function createDuelShareCard(
  round: DuelRound,
  shareUrl: string,
): Promise<Blob> {
  const data = buildDuelShareCardData(round, shareUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成分享卡");

  const background = context.createLinearGradient(0, 0, 1080, 1440);
  background.addColorStop(0, "#080b20");
  background.addColorStop(0.52, "#25205c");
  background.addColorStop(1, "#101936");
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1440);

  context.globalAlpha = 0.18;
  context.fillStyle = "#8d7bff";
  context.beginPath();
  context.arc(930, 120, 280, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#69d9ff";
  context.beginPath();
  context.arc(80, 1320, 230, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = "rgba(8, 10, 31, 0.78)";
  roundedRect(context, 58, 58, 964, 1324, 46);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.16)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "rgba(255,255,255,.68)";
  context.font = "600 27px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("AI 星 座 搭 子  ·  SAME QUESTION, TWO VOICES", 104, 126);
  context.fillStyle = "#ffffff";
  context.font = "900 53px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText(data.title, 104, 212);
  context.fillStyle = "rgba(255,255,255,.68)";
  context.font = "500 25px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("先不看身份，只凭回答选更对味的一边。", 104, 260);

  context.fillStyle = "rgba(255,255,255,.08)";
  roundedRect(context, 104, 312, 872, 182, 30);
  context.fill();
  context.fillStyle = "#9ca7ff";
  context.font = "700 24px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("这一题", 136, 358);
  context.fillStyle = "#ffffff";
  context.font = "700 32px system-ui, 'Microsoft YaHei', sans-serif";
  fillWrappedText(context, data.prompt, 136, 412, 25, 42, 2);

  data.replies.forEach((reply, index) => {
    const y = 534 + index * 278;
    context.fillStyle =
      index === 0 ? "rgba(130,119,255,.14)" : "rgba(73,203,235,.13)";
    roundedRect(context, 104, y, 872, 244, 34);
    context.fill();
    context.strokeStyle =
      index === 0 ? "rgba(164,155,255,.36)" : "rgba(116,222,246,.34)";
    context.stroke();
    context.fillStyle = index === 0 ? "#aaa1ff" : "#83e4f6";
    context.font = "800 27px system-ui, 'Microsoft YaHei', sans-serif";
    context.fillText(`声道 ${reply.channel}`, 140, y + 54);
    context.fillStyle = "#ffffff";
    context.font = "600 29px system-ui, 'Microsoft YaHei', sans-serif";
    fillWrappedText(context, reply.text, 140, y + 108, 27, 40, 4);
  });

  const qrData = await QRCode.toDataURL(data.url, {
    width: 220,
    margin: 1,
    color: { dark: "#111329", light: "#ffffff" },
  });
  const qrImage = await loadImage(qrData);
  context.fillStyle = "#ffffff";
  roundedRect(context, 740, 1110, 244, 244, 22);
  context.fill();
  context.drawImage(qrImage, 752, 1122, 220, 220);

  context.fillStyle = "#ffffff";
  context.font = "800 32px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("扫码后，也选一次", 104, 1180);
  context.fillStyle = "rgba(255,255,255,.68)";
  context.font = "500 24px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("看看你和朋友偏好的表达方式是否一样", 104, 1228);
  context.fillStyle = "rgba(255,255,255,.52)";
  context.font = "500 21px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText(data.disclaimer, 104, 1322);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("分享卡生成失败"))),
      "image/png",
      0.95,
    );
  });
}

export async function createShareCard(
  persona: ZodiacPersona,
  shareUrl: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成分享卡");

  const background = context.createLinearGradient(0, 0, 1080, 1440);
  background.addColorStop(0, "#090b1d");
  background.addColorStop(0.48, persona.visual.primary);
  background.addColorStop(1, "#17112e");
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1440);

  context.globalAlpha = 0.18;
  context.fillStyle = persona.visual.secondary;
  context.beginPath();
  context.arc(890, 170, 260, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(110, 1210, 210, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = "rgba(8, 9, 25, 0.72)";
  roundedRect(context, 64, 64, 952, 1312, 48);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.16)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "rgba(255,255,255,.72)";
  context.font = "600 28px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("AI 星 座 搭 子  ·  MY AI PERSONA", 112, 132);

  context.fillStyle = "#ffffff";
  context.font = "700 170px system-ui, 'Segoe UI Symbol', sans-serif";
  context.fillText(persona.symbol, 108, 340);
  context.font = "900 88px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText(persona.nameZh, 112, 460);
  context.fillStyle = persona.visual.secondary;
  context.font = "700 38px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText(persona.tagline, 112, 520);

  persona.traits.slice(0, 3).forEach((trait, index) => {
    const x = 112 + index * 274;
    context.fillStyle = "rgba(255,255,255,.11)";
    roundedRect(context, x, 566, 244, 64, 32);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "600 28px system-ui, 'Microsoft YaHei', sans-serif";
    context.textAlign = "center";
    context.fillText(trait, x + 122, 608);
  });
  context.textAlign = "left";

  context.fillStyle = "rgba(255,255,255,.75)";
  context.font = "600 26px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("你的沟通偏好光谱", 112, 706);

  AXIS_KEYS.forEach((key, index) => {
    const y = 758 + index * 62;
    context.fillStyle = "rgba(255,255,255,.7)";
    context.font = "500 24px system-ui, 'Microsoft YaHei', sans-serif";
    context.fillText(AXIS_LABELS[key], 112, y + 21);
    context.fillStyle = "rgba(255,255,255,.12)";
    roundedRect(context, 208, y, 498, 24, 12);
    context.fill();
    const axisGradient = context.createLinearGradient(208, y, 706, y);
    axisGradient.addColorStop(0, persona.visual.primary);
    axisGradient.addColorStop(1, persona.visual.secondary);
    context.fillStyle = axisGradient;
    roundedRect(context, 208, y, 498 * (persona.axes[key] / 100), 24, 12);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "600 23px system-ui, sans-serif";
    context.fillText(String(persona.axes[key]), 730, y + 21);
  });

  const qrData = await QRCode.toDataURL(shareUrl, {
    width: 220,
    margin: 1,
    color: { dark: "#111329", light: "#ffffff" },
  });
  const qrImage = await loadImage(qrData);
  context.fillStyle = "#ffffff";
  roundedRect(context, 748, 744, 244, 244, 22);
  context.fill();
  context.drawImage(qrImage, 760, 756, 220, 220);
  context.fillStyle = "rgba(255,255,255,.7)";
  context.font = "500 22px system-ui, 'Microsoft YaHei', sans-serif";
  context.textAlign = "center";
  context.fillText("扫码测测你的AI搭子", 870, 1026);
  context.textAlign = "left";

  context.strokeStyle = "rgba(255,255,255,.12)";
  context.beginPath();
  context.moveTo(112, 1140);
  context.lineTo(968, 1140);
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "800 34px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("不是给你贴标签，是给AI换个说话方式。", 112, 1208);
  context.fillStyle = "rgba(255,255,255,.58)";
  context.font = "500 22px system-ui, 'Microsoft YaHei', sans-serif";
  context.fillText("星座文化灵感 · 仅供娱乐 · 非心理测量或命运预测", 112, 1260);
  context.fillText("开源：zodiac-persona-kit", 112, 1312);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("分享卡生成失败"))),
      "image/png",
      0.95,
    );
  });
}
