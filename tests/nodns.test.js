import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";
import { grantPayload, providerRequest, remoteLogin, remoteCookie, publicCtv, portalOrders } from "../worker/nodns.js";

const site = "https://locketgold.info";
const env = { SESSION_SECRET: "test-session-secret-with-at-least-32-bytes", NODNS_CTV_PORTAL: "true" };

test("NoDNS uses x-api-key and the documented duration payload", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://ctv.nodns.vn/api/v1/grant");
    assert.equal(options.headers["x-api-key"], "private-key");
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { user: "alice", days: 365, note: "LGABCDEFGH" });
    return Response.json({ status: "success", data: { uid: "uid-1", active: true } }, { status: 201 });
  });
  await providerRequest({ NODNS_API_KEY: "private-key" }, "/api/v1/grant", { method: "POST", apiKey: true, body: grantPayload({ username: "alice", platform: "iOS", plan_id: "ios-year", code: "LGABCDEFGH" }) });
  assert.equal(grantPayload({ platform: "Android", plan_id: "android-lifetime" }), null);
  assert.equal(grantPayload({ platform: "iOS", plan_id: "unknown" }), null);
  assert.equal(grantPayload({ username: "alice", platform: "iOS", plan_id: "ios-month" }).days, 30);
  assert.equal(Object.hasOwn(grantPayload({ username: "alice", platform: "iOS", plan_id: "ios-lifetime" }), "days"), false);
});

test("remote cookies are encrypted, role-bound, and tamper resistant", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true }, { headers: { "Set-Cookie": "ctv-session=upstream-secret; Path=/; HttpOnly; Secure" } }));
  const cookie = await remoteLogin(new Request(site), env, "ctv", { username: "ctv", password: "password" });
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(cookie.includes("upstream-secret"), false);
  const pair = cookie.split(";")[0];
  assert.equal(await remoteCookie(new Request(site, { headers: { Cookie: pair } }), env, "ctv"), "ctv-session=upstream-secret");
  await assert.rejects(remoteCookie(new Request(site, { headers: { Cookie: pair.replace("lg_remote_ctv", "lg_remote_admin") } }), env, "admin"), { status: 401 });
  await assert.rejects(remoteCookie(new Request(site, { headers: { Cookie: `${pair}bad` } }), env, "ctv"), { status: 401 });
});

test("CTV upgrade resolves UID and maps plan to the portal package", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/login")) return Response.json({ success: true }, { headers: { "Set-Cookie": "ctv-session=remote-secret; Path=/" } });
    assert.equal(options.headers.Cookie, "ctv-session=remote-secret");
    if (url.endsWith("/lookup")) return Response.json({ uid: "alice-uid", username: "alice" });
    assert.ok(url.endsWith("/upgrade"));
    assert.deepEqual(JSON.parse(options.body), { userUpgraded: "alice", userId: "alice-uid", packageId: "1month", testflight: false });
    return Response.json({ success: true, data: { orderId: "order-1" } });
  });
  const cookie = (await remoteLogin(new Request(site), env, "ctv", {})).split(";")[0];
  const response = await worker.fetch(new Request(`${site}/api/ctv/orders`, { method: "POST", headers: { Cookie: cookie, Origin: site, "Content-Type": "application/json" }, body: JSON.stringify({ username: "alice", plan_id: "ios-month" }) }), env, {});
  assert.equal(response.status, 201);
  assert.equal((await response.json()).code, "order-1");
  assert.equal(calls.length, 3);
});

test("remote CTV details never expose credentials", () => {
  const user = publicCtv({ data: { username: "ctv", balance: 150000, remainingRequests: 15, apiKey: "hidden", depositCode: "hidden" } });
  assert.equal(user.remaining, 15);
  assert.equal(user.balance, 150000);
  assert.equal(JSON.stringify(user).includes("hidden"), false);
  assert.equal(portalOrders({ orders: [{ id: "1", userUpgraded: "alice", packageId: "1year", gold: { active: true } }] })[0].status, "completed");
});

test("public lookup encodes usernames and strips extra upstream fields", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://ctv.nodns.vn/api/v1/userinfo?user=alice");
    assert.equal(options.headers["x-api-key"], undefined);
    return Response.json({ status: "success", uid: "uid-1", username: "alice", full_name: "Alice", profile_picture_url: "https://images.example/avatar.jpg", apiKey: "never-public", gold: { has_gold: true } });
  });
  const response = await worker.fetch(new Request(`${site}/api/locket/userinfo?user=alice`), {}, {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.gold.has_gold, true);
  assert.equal(data.full_name, "Alice");
  assert.equal(data.apiKey, undefined);
});

test("provider business errors and cross-origin mutations are rejected", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: false, message: "Hết lượt" }));
  await assert.rejects(providerRequest({}, "/api/ctv/upgrade"), { status: 400, message: "Hết lượt" });
  const response = await worker.fetch(new Request(`${site}/api/ctv/orders`, { method: "POST", headers: { Origin: "https://other.example" } }), env, {});
  assert.equal(response.status, 403);
});
