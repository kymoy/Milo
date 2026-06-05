import chromadb
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "chroma_db"
COLLECTION = "milo_library"


def _get_collection():
    client = chromadb.PersistentClient(path=str(DB_PATH))
    return client.get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def retrieve(query: str, n_results: int = 3) -> list[dict]:
    """
    Search ChromaDB for the most relevant chunks for a given query.
    Returns a list of dicts with 'text' and 'source' keys.
    """
    collection = _get_collection()

    if collection.count() == 0:
        return []

    n_results = min(n_results, collection.count())
    results = collection.query(query_texts=[query], n_results=n_results)

    chunks = []
    for i, doc in enumerate(results["documents"][0]):
        source = results["metadatas"][0][i].get("source", "unknown")
        chunks.append({"text": doc, "source": source})

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
