import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";
import { postPurchaseState, goldCompletionGuide } from "../src/post-purchase.js";

const site = "https://locketgold.info";
const env = { SESSION_SECRET: "gold-admin-test-secret-at-least-32-bytes", ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", NODNS_API_KEY: "private-gold-key" };
async function login() {
  const response = await worker.fetch(new Request(`${site}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }), env, {});
  assert.equal(response.status, 200);
  return response.headers.get("Set-Cookie").split(";")[0];
}
function request(cookie, body, origin = site) {
  return new Request(`${site}/api/admin/gold/cancel`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin }, body: JSON.stringify(body) });
}

test("Gold cancellation requires an admin, same origin, valid username and explicit confirmation", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not call provider"); });
  const cookie = await login();
  const db = { prepare() { throw new Error("Must not mutate database"); } };
  for (const [session, body, origin, expected] of [["", { username: "alice", confirmed: true }, site, 401], [cookie, { username: "alice", confirmed: true }, "https://other.example", 403], [cookie, { username: "alice" }, site, 400], [cookie, { username: "bad user", confirmed: true }, site, 400]]) {
    assert.equal((await worker.fetch(request(session, body, origin), { ...env, DB: db }, {})).status, expected);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("NoDNS cancel sends only the account, records actual refund and preserves payment history", async (t) => {
  const cookie = await login();
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://ctv.nodns.vn/api/v1/cancel");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["x-api-key"], env.NODNS_API_KEY);
    assert.deepEqual(JSON.parse(options.body), { user: "alice" });
    return Response.json({ status: "success", data: { uid: "uid-alice", refunded: true, remaining: 12, privateField: "hidden" } });
  });
  const db = {
    prepare(sql) { return { sql, bind(...values) { this.values = values; return this; } }; },
    async batch(statements) { calls.push(...statements); return []; },
  };
  const response = await worker.fetch(request(cookie, { username: "@alice", confirmed: true, orderId: "do-not-delete" }), { ...env, DB: db }, {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.cancelled, true); assert.equal(data.refunded, true); assert.equal(data.remaining, 12);
  assert.equal(JSON.stringify(data).includes("private-gold-key"), false);
  assert.equal(JSON.stringify(data).includes("hidden"), false);
  assert.match(calls[0].sql, /INSERT INTO gold_cancellations/);
  assert.match(calls[1].sql, /gold_revoked_at/);
  assert.equal(calls[1].sql.includes("SET status"), false);
});

test("provider refusal or uncertain success does not revoke local orders", async (t) => {
  const cookie = await login();
  const db = { batch() { throw new Error("Must not revoke locally"); } };
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ status: "error", message: "User thuộc CTV khác" }, { status: 403 }));
  assert.equal((await worker.fetch(request(cookie, { username: "alice", confirmed: true }), { ...env, DB: db }, {})).status, 403);
  mock.mock.mockImplementation(async () => Response.json({ success: true }));
  t.mock.method(console, "error", () => {});
  assert.equal((await worker.fetch(request(cookie, { username: "alice", confirmed: true }), { ...env, DB: db }, {})).status, 502);
});

test("revoked paid orders retain payment state but never display an active Gold success screen", () => {
  const order = { status: "completed", platform: "iOS", gold_revoked_at: "2026-10-04 10:00:00" };
  const state = postPurchaseState(order);
  assert.equal(state.paid, true); assert.equal(state.terminal, true); assert.equal(state.showGoldGuide, false);
  assert.match(state.message, /đã được hủy/);
  assert.equal(goldCompletionGuide(order), "");
});
