import { postText } from "./post-brand.js";

export function mergePostArchive(existing = [], imported = []) {
  const posts = new Map();
  const titles = new Set();
  for (const post of [...existing, ...imported]) {
    if (!post?.slug) continue;
    const slug = post.duplicate_of || post.slug;
    const title = postText(post.title).normalize("NFKC").toLocaleLowerCase("vi-VN").replace(/\s+/g, " ").trim();
    if (posts.has(slug) || (title && titles.has(title))) continue;
    posts.set(slug, post);
    if (title) titles.add(title);
  }
  return [...posts.values()].sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
}

export function postArchivePage(posts, requestedPage, pageSize = 20) {
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(Number(requestedPage) || 1)));
  const start = (page - 1) * pageSize;
  return { page, totalPages, total: posts.length, start, posts: posts.slice(start, start + pageSize) };
}
