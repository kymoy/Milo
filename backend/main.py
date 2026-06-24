import os
import re
import json
import uuid
import subprocess
import time
import threading
import zipfile
import random as _random
from datetime import datetime, timezone
from pathlib import Path
from collections import deque
import psutil
import requests
try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
    _BOTO3_AVAILABLE = True
except ImportError:
    _BOTO3_AVAILABLE = False

try:
    import io
    from pypdf import PdfReader
    _PYPDF_AVAILABLE = True
except ImportError:
    _PYPDF_AVAILABLE = False

try:
    from fpdf import FPDF as _FPDF
    _FPDF_AVAILABLE = True
except ImportError:
    _FPDF_AVAILABLE = False

try:
    import anthropic as _anthropic_sdk
    _ANTHROPIC_AVAILABLE = True
except Exception:
    _ANTHROPIC_AVAILABLE = False
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Literal
from rag.retrieve import retrieve, build_context
from rag.ingest import ingest_text, list_sources, delete_source, get_source_chunks, _get_collection as _get_child_coll

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

BEDROCK_MODELS = [
    {"id": "meta.llama3-8b-instruct-v1:0",    "label": "Llama 3 8B (Bedrock)"},
    {"id": "meta.llama3-70b-instruct-v1:0",   "label": "Llama 3 70B (Bedrock)"},
    {"id": "mistral.mistral-7b-instruct-v0:2","label": "Mistral 7B (Bedrock)"},
    {"id": "anthropic.claude-3-haiku-20240307-v1:0",  "label": "Claude 3 Haiku (Bedrock)"},
    {"id": "anthropic.claude-3-sonnet-20240229-v1:0", "label": "Claude 3 Sonnet (Bedrock)"},
    {"id": "amazon.titan-text-express-v1",    "label": "Titan Text Express (Bedrock)"},
]

CLAUDE_MODELS = [
    {"id": "claude-opus-4-8",           "label": "Claude Opus 4.8"},
    {"id": "claude-sonnet-4-6",         "label": "Claude Sonnet 4.6"},
    {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5"},
]

CLAUDE_PRICING = {
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-opus-4-8":   {"input": 5.00, "output": 25.00},
}

def _get_claude_pricing(model_id: str) -> dict:
    for prefix, pricing in CLAUDE_PRICING.items():
        if model_id.startswith(prefix):
            return pricing
    return {"input": 3.00, "output": 15.00}

BASE_SYSTEM_PROMPT = "You are Milo, a helpful conversational assistant."

CHATS_DIR        = Path(__file__).parent / "chats"
CHATS_DIR.mkdir(exist_ok=True)
RULES_PATH       = Path(__file__).parent / "milo_rules.md"
MODEL_PATH       = Path(__file__).parent / "milo_model.txt"
PROVIDER_PATH    = Path(__file__).parent / "milo_provider.txt"
METRICS_PATH     = Path(__file__).parent / "milo_metrics.json"
BENCHMARK_PATH   = Path(__file__).parent / "milo_benchmarks.json"
RAM_SNAPSHOTS_PATH   = Path(__file__).parent / "milo_ram_snapshots.json"
CLAUDE_MODEL_PATH        = Path(__file__).parent / "milo_claude_model.txt"
PDF_BENCHMARK_PATH       = Path(__file__).parent / "milo_pdf_benchmark.json"
PDF_BENCHMARK_REAL_PATH  = Path(__file__).parent / "milo_pdf_benchmark_real.json"

TEST_PDFS_DIR       = Path(__file__).parent.parent / "Test PDFs"
REAL_PDFS_DIR       = Path(__file__).parent.parent / "Test PDFs" / "real"
PDF_BENCHMARK_SIZES = [5, 10, 50, 100, 500, 1000, 2000, 5000]

def _load_pdf_benchmark() -> dict:
    if PDF_BENCHMARK_PATH.exists():
        try:
            saved = json.loads(PDF_BENCHMARK_PATH.read_text(encoding="utf-8"))
            if saved.get("status") not in ("done", "cancelled"):
                saved["status"] = "done"
            saved["current_test"] = None
            saved.setdefault("total", len(PDF_BENCHMARK_SIZES))
            return saved
        except Exception:
            pass
    return {"status": "idle", "progress": 0, "total": len(PDF_BENCHMARK_SIZES), "current_test": None, "results": []}

_pdf_benchmark: dict = _load_pdf_benchmark()
_pdf_bench_cancel = threading.Event()

def _load_pdf_benchmark_real() -> dict:
    if PDF_BENCHMARK_REAL_PATH.exists():
        try:
            saved = json.loads(PDF_BENCHMARK_REAL_PATH.read_text(encoding="utf-8"))
            by_file = saved.get("results_by_file", {})
            return {
                "status": "done" if by_file else "idle",
                "current_test": None,
                "results_by_file": by_file,
                "results": list(by_file.values()),
            }
        except Exception:
            pass
    return {"status": "idle", "current_test": None, "results_by_file": {}, "results": []}

_pdf_benchmark_real: dict = _load_pdf_benchmark_real()

REALITY_QUERIES = [
    "What is the main topic discussed in this document?",
    "What are the key findings or conclusions in this text?",
    "What important information is covered in this document?",
]

PDF_BENCHMARK_CVE_PATH = Path(__file__).parent / "milo_pdf_benchmark_cve.json"
CHARS_PER_PAGE = 4000  # ~80 chars/line × 50 lines on A4 at 9pt
CVE_TIERS = [
    {"name": "cve_005pg", "cve_count": 30},
    {"name": "cve_010pg", "cve_count": 60},
    {"name": "cve_050pg", "cve_count": 300},
    {"name": "cve_100pg", "cve_count": 600},
    {"name": "cve_250pg", "cve_count": 1500},
    {"name": "cve_500pg", "cve_count": 3000},
]

def _load_cve_benchmark() -> dict:
    if PDF_BENCHMARK_CVE_PATH.exists():
        try:
            saved = json.loads(PDF_BENCHMARK_CVE_PATH.read_text(encoding="utf-8"))
            if saved.get("status") not in ("done", "cancelled"):
                saved["status"] = "done"
            saved["current_test"] = None
            saved.setdefault("total", len(CVE_TIERS))
            return saved
        except Exception:
            pass
    return {"status": "idle", "progress": 0, "total": len(CVE_TIERS), "current_test": None, "results": []}

_cve_benchmark: dict = _load_cve_benchmark()
_cve_bench_cancel = threading.Event()

BENCHMARK_SPEED_PROMPT = "Count from 1 to 30, putting each number on its own line. Do not add any other text."
BENCHMARK_ACCURACY_PROMPTS = [
    # Factual recall
    {"q": "What year did World War II end? Reply with only the year.", "key": "1945"},
    {"q": "What is the capital of France? Reply with only the city name.", "key": "Paris"},
    {"q": "What gas do plants primarily absorb during photosynthesis? Reply with only the gas name.", "key": "carbon dioxide"},
    # Arithmetic
    {"q": "What is 7 multiplied by 8? Reply with only the number.", "key": "56"},
    {"q": "What is 15% of 80? Reply with only the number.", "key": "12"},
    {"q": "What is the square root of 169? Reply with only the number.", "key": "13"},
    # Word problems
    {"q": "A train travels at 60 mph for 2.5 hours. How many miles does it cover? Reply with only the number.", "key": "150"},
    {"q": "A farmer has 17 sheep. All but 9 die. How many sheep are left? Reply with only the number.", "key": "9"},
    {"q": "If it takes 5 machines 5 minutes to make 5 widgets, how long does it take 100 machines to make 100 widgets? Reply with only the number of minutes.", "key": "5"},
    # Reasoning traps
    {"q": "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost in dollars? Reply with only the decimal number.", "key": "0.05"},
    {"q": "What comes next in the sequence 2, 4, 8, 16? Reply with only the number.", "key": "32"},
    # Logic
    {"q": "All mammals are warm-blooded. Dolphins are mammals. Are dolphins warm-blooded? Reply with only yes or no.", "key": "yes"},
    {"q": "If today is Wednesday and I have a meeting in 3 days, what day is the meeting? Reply with only the day name.", "key": "Saturday"},
]


def _load_metrics() -> list:
    if METRICS_PATH.exists():
        try:
            return json.loads(METRICS_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save_metrics() -> None:
    try:
        METRICS_PATH.write_text(
            json.dumps(list(METRICS_HISTORY), ensure_ascii=False),
            encoding="utf-8",
        )
    except Exception:
        pass


METRICS_HISTORY: deque = deque(_load_metrics(), maxlen=500)

_ram_snapshots: dict = (
    json.loads(RAM_SNAPSHOTS_PATH.read_text(encoding="utf-8"))
    if RAM_SNAPSHOTS_PATH.exists() else {}
)

def _capture_ram_snapshot(model: str) -> None:
    mem = psutil.virtual_memory()
    total_mb = round(mem.total / 1e6)
    _ram_snapshots[model] = {
        "ram_total_mb": total_mb,
        "process_breakdown": _get_process_breakdown(total_mb),
    }
    try:
        RAM_SNAPSHOTS_PATH.write_text(json.dumps(_ram_snapshots, indent=2), encoding="utf-8")
    except Exception:
        pass


def _get_process_breakdown(total_mb: float) -> list[dict]:
    procs: dict[str, float] = {}
    for p in psutil.process_iter(['name', 'memory_info']):
        try:
            mb = p.info['memory_info'].rss / 1e6
            if mb < 10:
                continue
            name = (p.info['name'] or 'unknown').lower().replace('.exe', '')
            procs[name] = procs.get(name, 0) + mb
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    # Keep top 7 by memory, bucket the rest into "other"
    sorted_procs = sorted(procs.items(), key=lambda x: x[1], reverse=True)
    top = sorted_procs[:7]
    other_mb = sum(v for _, v in sorted_procs[7:])
    accounted = sum(v for _, v in top) + other_mb
    free_mb = max(total_mb - accounted, 0)

    result = [{"name": name, "mb": round(mb, 1)} for name, mb in top]
    if other_mb > 1:
        result.append({"name": "other processes", "mb": round(other_mb, 1)})
    result.append({"name": "free", "mb": round(free_mb, 1)})
    return result


def _load_benchmarks() -> dict:
    if BENCHMARK_PATH.exists():
        try:
            return json.loads(BENCHMARK_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_benchmarks(data: dict) -> None:
    try:
        BENCHMARK_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception:
        pass

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


_active_claude_model: str = (
    CLAUDE_MODEL_PATH.read_text(encoding="utf-8").strip()
    if CLAUDE_MODEL_PATH.exists() and CLAUDE_MODEL_PATH.read_text(encoding="utf-8").strip()
    else "claude-sonnet-4-6"
)


def get_active_claude_model() -> str:
    return _active_claude_model


def set_active_claude_model(name: str) -> None:
    global _active_claude_model
    _active_claude_model = name
    CLAUDE_MODEL_PATH.write_text(name, encoding="utf-8")


_active_provider: str = (
    PROVIDER_PATH.read_text(encoding="utf-8").strip()
    if PROVIDER_PATH.exists() and PROVIDER_PATH.read_text(encoding="utf-8").strip() in ("ollama", "bedrock", "claude")
    else "ollama"
)


def get_active_provider() -> str:
    return _active_provider


def set_active_provider(name: str) -> None:
    global _active_provider
    _active_provider = name
    PROVIDER_PATH.write_text(name, encoding="utf-8")


def load_rules() -> str:
    if RULES_PATH.exists():
        return RULES_PATH.read_text(encoding="utf-8").strip()
    return ""


LOCAL_KEY_PATH = Path.home() / ".milo_claude_key"

def get_claude_api_key() -> str:
    if LOCAL_KEY_PATH.exists():
        return LOCAL_KEY_PATH.read_text(encoding="utf-8").strip()
    return os.environ.get("ANTHROPIC_API_KEY", "")


def set_claude_api_key(key: str) -> None:
    LOCAL_KEY_PATH.write_text(key.strip(), encoding="utf-8")

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
    """Return the currently active style from the current message, then history newest-first.
    A sentinel role='system' message with text='__reset_style__' marks a session boundary — stop scanning there."""
    changed, style = _detect_style(message)
    if changed:
        return style
    for h in reversed(history):
        if h.role == "system" and h.text == "__reset_style__":
            break
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
    role: Literal["user", "assistant", "system"]
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


class EstimateRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []

    @field_validator("message")
    @classmethod
    def validate_message(cls, v):
        v = v.strip()
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
            "model": get_active_model(),
            "response_ms": elapsed_ms,
            "cpu_percent": cpu,
            "tokens_per_sec": tokens_per_sec,
            **sys_stats,
        }
        METRICS_HISTORY.append(metrics)
        _save_metrics()
        _capture_ram_snapshot(get_active_model())

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


def ask_bedrock(messages: list[dict]) -> dict:
    if not _BOTO3_AVAILABLE:
        return {"text": "BEDROCK_ERROR:boto3 not installed — run: pip install boto3", "metrics": None}
    psutil.cpu_percent(interval=None)
    start = time.time()
    try:
        client = boto3.client("bedrock-runtime")
        system_msgs = [m for m in messages if m["role"] == "system"]
        convo_msgs  = [m for m in messages if m["role"] != "system"]
        kwargs: dict = {
            "modelId": get_active_model(),
            "messages": [
                {"role": m["role"], "content": [{"text": m["content"]}]}
                for m in convo_msgs
            ],
        }
        if system_msgs:
            kwargs["system"] = [{"text": system_msgs[0]["content"]}]

        resp = client.converse(**kwargs)
        elapsed_ms = round((time.time() - start) * 1000)
        cpu = round(psutil.cpu_percent(interval=None), 1)
        text = resp["output"]["message"]["content"][0]["text"].strip()
        usage = resp.get("usage", {})
        input_tokens = usage.get("inputTokens", None)
        output_tokens = usage.get("outputTokens", None)
        sys_stats = get_system_stats()
        metrics = {
            "ts": time.time(),
            "model": get_active_model(),
            "response_ms": elapsed_ms,
            "cpu_percent": cpu,
            "tokens_per_sec": None,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": None,
            **sys_stats,
        }
        METRICS_HISTORY.append(metrics)
        _save_metrics()
        _capture_ram_snapshot(get_active_model())
        return {"text": text, "metrics": metrics}
    except (BotoCoreError, ClientError) as e:
        return {"text": f"BEDROCK_ERROR:{e}", "metrics": None}
    except Exception as e:
        return {"text": f"BEDROCK_ERROR:{e}", "metrics": None}


def ask_claude(messages: list[dict]) -> dict:
    if not _ANTHROPIC_AVAILABLE:
        return {"text": "CLAUDE_ERROR:anthropic package not installed — run: pip install anthropic", "metrics": None}
    api_key = get_claude_api_key()
    if not api_key:
        return {"text": "CLAUDE_ERROR:No API key configured. Go to Admin > Models to add your key.", "metrics": None}
    psutil.cpu_percent(interval=None)
    start = time.time()
    try:
        client = _anthropic_sdk.Anthropic(api_key=api_key)
        system_msgs = [m for m in messages if m["role"] == "system"]
        convo_msgs  = [m for m in messages if m["role"] != "system"]
        claude_model = get_active_claude_model()
        kwargs: dict = {
            "model": claude_model,
            "max_tokens": 4096,
            "messages": [{"role": m["role"], "content": m["content"]} for m in convo_msgs],
        }
        if system_msgs:
            kwargs["system"] = [
                {"type": "text", "text": system_msgs[0]["content"], "cache_control": {"type": "ephemeral"}}
            ]
        resp = client.messages.create(**kwargs)
        elapsed_ms = round((time.time() - start) * 1000)
        cpu = round(psutil.cpu_percent(interval=None), 1)
        text = resp.content[0].text.strip()
        input_tokens = resp.usage.input_tokens if resp.usage else 0
        output_tokens = resp.usage.output_tokens if resp.usage else 0
        tokens_per_sec = round(output_tokens / (elapsed_ms / 1000), 1) if elapsed_ms > 0 and output_tokens > 0 else None
        pricing = _get_claude_pricing(claude_model)
        cost = round((input_tokens / 1_000_000) * pricing["input"] + (output_tokens / 1_000_000) * pricing["output"], 6)
        sys_stats = get_system_stats()
        metrics = {
            "ts": time.time(),
            "model": claude_model,
            "response_ms": elapsed_ms,
            "cpu_percent": cpu,
            "tokens_per_sec": tokens_per_sec,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": cost,
            **sys_stats,
        }
        METRICS_HISTORY.append(metrics)
        _save_metrics()
        _capture_ram_snapshot(claude_model)
        return {"text": text, "metrics": metrics}
    except _anthropic_sdk.AuthenticationError:
        return {"text": "CLAUDE_ERROR:Invalid API key. Check your key in Admin > Models.", "metrics": None}
    except _anthropic_sdk.RateLimitError:
        return {"text": "CLAUDE_ERROR:Rate limit reached. Try again in a moment.", "metrics": None}
    except Exception as e:
        return {"text": f"CLAUDE_ERROR:{e}", "metrics": None}


def ask_llm(messages: list[dict]) -> dict:
    if get_active_provider() == "bedrock":
        return ask_bedrock(messages)
    if get_active_provider() == "claude":
        return ask_claude(messages)
    return ask_ollama(messages)


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
        raw = res.json().get("models", [])
        detailed = [
            {
                "name": m["name"],
                "size_gb": round(m.get("size", 0) / 1e9, 1),
                "params": m.get("details", {}).get("parameter_size", "?"),
                "quantization": m.get("details", {}).get("quantization_level", "?"),
                "modified": m.get("modified_at", "")[:10],
            }
            for m in raw
        ]
    except Exception:
        detailed = []
    return {
        "models": [m["name"] for m in detailed],
        "models_detailed": detailed,
        "active": get_active_model(),
    }


@app.post("/admin/model")
def admin_set_model(body: dict):
    name = body.get("model", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Model name required.")
    set_active_model(name)
    return {"active": name}


@app.get("/admin/live-status")
def admin_live_status():
    """Returns the actual in-memory provider and model — reflects what the next chat will use."""
    return {
        "provider": get_active_provider(),
        "model": get_active_model() if get_active_provider() == "ollama" else None,
        "claude_model": get_active_claude_model() if get_active_provider() == "claude" else None,
    }


@app.get("/admin/provider")
def admin_get_provider():
    key = get_claude_api_key()
    masked = (key[:8] + "..." + key[-4:]) if len(key) > 12 else ("***" if key else None)
    return {
        "provider": get_active_provider(),
        "bedrock_available": _BOTO3_AVAILABLE,
        "bedrock_models": BEDROCK_MODELS,
        "claude_available": _ANTHROPIC_AVAILABLE,
        "claude_key_set": bool(key),
        "claude_key_masked": masked,
        "claude_models": CLAUDE_MODELS,
        "active_claude_model": get_active_claude_model(),
    }


@app.post("/admin/claude-model")
def admin_set_claude_model(body: dict):
    name = body.get("model", "").strip()
    valid_ids = [m["id"] for m in CLAUDE_MODELS]
    if not name or name not in valid_ids:
        raise HTTPException(status_code=400, detail=f"Invalid Claude model. Must be one of: {', '.join(valid_ids)}")
    set_active_claude_model(name)
    return {"active_claude_model": name}


@app.post("/admin/provider")
def admin_set_provider(body: dict):
    provider = body.get("provider", "").strip()
    if provider not in ("ollama", "bedrock", "claude"):
        raise HTTPException(status_code=400, detail="provider must be 'ollama', 'bedrock', or 'claude'.")
    if provider == "bedrock" and not _BOTO3_AVAILABLE:
        raise HTTPException(status_code=400, detail="boto3 is not installed. Run: pip install boto3")
    if provider == "claude" and not _ANTHROPIC_AVAILABLE:
        raise HTTPException(status_code=400, detail="anthropic package not installed. Run: pip install anthropic")
    if provider == "claude" and not get_claude_api_key():
        raise HTTPException(status_code=400, detail="No API key set. Add your Claude API key first.")
    set_active_provider(provider)
    return {"provider": provider}


@app.get("/admin/claude-key")
def admin_get_claude_key():
    key = get_claude_api_key()
    if key:
        masked = (key[:8] + "..." + key[-4:]) if len(key) > 12 else "***"
        return {"key_set": True, "masked": masked}
    return {"key_set": False, "masked": None}


@app.post("/admin/claude-key")
def admin_set_claude_key(body: dict):
    key = body.get("key", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")
    if len(key) > 300:
        raise HTTPException(status_code=400, detail="API key too long.")
    if not re.match(r'^sk-ant-[A-Za-z0-9\-_]+$', key):
        raise HTTPException(status_code=400, detail="Doesn't look like a valid Anthropic API key (should start with sk-ant-).")
    set_claude_api_key(key)
    return {"saved": True}


@app.get("/admin/diagnostics")
def admin_diagnostics():
    stats = get_system_stats()
    total_mb = round(stats.get("ram_total_gb", 0) * 1000)
    breakdown = _get_process_breakdown(total_mb) if total_mb > 0 else []
    return {"current": {**stats, "process_breakdown": breakdown}, "history": list(METRICS_HISTORY)}


@app.get("/admin/ram-breakdown")
def admin_ram_breakdown():
    mem = psutil.virtual_memory()
    total_mb = round(mem.total / 1e6)
    return {"ram_total_mb": total_mb, "process_breakdown": _get_process_breakdown(total_mb)}


@app.get("/admin/ram-snapshots")
def admin_ram_snapshots():
    return _ram_snapshots


@app.get("/admin/benchmarks")
def get_benchmarks():
    return _load_benchmarks()


@app.post("/admin/benchmark")
def run_benchmark(body: dict):
    model = body.get("model", "").strip()
    if not model or not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9.:_\-]{0,99}$', model):
        raise HTTPException(status_code=400, detail="Invalid model name.")

    try:
        tags_res = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        tags_res.raise_for_status()
        installed = [m["name"] for m in tags_res.json().get("models", [])]
    except Exception:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama.")

    if model not in installed:
        raise HTTPException(status_code=404, detail=f"Model '{model}' is not installed.")

    def _chat(prompt: str) -> dict | None:
        try:
            r = requests.post(
                OLLAMA_CHAT_URL,
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "keep_alive": "10m",
                    "options": {"num_ctx": 4096},
                },
                timeout=300,
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

    # Speed + resource test
    psutil.cpu_percent(interval=None)
    _mem_before    = psutil.virtual_memory()
    ram_before     = _mem_before.used / 1e6

    start = time.time()
    speed_data = _chat(BENCHMARK_SPEED_PROMPT)
    elapsed_ms = round((time.time() - start) * 1000)

    if speed_data is None:
        raise HTTPException(status_code=500, detail="Benchmark request to Ollama failed.")

    cpu_pct        = round(psutil.cpu_percent(interval=None), 1)
    _mem_after     = psutil.virtual_memory()
    ram_after      = _mem_after.used / 1e6
    ram_delta_mb   = round(max(ram_after - ram_before, 0))
    ram_percent    = round(_mem_after.percent, 1)
    ram_before_mb  = round(ram_before)
    ram_after_mb   = round(ram_after)
    ram_total_mb   = round(_mem_after.total / 1e6)
    process_breakdown = _get_process_breakdown(ram_total_mb)

    eval_count = speed_data.get("eval_count", 0)
    eval_ns    = speed_data.get("eval_duration", 0)
    tokens_per_sec = round(eval_count / (eval_ns / 1e9), 1) if eval_ns > 0 else None

    # Accuracy tests
    correct = 0
    for test in BENCHMARK_ACCURACY_PROMPTS:
        data = _chat(test["q"])
        if data:
            answer = data.get("message", {}).get("content", "")
            if test["key"].lower() in answer.lower():
                correct += 1

    result = {
        "model": model,
        "ts": time.time(),
        "response_ms": elapsed_ms,
        "tokens_per_sec": tokens_per_sec,
        "cpu_percent": cpu_pct,
        "ram_delta_mb": ram_delta_mb,
        "ram_percent": ram_percent,
        "ram_before_mb": ram_before_mb,
        "ram_after_mb": ram_after_mb,
        "ram_total_mb": ram_total_mb,
        "process_breakdown": process_breakdown,
        "accuracy": correct,
        "accuracy_total": len(BENCHMARK_ACCURACY_PROMPTS),
    }

    data = _load_benchmarks()
    data[model] = result
    _save_benchmarks(data)
    return result


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
    if not file.filename.endswith((".md", ".txt", ".pdf")):
        raise HTTPException(status_code=400, detail="Only .md, .txt, and .pdf files are supported.")
    content = await file.read()
    if file.filename.endswith(".pdf"):
        if not _PYPDF_AVAILABLE:
            raise HTTPException(status_code=500, detail="PDF support requires pypdf. Run: pip install pypdf")
        try:
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")
    else:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text.")
    source_name = re.sub(r'[^\w\-]', '_', file.filename.rsplit(".", 1)[0])
    chunks = ingest_text(text, source_name)
    return {"source": source_name, "chunks": chunks}


@app.get("/admin/sources/{source_name}/content")
def admin_source_content(source_name: str):
    chunks = get_source_chunks(source_name)
    return {"source": source_name, "chunks": chunks}


@app.delete("/admin/sources/{source_name}")
def admin_delete_source(source_name: str):
    count = delete_source(source_name)
    return {"source": source_name, "deleted_chunks": count}


@app.post("/admin/create")
def admin_create(body: CreateDocRequest):
    chunks = ingest_text(body.content, body.source_name)
    return {"source": body.source_name, "chunks": chunks}


def _generate_test_pdf(pages: int, facts: dict) -> Path:
    """Generate a synthetic test PDF with planted verification facts. Returns path."""
    FILLER = (
        "Chapter {n} outlines the operational scope for the corresponding processing segment. "
        "Service components assigned to section {n} handle request routing and load distribution. "
        "The configuration schema for chapter {n} defines threshold values for alerting and retry logic. "
        "Audit records associated with segment {n} are retained for a minimum of ninety days. "
        "During the {n}th operational cycle, validation checks confirmed system integrity across all nodes. "
        "Telemetry data captured in section {n} feeds into the central monitoring aggregator. "
        "The review cadence for chapter {n} aligns with the quarterly compliance schedule. "
    )
    TEST_PDFS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = TEST_PDFS_DIR / f"milo_test_{pages}pages.pdf"
    pdf = _FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    for page_n in range(1, pages + 1):
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 13)
        pdf.multi_cell(0, 8, f"Chapter {page_n}: System Overview")
        pdf.set_font("Helvetica", "", 10)
        pdf.ln(3)
        pdf.multi_cell(0, 6, FILLER.format(n=page_n))
        pdf.ln(2)
        pdf.multi_cell(0, 6, FILLER.format(n=page_n))
        if page_n in facts:
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 10)
            pdf.multi_cell(0, 7, f"MILO VERIFICATION: The secret phrase for section {page_n} is {facts[page_n]}.")
            pdf.set_font("Helvetica", "", 10)
    pdf.output(str(out_path))
    return out_path


def _run_pdf_benchmark() -> None:
    global _pdf_benchmark
    _pdf_bench_cancel.clear()
    FACT_PAGES = {
        5:    [2, 4],
        10:   [3, 8],
        50:   [10, 25, 40],
        100:  [10, 50, 90],
        500:  [50, 250, 450],
        1000: [100, 500, 900],
        2000: [200, 1000, 1800],
        5000: [500, 2500, 4500],
    }
    for i, pages in enumerate(PDF_BENCHMARK_SIZES):
        if _pdf_bench_cancel.is_set():
            break
        source_name = f"__milo_bench_{pages}"
        result: dict = {"pages": pages}
        try:
            fact_tokens = {p: uuid.uuid4().hex[:8].upper() for p in FACT_PAGES[pages]}
            _pdf_benchmark["current_test"] = f"Generating {pages}-page PDF…"
            pdf_path = _generate_test_pdf(pages, fact_tokens)
            result["file_size_kb"] = round(pdf_path.stat().st_size / 1024, 1)

            _pdf_benchmark["current_test"] = f"Ingesting {pages}-page PDF…"
            with open(pdf_path, "rb") as fh:
                reader = PdfReader(fh)
                raw_text = "\n".join(pg.extract_text() or "" for pg in reader.pages)
            # Ensure planted fact sentences are isolated paragraphs so they form
            # their own child chunks instead of being diluted by filler text.
            raw_text = re.sub(r'(?<!\n)MILO VERIFICATION', '\n\nMILO VERIFICATION', raw_text)
            t0 = time.perf_counter()
            chunk_count = ingest_text(raw_text, source_name)
            result["ingestion_time_s"] = round(time.perf_counter() - t0, 2)
            result["chunk_count"] = chunk_count

            _pdf_benchmark["current_test"] = f"Querying {pages}-page PDF…"
            latencies: list[float] = []
            facts_found = 0
            ctx_chars = 0
            child_coll = _get_child_coll()
            for page_n, token in fact_tokens.items():
                t1 = time.perf_counter()
                qr = child_coll.query(
                    query_texts=[f"What is the secret phrase for section {page_n}?"],
                    n_results=5,
                    where={"source": source_name},
                    include=["documents"],
                )
                latencies.append((time.perf_counter() - t1) * 1000)
                block = " ".join(qr["documents"][0])
                ctx_chars += len(block)
                if token in block:
                    facts_found += 1

            result["avg_query_latency_ms"] = round(sum(latencies) / len(latencies), 1) if latencies else 0
            result["accuracy_pct"] = round(facts_found / len(fact_tokens) * 100, 1)
            result["facts_planted"] = len(fact_tokens)
            result["facts_found"] = facts_found
            result["context_chars_avg"] = round(ctx_chars / len(latencies)) if latencies else 0
        except Exception as exc:
            result["error"] = str(exc)
        finally:
            try:
                delete_source(source_name)
            except Exception:
                pass
        _pdf_benchmark["results"].append(result)
        _pdf_benchmark["progress"] = i + 1

    _pdf_benchmark["status"] = "cancelled" if _pdf_bench_cancel.is_set() else "done"
    _pdf_benchmark["current_test"] = None
    try:
        PDF_BENCHMARK_PATH.write_text(json.dumps(_pdf_benchmark, indent=2), encoding="utf-8")
    except Exception:
        pass


@app.post("/admin/benchmark/pdf/run")
def start_pdf_benchmark(background_tasks: BackgroundTasks):
    if not _FPDF_AVAILABLE:
        raise HTTPException(status_code=500, detail="PDF generation requires fpdf2. Run: pip install fpdf2")
    if not _PYPDF_AVAILABLE:
        raise HTTPException(status_code=500, detail="PDF reading requires pypdf. Run: pip install pypdf")
    if _pdf_benchmark["status"] == "running":
        raise HTTPException(status_code=409, detail="Benchmark already running.")
    _pdf_benchmark.update(status="running", progress=0, results=[], current_test=None)
    background_tasks.add_task(_run_pdf_benchmark)
    return {"status": "started"}


@app.post("/admin/benchmark/pdf/cancel")
def cancel_pdf_benchmark():
    if _pdf_benchmark["status"] != "running":
        raise HTTPException(status_code=409, detail="No benchmark running.")
    _pdf_bench_cancel.set()
    _pdf_benchmark["current_test"] = "Cancelling after current test…"
    return {"status": "cancelling"}


@app.get("/admin/benchmark/pdf/status")
def get_pdf_benchmark_status():
    return _pdf_benchmark


def _run_pdf_benchmark_real_file(filename: str) -> None:
    global _pdf_benchmark_real
    pdf_path = REAL_PDFS_DIR / filename
    source_name = f"__milo_bench_real_{re.sub(r'[^\w]', '_', pdf_path.stem)}"
    result: dict = {"filename": filename}
    child_coll = _get_child_coll()
    try:
        _pdf_benchmark_real["current_test"] = f"Ingesting {filename}…"
        with open(pdf_path, "rb") as fh:
            reader = PdfReader(fh)
            page_count = len(reader.pages)
            raw_text = "\n".join(pg.extract_text() or "" for pg in reader.pages)
        result["pages"] = page_count
        result["file_size_kb"] = round(pdf_path.stat().st_size / 1024, 1)
        t0 = time.perf_counter()
        chunk_count = ingest_text(raw_text, source_name)
        result["ingestion_time_s"] = round(time.perf_counter() - t0, 2)
        result["chunk_count"] = chunk_count
        _pdf_benchmark_real["current_test"] = f"Querying {filename}…"
        latencies: list[float] = []
        for query in REALITY_QUERIES:
            t1 = time.perf_counter()
            child_coll.query(
                query_texts=[query],
                n_results=5,
                where={"source": source_name},
                include=["documents"],
            )
            latencies.append((time.perf_counter() - t1) * 1000)
        result["avg_query_latency_ms"] = round(sum(latencies) / len(latencies), 1) if latencies else 0
    except Exception as exc:
        result["error"] = str(exc)
    finally:
        try:
            delete_source(source_name)
        except Exception:
            pass
    _pdf_benchmark_real["results_by_file"][filename] = result
    _pdf_benchmark_real["results"] = list(_pdf_benchmark_real["results_by_file"].values())
    _pdf_benchmark_real["status"] = "done"
    _pdf_benchmark_real["current_test"] = None
    try:
        PDF_BENCHMARK_REAL_PATH.write_text(json.dumps({
            "results_by_file": _pdf_benchmark_real["results_by_file"],
        }, indent=2), encoding="utf-8")
    except Exception:
        pass


@app.get("/admin/benchmark/real/list")
def list_real_pdfs():
    REAL_PDFS_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for p in sorted(REAL_PDFS_DIR.glob("*.pdf")):
        try:
            with open(p, "rb") as fh:
                pages = len(PdfReader(fh).pages)
        except Exception:
            pages = None
        files.append({"filename": p.name, "pages": pages, "size_kb": round(p.stat().st_size / 1024, 1)})
    return {"files": files}


@app.post("/admin/benchmark/real/upload")
async def upload_real_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported.")
    if not _PYPDF_AVAILABLE:
        raise HTTPException(status_code=500, detail="PDF support requires pypdf.")
    REAL_PDFS_DIR.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    try:
        import io as _io
        reader = PdfReader(_io.BytesIO(content))
        page_count = len(reader.pages)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")
    safe_name = re.sub(r'[^\w\-.]', '_', file.filename)
    (REAL_PDFS_DIR / safe_name).write_bytes(content)
    return {"filename": safe_name, "pages": page_count, "size_kb": round(len(content) / 1024, 1)}


@app.delete("/admin/benchmark/real/files/{filename}")
def delete_real_pdf(filename: str):
    safe = re.sub(r'[^\w\-.]', '_', filename)
    path = REAL_PDFS_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    path.unlink()
    _pdf_benchmark_real["results_by_file"].pop(safe, None)
    _pdf_benchmark_real["results"] = list(_pdf_benchmark_real["results_by_file"].values())
    try:
        PDF_BENCHMARK_REAL_PATH.write_text(json.dumps({
            "results_by_file": _pdf_benchmark_real["results_by_file"],
        }, indent=2), encoding="utf-8")
    except Exception:
        pass
    return {"deleted": safe}


class RealRunRequest(BaseModel):
    filename: str


@app.post("/admin/benchmark/real/run")
def start_real_benchmark(req: RealRunRequest, background_tasks: BackgroundTasks):
    if not _PYPDF_AVAILABLE:
        raise HTTPException(status_code=500, detail="PDF reading requires pypdf.")
    if _pdf_benchmark_real["status"] == "running":
        raise HTTPException(status_code=409, detail="Benchmark already running.")
    safe = re.sub(r'[^\w\-.]', '_', req.filename)
    if not (REAL_PDFS_DIR / safe).exists():
        raise HTTPException(status_code=404, detail="File not found.")
    _pdf_benchmark_real["status"] = "running"
    _pdf_benchmark_real["current_test"] = None
    background_tasks.add_task(_run_pdf_benchmark_real_file, safe)
    return {"status": "started"}


@app.get("/admin/benchmark/real/status")
def get_real_benchmark_status():
    return _pdf_benchmark_real


# ── CVE benchmark ─────────────────────────────────────────────────────────────

def _cve_cvss(data):
    best = 0.0
    containers = data.get("containers", {})
    for src in [containers.get("cna", {})] + containers.get("adp", []):
        for m in src.get("metrics", []):
            for key in ("cvssV4_0", "cvssV3_1", "cvssV3_0", "cvssV2_0"):
                if key in m:
                    try: best = max(best, float(m[key].get("baseScore", 0)))
                    except: pass
    return best

def _cve_desc(data):
    try:
        for d in data["containers"]["cna"].get("descriptions", []):
            if d.get("lang", "").startswith("en"):
                return d.get("value", "").strip()
    except: pass
    return ""

def _cve_affected(data):
    try:
        parts = []
        for a in data["containers"]["cna"].get("affected", [])[:4]:
            vendor, product = a.get("vendor", ""), a.get("product", "")
            if vendor.lower() in ("n/a", "na", "unknown", ""):
                if product: parts.append(product)
            elif product:
                parts.append(f"{vendor} {product}")
        return "; ".join(parts[:4])
    except: return ""


def _run_cve_benchmark() -> None:
    """Scan the CVE zip directly, ingest each tier as plain text, test accuracy.
    Virtual page count = total content chars / CHARS_PER_PAGE (no PDF generation or parsing)."""
    global _cve_benchmark
    _cve_bench_cancel.clear()

    zips = sorted(REAL_PDFS_DIR.glob("cvelistV5*.zip"), key=lambda p: p.stat().st_size, reverse=True)
    if not zips:
        _cve_benchmark.update(status="error", current_test="No cvelistV5*.zip found in Test PDFs/real/.")
        return
    zip_path = zips[0]

    total_needed = sum(t["cve_count"] for t in CVE_TIERS)
    _cve_benchmark["current_test"] = f"Scanning {zip_path.name}…"

    entries = []
    try:
        with zipfile.ZipFile(zip_path) as zf:
            json_files = [n for n in zf.namelist() if n.endswith(".json") and "/cves/" in n]
            for name in json_files:
                if len(entries) >= total_needed * 2:
                    break
                if _cve_bench_cancel.is_set():
                    break
                try:
                    with zf.open(name) as fh:
                        data = json.load(fh)
                    if data.get("cveMetadata", {}).get("state") != "PUBLISHED":
                        continue
                    score = _cve_cvss(data)
                    if score < 7.0:
                        continue
                    desc = _cve_desc(data)
                    if not desc:
                        continue
                    entries.append({
                        "id":       data["cveMetadata"]["cveId"],
                        "score":    score,
                        "sev":      "CRITICAL" if score >= 9.0 else "HIGH",
                        "desc":     desc,
                        "affected": _cve_affected(data),
                    })
                except Exception:
                    pass
    except Exception as e:
        _cve_benchmark.update(status="error", current_test=f"Could not read zip: {e}")
        return

    if _cve_bench_cancel.is_set():
        _cve_benchmark.update(status="cancelled", current_test=None)
        return

    if len(entries) < total_needed:
        _cve_benchmark.update(status="error", current_test=f"Only {len(entries)} qualifying CVEs found; need {total_needed}.")
        return

    _random.seed(42)
    _random.shuffle(entries)

    _cve_benchmark["total"] = len(CVE_TIERS)
    child_coll = _get_child_coll()
    offset = 0

    for i, t in enumerate(CVE_TIERS):
        if _cve_bench_cancel.is_set():
            break
        tier_cves = entries[offset: offset + t["cve_count"]]
        offset += t["cve_count"]

        # Build plain-text corpus — same content that would have gone into a PDF
        text_blocks = []
        for e in tier_cves:
            lines = [f"{e['id']}  [{e['sev']}  {e['score']:.1f}]"]
            if e["affected"]:
                lines.append(f"Affects: {e['affected']}")
            lines.append(e["desc"])
            text_blocks.append("\n".join(lines))
        full_text     = "\n\n".join(text_blocks)
        virtual_pages = max(1, round(len(full_text) / CHARS_PER_PAGE))

        source_name = f"__milo_cve_{t['name']}"
        result: dict = {
            "pages":     virtual_pages,
            "tier":      t["name"],
            "cve_count": len(tier_cves),
        }
        try:
            _cve_benchmark["current_test"] = f"Ingesting {t['name']} ({virtual_pages} virtual pages, {len(tier_cves)} CVEs)…"
            t0 = time.perf_counter()
            chunk_count = ingest_text(full_text, source_name)
            result["ingestion_time_s"] = round(time.perf_counter() - t0, 2)
            result["chunk_count"]      = chunk_count
            result["file_size_kb"]     = round(len(full_text.encode()) / 1024, 1)

            _cve_benchmark["current_test"] = f"Querying {t['name']}…"
            latencies: list[float] = []
            facts_found = 0
            for e in tier_cves[:3]:
                t1 = time.perf_counter()
                qr = child_coll.query(
                    query_texts=[f"What is the CVSS score for {e['id']}?"],
                    n_results=5,
                    where={"source": source_name},
                    include=["documents"],
                )
                latencies.append((time.perf_counter() - t1) * 1000)
                if e["id"] in " ".join(qr["documents"][0]):
                    facts_found += 1

            result["avg_query_latency_ms"] = round(sum(latencies) / len(latencies), 1) if latencies else 0
            result["facts_planted"]        = min(3, len(tier_cves))
            result["facts_found"]          = facts_found
            result["accuracy_pct"]         = round(facts_found / result["facts_planted"] * 100, 1)
        except Exception as exc:
            result["error"] = str(exc)
        finally:
            try: delete_source(source_name)
            except: pass

        _cve_benchmark["results"].append(result)
        _cve_benchmark["progress"] = i + 1

    _cve_benchmark["status"] = "cancelled" if _cve_bench_cancel.is_set() else "done"
    _cve_benchmark["current_test"] = None
    try:
        PDF_BENCHMARK_CVE_PATH.write_text(json.dumps(_cve_benchmark, indent=2), encoding="utf-8")
    except: pass


@app.post("/admin/benchmark/cve/run")
def start_cve_benchmark(background_tasks: BackgroundTasks):
    if _cve_benchmark["status"] == "running":
        raise HTTPException(status_code=409, detail="CVE benchmark already running.")
    _cve_benchmark.update(status="running", progress=0, results=[], current_test=None)
    background_tasks.add_task(_run_cve_benchmark)
    return {"status": "started"}


@app.post("/admin/benchmark/cve/cancel")
def cancel_cve_benchmark():
    if _cve_benchmark["status"] != "running":
        raise HTTPException(status_code=409, detail="No CVE benchmark running.")
    _cve_bench_cancel.set()
    _cve_benchmark["current_test"] = "Cancelling after current tier…"
    return {"status": "cancelling"}


@app.get("/admin/benchmark/cve/status")
def get_cve_benchmark_status():
    return _cve_benchmark


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/chats")
def list_chats():
    sessions = []
    for f in sorted(CHATS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            sessions.append({
                "id": data["id"],
                "title": data.get("title", "Untitled"),
                "created_at": data.get("created_at", ""),
                "updated_at": data.get("updated_at", ""),
                "message_count": sum(1 for m in data.get("messages", []) if m["role"] == "user"),
            })
        except Exception:
            pass
    return {"sessions": sessions}


@app.get("/chats/{session_id}")
def get_chat(session_id: str):
    path = CHATS_DIR / f"{session_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found.")
    return json.loads(path.read_text(encoding="utf-8"))


@app.post("/chats")
def save_chat(body: dict):
    session_id = body.get("id") or str(uuid.uuid4())
    path = CHATS_DIR / f"{session_id}.json"
    messages = body.get("messages", [])

    title = "New chat"
    for m in messages:
        if m.get("role") == "user" and m.get("text"):
            title = m["text"][:60]
            break

    created_at = _now()
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
            created_at = existing.get("created_at", created_at)
        except Exception:
            pass

    data = {
        "id": session_id,
        "title": title,
        "created_at": created_at,
        "updated_at": _now(),
        "messages": messages,
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"id": session_id, "title": title}


@app.delete("/chats/{session_id}")
def delete_chat(session_id: str):
    path = CHATS_DIR / f"{session_id}.json"
    if path.exists():
        path.unlink()
    return {"deleted": session_id}


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
        try:
            chunks = retrieve(body.message, n_results=3)
        except Exception:
            chunks = []
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

    result = ask_llm(messages)
    answer = result["text"]
    metrics = result["metrics"]

    if answer == "CONNECTION_ERROR":
        return {"reply": "Ollama is not reachable. Open a terminal and run: ollama serve", "metrics": None}
    if answer == "TIMEOUT_ERROR":
        return {"reply": "Milo is still thinking — the model took too long. Try again in a moment.", "metrics": None}
    if isinstance(answer, str) and answer.startswith("BEDROCK_ERROR:"):
        detail = answer.split(":", 1)[1]
        return {"reply": f"AWS Bedrock error: {detail}", "metrics": None}
    if isinstance(answer, str) and answer.startswith("CLAUDE_ERROR:"):
        detail = answer.split(":", 1)[1]
        return {"reply": f"Claude API error: {detail}", "metrics": None}

    return {"reply": answer, "metrics": metrics}


@app.post("/chat/estimate")
def chat_estimate(body: EstimateRequest):
    provider = get_active_provider()
    if provider == "claude" and _ANTHROPIC_AVAILABLE:
        api_key = get_claude_api_key()
        if api_key:
            try:
                client = _anthropic_sdk.Anthropic(api_key=api_key)
                claude_model = get_active_claude_model()
                msgs = [{"role": h.role, "content": h.text} for h in body.history[-HISTORY_LIMIT:]]
                msgs.append({"role": "user", "content": body.message})
                count_resp = client.messages.count_tokens(
                    model=claude_model,
                    system=BASE_SYSTEM_PROMPT,
                    messages=msgs,
                )
                input_tokens = count_resp.input_tokens
                pricing = _get_claude_pricing(claude_model)
                estimated_cost = round((input_tokens / 1_000_000) * pricing["input"], 6)
                return {"input_tokens": input_tokens, "estimated_cost": estimated_cost, "provider": provider, "model": claude_model}
            except Exception:
                pass
    # Fallback: character-based approximation (no cost for Ollama/Bedrock)
    total_chars = len(body.message) + sum(len(h.text) for h in body.history)
    input_tokens = max(1, total_chars // 4)
    return {"input_tokens": input_tokens, "estimated_cost": None, "provider": provider, "model": get_active_model()}


@app.post("/chat/stream")
def chat_stream(body: ChatMessage):
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

    def generate():
        system_content = system_base

        if body.use_library:
            yield 'data: {"type":"status","message":"Searching your library..."}\n\n'
            try:
                chunks = retrieve(body.message, n_results=3)
            except Exception:
                chunks = []
            if chunks:
                count        = len(chunks)
                source_names = list(dict.fromkeys(c["source"] for c in chunks))
                src_display  = ", ".join(source_names[:2]) + ("…" if len(source_names) > 2 else "")
                chunk_s      = "s" if count != 1 else ""
                status_msg   = f"Found {count} chunk{chunk_s} · {src_display}"
                yield f'data: {json.dumps({"type": "status", "message": status_msg})}\n\n'
                yield f'data: {json.dumps({"type": "sources", "names": source_names})}\n\n'
                system_content = (
                    system_base
                    + "\n\nUse the context below to help answer questions. "
                    "If the answer is not in the context, use your general knowledge.\n\n"
                    f"Context:\n{build_context(chunks)}"
                )

        messages = [{"role": "system", "content": system_content}]
        for h in body.history[-HISTORY_LIMIT:]:
            messages.append({"role": h.role, "content": h.text})
        messages.append({"role": "user", "content": body.message})

        provider = get_active_provider()

        if provider == "ollama":
            psutil.cpu_percent(interval=None)
            start = time.time()
            try:
                resp = requests.post(
                    OLLAMA_CHAT_URL,
                    json={
                        "model": get_active_model(),
                        "messages": messages,
                        "stream": True,
                        "keep_alive": "10m",
                        "options": {"num_ctx": 4096},
                    },
                    stream=True,
                    timeout=180,
                )
                resp.raise_for_status()
                eval_count = 0
                eval_duration_ns = 0
                for line in resp.iter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    token = data.get("message", {}).get("content", "")
                    if token:
                        yield f'data: {json.dumps({"type": "token", "content": token})}\n\n'
                    if data.get("done"):
                        eval_count = data.get("eval_count", 0)
                        eval_duration_ns = data.get("eval_duration", 0)
                        break
                elapsed_ms = round((time.time() - start) * 1000)
                cpu = round(psutil.cpu_percent(interval=None), 1)
                tokens_per_sec = round(eval_count / (eval_duration_ns / 1e9), 1) if eval_duration_ns > 0 else None
                prompt_chars = sum(len(m["content"]) for m in messages)
                sys_stats = get_system_stats()
                metrics = {
                    "ts": time.time(),
                    "model": get_active_model(),
                    "response_ms": elapsed_ms,
                    "cpu_percent": cpu,
                    "tokens_per_sec": tokens_per_sec,
                    "input_tokens": max(1, prompt_chars // 4),
                    "output_tokens": eval_count,
                    "cost": None,
                    **sys_stats,
                }
                METRICS_HISTORY.append(metrics)
                _save_metrics()
                _capture_ram_snapshot(get_active_model())
                yield f'data: {json.dumps({"type": "done", "metrics": metrics})}\n\n'
            except requests.exceptions.ConnectionError:
                yield 'data: {"type":"error","message":"Ollama is not reachable. Open a terminal and run: ollama serve"}\n\n'
            except requests.exceptions.Timeout:
                yield 'data: {"type":"error","message":"Milo is still thinking — the model took too long."}\n\n'
            except Exception:
                yield 'data: {"type":"error","message":"Something went wrong."}\n\n'
        else:
            yield 'data: {"type":"status","message":"Composing response..."}\n\n'
            result = ask_llm(messages)
            answer = result["text"]
            metrics = result["metrics"]
            if answer == "CONNECTION_ERROR":
                yield 'data: {"type":"error","message":"Ollama is not reachable. Open a terminal and run: ollama serve"}\n\n'
            elif answer == "TIMEOUT_ERROR":
                yield 'data: {"type":"error","message":"Milo is still thinking — the model took too long."}\n\n'
            elif isinstance(answer, str) and (answer.startswith("BEDROCK_ERROR:") or answer.startswith("CLAUDE_ERROR:")):
                detail = answer.split(":", 1)[1]
                yield f'data: {json.dumps({"type": "error", "message": detail})}\n\n'
            else:
                yield f'data: {json.dumps({"type": "token", "content": answer})}\n\n'
                yield f'data: {json.dumps({"type": "done", "metrics": metrics})}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/admin/tests/run")
def run_admin_tests():
    import pytest
    test_path = Path(__file__).parent / "tests" / "test_knowledge_library.py"

    class ResultCollector:
        def __init__(self):
            self.results = []
            self.descriptions = {}

        def pytest_itemcollected(self, item):
            doc = (item.function.__doc__ or "").strip()
            self.descriptions[item.nodeid] = doc

        def pytest_runtest_logreport(self, report):
            if report.when == "call" or (report.when == "setup" and report.failed):
                nodeid = report.nodeid
                fn_name = nodeid.split("::")[-1]
                label = fn_name.replace("test_", "").replace("_", " ").title()
                self.results.append({
                    "id": fn_name,
                    "name": label,
                    "outcome": "passed" if report.passed else "failed",
                    "duration": round(getattr(report, "duration", 0), 3),
                    "description": self.descriptions.get(nodeid, ""),
                    "error": str(report.longrepr).strip() if report.longrepr else None,
                })

    collector = ResultCollector()
    pytest.main(
        [str(test_path), "--tb=short", "-q", "--no-header", "-p", "no:warnings"],
        plugins=[collector],
    )

    total = len(collector.results)
    passed = sum(1 for r in collector.results if r["outcome"] == "passed")
    return {
        "results": collector.results,
        "summary": {"total": total, "passed": passed, "failed": total - passed},
    }


@app.post("/warmup")
def warmup():
    if get_active_provider() == "ollama":
        try:
            requests.post(
                OLLAMA_CHAT_URL,
                json={"model": get_active_model(), "messages": [], "keep_alive": "10m"},
                timeout=10,
            )
        except Exception:
            pass
    return {"ok": True}
