import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";
import { DEFAULT_PLANS } from "../src/plans.js";

const site = "https://locketgold.info";

test("the public API and quotes keep the prices initially displayed by the frontend", async () => {
  const response = await worker.fetch(new Request(`${site}/api/plans`), {}, {});
  assert.equal(response.status, 200);
  const { plans } = await response.json();
  assert.deepEqual(plans, DEFAULT_PLANS);
  assert.deepEqual(plans.map(({ price }) => price), [29000, 69000, 139000, 99000]);

  for (const plan of plans) {
    const quote = await worker.fetch(new Request(`${site}/api/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: plan.id, promo_code: "" }),
    }), {}, {});
    assert.equal(quote.status, 200);
    assert.equal((await quote.json()).total, plan.price, plan.id);
  }
});

test("an empty database uses the same default price list", async () => {
  const db = { prepare() { return { async all() { return { results: [] }; } }; } };
  const response = await worker.fetch(new Request(`${site}/api/plans`), { DB: db }, {});
  assert.deepEqual((await response.json()).plans, DEFAULT_PLANS);
});

test("admin prices from the database are retained in both the price list and quote", async () => {
  const customPlan = { ...DEFAULT_PLANS[1], price: 75000, old_price: 90000, featured: 0 };
  const db = {
    prepare() {
      return {
        bind(id) { assert.equal(id, customPlan.id); return this; },
        async all() { return { results: [customPlan] }; },
        async first() { return customPlan; },
      };
    },
  };
  const response = await worker.fetch(new Request(`${site}/api/plans`), { DB: db }, {});
  const { plans } = await response.json();
  assert.equal(plans[0].price, 75000);
  assert.equal(plans[0].old_price, 90000);
  const quote = await worker.fetch(new Request(`${site}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: customPlan.id, promo_code: "" }),
  }), { DB: db }, {});
  assert.equal((await quote.json()).total, 75000);
});
