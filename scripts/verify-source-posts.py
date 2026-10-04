"""Compare every imported title and paragraph against the cached source HTML."""
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from bs4 import BeautifulSoup, SoupStrainer

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "public" / "imported-posts"
CACHE = ROOT / "tmp" / "source-posts"
metadata = json.loads((CACHE / "metadata.json").read_text(encoding="utf-8"))
index = json.loads((DIRECTORY / "index.json").read_text(encoding="utf-8"))
assert len(index) == len(metadata) == 2499
assert {post["slug"] for post in index} == {post["slug"] for post in metadata}


def block_text(nodes):
    return "".join(node if isinstance(node, str) else block_text(node.get("children", [])) for node in nodes)


def verify(item):
    post = json.loads((DIRECTORY / (item["slug"] + ".json")).read_text(encoding="utf-8"))
    raw = (CACHE / (hashlib.sha256(item["source_url"].encode()).hexdigest() + ".html")).read_bytes()
    text = raw.decode("utf-8", errors="replace")
    article = re.search(r'<article\b[^>]*class="art-content"[^>]*>.*?</article>', text, re.S)
    title = re.search(r'<h1\b[^>]*class="art-title"[^>]*>.*?</h1>', text, re.S)
    fragment = title[0] + article[0] if title and article else text
    document = BeautifulSoup(fragment, "html.parser", parse_only=SoupStrainer(["article", "h1"]))
    body = document.select_one("article.art-content")
    assert post["title"] == document.select_one("h1.art-title").get_text(strip=True), item["slug"]
    assert post["content"] == body.get_text("\n", strip=True), item["slug"]
    assert block_text(post["content_blocks"]) == body.get_text(), item["slug"]
    for path in (post["thumbnail"], post["cover"]):
        if path:
            assert (ROOT / "public" / path.lstrip("/")).is_file(), path
    return item["slug"]


with ThreadPoolExecutor(max_workers=4) as pool:
    for number, slug in enumerate(pool.map(verify, metadata), 1):
        if number % 500 == 0:
            print(f"Verified {number}/{len(index)} articles", flush=True)
assert all(path.stat().st_size < 25 * 1024 * 1024 for path in (ROOT / "public" / "images" / "imported-posts").iterdir())
print(f"Verified {len(index)} complete articles: original titles, text, formatting tree and local images.")
