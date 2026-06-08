import requests
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

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "phi3:mini"

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


def ask_ollama(prompt: str) -> str:
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=180,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except requests.exceptions.ConnectionError:
        return "CONNECTION_ERROR"
    except requests.exceptions.Timeout:
        return "TIMEOUT_ERROR"
    except Exception:
        return "CONNECTION_ERROR"


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

    prompt = f"""You are Milo, a knowledgeable and concise assistant. Use only the context below to answer the question. If the answer is not in the context, say you don't have that information.

Context:
{context}

Question: {body.message}

Answer:"""

    answer = ask_ollama(prompt)

    if answer == "CONNECTION_ERROR":
        return {"reply": "Ollama is not reachable. Make sure the Ollama app is open and running in your system tray."}
    if answer == "TIMEOUT_ERROR":
        return {"reply": "Milo is still thinking — the model took too long this time. Try asking again, it should be faster now that it is warmed up."}

    return {"reply": answer}
