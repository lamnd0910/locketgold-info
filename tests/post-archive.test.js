import assert from "node:assert/strict";
import test from "node:test";
import { mergePostArchive, postArchivePage } from "../src/post-archive.js";
import { renderPostContent } from "../src/post-content.js";
import { readFile } from "node:fs/promises";

test("duplicate titles and confirmed renamed copies keep the existing article", () => {
  const own = [{ slug: "own-a", title: "Hướng dẫn Locket" }, { slug: "own-b", title: "Cài Locket" }];
  const imported = [{ slug: "source-a-123", title: "  HƯỚNG DẪN   LOCKET " }, { slug: "source-b-456", title: "Cài Locket - Phần 500", duplicate_of: "own-b" }, { slug: "other", title: "Hướng dẫn Locket Android" }];
  assert.deepEqual(mergePostArchive(own, imported).map((post) => post.slug), ["own-a", "own-b", "other"]);
  assert.equal(mergePostArchive([], imported).length, 3);
});

test("all thirteen existing source copies appear only once in the real archive", async () => {
  const archive = JSON.parse(await readFile(new URL("../public/imported-posts/index.json", import.meta.url), "utf8"));
  const matches = archive.filter((post) => post.duplicate_of);
  assert.equal(matches.length, 13);
  const own = matches.map((post) => ({ ...post, slug: post.duplicate_of, duplicate_of: undefined }));
  const merged = mergePostArchive(own, archive);
  const report = JSON.parse(await readFile(new URL("../public/imported-posts/duplicate-report.json", import.meta.url), "utf8"));
  assert.equal(merged.length, report.visible_articles);
  assert.equal(new Set(merged.map((post) => post.title.normalize("NFKC").toLocaleLowerCase("vi-VN").replace(/\s+/g, " ").trim())).size, merged.length);
  for (const post of own) assert.equal(merged.filter((item) => item.slug === post.slug).length, 1);
});

test("every archive article remains reachable across pages alongside existing posts", () => {
  const imported = Array.from({ length: 2499 }, (_, i) => ({ slug: `source-${i}`, published_at: "2026-06-28" }));
  const existing = [{ slug: "own-post", published_at: "2026-10-04" }, { slug: "source-0", published_at: "2026-06-28", title: "Admin version" }];
  const merged = mergePostArchive(existing, imported);
  assert.equal(merged.length, 2500);
  assert.equal(merged[0].slug, "own-post");
  assert.equal(merged.find((post) => post.slug === "source-0").title, "Admin version");
  const collected = [];
  for (let page = 1; page <= 125; page++) collected.push(...postArchivePage(merged, page).posts);
  assert.deepEqual(collected, merged);
  assert.equal(postArchivePage(merged, -10).page, 1);
  assert.equal(postArchivePage(merged, "bad").page, 1);
  assert.equal(postArchivePage(merged, 1e9).page, 125);
});

test("imported article formatting preserves text and lists while rejecting active HTML", () => {
  const blocks = [
    { tag: "h2", children: ["Hướng dẫn"] },
    { tag: "p", children: ["Nội dung ", { tag: "strong", children: ["in đậm"] }, " & văn bản"] },
    { tag: "ul", children: [{ tag: "li", children: ["Bước đầu"] }] },
    { tag: "a", attrs: { href: "javascript:alert(1)", onclick: "alert(1)" }, children: ["Liên kết"] },
    { tag: "script", children: ["alert(1)"] },
    { tag: "img", attrs: { src: "https://attacker.example/x", onerror: "alert(1)" } },
    { tag: "img", attrs: { src: "/images/imported-posts/0123456789abcdef01234567.png", alt: 'Ảnh "gốc"' } },
  ];
  const html = renderPostContent("", blocks);
  assert.match(html, /<h2>Hướng dẫn<\/h2>/);
  assert.match(html, /<strong>in đậm<\/strong> &amp; văn bản/);
  assert.match(html, /<ul><li>Bước đầu<\/li><\/ul>/);
  assert.match(html, /alt="Ảnh &quot;gốc&quot;"/);
  assert.equal(/javascript:|<script|onclick|onerror|attacker\.example/.test(html), false);
});
