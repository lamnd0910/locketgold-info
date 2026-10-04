import assert from "node:assert/strict";
import test from "node:test";
import { postPurchaseState, apkInstallationGuide } from "../src/post-purchase.js";
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

test("the APK guide contains all five steps, troubleshooting and Zalo delivery", () => {
  const guide = apkInstallationGuide();
  for (let step = 1; step <= 5; step += 1) assert.ok(guide.includes(`BƯỚC ${step}`));
  assert.match(guide, /ỨNG DỤNG CHƯA ĐƯỢC CÀI ĐẶT/);
  assert.match(guide, /File Locket APK sẽ được gửi trong Zalo/);
});

test("activation requires completion rather than request acceptance", () => {
  for (const response of [null, {}, { success: true }, { status: "pending" }, { status: "processing" }, { success: true, status: "accepted" }, { success: false, status: "completed" }]) {
    assert.equal(activationConfirmed(response), false, JSON.stringify(response));
  }
  assert.equal(activationConfirmed({ status: "completed" }), true);
  assert.equal(activationConfirmed({ success: true, completed: true }), true);
});
