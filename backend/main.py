from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

app = FastAPI(title="Milo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "null"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

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

@app.post("/chat")
def chat(body: ChatMessage):
    # Placeholder — agents will be wired in here later
    return {"reply": f"[Milo] Got your message: '{body.message}' — agents coming soon."}
