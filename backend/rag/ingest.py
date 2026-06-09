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


def _chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> list[str]:
    """Split by double newline (paragraphs/sections) first.
    If a paragraph is still too large, sub-chunk it by word count."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    for para in paragraphs:
        words = para.split()
        if len(words) <= chunk_size:
            chunks.append(para)
        else:
            i = 0
            while i < len(words):
                chunk = " ".join(words[i : i + chunk_size])
                chunks.append(chunk)
                i += chunk_size - overlap
    return [c for c in chunks if len(c.strip()) > 20]


def ingest_text(text: str, source_name: str) -> int:
    """Chunk raw text and store in ChromaDB. Returns chunk count."""
    chunks = _chunk_text(text)
    if not chunks:
        return 0
    collection = _get_collection()
    ids       = [f"{source_name}_{i}" for i in range(len(chunks))]
    metadatas = [{"source": source_name, "chunk": i} for i in range(len(chunks))]
    existing = collection.get(where={"source": source_name})
    if existing["ids"]:
        collection.delete(ids=existing["ids"])
    collection.add(documents=chunks, ids=ids, metadatas=metadatas)
    return len(chunks)


def ingest_file(filepath: str, source_name: str | None = None) -> int:
    """Load a text file, chunk it, and store in ChromaDB. Returns chunk count."""
    text = Path(filepath).read_text(encoding="utf-8")
    source = source_name or Path(filepath).stem
    chunks = _chunk_text(text)
    collection = _get_collection()

    ids       = [f"{source}_{i}" for i in range(len(chunks))]
    metadatas = [{"source": source, "chunk": i} for i in range(len(chunks))]

    # Delete existing entries for this source so re-ingestion is safe
    existing = collection.get(where={"source": source})
    if existing["ids"]:
        collection.delete(ids=existing["ids"])

    collection.add(documents=chunks, ids=ids, metadatas=metadatas)
    return len(chunks)


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
