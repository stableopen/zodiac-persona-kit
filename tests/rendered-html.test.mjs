import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/", requestHeaders = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  const requestUrl = /^https?:\/\//.test(pathname)
    ? pathname
    : `http://localhost${pathname}`;

  return worker.fetch(
    new Request(requestUrl, {
      headers: { accept: "text/html", ...requestHeaders },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished AI星座搭子 homepage", async () => {
  const response = await render("https://zodiac.example/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /AI星座搭子/);
  assert.match(html, /你的AI/);
  assert.equal(
    (html.match(/class="hero-title-line"/g) ?? []).length,
    2,
    "首页主标题应由两个受控标题行组成",
  );
  assert.match(html, /class="hero-title-accent"[^>]*>星座？<\/span>/);
  assert.match(html, /测测我的AI搭子/);
  assert.match(html, /同一道题，让两种AI回答给你听/);
  assert.match(html, /同一道题，两种AI/);
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/zodiac\.example\/og\.png"\/>/,
  );
  assert.match(
    html,
    /<meta name="twitter:image" content="https:\/\/zodiac\.example\/og\.png"\/>/,
  );
  assert.doesNotMatch(html, /zodiac-persona-kit\.pages\.dev/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("social metadata ignores injected proxy and internal origin headers", async () => {
  const response = await render("https://zodiac.example/", {
    "x-forwarded-host": "attacker.example",
    "x-forwarded-proto": "http",
    "x-zodiac-request-origin": "https://attacker.example/steal?from=proxy",
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/zodiac\.example\/og\.png"\/>/,
  );
  assert.match(
    html,
    /<meta name="twitter:image" content="https:\/\/zodiac\.example\/og\.png"\/>/,
  );
  assert.doesNotMatch(
    html,
    /attacker\.example|javascript:|zodiac-persona-kit\.pages\.dev/,
  );
});

test("server-renders a validated shared duel without login", async () => {
  const response = await render(
    "/?scenario=busy-day&left=virgo&right=pisces&pick=virgo&ref=share_12345678",
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /今天事情堆在一起/);
  assert.match(html, /声道 A/);
  assert.match(html, /声道 B/);
  assert.match(html, /朋友邀请你来选/);
});

test("server-renders the twelve-persona explore route", async () => {
  const response = await render("/explore");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /12种表达/);
  assert.match(html, /白羊座/);
  assert.match(html, /双鱼座/);
});
