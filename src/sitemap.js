import { mergePostArchive } from "./post-archive.js";

export const SITE_URL = "https://locketgold.info";
export const PUBLIC_PATHS = ["/", "/len-gold/", "/uy-tin/", "/bai-viet/", "/huong-dan/", "/cong-tac-vien/", "/lien-he/", "/tai-dns/"];

export function postUrl(slug) {
  return `${SITE_URL}/bai-viet/?bai=${encodeURIComponent(slug)}`;
}

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function publicationDate(value) {
  // D1 stores UTC timestamps without a timezone; use only the known calendar date.
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

export function sitemapXml(existing = [], imported = []) {
  const entries = PUBLIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
  for (const post of mergePostArchive(existing, imported)) {
    if (!/^[a-z0-9-]{1,200}$/.test(post.slug)) continue;
    entries.push({ url: postUrl(post.slug), lastmod: publicationDate(post.published_at) });
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ url, lastmod }) => `  <url><loc>${xmlEscape(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}
