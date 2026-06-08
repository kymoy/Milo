import re
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Literal
from rag.retrieve import retrieve, build_context

app = FastAPI(title="Milo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "null"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "llama3.1:8b"
HISTORY_LIMIT = 20

BASE_SYSTEM_PROMPT = (
    "You are Milo, a helpful conversational assistant. "
    "Respond in plain, clear English by default. "
    "If a style instruction appears below, follow it exactly for your entire response."
)

STYLE_PATTERN = re.compile(
    r"(?:talk|speak|say\s+it|respond|answer|write|reply)\s+(?:\w+\s+){0,3}(?:like|as)\s+(?:a\s+|an\s+)?(\w[\w\s]{0,30})",
    re.IGNORECASE,
)
STYLE_RESET_WORDS = frozenset(["normally", "normal", "default", "regular", "plain", "neutral"])

USERS = {
    "admin": {"password": "admin123", "role": "admin"},
    "user":  {"password": "user123",  "role": "user"},
}


def _detect_style(text: str) -> tuple[bool, str | None]:
    lower = text.lower()
    if any(w in lower for w in STYLE_RESET_WORDS):
        return True, None
    match = STYLE_PATTERN.search(lower)
    if match:
        style = match.group(1).strip().rstrip(".,!?")
        if style:
            return True, style
    return False, None


def get_active_style(message: str, history: list) -> str | None:
    """Return the currently active style by checking the current message then history newest-first."""
    changed, style = _detect_style(message)
    if changed:
        return style
    for h in reversed(history):
        if h.role == "user":
            changed, style = _detect_style(h.text)
            if changed:
                return style
    return None


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


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, v):
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("History message too long (max 2000 characters)")
        return v


class ChatMessage(BaseModel):
    message: str
    use_library: bool = True
    history: list[HistoryMessage] = []

    @field_validator("message")
    @classmethod
    def validate_message(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > 2000:
            raise ValueError("Message too long (max 2000 characters)")
        return v

    @field_validator("history")
    @classmethod
    def validate_history(cls, v):
        if len(v) > 40:
            raise ValueError("History too long (max 40 messages)")
        return v


def ask_ollama(messages: list[dict]) -> str:
    try:
        resp = requests.post(
            OLLAMA_CHAT_URL,
            json={"model": OLLAMA_MODEL, "messages": messages, "stream": False},
            timeout=180,
        )
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "").strip()
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
    active_style = get_active_style(body.message, body.history)
    style_note = (
        f"\n\nStyle instruction: respond in this style for your entire response: {active_style}."
        if active_style else ""
    )

    if body.use_library:
        chunks = retrieve(body.message, n_results=3)
        if chunks:
            context = build_context(chunks)
            system_content = (
                BASE_SYSTEM_PROMPT + style_note
                + "\n\nUse the context below to help answer questions. "
                "If the answer is not in the context, use your general knowledge.\n\n"
                f"Context:\n{context}"
            )
        else:
            system_content = BASE_SYSTEM_PROMPT + style_note
    else:
        system_content = BASE_SYSTEM_PROMPT + style_note

    messages = [{"role": "system", "content": system_content}]

    for h in body.history[-HISTORY_LIMIT:]:
        messages.append({"role": h.role, "content": h.text})

    messages.append({"role": "user", "content": body.message})

    answer = ask_ollama(messages)

    if answer == "CONNECTION_ERROR":
        return {"reply": "Ollama is not reachable. Open a terminal and run: ollama serve"}
    if answer == "TIMEOUT_ERROR":
        return {"reply": "Milo is still thinking — the model took too long. Try again in a moment."}

    return {"reply": answer}
