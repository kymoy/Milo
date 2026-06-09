# Changelog

## Unreleased

### Added
- **Conversation history (working)**: Milo can now remember what was said earlier in a chat. You can refer back to previous messages, ask follow-up questions, and give instructions like "say that like a pirate" that stick for the rest of the conversation.
- **Style memory**: The backend detects speaking style instructions (e.g. "talk like a pirate") from the current message or earlier in the conversation and injects them into the system prompt on every request, so the model doesn't forget them.
- **Base model knowledge**: Ollama model general knowledge is now available as a fallback when no relevant library content is found via RAG, allowing Milo to answer general questions (e.g. "how many states are in the US") without requiring uploaded documents.
- **Upgraded model**: Switched from `llama3.2:3b` to `llama3.1:8b` for better instruction following and reasoning.

### Bug fixes
- **History was never actually being sent**: Even though the backend was built to accept conversation history, every request was arriving with an empty history. The root cause was that each theme (Lavender, Crystals, Stiff, Stōkt, Firstframe) has its own `Chat.jsx` component, and all of them called a shared `utils/chat.js` utility that never included history in the request body. The fix was to update `utils/chat.js` to accept a `history` parameter, and update every theme's `send()` function to build the history from its local message state and pass it through. The earlier changes to `pages/Chat.jsx` were going to the wrong file entirely — the themes don't use that component.
