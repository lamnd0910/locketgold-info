const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderPostContent(content) {
  return String(content || "").split(/\r?\n+/).filter((line) => line.trim()).map((line) => {
    const image = line.trim().match(/^!\[([^\]\n]*)\]\((\/api\/images\/[0-9a-f-]{36})\)$/);
    return image ? `<figure class="post-image"><img src="${image[2]}" alt="${escape(image[1])}" loading="lazy" decoding="async">${image[1] ? `<figcaption>${escape(image[1])}</figcaption>` : ""}</figure>` : `<p>${escape(line)}</p>`;
  }).join("");
}
