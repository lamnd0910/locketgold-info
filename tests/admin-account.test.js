import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

const site = "https://locketgold.info";
let ip = 100;
function setup() {
  let row = null;
  const env = { ADMIN_CREDENTIALS_ENABLED: "true", ADMIN_USERNAME: "admin", SESSION_SECRET: "account-test-secret-at-least-thirty-two-bytes", ADMIN_PASSWORD_SHA256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", DB: {
    prepare(sql) { return {
      bind(...values) { this.values = values; return this; },
      async first() { assert.match(sql, /SELECT .* FROM admin_credentials/); return row; },
      async run() {
        assert.match(sql, /INSERT INTO admin_credentials/);
        const [username, password_hash, password_salt, revision, previous] = this.values;
        if (row && row.revision !== previous) return { meta: { changes: 0 } };
        row = { username, password_hash, password_salt, revision };
        return { meta: { changes: 1 } };
      },
    }; },
  } };
  const request = (path, cookie, body, origin = site) => new Request(site + path, { method: body ? "POST" : "GET", headers: { Cookie: cookie || "", Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": `192.0.2.${ip++}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const call = (path, cookie, body, origin) => worker.fetch(request(path, cookie, body, origin), env, {});
  const login = async (username = "admin", password = "admin") => call("/api/admin/login", "", { username, password });
  return { env, call, login, row: () => row };
}
const cookieOf = response => response.headers.get("Set-Cookie").split(";")[0];

test("account settings require admin, same origin and the current password before changing credentials", async () => {
  const { call, login, row } = setup();
  const cookie = cookieOf(await login());
  const values = { username: "owner", current_password: "admin", new_password: "new-password-123", confirm_password: "new-password-123" };
  assert.equal((await call("/api/admin/account", "")).status, 401);
  assert.equal((await call("/api/admin/account", cookie, values, "https://other.example")).status, 403);
  for (const [patch, status] of [[{ current_password: "wrong" }, 401], [{ username: "a b" }, 400], [{ new_password: "short", confirm_password: "short" }, 400], [{ confirm_password: "different-password" }, 400]]) {
    assert.equal((await call("/api/admin/account", cookie, { ...values, ...patch })).status, status);
    assert.equal(row(), null);
  }
});

test("changing username and password preserves the current session, invalidates old sessions and disables old credentials", async () => {
  const { call, login, row } = setup();
  const oldCookie = cookieOf(await login());
  const result = await call("/api/admin/account", oldCookie, { username: "owner", current_password: "admin", new_password: "new-password-123", confirm_password: "new-password-123" });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.username, "owner");
  assert.equal(JSON.stringify(body).includes("password"), false);
  assert.notEqual(row().password_hash, "new-password-123");
  const cookie = cookieOf(result);
  assert.equal((await call("/api/admin/session", oldCookie)).status, 401);
  assert.equal((await call("/api/admin/session", cookie)).status, 200);
  assert.equal((await login("admin", "admin")).status, 401);
  assert.equal((await login("owner", "admin")).status, 401);
  assert.equal((await login("owner", "new-password-123")).status, 200);
  assert.deepEqual(await (await call("/api/admin/account", cookie)).json(), { username: "owner", editable: true });
});

test("changing only the username keeps the password; changing only the password keeps the username", async () => {
  const { call, login } = setup();
  const initial = cookieOf(await login());
  const rename = await call("/api/admin/account", initial, { username: "owner", current_password: "admin", new_password: "", confirm_password: "" });
  assert.equal(rename.status, 200);
  assert.equal((await login("owner", "admin")).status, 200);
  const change = await call("/api/admin/account", cookieOf(rename), { username: "owner", current_password: "admin", new_password: "second-password-123", confirm_password: "second-password-123" });
  assert.equal(change.status, 200);
  assert.equal((await login("owner", "admin")).status, 401);
  assert.equal((await login("owner", "second-password-123")).status, 200);
});
