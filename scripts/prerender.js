import { readFile, writeFile } from "node:fs/promises";
import { createPageRenderer } from "../src/page-render.js";
import { mergePostArchive } from "../src/post-archive.js";
import { archiveView } from "../src/post-view.js";
import { FALLBACK_POSTS } from "../src/fallback-posts.js";

const pages = { "index.html": "home", "len-gold/index.html": "pricing", "uy-tin/index.html": "trust", "bai-viet/index.html": "posts", "huong-dan/index.html": "guide", "cong-tac-vien/index.html": "ctv", "lien-he/index.html": "contact", "tai-dns/index.html": "dns" };
const archive = JSON.parse(await readFile(new URL("../public/imported-posts/index.json", import.meta.url), "utf8"));
for (const [path, page] of Object.entries(pages)) {
  const file = new URL(`../dist/${path}`, import.meta.url);
  let content = createPageRenderer(page).render();
  if (page === "posts") {
    const view = archiveView(mergePostArchive(FALLBACK_POSTS, archive), 1);
    content = content.replace(/<div id="post-list" class="post-grid">[\s\S]*?<\/div><\/div><\/section>/, () => `<div id="post-list" class="post-grid">${view.cards}</div>${view.controls}</div></section>`);
  }
  const html = await readFile(file, "utf8");
  if (!html.includes('<div id="app"></div>')) throw new Error(`Missing app mount in ${path}`);
  await writeFile(file, html.replace('<div id="app"></div>', () => `<div id="app">${content}</div>`), "utf8");
}
console.log(`Prerendered ${Object.keys(pages).length} public pages with content and crawlable links.`);
