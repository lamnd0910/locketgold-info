import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";
import { DEFAULT_WELCOME, validateWelcome, welcomeMarkup, shouldShowWelcome } from "../src/welcome-notice.js";

test("welcome validates links and escapes content without interpreting HTML", () => {
  for (const primary_url of ["javascript:alert(1)", "//evil.example", "/\\evil.example", "http://example.com", "https://user:pass@example.com"]) {
    assert.throws(() => validateWelcome({ ...DEFAULT_WELCOME, primary_url }));
  }
  const markup = welcomeMarkup({ ...DEFAULT_WELCOME, title: '<script>alert("x")</script>', content: "Dòng 1\nDòng 2", secondary_label: "", secondary_url: "" });
  assert.ok(!markup.includes("<script>"));
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /Dòng 1\nDòng 2/);
  assert.ok(!markup.includes('href="/huong-dan/"'));
});
test("welcome respects disabled state, per-session dismissal and revised content", () => {
  assert.equal(shouldShowWelcome({ ...DEFAULT_WELCOME, enabled: false }, null), false);
  assert.equal(shouldShowWelcome(DEFAULT_WELCOME, "initial"), false);
  assert.equal(shouldShowWelcome({ ...DEFAULT_WELCOME, revision: "updated" }, "initial"), true);
  assert.equal(shouldShowWelcome({ ...DEFAULT_WELCOME, display_policy: "visit" }, "initial"), true);
});
test("only an admin can save the notice and public reads reflect the stored version", async () => {
  let value;
  const env = { SESSION_SECRET: "welcome-admin-test-secret-at-least-32-bytes", ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", DB: { prepare(sql) { return {
    bind(...args) { this.args = args; return this; },
    async all() { return { results: value ? [{ key: "welcome_notice", value }] : [] }; },
    async run() { assert.match(sql, /INSERT INTO settings/); value = this.args[0]; },
  }; } } };
  const site = "https://locketgold.info";
  const call = (path, cookie, body, origin = site) => worker.fetch(new Request(site + path, { method: body ? "POST" : "GET", headers: { Cookie: cookie || "", Origin: origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), env, {});
  assert.deepEqual(await (await call("/api/welcome")).json(), DEFAULT_WELCOME);
  assert.equal((await call("/api/admin/welcome", "", DEFAULT_WELCOME)).status, 401);
  const login = await call("/api/admin/login", "", { username: "admin", password: "admin" });
  const cookie = login.headers.get("Set-Cookie").split(";")[0];
  assert.equal((await call("/api/admin/welcome", cookie, DEFAULT_WELCOME, "https://other.example")).status, 403);
  assert.equal((await call("/api/admin/welcome", cookie, { ...DEFAULT_WELCOME, title: "" })).status, 400);
  assert.equal(value, undefined);
  const saved = await call("/api/admin/welcome", cookie, { ...DEFAULT_WELCOME, title: "Thông báo mới", enabled: false });
  assert.equal(saved.status, 200);
  const notice = await (await call("/api/welcome")).json();
  assert.equal(notice.title, "Thông báo mới");
  assert.equal(notice.enabled, false);
  assert.notEqual(notice.revision, "initial");
});
