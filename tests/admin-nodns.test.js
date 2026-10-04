import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import worker from "../worker/index.js";

const site = "https://locketgold.info";
const env = { SESSION_SECRET: "admin-session-test-secret-at-least-32-bytes", ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" };
async function localLogin(ip) {
  const response = await worker.fetch(new Request(`${site}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify({ username: "admin", password: "admin" }) }), env, {});
  assert.equal(response.status, 200);
  return response.headers.get("Set-Cookie").split(";")[0];
}

test("new collection contains exactly the three original admin requests", () => {
  const collection = JSON.parse(readFileSync(new URL("../public/downloads/admin.postman_collection.json", import.meta.url), "utf8"));
  assert.equal(collection.item.length, 1);
  assert.deepEqual(collection.item[0].item.map((item) => `${item.request.method} /${item.request.url.path.join("/")}`), ["POST /api/auth/login", "POST /api/auth/logout", "GET /api/auth/me"]);
  assert.deepEqual(collection.variable.map((v) => v.key), ["base"]);
  assert.equal(existsSync(new URL("../public/downloads/admin-gold.postman_collection.json", import.meta.url)), false);
});

test("NoDNS admin login, me and logout use encrypted session cookies without API keys", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(url);
    assert.equal(options.headers["x-api-key"], undefined);
    if (url.endsWith("/login")) {
      assert.deepEqual(JSON.parse(options.body), { username: "remote-admin", password: "private-password" });
      return Response.json({ success: true }, { headers: { "Set-Cookie": "admin-session=private-cookie; Path=/; HttpOnly" } });
    }
    assert.equal(options.headers.Cookie, "admin-session=private-cookie");
    if (url.endsWith("/me")) return Response.json({ authenticated: true, user: { username: "remote-admin", apiKey: "hidden", password: "hidden" } });
    assert.equal(options.method, "POST");
    return Response.json({ success: true });
  });
  const localCookie = await localLogin("192.0.2.80");
  const login = await worker.fetch(new Request(`${site}/api/admin/nodns/login`, { method: "POST", headers: { Cookie: localCookie, Origin: site, "Content-Type": "application/json" }, body: JSON.stringify({ username: "remote-admin", password: "private-password", apiKey: "ignored" }) }), env, {});
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { authenticated: true });
  const remoteCookie = login.headers.get("Set-Cookie");
  assert.match(remoteCookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(remoteCookie.includes("private-cookie"), false);
  const cookie = `${localCookie}; ${remoteCookie.split(";")[0]}`;
  const me = await worker.fetch(new Request(`${site}/api/admin/nodns/me`, { headers: { Cookie: cookie } }), env, {});
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { authenticated: true, username: "remote-admin" });
  const logout = await worker.fetch(new Request(`${site}/api/admin/nodns/logout`, { method: "POST", headers: { Cookie: cookie, Origin: site } }), env, {});
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("Set-Cookie"), /lg_remote_admin=;.*Max-Age=0/);
  assert.deepEqual(calls, ["https://ctv.nodns.vn/api/auth/login", "https://ctv.nodns.vn/api/auth/me", "https://ctv.nodns.vn/api/auth/logout"]);
});

test("NoDNS admin rejects anonymous, missing remote sessions, invalid credentials and foreign origins", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected provider call"); });
  const localCookie = await localLogin("192.0.2.81");
  assert.equal((await worker.fetch(new Request(`${site}/api/admin/nodns/me`), env, {})).status, 401);
  assert.equal((await worker.fetch(new Request(`${site}/api/admin/nodns/me`, { headers: { Cookie: localCookie } }), env, {})).status, 401);
  const login = (origin, body) => new Request(`${site}/api/admin/nodns/login`, { method: "POST", headers: { Cookie: localCookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await worker.fetch(login(site, { username: "", password: "" }), env, {})).status, 400);
  assert.equal((await worker.fetch(login("https://other.example", { username: "admin", password: "test" }), env, {})).status, 403);
  assert.equal((await worker.fetch(new Request(`${site}/api/admin/gold/grant`, { method: "POST", headers: { Cookie: localCookie }, body: "{}" }), env, {})).status, 404);
  assert.equal(mock.mock.callCount(), 0);
});

test("expired provider admin session is reported and never exposes response secrets", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => url.endsWith("/login") ? Response.json({ success: true }, { headers: { "Set-Cookie": "admin-session=private" } }) : Response.json({ authenticated: false, apiKey: "hidden" }));
  const cookie = await localLogin("192.0.2.82");
  const login = await worker.fetch(new Request(`${site}/api/admin/nodns/login`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "test" }) }), env, {});
  const me = await worker.fetch(new Request(`${site}/api/admin/nodns/me`, { headers: { Cookie: `${cookie}; ${login.headers.get("Set-Cookie").split(";")[0]}` } }), env, {});
  assert.equal(me.status, 401);
  assert.equal(JSON.stringify(await me.json()).includes("hidden"), false);
});
