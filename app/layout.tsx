import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

interface HeaderReader {
  get(name: string): string | null;
}

function validatedRequestOrigin(value: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 2048) return null;
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.origin !== candidate
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function requestOrigin(requestHeaders: HeaderReader): string | null {
  return validatedRequestOrigin(
    requestHeaders.get("x-zodiac-request-origin"),
  );
}

function siteMetadata(imageUrl: string): Metadata {
  return {
  title: {
    default: "同一道题，两种AI｜AI星座搭子",
    template: "%s｜AI星座搭子",
  },
  description:
    "同一道题，比较两种AI表达，选出更对味的沟通人格。12套开放人格，可确认、聊天、分享并下载JSON。",
  applicationName: "AI星座搭子",
  keywords: ["AI人格", "星座", "提示词", "开源", "AI搭子"],
  authors: [{ name: "zodiac-persona-kit contributors" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "同一道题，两种AI｜AI星座搭子",
    description: "比较同一道题的两种AI表达，选出更对味的沟通人格。",
    siteName: "AI星座搭子",
    images: [
      {
        url: imageUrl,
        width: 1731,
        height: 909,
        alt: "AI星座搭子：同一道题，两种AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "同一道题，两种AI｜AI星座搭子",
    description: "比较同一道题的两种AI表达，选出更对味的沟通人格。",
    images: [imageUrl],
  },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = requestOrigin(await headers());
  const imageUrl = origin ? new URL("/og.png", origin).toString() : "/og.png";
  return siteMetadata(imageUrl);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
