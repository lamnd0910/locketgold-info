import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

const site = "https://locketgold.info";
const env = {
  SESSION_SECRET: "test-session-secret-with-at-least-32-bytes", NODNS_ADMIN_AUTH: "false", ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
  SEPAY_WEBHOOK_API_KEY: "private-webhook-key", BANK_NAME: "MB Bank", BANK_ACCOUNT: "5565662518", SITE_URL: site,
};

test("SePay admin requires authentication before accessing transaction data", async () => {
  const response = await worker.fetch(new Request(`${site}/api/admin/sepay`), { ...env, DB: { prepare() { throw new Error("Must not query before authentication"); } } }, {});
  assert.equal(response.status, 401);
});

test("SePay admin shows matched orders and diagnostics without exposing raw payloads or secrets", async () => {
  const login = await worker.fetch(new Request(`${site}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }), env, {});
  const cookie = login.headers.get("Set-Cookie").split(";")[0];
  const row = { transaction_id: "123", amount: 139000, created_at: "2026-10-04 12:00:00", order_code: "LGABCDEFGH", outcome: "matched", order_status: "completed", order_amount: 139000,
    payload_json: JSON.stringify({ gateway: "MBBank", accountNumber: "5565662518", transferType: "in", content: "LGABCDEFGH", referenceCode: "FT123", privateField: "never-return-this" }) };
  const db = { prepare(sql) { return {
    async all() { assert.match(sql, /LEFT JOIN orders/); return { results: [row, { ...row, transaction_id: "124", payload_json: "bad json", outcome: "legacy" }] }; },
    async first() { return { total: 2, matched_amount: 139000, last_received: row.created_at }; },
  }; } };
  const response = await worker.fetch(new Request(`${site}/api/admin/sepay`, { headers: { Cookie: cookie } }), { ...env, DB: db }, {});
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.config.key_configured, true);
  assert.equal(result.config.webhook_url, `${site}/api/sepay/webhook`);
  assert.equal(result.transactions[0].order_status, "completed");
  assert.equal(result.transactions[0].reference, "FT123");
  assert.equal(result.transactions[1].content, "");
  assert.equal(JSON.stringify(result).includes("private-webhook-key"), false);
  assert.equal(JSON.stringify(result).includes("never-return-this"), false);
});
