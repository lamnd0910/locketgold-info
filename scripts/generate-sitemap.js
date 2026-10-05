import { readFile, writeFile } from "node:fs/promises";
import { sitemapXml } from "../src/sitemap.js";
import { FALLBACK_POSTS } from "../src/fallback-posts.js";

const archive = JSON.parse(await readFile(new URL("../public/imported-posts/index.json", import.meta.url), "utf8"));
const xml = sitemapXml(FALLBACK_POSTS, archive);
await writeFile(new URL("../public/sitemap.xml", import.meta.url), xml, "utf8");
console.log(`Generated sitemap.xml with ${xml.match(/<loc>/g).length} public URLs.`);
