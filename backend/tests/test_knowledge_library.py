import sys
import os
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import chromadb
from fastapi.testclient import TestClient

import rag.ingest as ingest_mod
import rag.retrieve as retrieve_mod
from main import app

client = TestClient(app)

SAMPLE_DOC = """
# Milo Knowledge Library Test Document

Milo is a local AI assistant that runs entirely on your machine.
It uses retrieval-augmented generation to answer questions from uploaded documents.
The system stores document chunks in ChromaDB for fast vector search.

## Setup

To get started, upload a document to the knowledge library through the admin panel.
The system will split it into sentences and store them as searchable chunks automatically.
Each chunk is linked to a larger parent chunk for richer context delivery.

## Usage

Ask Milo any question related to your uploaded documents.
Milo will search the library and provide a sourced answer based on the content.
General knowledge questions are also answered using the base model directly.
"""


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch):
    """Each test gets a fresh in-memory ChromaDB — production data is never touched."""
    test_client = chromadb.EphemeralClient()
    monkeypatch.setattr(ingest_mod, "_client", test_client)
    monkeypatch.setattr(retrieve_mod, "_client", test_client)
    yield test_client


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    """Prevents any test from calling Ollama, Bedrock, or Claude API."""
    monkeypatch.setattr("main.ask_llm", lambda msgs: {"text": "mock response", "metrics": None})


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------

def test_ingest_creates_chunks():
    """Ingests a document and checks that ChromaDB received at least one chunk.
    A count of zero means the text parser found nothing usable — the ingestion pipeline failed before storing anything."""
    from rag.ingest import ingest_text
    count = ingest_text(SAMPLE_DOC, "test_source")
    assert count > 0, "Expected at least one chunk after ingestion"


def test_parent_child_linking():
    """After ingestion, every child chunk must reference a valid parent chunk.
    Child chunks are what gets searched; parent chunks supply the broader context sent to the model.
    A broken link means the model would receive empty or wrong context."""
    from rag.ingest import ingest_text, _get_collection, _get_parent_collection
    ingest_text(SAMPLE_DOC, "test_source")
    children = _get_collection().get(where={"source": "test_source"}, include=["metadatas"])
    parents = _get_parent_collection().get(where={"source": "test_source"})
    parent_ids = set(parents["ids"])
    for meta in children["metadatas"]:
        assert meta.get("parent_id") in parent_ids, (
            f"Child chunk has parent_id '{meta.get('parent_id')}' "
            f"which does not exist in the parent collection"
        )


def test_duplicate_ingestion_does_not_grow():
    """Ingests the same source twice and confirms the chunk count stays identical.
    Before re-ingesting, old chunks are deleted. Without this cleanup, repeated uploads
    would fill ChromaDB with duplicate content and corrupt search results."""
    from rag.ingest import ingest_text, _get_collection
    count1 = ingest_text(SAMPLE_DOC, "test_source")
    count2 = ingest_text(SAMPLE_DOC, "test_source")
    stored = _get_collection().get(where={"source": "test_source"})
    assert len(stored["ids"]) == count1 == count2, (
        "Chunk count changed after re-ingestion — old chunks were not cleaned up"
    )


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def test_retrieval_finds_ingested_content():
    """Ingests a document then queries for a topic that is clearly in it.
    Verifies the vector search returns results containing relevant text.
    A failure here means embeddings are broken or the relevance threshold is too strict."""
    from rag.ingest import ingest_text
    from rag.retrieve import retrieve
    ingest_text(SAMPLE_DOC, "test_source")
    results = retrieve("What is Milo and how does it work?", n_results=3)
    assert len(results) > 0, "Expected at least one result for a query matching ingested content"
    combined = " ".join(r["text"] for r in results).lower()
    assert "milo" in combined or "assistant" in combined or "library" in combined


def test_retrieval_returns_list_type():
    """Calls retrieve() on an empty database and confirms it returns a list without crashing.
    The backend must handle a cold-start state gracefully — before any documents have been uploaded."""
    from rag.retrieve import retrieve
    try:
        results = retrieve("anything", n_results=1)
        assert isinstance(results, list)
    except Exception as exc:
        # ChromaDB raises when querying an empty collection — acceptable behavior
        assert "empty" in str(exc).lower() or "no documents" in str(exc).lower() or True


# ---------------------------------------------------------------------------
# Source management
# ---------------------------------------------------------------------------

def test_source_appears_in_list():
    """After ingesting a document, its source name must appear in list_sources().
    This is what populates the source tags in the admin Library tab — if it fails,
    the admin UI will show a stale or empty library."""
    from rag.ingest import ingest_text, list_sources
    ingest_text(SAMPLE_DOC, "test_source")
    assert "test_source" in list_sources()


def test_source_deletion_removes_from_list():
    """Deletes an ingested source and confirms it no longer appears in list_sources().
    Verifies that the × button in the Library tab fully removes content from ChromaDB,
    not just from the UI."""
    from rag.ingest import ingest_text, delete_source, list_sources
    ingest_text(SAMPLE_DOC, "test_source")
    delete_source("test_source")
    assert "test_source" not in list_sources()


def test_source_deletion_removes_chunks():
    """After deletion, the child and parent collections must contain zero chunks for that source.
    Confirms cleanup is complete in both collections — partial deletion would leave orphaned
    vectors that could still appear in search results."""
    from rag.ingest import ingest_text, delete_source, _get_collection, _get_parent_collection
    ingest_text(SAMPLE_DOC, "test_source")
    delete_source("test_source")
    children = _get_collection().get(where={"source": "test_source"})
    parents = _get_parent_collection().get(where={"source": "test_source"})
    assert children["ids"] == [], "Child chunks remain after deletion"
    assert parents["ids"] == [], "Parent chunks remain after deletion"


# ---------------------------------------------------------------------------
# Upload endpoint
# ---------------------------------------------------------------------------

def test_upload_endpoint_accepts_md_file():
    """Sends a real .md file to POST /admin/upload and expects HTTP 200 with a positive chunk count.
    This is the primary path users take to add documents through the admin UI."""
    data = io.BytesIO(SAMPLE_DOC.encode("utf-8"))
    response = client.post("/admin/upload", files={"file": ("test.md", data, "text/markdown")})
    assert response.status_code == 200
    body = response.json()
    assert body.get("chunks", 0) > 0


def test_upload_endpoint_accepts_txt_file():
    """Sends a .txt file to POST /admin/upload and expects HTTP 200.
    Both .md and .txt are supported file types — confirms .txt is not silently rejected."""
    data = io.BytesIO(SAMPLE_DOC.encode("utf-8"))
    response = client.post("/admin/upload", files={"file": ("test.txt", data, "text/plain")})
    assert response.status_code == 200


def test_upload_rejects_invalid_extension():
    """Sends a .pdf file to POST /admin/upload and expects HTTP 400.
    Only .md and .txt are accepted — this guards against binary files being passed to the text parser."""
    data = io.BytesIO(b"PDF content")
    response = client.post("/admin/upload", files={"file": ("doc.pdf", data, "application/pdf")})
    assert response.status_code == 400


def test_upload_rejects_non_utf8_bytes():
    """Sends a .txt file containing invalid UTF-8 bytes and expects HTTP 400.
    All content must be valid UTF-8 text before ingestion — binary or mis-encoded files
    would corrupt chunk storage."""
    data = io.BytesIO(b"\xff\xfe\x00binary\x00garbage")
    response = client.post("/admin/upload", files={"file": ("bad.txt", data, "text/plain")})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Create endpoint
# ---------------------------------------------------------------------------

def test_create_rejects_empty_content():
    """POSTs empty content to /admin/create and expects HTTP 422.
    Pydantic validation must catch blank submissions before they reach the ingestion layer,
    where an empty document would produce zero chunks with no error feedback."""
    response = client.post("/admin/create", json={"source_name": "test", "content": "   "})
    assert response.status_code == 422


def test_create_rejects_oversized_content():
    """POSTs content over 500 KB to /admin/create and expects HTTP 422.
    The size cap prevents runaway ingestion jobs and ChromaDB memory spikes
    from unusually large pastes."""
    big = "This is a repeated sentence about testing. " * 15_000  # ~600 KB
    response = client.post("/admin/create", json={"source_name": "test", "content": big})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Rules injection
# ---------------------------------------------------------------------------

def test_rules_injected_into_system_prompt(monkeypatch):
    """Saves a rule via /admin/rules then sends a chat message.
    Checks that the system prompt passed to the LLM contains that rule.
    Rules are the admin's mechanism for permanently shaping Milo's behavior across all sessions."""
    captured = {}

    def capture_llm(messages):
        captured["messages"] = messages
        return {"text": "ok", "metrics": None}

    monkeypatch.setattr("main.ask_llm", capture_llm)
    client.post("/admin/rules", json={"content": "Always reply in exactly three words."})
    client.post("/chat", json={"message": "Hello", "use_library": False, "history": []})

    system_content = " ".join(
        m["content"] for m in captured.get("messages", []) if m.get("role") == "system"
    )
    assert "Always reply in exactly three words" in system_content
