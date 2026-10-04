import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/import-android-apk.js <apk-path>");
const directory = new URL("../public/downloads/android/", import.meta.url);
await mkdir(directory, { recursive: true });
const hash = createHash("sha256");
const parts = [];
let size = 0;
for await (const chunk of createReadStream(source, { highWaterMark: 20 * 1024 * 1024 })) {
  hash.update(chunk);
  size += chunk.length;
  const name = `${createHash("sha256").update(chunk).digest("hex")}.part`;
  await writeFile(new URL(name, directory), chunk);
  parts.push(`/downloads/android/${name}`);
}
const manifest = { filename: "LocketGold.website.apk", size, sha256: hash.digest("hex"), parts };
await writeFile(new URL("../worker/android-apk-manifest.js", import.meta.url), `export default ${JSON.stringify(manifest, null, 2)};\n`);
console.log(`Imported ${size} bytes in ${parts.length} parts (${manifest.sha256}).`);
