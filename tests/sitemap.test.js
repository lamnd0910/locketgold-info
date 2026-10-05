import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sitemapXml, PUBLIC_PATHS } from "../src/sitemap.js";
import worker from "../worker/index.js";
import { FALLBACK_POSTS } from "../src/fallback-posts.js";

const request = (method = "GET") => new Request("https://locketgold.info/sitemap.xml", { method });
const assets = (archive) => ({ async fetch(req) {
  assert.equal(new URL(req.url).pathname, "/imported-posts/index.json");
  return Response.json(archive);
} });

test("sitemap covers the real archive once and prefers published database copies", async () => {
  const archive = JSON.parse(await readFile(new URL("../public/imported-posts/index.json", import.meta.url), "utf8"));
  const report = JSON.parse(await readFile(new URL("../public/imported-posts/duplicate-report.json", import.meta.url), "utf8"));
  const live = archive.filter((post) => post.duplicate_of).map((post) => ({ ...post, slug: post.duplicate_of, duplicate_of: undefined, published_at: "2026-10-04 12:00:00" }));
  live.push({ slug: "new-admin-article", title: "Bài mới từ admin", published_at: "2026-10-05" });
  const response = await worker.fetch(request(), { ASSETS: assets(archive), DB: { prepare(sql) {
    assert.match(sql, /WHERE status = 'published'/);
    return { async all() { return { results: live }; } };
  } } }, {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /application\/xml/);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(urls.length, PUBLIC_PATHS.length + report.visible_articles + FALLBACK_POSTS.length + 1);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.includes("https://locketgold.info/bai-viet/?bai=new-admin-article"));
  assert.match(xml, /<lastmod>2026-10-05<\/lastmod>/);
  for (const post of live.slice(0, 13)) assert.ok(urls.includes(`https://locketgold.info/bai-viet/?bai=${post.slug}`));
  for (const post of archive.filter((item) => item.duplicate_of)) assert.ok(!urls.includes(`https://locketgold.info/bai-viet/?bai=${post.slug}`));
  assert.ok(!urls.some((value) => {
    const url = new URL(value);
    return /quan-tri|thanh-toan|\/api\/|imported-posts/.test(url.pathname) || url.searchParams.has("trang");
  }));
});

test("sitemap omits invalid slugs and dates and does not invent modification times", () => {
  const xml = sitemapXml([
    { slug: "valid", title: "Bài viết", published_at: "2026-02-30" },
    { slug: "../secret", title: "Invalid" },
    { slug: "valid-date", title: "Bài khác", published_at: "2026-10-04 12:08:55" },
  ]);
  assert.ok(!xml.includes("secret"));
  assert.ok(!xml.includes("2026-02-30"));
  assert.match(xml, /<lastmod>2026-10-04<\/lastmod>/);
  assert.equal((xml.match(/<lastmod>/g) || []).length, 1);
});

test("sitemap supports HEAD and refuses mutations", async () => {
  const head = await worker.fetch(request("HEAD"), { ASSETS: assets([]) }, {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const post = await worker.fetch(request("POST"), {}, {});
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, HEAD");
});

test("archive failure returns a retryable error instead of an incomplete successful sitemap", async () => {
  const response = await worker.fetch(request(), { ASSETS: { async fetch() { return new Response("Not found", { status: 404 }); } } }, {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Retry-After"), "60");
});

test("unknown article URLs return 404 and noindex", async () => {
  const response = await worker.fetch(new Request("https://locketgold.info/bai-viet/?bai=missing"), { ASSETS: { async fetch(req) {
    return new URL(req.url).pathname === "/bai-viet/"
      ? new Response("<html><head></head><body></body></html>", { headers: { "Content-Type": "text/html" } })
      : new Response("Not found", { status: 404 });
  } } }, {});
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
});
