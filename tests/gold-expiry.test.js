import assert from "node:assert/strict";
import test from "node:test";
import { grantPayload, purchasedGoldExpiry, providerGoldOrder } from "../worker/nodns.js";
import { repairQueuedGoldExpiries } from "../worker/index.js";

test("finite plans send explicit expiry, lifetime omits finite duration", () => {
  const order = { platform: "iOS", username: "alice", code: "LGTEST", completed_at: "2026-10-04 08:49:08" };
  for (const [plan_id, days] of [["ios-month", 30], ["ios-year", 365]]) {
    const payload = grantPayload({ ...order, plan_id }, Date.parse("2026-10-04T08:49:08Z"));
    assert.equal(payload.days, days);
    assert.equal(payload.expiresAt, purchasedGoldExpiry({ ...order, plan_id }));
  }
  assert.equal(purchasedGoldExpiry({ ...order, plan_id: "ios-month" }), "2026-11-03T08:49:08.000Z");
  assert.equal(Object.hasOwn(grantPayload({ ...order, plan_id: "ios-lifetime" }), "expiresAt"), false);
});

test("missing or invalid provider date is not reported as lifetime", () => {
  assert.equal(providerGoldOrder({ expiresAt: null }).lifetime, true);
  assert.equal(providerGoldOrder({}).lifetime, false);
  assert.equal(providerGoldOrder({ expiresAt: "invalid" }).lifetime, false);
  assert.equal(providerGoldOrder({ expiresAt: "2026-11-03T08:49:08Z" }).expiresAt, "2026-11-03T08:49:08.000Z");
});

test("repair verifies ownership and order code, updates exact purchased expiry without granting again", async t => {
  for (const owned of [true, false]) {
    const calls = [], writes = [];
    const order = { code: "LGTEST", username: "alice", plan_id: "ios-month", platform: "iOS", status: "completed", completed_at: "2026-10-04 08:49:08" };
    const db = { prepare(sql) { return {
      bind(...v) { this.values = v; return this; },
      async all() { return { results: [{ order_code: order.code }] }; },
      async first() { return sql.includes("SELECT *") ? order : { code: order.code }; },
      async run() { writes.push([sql, this.values]); },
    }; } };
    const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
      calls.push(url);
      if (url.includes("/lookup")) return Response.json({ data: { uid: "uid-alice" } });
      if (url.includes("/status")) return Response.json({ data: { owned_by_you: owned, has_gold: true, expiresAt: null } });
      if (url.includes("/orders")) return Response.json({ data: [{ uid: "uid-alice", note: "LGTEST" }] });
      assert.ok(url.endsWith("/update"));
      assert.deepEqual(JSON.parse(options.body), { user: "uid-alice", expiresAt: "2026-11-03T08:49:08.000Z" });
      return Response.json({ status: "success", data: { expiresAt: "2026-11-03T08:49:08.000Z" } });
    });
    t.mock.method(console, "error", () => {});
    await repairQueuedGoldExpiries({ DB: db, NODNS_API_KEY: "test" });
    assert.equal(calls.some(url => url.endsWith("/update")), owned);
    assert.match(writes[0][0], owned ? /status = 'repaired'/ : /status = 'failed'/);
    mock.mock.restore();
  }
});
