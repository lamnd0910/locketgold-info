import assert from "node:assert/strict";
import test from "node:test";
import { orderStatusLabel, goldStatusLabel, planNameLabel } from "../src/vietnamese.js";
import { providerRequest } from "../worker/nodns.js";

test("order and Gold statuses have Vietnamese labels including unknown statuses", () => {
  assert.equal(orderStatusLabel("pending"), "Chờ thanh toán");
  assert.equal(orderStatusLabel("completed"), "Hoàn tất");
  assert.equal(goldStatusLabel("active"), "Đang hoạt động");
  assert.equal(goldStatusLabel("expired"), "Đã hết hạn");
  assert.equal(goldStatusLabel("unknown"), "Chưa xác định");
  assert.equal(planNameLabel("1month"), "Gói 1 tháng");
});
test("English upstream errors are replaced by a Vietnamese diagnostic", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Unauthorized" }, { status: 401 }));
  await assert.rejects(providerRequest({}, "/api/v1/me"), /Thông tin xác thực NoDNS không đúng/);
});
