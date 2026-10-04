import assert from "node:assert/strict";
import test from "node:test";
import { paymentQrUrl } from "../src/payment.js";
import worker from "../worker/index.js";

const bank = { BANK_NAME: "MB Bank", BANK_BIN: "970422", BANK_ACCOUNT: "5565662518" };

test("each QR contains the receiving account, final amount and unique order code", () => {
  for (const [amount, code] of [[139000, "LGABCDEFGH"], [125100, "LG12345678"], [29000, "LG87654321"]]) {
    const url = new URL(paymentQrUrl({ amount, bank_bin: bank.BANK_BIN, bank_account: bank.BANK_ACCOUNT, transfer_content: code }));
    assert.equal(url.origin, "https://vietqr.app");
    assert.equal(url.searchParams.get("acc"), bank.BANK_ACCOUNT);
    assert.equal(url.searchParams.get("bank"), bank.BANK_BIN);
    assert.equal(url.searchParams.get("amount"), String(amount));
    assert.equal(url.searchParams.get("des"), code);
  }
  assert.equal(paymentQrUrl({ amount: -1 }), "");
});

test("discounted orders return the configured bank and QR uses the amount saved by the server", async () => {
  let savedAmount;
  const db = { prepare(sql) { return {
    bind(...values) { this.values = values; return this; },
    async first() {
      if (sql.includes("FROM plans")) return { id: "ios-lifetime", name: "Vĩnh viễn", platform: "iOS", price: 139000 };
      if (sql.includes("FROM promo_codes")) return { code: "SALE10", percent: 10 };
      return null;
    },
    async run() { savedAmount = this.values[8]; return { meta: { changes: 1 } }; },
  }; } };
  const response = await worker.fetch(new Request("https://locketgold.info/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alice", contact: "customer@example.com", plan_id: "ios-lifetime", promo_code: "SALE10" }),
  }), { DB: db, ...bank }, {});
  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(order.amount, 125100);
  assert.equal(order.amount, savedAmount);
  assert.equal(order.bank_account, bank.BANK_ACCOUNT);
  assert.equal(new URL(paymentQrUrl(order)).searchParams.get("amount"), "125100");
});

test("webhook records wrong-account events without touching orders and rejects invalid authentication", async () => {
  const outcomes = [];
  const db = { prepare(sql) {
    assert.ok(sql.startsWith("INSERT OR IGNORE INTO payment_events") || sql.startsWith("UPDATE payment_events"));
    return { bind(...args) { this.args = args; return this; }, async run() { if (sql.startsWith("UPDATE")) outcomes.push(this.args[1]); return { meta: { changes: 1 } }; } };
  } };
  for (const [accountNumber, authorization, expected] of [["1111111111", "Apikey secret", 200], ["", "Apikey secret", 200], [bank.BANK_ACCOUNT, "Apikey wrong", 401]]) {
    const response = await worker.fetch(new Request("https://locketgold.info/api/sepay/webhook", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({ id: 1, transferType: "in", transferAmount: 139000, accountNumber, content: "LGABCDEFGH" }),
    }), { DB: db, ...bank, SEPAY_WEBHOOK_API_KEY: "secret" }, {});
    assert.equal(response.status, expected);
  }
  assert.deepEqual(outcomes, ["wrong_account", "wrong_account"]);
});
