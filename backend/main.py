import os
import re
import json
import uuid
import subprocess
import time
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
    import anthropic as _anthropic_sdk
    _ANTHROPIC_AVAILABLE = True
except Exception:
    _ANTHROPIC_AVAILABLE = False
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Literal
from rag.retrieve import retrieve, build_context
from rag.ingest import ingest_text, list_sources, delete_source, get_source_chunks

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

BASE_SYSTEM_PROMPT = "You are Milo, a helpful conversational assistant."

CHATS_DIR        = Path(__file__).parent / "chats"
CHATS_DIR.mkdir(exist_ok=True)
RULES_PATH       = Path(__file__).parent / "milo_rules.md"
MODEL_PATH       = Path(__file__).parent / "milo_model.txt"
PROVIDER_PATH    = Path(__file__).parent / "milo_provider.txt"
METRICS_PATH     = Path(__file__).parent / "milo_metrics.json"
BENCHMARK_PATH   = Path(__file__).parent / "milo_benchmarks.json"
RAM_SNAPSHOTS_PATH = Path(__file__).parent / "milo_ram_snapshots.json"

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

        sys_stats = get_system_stats()
        metrics = {
            "ts": time.time(),
            "model": get_active_model(),
            "response_ms": elapsed_ms,
            "cpu_percent": cpu,
            "tokens_per_sec": None,
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
        kwargs: dict = {
            "model": get_active_model(),
            "max_tokens": 4096,
            "messages": [{"role": m["role"], "content": m["content"]} for m in convo_msgs],
        }
        if system_msgs:
            kwargs["system"] = system_msgs[0]["content"]
        resp = client.messages.create(**kwargs)
        elapsed_ms = round((time.time() - start) * 1000)
        cpu = round(psutil.cpu_percent(interval=None), 1)
        text = resp.content[0].text.strip()
        output_tokens = resp.usage.output_tokens if resp.usage else 0
        tokens_per_sec = round(output_tokens / (elapsed_ms / 1000), 1) if elapsed_ms > 0 and output_tokens > 0 else None
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
    }


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
