import assert from "node:assert/strict";
import test from "node:test";
import { postPurchaseState, apkInstallationGuide, goldCompletionGuide } from "../src/post-purchase.js";
import { activationConfirmed } from "../worker/activation.js";

test("unpaid and unsuccessful orders never unlock installation instructions", () => {
  for (const status of ["pending", "failed", "cancelled", "unknown"]) {
    for (const platform of ["iOS", "Android"]) {
      const state = postPurchaseState({ status, platform });
      assert.equal(state.showApkGuide, false);
      assert.equal(state.showGoldGuide, false);
    }
  }
});

test("SePay confirmation unlocks the Android guide but waits for iOS activation", () => {
  const android = postPurchaseState({ status: "paid", platform: "Android" });
  assert.equal(android.showApkGuide, true);
  assert.equal(android.showGoldGuide, false);
  const ios = postPurchaseState({ status: "paid", platform: "iOS" });
  assert.equal(ios.showGoldGuide, false);
  assert.equal(ios.terminal, false);
  assert.match(ios.message, /Đang chờ/);
});

test("completed iOS orders unlock the success guide and stop polling", () => {
  const state = postPurchaseState({ status: "completed", platform: "iOS" });
  assert.equal(state.showGoldGuide, true);
  assert.equal(state.showApkGuide, false);
  assert.equal(state.terminal, true);
});

test("the APK guide contains all five steps, troubleshooting and direct download", () => {
  const guide = apkInstallationGuide({ code: "LG12345678" });
  for (let step = 1; step <= 5; step += 1) assert.ok(guide.includes(`BƯỚC ${step}`));
  assert.match(guide, /ỨNG DỤNG CHƯA ĐƯỢC CÀI ĐẶT/);
  assert.match(guide, /href="\/api\/orders\/LG12345678\/apk"/);
  assert.match(guide, /download="LocketGold.website.apk"/);
});

test("activation requires completion rather than request acceptance", () => {
  for (const response of [null, {}, { success: true }, { status: "pending" }, { status: "processing" }, { success: true, status: "accepted" }, { success: false, status: "completed" }]) {
    assert.equal(activationConfirmed(response), false, JSON.stringify(response));
  }
  assert.equal(activationConfirmed({ status: "completed" }), true);
  assert.equal(activationConfirmed({ success: true, completed: true }), true);
});

test("iOS success screen uses the real account and plan and only unlocks DNS after activation", () => {
  const order = { code: "LGABCDEFGH", username: "alice", plan_name: "Gói 1 năm", platform: "iOS" };
  const paid = goldCompletionGuide({ ...order, status: "paid" });
  assert.match(paid, /Thanh Toán Thành Công/);
  assert.match(paid, /đang xác nhận kích hoạt/);
  assert.equal(paid.includes("data-gold-dns"), false);
  assert.equal(paid.includes("đã được hệ thống kích hoạt"), false);
  const completed = goldCompletionGuide({ ...order, status: "completed" });
  assert.match(completed, /@alice/);
  assert.match(completed, /Gói 1 năm/);
  assert.match(completed, /data-gold-dns/);
  assert.match(completed, /Quay Lại Trang Chủ/);
  assert.equal((completed.match(/<li>/g) || []).length, 4);
  assert.equal(goldCompletionGuide({ ...order, status: "pending" }), "");
  const escaped = goldCompletionGuide({ ...order, username: '<img src=x onerror="alert(1)">', status: "completed" });
  assert.equal(escaped.includes("<img"), false);
});
