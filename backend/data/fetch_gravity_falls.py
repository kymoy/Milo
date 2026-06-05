"""
Fetches Gravity Falls wiki pages and saves them as a plain text
file for ingestion into the RAG pipeline.

Uses only Python stdlib — no extra dependencies needed.
"""

import json
import re
import time
import urllib.request
from pathlib import Path

OUTPUT = Path(__file__).parent / "gravity_falls.txt"

API = "https://gravityfalls.fandom.com/api.php"

PAGES = [
    # Main characters
    "Dipper Pines", "Mabel Pines", "Grunkle Stan", "Stanford Pines",
    "Bill Cipher", "Wendy Corduroy", "Soos Ramirez", "Gideon Gleeful",
    # Creatures & beings
    "Gnome", "Multi-Bear", "Time Baby", "Manotaur", "Gremloblin",
    "Shapeshifter", "Summerween Trickster",
    # Locations
    "Mystery Shack", "Gravity Falls, Oregon", "Bunker",
    "Northwest Mansion",
    # Objects & items
    "Journal 1", "Journal 2", "Journal 3", "Grappling hook",
    # Events & concepts
    "Weirdmageddon", "Society of the Blind Eye", "Blind Ivan",
    "Cipher Hunt",
]

BATCH = 10  # pages per API call


def fetch_batch(titles: list[str]) -> dict[str, str]:
    """Fetch a batch of pages from the MediaWiki API. Returns {title: wikitext}."""
    params = {
        "action": "query",
        "titles": "|".join(titles),
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
        "format": "json",
        "formatversion": "2",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "MiloRAGBot/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    results = {}
    for page in data.get("query", {}).get("pages", []):
        if page.get("missing"):
            continue
        title = page["title"]
        try:
            text = page["revisions"][0]["slots"]["main"]["content"]
            results[title] = text
        except (KeyError, IndexError):
            pass
    return results


def clean_wikitext(text: str) -> str:
    """Strip wiki markup and return readable plain text."""
    # Remove file/image links
    text = re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", text, flags=re.IGNORECASE)
    # Wikilinks: [[Page|Display]] -> Display, [[Page]] -> Page
    text = re.sub(r"\[\[(?:[^|\]]+\|)?([^\]]+)\]\]", r"\1", text)
    # External links
    text = re.sub(r"\[https?://\S+\s+([^\]]+)\]", r"\1", text)
    text = re.sub(r"\[https?://\S+\]", "", text)
    # Remove templates (iterative to handle nesting)
    for _ in range(6):
        text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    # Remove table markup
    text = re.sub(r"^\{\|.*?^\|\}", "", text, flags=re.MULTILINE | re.DOTALL)
    text = re.sub(r"^[|!].*$", "", text, flags=re.MULTILINE)
    # Remove HTML tags and ref tags
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    # Remove bold/italic markers
    text = re.sub(r"'{2,3}", "", text)
    # Convert headings to readable text
    text = re.sub(r"={2,6}\s*([^=\n]+?)\s*={2,6}", r"\n\1\n", text)
    # Remove category and interwiki links
    text = re.sub(r"\[\[(?:Category|[a-z]{2}):[^\]]+\]\]", "", text, flags=re.IGNORECASE)
    # Clean up excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build_entry(title: str, wikitext: str) -> str:
    """Format a single page as a clean text block."""
    body = clean_wikitext(wikitext)
    # Keep only the first 600 words to avoid one article dominating the chunk
    words = body.split()
    if len(words) > 600:
        body = " ".join(words[:600]) + "..."
    return f"{title.upper()}\n{body}"


def main():
    import urllib.parse  # noqa: imported here to keep top clean

    all_entries = []
    batches = [PAGES[i:i + BATCH] for i in range(0, len(PAGES), BATCH)]

    for i, batch in enumerate(batches):
        print(f"Fetching batch {i + 1}/{len(batches)}: {batch}")
        try:
            pages = fetch_batch(batch)
            for title, wikitext in pages.items():
                entry = build_entry(title, wikitext)
                if len(entry.split()) > 30:
                    all_entries.append(entry)
                    print(f"  OK: {title}")
                else:
                    print(f"  SKIP (too short): {title}")
        except Exception as e:
            print(f"  ERROR on batch: {e}")
        if i < len(batches) - 1:
            time.sleep(1)  # be polite to the API

    OUTPUT.write_text("\n\n---\n\n".join(all_entries), encoding="utf-8")
    print(f"\nSaved {len(all_entries)} articles to {OUTPUT}")


if __name__ == "__main__":
    import urllib.parse
    main()
