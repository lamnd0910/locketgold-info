import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

const site = "https://locketgold.info";

function orderRequest(username) {
  return new Request(`${site}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, contact: "customer@example.com", plan_id: "ios-month" }),
  });
}

test("invalid usernames are rejected without creating an order", async () => {
  const db = { prepare() { throw new Error("Invalid username reached the database"); } };
  const invalid = [
    "https://locket.cam/alice",
    "https://locket.camera/links/abc123",
    "@@alice",
    "alice bob",
    "alice!",
    "a".repeat(65),
    ["alice"],
  ];

  for (const username of invalid) {
    const response = await worker.fetch(orderRequest(username), { DB: db }, {});
    assert.equal(response.status, 400, `Expected ${JSON.stringify(username)} to be rejected`);
    assert.match((await response.json()).error, /Username/);
  }
});

test("a valid @username is stored without changing its characters", async () => {
  const inserts = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) { this.values = values; return this; },
        async first() { return null; },
        async run() {
          assert.match(sql, /^INSERT INTO orders/);
          inserts.push(this.values);
          return { meta: { changes: 1 } };
        },
      };
    },
  };

  const response = await worker.fetch(orderRequest("  @alice.test_1  "), { DB: db }, {});
  assert.equal(response.status, 201);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][1], "alice.test_1");
});

test("quote works without a promo code for the review step", async () => {
  const request = new Request(`${site}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: "ios-month", promo_code: "" }),
  });
  const response = await worker.fetch(request, {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    subtotal: 29000,
    discount_percent: 0,
    discount_amount: 0,
    total: 29000,
  });
});

test("an unknown promo code is still rejected", async () => {
  const request = new Request(`${site}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: "ios-month", promo_code: "NOTREAL" }),
  });
  const db = { prepare() { return { bind() { return this; }, async first() { return null; } }; } };
  const response = await worker.fetch(request, { DB: db }, {});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Mã giảm giá/);
});

function webhookRequest(id, amount = 29000) {
  return new Request(`${site}/api/sepay/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Apikey test-secret" },
    body: JSON.stringify({ id, transferType: "in", transferAmount: amount, content: "LGABCDEFGH" }),
  });
}

function paymentDb() {
  const state = {
    order: { code: "LGABCDEFGH", username: "alice", plan_id: "ios-month", platform: "iOS", amount: 29000, status: "pending" },
    transactionIds: new Set(),
    paidUpdates: 0,
  };
  return {
    state,
    prepare(sql) {
      return {
        bind(...values) { this.values = values; return this; },
        async first() {
          assert.match(sql, /^SELECT \* FROM orders/);
          return this.values[0] === state.order.code ? { ...state.order } : null;
        },
        async all() {
          assert.match(sql, /^SELECT key, value FROM settings/);
          return { results: [] };
        },
        async run() {
          if (sql.startsWith("INSERT OR IGNORE INTO payment_events")) {
            const id = this.values[0];
            if (state.transactionIds.has(id)) return { meta: { changes: 0 } };
            state.transactionIds.add(id);
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("UPDATE orders SET status = 'completed'")) {
            if (state.order.status !== "paid") return { meta: { changes: 0 } };
            state.order.status = "completed";
            return { meta: { changes: 1 } };
          }
          assert.match(sql, /^UPDATE orders SET status = 'paid'/);
          if (state.order.status !== "pending") return { meta: { changes: 0 } };
          state.order.status = "paid";
          state.paidUpdates += 1;
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

test("webhook schedules activation only for the pending-to-paid transition", async () => {
  const db = paymentDb();
  const scheduled = [];
  const ctx = { waitUntil(promise) { scheduled.push(promise); } };
  const env = { DB: db, SEPAY_WEBHOOK_API_KEY: "test-secret" };

  for (const transactionId of ["transaction-1", "transaction-1", "transaction-2"]) {
    const response = await worker.fetch(webhookRequest(transactionId), env, ctx);
    assert.equal(response.status, 200);
  }
  await Promise.all(scheduled);
  assert.equal(db.state.order.status, "paid");
  assert.equal(db.state.paidUpdates, 1);
  assert.equal(scheduled.length, 1);
});

test("an underpaid webhook does not schedule activation", async () => {
  const db = paymentDb();
  const scheduled = [];
  const response = await worker.fetch(webhookRequest("underpaid", 1000), {
    DB: db,
    SEPAY_WEBHOOK_API_KEY: "test-secret",
  }, { waitUntil(promise) { scheduled.push(promise); } });

  assert.equal(response.status, 200);
  assert.equal(db.state.order.status, "pending");
  assert.equal(scheduled.length, 0);
});

test("SePay plus upstream acceptance still leaves an order awaiting activation", async (t) => {
  const db = paymentDb();
  const scheduled = [];
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, status: "processing" }));
  const response = await worker.fetch(webhookRequest("queued-upgrade"), {
    DB: db, SEPAY_WEBHOOK_API_KEY: "test-secret",
    UPSTREAM_API_URL: "https://activation.example/api", UPSTREAM_API_KEY: "test-upstream-key",
  }, { waitUntil(promise) { scheduled.push(promise); } });
  assert.equal(response.status, 200);
  await Promise.all(scheduled);
  assert.equal(db.state.order.status, "paid");
});

test("SePay plus explicit upstream completion completes the order", async (t) => {
  const db = paymentDb();
  const scheduled = [];
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "completed" }));
  const response = await worker.fetch(webhookRequest("completed-upgrade"), {
    DB: db, SEPAY_WEBHOOK_API_KEY: "test-secret",
    UPSTREAM_API_URL: "https://activation.example/api", UPSTREAM_API_KEY: "test-upstream-key",
  }, { waitUntil(promise) { scheduled.push(promise); } });
  assert.equal(response.status, 200);
  await Promise.all(scheduled);
  assert.equal(db.state.order.status, "completed");
});

test("NoDNS grant completes paid iOS orders only after explicit active confirmation", async (t) => {
  for (const active of [false, true]) {
    const db = paymentDb();
    const scheduled = [];
    const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, "https://ctv.nodns.vn/api/v1/grant");
      assert.equal(options.headers["x-api-key"], "nodns-secret");
      assert.deepEqual(JSON.parse(options.body), { user: "alice", days: 30, note: "LGABCDEFGH" });
      return Response.json({ status: "success", data: { active, uid: "alice-uid" } });
    });
    const response = await worker.fetch(webhookRequest(`nodns-${active}`), {
      DB: db, SEPAY_WEBHOOK_API_KEY: "test-secret", NODNS_API_KEY: "nodns-secret",
    }, { waitUntil(promise) { scheduled.push(promise); } });
    assert.equal(response.status, 200);
    await Promise.all(scheduled);
    assert.equal(db.state.order.status, active ? "completed" : "paid");
    mock.mock.restore();
  }
});
