import re
import subprocess
import time
from pathlib import Path
from collections import deque
import psutil
import requests
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Literal
from rag.retrieve import retrieve, build_context
from rag.ingest import ingest_text, list_sources, delete_source

app = FastAPI(title="Milo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "null"],
    allow_methods=["POST", "GET", "DELETE"],
    allow_headers=["Content-Type"],
)

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
OLLAMA_BASE_URL  = "http://localhost:11434"
OLLAMA_MODEL_DEFAULT = "llama3.1:8b"
HISTORY_LIMIT = 20

BASE_SYSTEM_PROMPT = "You are Milo, a helpful conversational assistant."

RULES_PATH  = Path(__file__).parent / "milo_rules.md"
MODEL_PATH  = Path(__file__).parent / "milo_model.txt"
METRICS_HISTORY: deque = deque(maxlen=100)

_active_model: str = (
    MODEL_PATH.read_text(encoding="utf-8").strip()
    if MODEL_PATH.exists() and MODEL_PATH.read_text(encoding="utf-8").strip()
    else OLLAMA_MODEL_DEFAULT
)


def get_active_model() -> str:
    return _active_model


def set_active_model(name: str) -> None:
    global _active_model
    _active_model = name
    MODEL_PATH.write_text(name, encoding="utf-8")


def load_rules() -> str:
    if RULES_PATH.exists():
        return RULES_PATH.read_text(encoding="utf-8").strip()
    return ""

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


def get_system_stats() -> dict:
    mem = psutil.virtual_memory()
    stats = {
        "ram_percent": round(mem.percent, 1),
        "ram_used_gb": round(mem.used / 1e9, 2),
        "ram_total_gb": round(mem.total / 1e9, 2),
        "gpu_percent": None,
        "vram_used_mb": None,
        "vram_total_mb": None,
        "gpu_temp": None,
    }
    try:
        result = subprocess.run(
            ["nvidia-smi",
             "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=2,
        )
        if result.returncode == 0:
            parts = [p.strip() for p in result.stdout.strip().split(",")]
            stats["gpu_percent"]  = float(parts[0])
            stats["vram_used_mb"] = float(parts[1])
            stats["vram_total_mb"] = float(parts[2])
            stats["gpu_temp"]     = float(parts[3])
    except Exception:
        pass
    return stats


def ask_ollama(messages: list[dict]) -> dict:
    psutil.cpu_percent(interval=None)  # reset cpu counter before request
    start = time.time()
    try:
        resp = requests.post(
            OLLAMA_CHAT_URL,
            json={
                "model": get_active_model(),
                "messages": messages,
                "stream": False,
                "keep_alive": "10m",
                "options": {"num_ctx": 4096},
            },
            timeout=180,
        )
        resp.raise_for_status()
        data = resp.json()
        elapsed_ms = round((time.time() - start) * 1000)
        cpu = round(psutil.cpu_percent(interval=None), 1)

        eval_count = data.get("eval_count", 0)
        eval_duration_ns = data.get("eval_duration", 0)
        tokens_per_sec = round(eval_count / (eval_duration_ns / 1e9), 1) if eval_duration_ns > 0 else None

        sys_stats = get_system_stats()
        metrics = {
            "ts": time.time(),
            "response_ms": elapsed_ms,
            "cpu_percent": cpu,
            "tokens_per_sec": tokens_per_sec,
            **sys_stats,
        }
        METRICS_HISTORY.append(metrics)

        return {
            "text": data.get("message", {}).get("content", "").strip(),
            "metrics": metrics,
        }
    except requests.exceptions.ConnectionError:
        return {"text": "CONNECTION_ERROR", "metrics": None}
    except requests.exceptions.Timeout:
        return {"text": "TIMEOUT_ERROR", "metrics": None}
    except Exception:
        return {"text": "CONNECTION_ERROR", "metrics": None}


class RulesRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_rules(cls, v):
        if len(v) > 50_000:
            raise ValueError("Rules too large (max 50KB)")
        return v


class CreateDocRequest(BaseModel):
    source_name: str
    content: str

    @field_validator("source_name")
    @classmethod
    def validate_source_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Source name cannot be empty")
        if len(v) > 100:
            raise ValueError("Source name too long (max 100 characters)")
        if not re.match(r'^[\w\-]+$', v):
            raise ValueError("Source name can only contain letters, numbers, hyphens, and underscores")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Content cannot be empty")
        if len(v) > 500_000:
            raise ValueError("Content too large (max 500KB)")
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


@app.get("/admin/models")
def admin_get_models():
    try:
        res = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        res.raise_for_status()
        models = [m["name"] for m in res.json().get("models", [])]
    except Exception:
        models = []
    return {"models": models, "active": get_active_model()}


@app.post("/admin/model")
def admin_set_model(body: dict):
    name = body.get("model", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Model name required.")
    set_active_model(name)
    return {"active": name}


@app.get("/admin/diagnostics")
def admin_diagnostics():
    return {"current": get_system_stats(), "history": list(METRICS_HISTORY)}


@app.get("/admin/rules")
def get_rules():
    return {"content": load_rules()}


@app.post("/admin/rules")
def save_rules(body: RulesRequest):
    content = body.content.strip()
    if content:
        RULES_PATH.write_text(content, encoding="utf-8")
    elif RULES_PATH.exists():
        RULES_PATH.unlink()
    return {"saved": True}


@app.get("/admin/sources")
def admin_sources():
    return {"sources": list_sources()}


@app.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...)):
    if not file.filename.endswith((".md", ".txt")):
        raise HTTPException(status_code=400, detail="Only .md and .txt files are supported.")
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text.")
    source_name = re.sub(r'[^\w\-]', '_', file.filename.rsplit(".", 1)[0])
    chunks = ingest_text(text, source_name)
    return {"source": source_name, "chunks": chunks}


@app.delete("/admin/sources/{source_name}")
def admin_delete_source(source_name: str):
    count = delete_source(source_name)
    return {"source": source_name, "deleted_chunks": count}


@app.post("/admin/create")
def admin_create(body: CreateDocRequest):
    chunks = ingest_text(body.content, body.source_name)
    return {"source": body.source_name, "chunks": chunks}


@app.post("/chat")
def chat(body: ChatMessage):
    active_style = get_active_style(body.message, body.history)

    rules = load_rules()
    rules_note = f"\n\nRules to always follow:\n{rules}" if rules else ""

    if active_style:
        system_base = (
            f"You are Milo, a helpful conversational assistant. "
            f"You MUST speak entirely in {active_style} style for every sentence. "
            f"Apply {active_style} vocabulary and mannerisms even when answering factual questions."
        ) + rules_note
    else:
        system_base = BASE_SYSTEM_PROMPT + rules_note

    if body.use_library:
        chunks = retrieve(body.message, n_results=3)
        if chunks:
            context = build_context(chunks)
            system_content = (
                system_base
                + "\n\nUse the context below to help answer questions. "
                "If the answer is not in the context, use your general knowledge.\n\n"
                f"Context:\n{context}"
            )
        else:
            system_content = system_base
    else:
        system_content = system_base

    messages = [{"role": "system", "content": system_content}]

    for h in body.history[-HISTORY_LIMIT:]:
        messages.append({"role": h.role, "content": h.text})

    messages.append({"role": "user", "content": body.message})

    result = ask_ollama(messages)
    answer = result["text"]
    metrics = result["metrics"]

    if answer == "CONNECTION_ERROR":
        return {"reply": "Ollama is not reachable. Open a terminal and run: ollama serve", "metrics": None}
    if answer == "TIMEOUT_ERROR":
        return {"reply": "Milo is still thinking — the model took too long. Try again in a moment.", "metrics": None}

    return {"reply": answer, "metrics": metrics}
