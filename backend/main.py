from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from rag.retrieve import retrieve, build_context

app = FastAPI(title="Milo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "null"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

# Placeholder credentials — will be replaced with a real database in Phase 4
USERS = {
    "admin": {"password": "admin123", "role": "admin"},
    "user":  {"password": "user123",  "role": "user"},
}


class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username", "password")
    @classmethod
    def validate_field(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        if len(v) > 64:
            raise ValueError("Field too long (max 64 characters)")
        return v


class ChatMessage(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def validate_message(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > 2000:
            raise ValueError("Message too long (max 2000 characters)")
        return v


@app.get("/")
def status():
    return {"status": "running", "app": "Milo"}


@app.post("/auth/login")
def login(body: LoginRequest):
    user = USERS.get(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    return {"role": user["role"]}


@app.post("/chat")
def chat(body: ChatMessage):
    chunks = retrieve(body.message, n_results=3)

    if not chunks:
        return {"reply": "I don't have any information loaded yet. Ask an admin to ingest a library first."}

    context = build_context(chunks)

    # Phase 5 will pass this context to Ollama for a real generated answer.
    # For now, return the most relevant retrieved chunk directly.
    best = chunks[0]["text"]
    return {
        "reply": best,
        "sources": [c["source"] for c in chunks],
        "context_preview": context[:300],
    }
