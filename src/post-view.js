import { postForDisplay } from "./post-brand.js";
import { renderPostContent } from "./post-content.js";
import { postArchivePage } from "./post-archive.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

export function postCards(posts) {
  const images = {
    "bao-ve-tai-khoan": "/images/antoan.png",
    "kiem-tra-sau-nang-cap": "/images/noapp.png",
    "chon-goi-phu-hop": "/images/logo.png",
  };
  return posts.map((rawPost) => {
    const post = postForDisplay(rawPost);
    const href = `/bai-viet/?bai=${encodeURIComponent(post.slug || "")}`;
    const image = /^\/images\/imported-posts\/[a-f0-9]{24}\.(png|jpe?g|webp|gif)$/.test(post.thumbnail || "") ? post.thumbnail : images[post.slug] || "/images/logo.png";
    return `<article class="post-card"><a class="post-card-image" href="${href}" aria-label="${escapeHtml(post.title)}"><img src="${image}" alt="${escapeHtml(post.title)}" width="1536" height="1024" loading="lazy" decoding="async"></a><span>${escapeHtml(formatDate(post.published_at))}</span><h2><a href="${href}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.excerpt || "")}</p><a href="${href}">Đọc bài →</a></article>`;
  }).join("");
}

export function formatDate(value) {
  if (!value) return "Mới cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN").format(date);
}

export function articleMarkup(rawPost) {
  const post = postForDisplay(rawPost);
  const cover = /^\/images\/imported-posts\/[a-f0-9]{24}\.(png|jpe?g|webp|gif)$/.test(post.cover || "") ? `<img class="article-cover" src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" decoding="async">` : "";
  return `<article><a class="text-link" href="/bai-viet/">← Tất cả bài viết</a><span>${escapeHtml(formatDate(post.published_at))}${post.category ? ` · ${escapeHtml(post.category)}` : ""}</span><h1>${escapeHtml(post.title)}</h1>${cover}<p class="article-lead">${escapeHtml(post.excerpt)}</p><div class="article-body">${renderPostContent(post.content, post.content_blocks)}</div></article>`;
}

export function archiveView(posts, requestedPage) {
  const selected = postArchivePage(posts, requestedPage);
  const pageLink = (number, label = number) => `<a class="button button--small button--outline" href="/bai-viet/?trang=${number}"${number === selected.page ? ' aria-current="page"' : ""}>${label}</a>`;
  const visiblePages = [...new Set([1, selected.page - 1, selected.page, selected.page + 1, selected.totalPages])].filter((number) => number >= 1 && number <= selected.totalPages).sort((a, b) => a - b);
  const controls = `<div class="post-archive-controls"><p>Hiển thị ${selected.total ? selected.start + 1 : 0}–${selected.start + selected.posts.length} trong ${selected.total.toLocaleString("vi-VN")} bài viết</p><nav class="post-pagination" aria-label="Phân trang bài viết">${selected.page > 1 ? pageLink(selected.page - 1, "← Trước") : ""}${visiblePages.map((number, index) => `${index && number > visiblePages[index - 1] + 1 ? '<span aria-hidden="true">…</span>' : ""}${pageLink(number)}`).join("")}${selected.page < selected.totalPages ? pageLink(selected.page + 1, "Sau →") : ""}</nav></div>`;
  return { ...selected, cards: postCards(selected.posts), controls };
}

