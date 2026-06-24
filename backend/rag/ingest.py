import re
import chromadb
from pathlib import Path

DB_PATH           = Path(__file__).parent.parent / "chroma_db"
COLLECTION        = "milo_library"
PARENT_COLLECTION = "milo_library_parents"

CHILD_SENTENCES  = 3
CHILD_OVERLAP    = 1
PARENT_SENTENCES = 12
PARENT_OVERLAP   = 2

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(DB_PATH))
    return _client


def _get_collection():
    return _get_client().get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def _get_parent_collection():
    return _get_client().get_or_create_collection(
        name=PARENT_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def _extract_topic(first_sentence: str, heading: str | None) -> str:
    """Derive a short topic label from a section heading or first sentence."""
    source = heading if heading else first_sentence
    source = source.strip().lstrip("#").strip()
    match = re.search(r"[.!?]", source[:80])
    if match and match.start() > 10:
        return source[: match.start()].strip()
    return source[:60].rstrip() + ("…" if len(source) > 60 else "")


def _extract_sentences(text: str) -> list[dict]:
    """Split text into annotated sentences, tracking nearest heading context."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    annotated: list[dict] = []
    current_heading: str | None = None

    for para in paragraphs:
        if re.match(r"^#{1,6}\s", para):
            current_heading = para.lstrip("#").strip()
            continue
        if len(para) < 100 and not re.search(r"[.!?]", para) and para[0].isupper():
            current_heading = para.rstrip(":").strip()
            continue
        for s in re.split(r"(?<=[.!?])\s+", para):
            s = s.strip()
            if len(s) > 15:
                annotated.append({"text": s, "heading": current_heading})

    return annotated


def ingest_text(text: str, source_name: str) -> int:
    """Chunk text into parent/child pairs and store in ChromaDB. Returns child chunk count."""
    sentences = _extract_sentences(text)
    if not sentences:
        return 0

    child_coll  = _get_collection()
    parent_coll = _get_parent_collection()

    for coll in (child_coll, parent_coll):
        existing = coll.get(where={"source": source_name})
        if existing["ids"]:
            coll.delete(ids=existing["ids"])

    parent_ids, parent_docs, parent_metas = [], [], []
    child_ids, child_docs, child_metas    = [], [], []
    global_child_idx = 0
    p_idx   = 0
    p_start = 0

    while p_start < len(sentences):
        p_end   = min(p_start + PARENT_SENTENCES, len(sentences))
        p_group = sentences[p_start:p_end]
        parent_text = " ".join(s["text"] for s in p_group)
        if len(parent_text.strip()) < 20:
            p_start += PARENT_SENTENCES - PARENT_OVERLAP
            p_idx += 1
            continue

        parent_id    = f"{source_name}_parent_{p_idx}"
        heading      = next((s["heading"] for s in p_group if s["heading"]), None)
        parent_topic = _extract_topic(p_group[0]["text"], heading)
        parent_ids.append(parent_id)
        parent_docs.append(parent_text)
        parent_metas.append({"source": source_name, "parent_idx": p_idx, "topic": parent_topic})

        c_start = p_start
        c_idx   = 0
        while c_start + CHILD_SENTENCES <= p_end:
            c_group    = sentences[c_start: c_start + CHILD_SENTENCES]
            child_text = " ".join(s["text"] for s in c_group)
            if len(child_text.strip()) >= 20:
                c_heading   = next((s["heading"] for s in c_group if s["heading"]), None)
                child_topic = _extract_topic(c_group[0]["text"], c_heading) if c_group else parent_topic
                child_ids.append(f"{source_name}_{p_idx}_{c_idx}")
                child_docs.append(child_text)
                child_metas.append({
                    "source":    source_name,
                    "parent_id": parent_id,
                    "chunk":     global_child_idx,
                    "topic":     child_topic or parent_topic,
                })
                global_child_idx += 1
                c_idx += 1
            c_start += CHILD_SENTENCES - CHILD_OVERLAP

        p_start += PARENT_SENTENCES - PARENT_OVERLAP
        p_idx += 1

    BATCH = 5000
    for i in range(0, len(parent_ids), BATCH):
        parent_coll.add(
            documents=parent_docs[i:i+BATCH],
            ids=parent_ids[i:i+BATCH],
            metadatas=parent_metas[i:i+BATCH],
        )
    for i in range(0, len(child_ids), BATCH):
        child_coll.add(
            documents=child_docs[i:i+BATCH],
            ids=child_ids[i:i+BATCH],
            metadatas=child_metas[i:i+BATCH],
        )

    return len(child_ids)


def delete_source(source_name: str) -> int:
    """Delete all chunks for a source from both collections. Returns total removed."""
    child_coll  = _get_collection()
    parent_coll = _get_parent_collection()
    count = 0
    for coll in (child_coll, parent_coll):
        existing = coll.get(where={"source": source_name})
        if existing["ids"]:
            coll.delete(ids=existing["ids"])
            count += len(existing["ids"])
    return count


def ingest_file(filepath: str, source_name: str | None = None) -> int:
    """Load a text file, chunk it, and store in ChromaDB. Returns chunk count."""
    text   = Path(filepath).read_text(encoding="utf-8")
    source = source_name or Path(filepath).stem
    return ingest_text(text, source)


def get_source_chunks(source_name: str) -> list[dict]:
    """Return all child chunks for a source, sorted by chunk index."""
    collection = _get_collection()
    results = collection.get(where={"source": source_name}, include=["documents", "metadatas"])
    pairs = sorted(zip(results["metadatas"], results["documents"]), key=lambda x: x[0].get("chunk", 0))
    return [
        {"index": m.get("chunk", i), "text": doc, "topic": m.get("topic", "")}
        for i, (m, doc) in enumerate(pairs)
    ]


def list_sources() -> list[str]:
    collection = _get_collection()
    results = collection.get(include=["metadatas"])
    seen = set()
    sources = []
    for m in results["metadatas"]:
        if m["source"] not in seen:
            seen.add(m["source"])
            sources.append(m["source"])
    return sources


if __name__ == "__main__":
    data_dir = Path(__file__).parent.parent / "data"
    for txt_file in data_dir.glob("*.txt"):
        count = ingest_file(str(txt_file))
        print(f"Ingested {txt_file.name} - {count} chunks")
    print("Sources in DB:", list_sources())
