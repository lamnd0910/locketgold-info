"""Import the owner's authorized LocketGold article archive; resumable HTTP cache."""
import concurrent.futures
import hashlib
import json
import re
import threading
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Comment, NavigableString

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://locketgold.app"
CACHE = ROOT / "tmp" / "source-posts"
OUTPUT = ROOT / "public" / "imported-posts"
IMAGES = ROOT / "public" / "images" / "imported-posts"
for directory in (CACHE, OUTPUT, IMAGES):
    directory.mkdir(parents=True, exist_ok=True)
local = threading.local()
image_lock = threading.Lock()
MISSING_IMAGES = CACHE / "missing-images.json"
missing_images = json.loads(MISSING_IMAGES.read_text(encoding="utf-8")) if MISSING_IMAGES.exists() else []
ALLOWED = {"p", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "br", "hr", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "pre", "code", "div", "span"}


def fetch(url):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".html")
    if path.exists():
        return path.read_bytes()
    if not hasattr(local, "session"):
        local.session = requests.Session()
        local.session.headers.update({"User-Agent": "Mozilla/5.0"})
    for attempt in range(5):
        try:
            response = local.session.get(url, timeout=45)
            response.raise_for_status()
            path.write_bytes(response.content)
            time.sleep(0.15)
            return response.content
        except requests.RequestException as error:
            if getattr(error.response, "status_code", None) == 404:
                raise
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


def soup(url):
    return BeautifulSoup(fetch(url).decode("utf-8", errors="replace"), "html.parser")


def image(src):
    if not src:
        return ""
    url = urljoin(BASE, src)
    ext = Path(urlparse(url).path).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        raise ValueError(f"Unsupported image: {url}")
    name = hashlib.sha256(url.encode()).hexdigest()[:24] + ext
    destination = IMAGES / name
    with image_lock:
        if url in missing_images:
            return ""
        if not destination.exists():
            try:
                data = fetch(url)
            except requests.HTTPError as error:
                if error.response.status_code != 404:
                    raise
                missing_images.append(url)
                MISSING_IMAGES.write_text(json.dumps(missing_images), encoding="utf-8")
                return ""
            if data.lstrip().startswith(b"<"):
                raise ValueError(f"Image returned HTML: {url}")
            destination.write_bytes(data)
    return f"/images/imported-posts/{name}"


def node(element):
    if isinstance(element, Comment):
        return []
    if isinstance(element, NavigableString):
        return [str(element)]
    if element.name in {"script", "style", "iframe", "form", "svg"}:
        return []
    children = [item for child in element.children for item in node(child)]
    if element.name not in ALLOWED:
        return children
    result = {"tag": element.name, "children": children}
    attrs = {}
    if element.name == "a" and element.get("href"):
        href = urljoin(BASE, element["href"])
        parsed = urlparse(href)
        if parsed.scheme in {"http", "https", "mailto", "tel"}:
            attrs["href"] = f"/bai-viet/?bai={parsed.path.split('/')[-1]}" if parsed.netloc == "locketgold.app" and parsed.path.startswith("/bai-viet/") else href
    if element.name == "img":
        attrs = {"src": image(element.get("src")), "alt": element.get("alt", "")}
    for key in ("colspan", "rowspan", "start"):
        if element.get(key) and str(element[key]).isdigit():
            attrs[key] = str(element[key])
    if attrs:
        result["attrs"] = attrs
    return [result]


def list_page(page):
    url = f"{BASE}/bai-viet" + (f"?trang={page}" if page > 1 else "")
    document = soup(url)
    cards = document.select("a.blog-card")
    if not cards:
        raise ValueError(f"No article cards on page {page}")
    result = []
    for card in cards:
        title = card.select_one(".blog-card-title")
        intro = card.select_one(".blog-card-excerpt")
        category = card.select_one(".blog-card-cat")
        thumbnail = card.select_one("img")
        result.append({"slug": card["href"].rstrip("/").split("/")[-1], "source_url": urljoin(BASE, card["href"]), "title": title.get_text(strip=True), "excerpt": intro.get_text(strip=True) if intro else "", "category": category.get_text(strip=True) if category else "", "thumbnail_source": thumbnail.get("src", "") if thumbnail else "", "source_page": page})
    return result


def import_post(metadata):
    destination = OUTPUT / (metadata["slug"] + ".json")
    if destination.exists():
        return json.loads(destination.read_text(encoding="utf-8"))
    document = soup(metadata["source_url"])
    body = document.select_one("article.art-content")
    title = document.select_one("h1.art-title")
    if not body or not title or not body.get_text(strip=True):
        raise ValueError(f"Incomplete article: {metadata['source_url']}")
    date = re.search(r"(\d{2})/(\d{2})/(\d{4})", document.select_one(".art-meta").get_text())
    lead = body.find_previous_sibling("blockquote")
    cover = document.select_one(".art-thumb img")
    content = body.get_text("\n", strip=True)
    result = {**metadata, "title": title.get_text(strip=True), "excerpt": lead.get_text(" ", strip=True) if lead else metadata["excerpt"], "published_at": f"{date[3]}-{date[2]}-{date[1]}" if date else "", "content": content, "content_blocks": [item for child in body.children for item in node(child)], "thumbnail": image(metadata["thumbnail_source"]), "cover": image(cover.get("src")) if cover else "", "source_body_sha256": hashlib.sha256(str(body).encode()).hexdigest()}
    destination.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result


def main():
    previous_index = OUTPUT / "index.json"
    aliases = {post["slug"]: post["duplicate_of"] for post in json.loads(previous_index.read_text(encoding="utf-8")) if post.get("duplicate_of")} if previous_index.exists() else {}
    first = soup(f"{BASE}/bai-viet")
    pages = max([int(match[1]) for a in first.select(".blog-pagination a[href]") if (match := re.search(r"trang=(\d+)", a["href"]))] or [1])
    count_match = re.search(r"trong s[oố]\s*([\d,]+)", first.get_text(" ", strip=True))
    expected = int(count_match[1].replace(",", "")) if count_match else None
    print(f"Scanning {pages} pages; expected {expected} articles", flush=True)
    metadata = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for index, cards in enumerate(pool.map(list_page, range(1, pages + 1)), 1):
            metadata.extend(cards)
            if index % 25 == 0:
                print(f"Lists {index}/{pages}; {len(metadata)} articles", flush=True)
    slugs = [post["slug"] for post in metadata]
    if len(slugs) != len(set(slugs)) or (expected and len(slugs) != expected):
        raise ValueError(f"Archive mismatch: {len(slugs)} rows, {len(set(slugs))} unique, expected {expected}")
    (CACHE / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")
    index = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for number, post in enumerate(pool.map(import_post, metadata), 1):
            index.append({key: post[key] for key in ("slug", "title", "excerpt", "published_at", "category", "thumbnail", "source_url")})
            index[-1]["excerpt"] = metadata[number - 1]["excerpt"]
            if post["slug"] in aliases:
                index[-1]["duplicate_of"] = aliases[post["slug"]]
            if number % 100 == 0:
                print(f"Articles {number}/{len(metadata)}", flush=True)
    (OUTPUT / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    report = {"source": f"{BASE}/bai-viet", "articles": len(index), "pages": pages, "images": len(list(IMAGES.iterdir())), "missing_articles": 0, "unavailable_source_images": missing_images}
    (OUTPUT / "import-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
