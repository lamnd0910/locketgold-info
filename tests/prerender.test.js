import assert from "node:assert/strict";
import test from "node:test";
import { createPageRenderer } from "../src/page-render.js";
import { articleMarkup, archiveView } from "../src/post-view.js";

test("all public pages contain real navigation links and content before JavaScript runs", () => {
  for (const page of ["home", "pricing", "trust", "posts", "guide", "ctv", "contact", "dns"]) {
    const html = createPageRenderer(page).render();
    assert.match(html, /<h1[ >]/);
    for (const path of ["/", "/len-gold/", "/uy-tin/", "/bai-viet/", "/huong-dan/", "/cong-tac-vien/", "/lien-he/", "/tai-dns/"]) assert.ok(html.includes(`href="${path}"`), `${page} must link to ${path}`);
    assert.equal((html.match(/id="main-nav"/g) || []).length, 1);
  }
});

test("checkout template still respects the selected plan without relying on a global browser location", () => {
  const html = createPageRenderer("checkout", "?plan=android-lifetime").render();
  assert.match(html, /value="android-lifetime" checked/);
});

test("server-rendered article includes the full content and escapes unsafe HTML", () => {
  const html = articleMarkup({ slug: "test", title: '<script>unsafe</script>', excerpt: '<img onerror="bad">', content: "First paragraph\nSecond paragraph\n<script>alert(1)</script>", published_at: "2026-10-05" });
  assert.match(html, /<h1>&lt;script&gt;unsafe&lt;\/script&gt;<\/h1>/);
  assert.match(html, /<p>First paragraph<\/p><p>Second paragraph<\/p>/);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes('href="/bai-viet/"'));
});

test("a crawler following pagination links can reach every article without JavaScript", () => {
  const posts = Array.from({ length: 2457 }, (_, index) => ({ slug: `article-${index}`, title: `Article ${index}` }));
  const pending = [1], visited = new Set(), slugs = new Set();
  while (pending.length) {
    const page = pending.pop();
    if (visited.has(page)) continue;
    visited.add(page);
    const view = archiveView(posts, page);
    for (const match of view.cards.matchAll(/href="\/bai-viet\/\?bai=([^"]+)"/g)) slugs.add(match[1]);
    for (const match of view.controls.matchAll(/href="\/bai-viet\/\?trang=(\d+)"/g)) if (!visited.has(Number(match[1]))) pending.push(Number(match[1]));
  }
  assert.equal(slugs.size, posts.length);
  assert.equal(visited.size, Math.ceil(posts.length / 20));
});
