import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";
import { encryptNoDnsKey, resolveNoDnsEnv, providerRequest } from "../worker/nodns.js";

const site = "https://locketgold.info";
const env = { SESSION_SECRET: "provider-settings-test-secret-at-least-32-bytes", ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", NODNS_API_KEY: "old-cloudflare-key", NODNS_CREDENTIALS_ENABLED: "true" };
async function login() {
  const r = await worker.fetch(new Request(`${site}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "admin" }) }), env, {});
  assert.equal(r.status, 200);
  return r.headers.get("Set-Cookie").split(";")[0];
}
function request(cookie, body, origin = site) {
  return new Request(`${site}/api/admin/provider/key`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin }, body: JSON.stringify(body) });
}

test("only an authenticated admin can change provider keys", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected provider call"); });
  const cookie = await login();
  const db = { prepare() { throw new Error("Unexpected storage access"); } };
  for (const [session, body, origin, status] of [["", { api_key: "new-key" }, site, 401], [cookie, { api_key: "new-key" }, "https://other.example", 403], [cookie, { api_key: "" }, site, 400], [cookie, { api_key: "bad key" }, site, 400]]) {
    assert.equal((await worker.fetch(request(session, body, origin), { ...env, DB: db }, {})).status, status);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("new key is verified then encrypted, overrides the secret and never appears in responses", async (t) => {
  const cookie = await login();
  let stored;
  const db = { prepare(sql) { return {
    bind(...values) { this.values = values; return this; },
    async run() { assert.match(sql, /INSERT INTO provider_credentials/); stored = { encrypted_key: this.values[0], updated_at: "2026-10-04 12:00:00" }; },
    async first() { return stored; },
  }; } };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers["x-api-key"], "new-private-key");
    assert.ok(url.endsWith("/api/v1/me"));
    return Response.json({ status: "success", data: { username: "new-owner", remaining: 10, active: true, apiKey: "new-private-key" } });
  });
  const result = await worker.fetch(request(cookie, { api_key: "new-private-key" }), { ...env, DB: db }, {});
  assert.equal(result.status, 200);
  const response = await result.json();
  assert.equal(response.account.username, "new-owner");
  assert.equal(JSON.stringify(response).includes("new-private-key"), false);
  assert.equal(stored.encrypted_key.includes("new-private-key"), false);
  const resolved = await resolveNoDnsEnv({ ...env, DB: db });
  assert.equal(resolved.NODNS_API_KEY, "new-private-key");
  assert.equal(env.NODNS_API_KEY, "old-cloudflare-key");
  await providerRequest(resolved, "/api/v1/me", { apiKey: true });
  const config = await worker.fetch(new Request(`${site}/api/admin/provider/key`, { headers: { Cookie: cookie } }), { ...env, DB: db }, {});
  const meta = await config.json(); assert.equal(meta.source, "admin");
  assert.equal(JSON.stringify(meta).includes(stored.encrypted_key), false);
});

test("invalid candidate key preserves existing configuration", async (t) => {
  const cookie = await login();
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "error", message: "Invalid key" }, { status: 401 }));
  const db = { prepare() { throw new Error("Must not overwrite existing key"); } };
  assert.equal((await worker.fetch(request(cookie, { api_key: "invalid" }), { ...env, DB: db }, {})).status, 401);
});

test("default secret remains usable without override; encrypted key fails closed when damaged", async () => {
  const noRow = { prepare() { return { async first() { return null; } }; } };
  assert.equal((await resolveNoDnsEnv({ ...env, DB: noRow })).NODNS_API_KEY, "old-cloudflare-key");
  const cipher = await encryptNoDnsKey(env, "saved-key");
  const db = { prepare() { return { async first() { return { encrypted_key: cipher }; } }; } };
  await assert.rejects(resolveNoDnsEnv({ ...env, DB: db, SESSION_SECRET: "different-secret" }), { status: 503 });
});
