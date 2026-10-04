import { postText } from "./post-brand.js";
const escape = (value) => postText(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const importedTags = new Set(["p", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "br", "hr", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "pre", "code", "div", "span"]);
const safeHref = (value) => /^(https?:\/\/|mailto:|tel:|\/bai-viet\/\?bai=)/i.test(value || "") && !/[\u0000-\u0020]/.test(value);
const safeImage = (value) => /^\/images\/imported-posts\/[a-f0-9]{24}\.(png|jpe?g|webp|gif)$/.test(value || "");

function renderImportedNode(node) {
  if (typeof node === "string") return escape(node);
  if (!node || !importedTags.has(node.tag)) return "";
  const children = Array.isArray(node.children) ? node.children.map(renderImportedNode).join("") : "";
  const attrs = node.attrs || {};
  if (node.tag === "img") return safeImage(attrs.src) ? `<img src="${escape(attrs.src)}" alt="${escape(attrs.alt)}" loading="lazy" decoding="async">` : "";
  let attributes = "";
  if (node.tag === "a" && safeHref(attrs.href)) attributes += ` href="${escape(attrs.href)}" rel="noopener noreferrer"`;
  for (const key of ["colspan", "rowspan", "start"]) if (/^\d{1,3}$/.test(String(attrs[key] || ""))) attributes += ` ${key}="${attrs[key]}"`;
  return ["br", "hr"].includes(node.tag) ? `<${node.tag}>` : `<${node.tag}${attributes}>${children}</${node.tag}>`;
}

export function renderPostContent(content, blocks) {
  if (Array.isArray(blocks)) return blocks.map(renderImportedNode).join("");
  return String(content || "").split(/\r?\n+/).filter((line) => line.trim()).map((line) => {
    const image = line.trim().match(/^!\[([^\]\n]*)\]\((\/api\/images\/[0-9a-f-]{36})\)$/);
    return image ? `<figure class="post-image"><img src="${image[2]}" alt="${escape(image[1])}" loading="lazy" decoding="async">${image[1] ? `<figcaption>${escape(image[1])}</figcaption>` : ""}</figure>` : `<p>${escape(line)}</p>`;
  }).join("");
}
