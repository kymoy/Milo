# Changelog

## Unreleased

### Added
- **Conversation history**: Chat now passes full conversation context to the model. Milo can follow multi-turn instructions (e.g. "say it like a pirate" persists across subsequent messages in the same session). Backend switched from `/api/generate` to Ollama's `/api/chat` endpoint for native multi-turn support. History is capped at 20 messages per request and validated server-side.
- **Base model knowledge**: Ollama model general knowledge is now available as a fallback when no relevant library content is found via RAG, allowing Milo to answer general questions (e.g. "how many states are in the US") without requiring uploaded documents.
