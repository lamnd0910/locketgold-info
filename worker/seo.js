import { sitemapXml, postUrl } from "../src/sitemap.js";
import { FALLBACK_POSTS } from "../src/fallback-posts.js";
import { postForDisplay } from "../src/post-brand.js";
import { mergePostArchive } from "../src/post-archive.js";
import { articleMarkup, archiveView } from "../src/post-view.js";

async function assetJson(request, env, path) {
  const response = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
  if (!response.ok) throw new Error(`SEO asset unavailable: ${path}`);
  return response.json();
}

export async function sitemapResponse(request, env) {
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  try {
    const [archive, live] = await Promise.all([
      assetJson(request, env, "/imported-posts/index.json"),
      env.DB ? env.DB.prepare("SELECT slug, title, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC").all() : { results: [] },
    ]);
    if (!Array.isArray(archive)) throw new Error("Invalid post archive");
    const xml = sitemapXml([...(live.results || []), ...FALLBACK_POSTS], archive);
    return new Response(request.method === "HEAD" ? null : xml, { headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Sitemap unavailable", error);
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  }
}

export async function postsResponse(request, env) {
  const url = new URL(request.url);
  // Render from the current shell rather than accepting a stale conditional asset response.
  const response = await env.ASSETS.fetch(new Request(url));
  if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) return response;
  if (!url.searchParams.has("bai")) {
    const [archive, live] = await Promise.all([
      assetJson(request, env, "/imported-posts/index.json"),
      env.DB ? env.DB.prepare("SELECT slug, title, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC").all() : { results: [] },
    ]);
    if (!Array.isArray(archive)) throw new Error("Invalid post archive");
    const view = archiveView(mergePostArchive(live.results?.length ? live.results : FALLBACK_POSTS, archive), url.searchParams.get("trang"));
    const canonical = `https://locketgold.info/bai-viet/${view.page > 1 ? `?trang=${view.page}` : ""}`;
    return finishHtml(request, response, new HTMLRewriter()
      .on('link[rel="canonical"]', { element(element) { element.setAttribute("href", canonical); } })
      .on("#post-list", { element(element) { element.setInnerContent(view.cards, { html: true }); element.after(view.controls, { html: true }); } })
      .on(".post-archive-controls", { element(element) { element.remove(); } }));
  }
  const slug = url.searchParams.get("bai");
  let post;
  if (/^[a-z0-9-]{1,200}$/.test(slug)) {
    if (env.DB) post = await env.DB.prepare("SELECT slug, title, excerpt, content, published_at FROM posts WHERE slug = ? AND status = 'published'").bind(slug).first();
    if (!post) {
      try { post = await assetJson(request, env, `/imported-posts/${slug}.json`); } catch { /* Try the built-in articles below. */ }
    }
    if (!post?.title) post = FALLBACK_POSTS.find((item) => item.slug === slug);
  }
  if (!post?.title) {
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex");
    return new Response(request.method === "HEAD" ? null : response.body, { status: 404, headers });
  }
  const display = postForDisplay(post);
  return finishHtml(request, response, new HTMLRewriter()
    .on('link[rel="canonical"]', { element(element) { element.setAttribute("href", postUrl(slug)); } })
    .on("title", { element(element) { element.setInnerContent(`${display.title} | Locket Gold`); } })
    .on('meta[name="description"]', { element(element) { element.setAttribute("content", display.excerpt || display.title); } })
    .on(".page-hero", { element(element) { element.remove(); } })
    .on(".post-archive-controls", { element(element) { element.remove(); } })
    .on("#post-list", { element(element) {
      element.setAttribute("class", "article-view");
      element.setAttribute("data-rendered-post", slug);
      element.setInnerContent(articleMarkup(post), { html: true });
    } }));
}

function finishHtml(request, response, rewriter) {
  const headers = new Headers(response.headers);
  headers.delete("ETag");
  headers.delete("Last-Modified");
  headers.set("Cache-Control", "public, max-age=300");
  if (request.method === "HEAD") return new Response(null, { status: response.status, headers });
  return rewriter.transform(new Response(response.body, { status: response.status, headers }));
}
