import chromadb
from pathlib import Path

DB_PATH           = Path(__file__).parent.parent / "chroma_db"
COLLECTION        = "milo_library"
PARENT_COLLECTION = "milo_library_parents"

RELEVANCE_THRESHOLD = 0.50  # cosine distance; lower = more similar (0=identical, 1=unrelated)

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


def retrieve(query: str, n_results: int = 3) -> list[dict]:
    """
    Search child chunks for the query, then return their parent chunks as context.
    Falls back to returning child chunks directly if no parent_id metadata exists
    (e.g. data ingested before parent-child chunking was added).
    """
    child_coll  = _get_collection()
    parent_coll = _get_parent_collection()

    if child_coll.count() == 0:
        return []

    n_results = min(n_results, child_coll.count())
    results = child_coll.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    seen_parents: set[str] = set()
    parent_ids_ordered: list[tuple[str, str]] = []
    fallback_chunks: list[dict] = []

    for i, doc in enumerate(results["documents"][0]):
        distance = results["distances"][0][i]
        if distance >= RELEVANCE_THRESHOLD:
            continue
        meta   = results["metadatas"][0][i]
        source = meta.get("source", "unknown")
        pid    = meta.get("parent_id")

        if pid:
            if pid not in seen_parents:
                seen_parents.add(pid)
                parent_ids_ordered.append((pid, source))
        else:
            # Legacy data: no parent_id — return child text directly
            fallback_chunks.append({"text": doc, "source": source})

    if not parent_ids_ordered:
        return fallback_chunks

    pids       = [p[0] for p in parent_ids_ordered]
    source_map = {p[0]: p[1] for p in parent_ids_ordered}
    fetched    = parent_coll.get(ids=pids, include=["documents"])

    chunks = []
    for pid, doc in zip(fetched["ids"], fetched["documents"]):
        chunks.append({"text": doc, "source": source_map.get(pid, "unknown")})

    return chunks


def build_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a readable context block."""
    if not chunks:
        return ""
    lines = []
    for c in chunks:
        lines.append(f"[Source: {c['source']}]\n{c['text']}")
    return "\n\n---\n\n".join(lines)


if __name__ == "__main__":
    query = "how do I make carbonara"
    chunks = retrieve(query)
    print(f"Query: {query}\n")
    print(build_context(chunks))
