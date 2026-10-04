import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";
import { renderPostContent } from "../src/post-content.js";

const site = "https://locketgold.info";
const env = { SESSION_SECRET: "post-images-test-secret-at-least-32-bytes", ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" };
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64"));
async function login() {
  const r = await worker.fetch(new Request(`${site}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }), env, {});
  return r.headers.get("Set-Cookie").split(";")[0];
}
function upload(cookie, bytes = png, origin = site) {
  return new Request(`${site}/api/admin/images`, { method: "POST", headers: { "Content-Type": "image/png", Cookie: cookie, Origin: origin }, body: bytes });
}

test("image upload requires admin and same origin and validates image bytes and size", async () => {
  const cookie = await login();
  const db = { prepare() { throw new Error("Invalid request must not store image"); } };
  for (const [session, bytes, origin, expected] of [["", png, site, 401], [cookie, png, "https://other.example", 403], [cookie, new TextEncoder().encode('<svg onload="alert(1)"></svg>'), site, 400], [cookie, new Uint8Array(1024 * 1024 + 1), site, 413]]) {
    assert.equal((await worker.fetch(upload(session, bytes, origin), { ...env, DB: db }, {})).status, expected);
  }
});

test("uploaded image round-trips as binary and is served with safe headers", async () => {
  const cookie = await login();
  let stored;
  const db = { prepare(sql) { return {
    bind(...values) { this.values = values; return this; },
    async run() { assert.match(sql, /INSERT INTO post_images/); stored = { id: this.values[0], mime_type: this.values[1], image_data: Array.from(new Uint8Array(this.values[2])) }; },
    async first() { return this.values[0] === stored.id ? stored : null; },
  }; } };
  const r = await worker.fetch(upload(cookie), { ...env, DB: db }, {});
  assert.equal(r.status, 201);
  const { url } = await r.json();
  const image = await worker.fetch(new Request(site + url), { DB: db }, {});
  assert.equal(image.status, 200); assert.equal(image.headers.get("Content-Type"), "image/png");
  assert.equal(image.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
});

test("post content renders uploaded images while escaping arbitrary HTML and external image syntax", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const html = renderPostContent(`Đoạn đầu\n\n![Hướng dẫn & ảnh](/api/images/${id})\n\nĐoạn cuối\n<script>alert(1)</script>\n![bad](javascript:alert(1))`);
  assert.match(html, /<figure class="post-image">/);
  assert.match(html, /alt="Hướng dẫn &amp; ảnh"/);
  assert.match(html, /<p>Đoạn cuối<\/p>/);
  assert.equal(html.includes("<script>"), false);
  assert.equal((html.match(/<img /g) || []).length, 1);
});

test("publishing preserves paragraph breaks and inserted image markers", async () => {
  const cookie = await login(); let saved;
  const db = { prepare() { return { bind(...values) { this.values = values; return this; }, async first() { return null; }, async run() { saved = this.values[3]; } }; } };
  const content = "Đoạn đầu\n\n![Ảnh](/api/images/11111111-2222-3333-4444-555555555555)\n\nĐoạn cuối";
  const r = await worker.fetch(new Request(`${site}/api/admin/posts`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: site }, body: JSON.stringify({ title: "Bài mới", excerpt: "Giới thiệu", content }) }), { ...env, DB: db }, {});
  assert.equal(r.status, 201); assert.equal(saved, content);
});
