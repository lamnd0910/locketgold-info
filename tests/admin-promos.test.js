import assert from "node:assert/strict";
import test from "node:test";
import worker, { promoStatus } from "../worker/index.js";

test("promo status distinguishes cancellation and expiry at the exact deadline", () => {
  const now = Date.parse("2026-10-04T10:00:00Z");
  assert.equal(promoStatus({ active: 1, expires_at: null }, now), "active");
  assert.equal(promoStatus({ active: 1, expires_at: "2026-10-04T10:00:00Z" }, now), "expired");
  assert.equal(promoStatus({ active: 1, expires_at: "2026-10-04T10:00:01Z" }, now), "active");
  assert.equal(promoStatus({ active: 0, expires_at: "2027-10-04T10:00:00Z" }, now), "cancelled");
});

test("admin lists and cancels a promo, blocks further discounts and preserves existing orders", async () => {
  const promo = { code: "SALE20", active: 1, percent: 20, expires_at: null, paid_orders: 2, discount_total: 40000 };
  const env = { SESSION_SECRET: "promo-admin-test-secret-at-least-32-bytes", ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", DB: { prepare(sql) { return {
    bind(...values) { this.values = values; return this; },
    async all() { assert.match(sql, /FROM promo_codes p/); return { results: [{ ...promo }] }; },
    async first() {
      if (sql.includes("FROM plans")) return { id: "ios-month", enabled: 1, price: 100000 };
      assert.match(sql, /FROM promo_codes/);
      if (this.values[0] !== promo.code) return null;
      if (sql.includes("active = 1")) { assert.match(sql, /datetime\(expires_at\)/); return promo.active ? promo : null; }
      return promo;
    },
    async run() { assert.match(sql, /^UPDATE promo_codes SET active = 0/); promo.active = 0; return { meta: { changes: 1 } }; },
  }; } } };
  const site = "https://locketgold.info";
  const call = (path, cookie, body, origin = site) => worker.fetch(new Request(site + path, { method: body ? "POST" : "GET", headers: { Cookie: cookie || "", Origin: origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), env, {});
  assert.equal((await call("/api/admin/promos")).status, 401);
  assert.equal((await call("/api/admin/promos/cancel", "", { code: "SALE20" })).status, 401);
  const login = await call("/api/admin/login", "", { username: "admin", password: "admin" });
  const cookie = login.headers.get("Set-Cookie").split(";")[0];
  const listed = await (await call("/api/admin/promos", cookie)).json();
  assert.equal(listed.summary.active, 1);
  assert.equal(listed.promos[0].percent, 20);
  const quote = await (await call("/api/quote", "", { plan_id: "ios-month", promo_code: "SALE20" })).json();
  assert.equal(quote.total, 80000);
  assert.equal((await call("/api/admin/promos/cancel", cookie, { code: "SALE20" }, "https://other.example")).status, 403);
  assert.equal(promo.active, 1);
  assert.equal((await call("/api/admin/promos/cancel", cookie, { code: "MISSING" })).status, 404);
  assert.equal((await call("/api/admin/promos", cookie, { code: "BAD", percent: 20, expires_at: "invalid" })).status, 400);
  assert.equal((await call("/api/admin/promos/cancel", cookie, { code: "sale20" })).status, 200);
  assert.equal((await call("/api/quote", "", { plan_id: "ios-month", promo_code: "SALE20" })).status, 400);
  const cancelled = await (await call("/api/admin/promos", cookie)).json();
  assert.equal(cancelled.summary.cancelled, 1);
  assert.equal(cancelled.summary.active, 0);
  assert.equal(cancelled.promos[0].paid_orders, 2);
  assert.equal(cancelled.promos[0].discount_total, 40000);
});
