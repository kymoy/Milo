# Milo Updates

## Unreleased

### Added
- **Conversation history (working)**: Milo can now remember what was said earlier in a chat. You can refer back to previous messages, ask follow-up questions, and give instructions like "say that like a pirate" that stick for the rest of the conversation.
- **Style memory**: The backend detects speaking style instructions (e.g. "talk like a pirate") from the current message or earlier in the conversation and injects them into the system prompt on every request, so the model doesn't forget them.
- **Base model knowledge**: Ollama model general knowledge is now available as a fallback when no relevant library content is found via RAG, allowing Milo to answer general questions (e.g. "how many states are in the US") without requiring uploaded documents.
- **Upgraded model**: Switched from `llama3.2:3b` to `llama3.1:8b` for better instruction following and reasoning.

### Bug fixes
- **History was never actually being sent**: Even though the backend was built to accept conversation history, every request was arriving with an empty history. The root cause was that each theme (Lavender, Crystals, Stiff, Stōkt, Firstframe) has its own `Chat.jsx` component, and all of them called a shared `utils/chat.js` utility that never included history in the request body. The fix was to update `utils/chat.js` to accept a `history` parameter, and update every theme's `send()` function to build the history from its local message state and pass it through. The earlier changes to `pages/Chat.jsx` were going to the wrong file entirely — the themes don't use that component.

---

## [2026-06-08] Performance metrics, shared hooks, admin panel, and navigation fixes

### Added
- **Performance metrics**: Every bot response now shows a small diagnostic line underneath it — response time, CPU usage, tokens per second, and GPU usage (if an NVIDIA card is present). Metrics come from the backend using `psutil` and Ollama's built-in timing fields.
- **Shared `useMiloChat` hook**: All theme Chat components now share one hook for chat logic (history, API call, metrics). Previously each theme had its own copy of the `send()` function — any future change to chat behaviour only needs to happen in one place.
- **Shared `useAdminPanel` hook**: Same pattern applied to admin logic (file upload, document creation, source listing).
- **Themed admin pages**: Each theme (Lavender, Crystals, Stiff, Stōkt) now has its own admin page that matches its look and feel, complete with dark/light mode, sidebar, and settings panel.
- **Admin backend endpoints**: Three new endpoints — `POST /admin/upload` (ingest an uploaded .md/.txt file), `POST /admin/create` (ingest markdown written directly in the UI), `GET /admin/sources` (list all sources currently in the knowledge library).
- **Theme switcher in Settings**: The settings panel now has a Theme section with a 2×2 grid — click any theme to switch to it without logging out.
- **Admin/chat toggle in Sidebar**: The "Admin panel" button in the sidebar now reads "← Back to chat" when you're already on the admin page, and navigates accordingly.
- **Settings panel in admin pages**: The settings gear icon in the sidebar now opens the full settings panel from admin pages too.

### Bug fixes
- **Admin login redirected to theme picker**: Logging in as admin sent users to `/{theme}/admin` which didn't exist, so the catch-all route redirected to `/`. Fixed by giving each theme a proper admin route and navigating there directly on login.
- **Logout sent users to wrong theme login**: `ProtectedRoute` hard-coded a redirect to `/login` (the default unstyled page) when auth cleared, racing against the themed navigate call. Fixed by passing a `loginPath` prop to `ProtectedRoute` so each theme's routes redirect to the correct login page.
