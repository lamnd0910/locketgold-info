import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import worker from "../worker/index.js";
import manifest from "../worker/android-apk-manifest.js";

const request = () => new Request("https://locketgold.info/api/orders/LG12345678/apk");
const db = (order) => ({ prepare() { return { bind() { return this; }, async first() { return order; } }; } });

test("APK download requires a paid Android order and hides raw parts", async () => {
  for (const order of [null, { platform: "Android", status: "pending" }, { platform: "Android", status: "failed" }, { platform: "Android", status: "cancelled" }, { platform: "iOS", status: "completed" }, { platform: "Android", status: "paid", gold_revoked_at: "2026-10-04" }]) {
    const response = await worker.fetch(request(), { DB: db(order), ASSETS: { fetch() { throw new Error("Unauthorized asset access"); } } }, {});
    assert.equal(response.status, order ? 403 : 404);
  }
  const raw = await worker.fetch(new Request(`https://locketgold.info${manifest.parts[0]}`), {}, {});
  assert.equal(raw.status, 404);
});

test("paid Android download streams the exact original APK within asset limits", async () => {
  const paths = [];
  const response = await worker.fetch(request(), {
    DB: db({ platform: "Android", status: "paid" }),
    ASSETS: { async fetch(assetRequest) {
      const path = new URL(assetRequest.url).pathname;
      paths.push(path);
      const file = new URL(`../public${path}`, import.meta.url);
      assert.ok((await stat(file)).size <= 25 * 1024 * 1024);
      return new Response(Readable.toWeb(createReadStream(file)));
    } },
  }, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/vnd.android.package-archive");
  assert.match(response.headers.get("Content-Disposition"), /LocketGold.website.apk/);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of response.body) { hash.update(chunk); size += chunk.length; }
  assert.equal(size, manifest.size);
  assert.equal(hash.digest("hex"), manifest.sha256);
  assert.deepEqual(paths, manifest.parts);
});
