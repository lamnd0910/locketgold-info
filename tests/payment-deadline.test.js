import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";
import { paymentTimeLeft } from "../src/payment-deadline.js";
import { postPurchaseState } from "../src/post-purchase.js";

test("countdown follows the absolute server deadline without restarting", () => {
  const start = Date.parse("2026-10-04T08:00:00Z");
  const deadline = "2026-10-04T08:10:00Z";
  assert.equal(paymentTimeLeft(deadline, start), 600);
  assert.equal(paymentTimeLeft(deadline, start + 9 * 60_000), 60);
  assert.equal(paymentTimeLeft(deadline, start + 10 * 60_000), 0);
  assert.equal(paymentTimeLeft(deadline, start + 11 * 60_000), 0);
  assert.equal(paymentTimeLeft(undefined), null);
});

test("late SePay payment is logged for reconciliation and never activates expired orders", async (t) => {
  const remote = t.mock.method(globalThis, "fetch", async () => { throw new Error("Expired order must not grant Gold"); });
  const scheduled = []; let outcome;
  const db = { prepare(sql) { return {
    bind(...values) { this.values = values; return this; },
    async first() { return { code: "LGABCDEFGH", status: "cancelled", expired_at: "2026-10-04 08:10:00", amount: 139000 }; },
    async run() {
      if (sql.startsWith("UPDATE payment_events")) outcome = this.values[1];
      else assert.ok(sql.startsWith("INSERT OR IGNORE INTO payment_events") || sql.startsWith("UPDATE orders SET status = 'cancelled'"));
      return { meta: { changes: 1 } };
    },
  }; } };
  const response = await worker.fetch(new Request("https://locketgold.info/api/sepay/webhook", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Apikey test" },
    body: JSON.stringify({ id: 123, transferType: "in", accountNumber: "5565662518", content: "LGABCDEFGH", transferAmount: 139000 }),
  }), { DB: db, SEPAY_WEBHOOK_API_KEY: "test", BANK_ACCOUNT: "5565662518", NODNS_API_KEY: "private" }, { waitUntil(promise) { scheduled.push(promise); } });
  assert.equal(response.status, 200); assert.equal(outcome, "expired_order"); assert.equal(scheduled.length, 0); assert.equal(remote.mock.callCount(), 0);
});

test("scheduled expiration is restricted to pending orders and an expired order stops polling", async () => {
  const tasks = [];
  let query;
  const db = { prepare(sql) { if (sql.startsWith("UPDATE orders")) query = sql; return { bind(deadline) { assert.ok(Number.isFinite(Date.parse(deadline))); return this; }, async run() { return {}; }, async all() { return { results: [] }; } }; } };
  await worker.scheduled({}, { DB: db }, { waitUntil(promise) { tasks.push(promise); } }); await Promise.all(tasks);
  assert.match(query, /WHERE status = 'pending'/); assert.match(query, /expires_at <= \?/);
  const expired = postPurchaseState({ status: "cancelled", expired_at: "2026-10-04 08:10:00", platform: "iOS" });
  assert.equal(expired.terminal, true); assert.equal(expired.showGoldGuide, false); assert.match(expired.message, /10 phút/);
});
