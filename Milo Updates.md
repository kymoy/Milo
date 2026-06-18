# Milo Updates

## [2026-06-18] Token diagnostics, theme architecture refactor, collapsible sidebar

### Added
- **Backend test suite** (`backend/tests/test_knowledge_library.py`): 13 pytest tests covering the full knowledge library pipeline. Uses an isolated in-memory ChromaDB per test via `monkeypatch` — production data is never touched. Test groups: ingestion (chunk creation, parent-child linking, duplicate cleanup), retrieval (vector search, graceful empty-DB handling), source management (list, delete, full chunk cleanup from both collections), upload endpoint (`.md` accepted, `.txt` accepted, invalid extension rejected with 400, invalid UTF-8 rejected with 400), create endpoint (empty content rejected with 422, oversized content >500 KB rejected with 422), and rules injection (rules saved via `/admin/rules` appear in the system prompt on the next `/chat` call).
- **`TestsPanel.jsx`**: New "Automated Tests" section in the admin panel. Triggers the backend pytest suite via `POST /admin/tests/run`. Displays a summary bar (passed / failed / total / elapsed) and a per-test results table with pass/fail dot, test name, duration, and error snippet on failure. Hover any row to see a tooltip describing what that test is verifying.
- **`convert_updates_to_pdf.py`**: Utility script that renders `Milo Updates.md` to `Milo Updates.pdf`. Run after editing the changelog to keep the PDF in sync.
- **Pre-send token & cost estimate**: As you type, a chip appears in the header showing the estimated input token count and projected cost (`~X tokens · ~$0.0000`). For Claude providers the count is exact (via `client.messages.count_tokens()`); for Ollama it is approximated at ~4 chars/token. Updates with a 400ms debounce and clears on send.
- **Per-message token diagnostics**: Input token count (`X tokens in`) now appears right-aligned below each user message once the bot responds. Output token count and total tokens for the exchange appear below each bot response alongside the existing timing and cost chips.
- **Session stats bar**: After the first reply a right-aligned stats box appears below the header showing: Msgs · Tokens In · Tokens Out · Total Tokens · Cost. Labels are centered under their values. Labeled "Session Total" to distinguish it from per-message metrics.
- **Backend `/chat/estimate` endpoint**: `POST /chat/estimate` accepts the current message and recent history and returns exact or approximate token counts plus estimated cost. Used by the frontend estimate chip.
- **Provider pricing constants**: Added `CLAUDE_PRICING` map and `_get_claude_pricing()` helper in `main.py`. All providers now return `input_tokens`, `output_tokens`, and `cost` in their SSE done event.
- **`ThemedChat.jsx` base component**: Single shared component that renders the full chat UI (sidebar, header, message area, footer). All layout and feature logic lives here. Each theme is now a thin wrapper (~25 lines) that passes color palettes, greeting, login path, and a `layout` object for style overrides.
- **Collapsible sidebar**: Hover near the right edge of the sidebar — it widens to a 20px click target highlighted in the theme accent color. Click to collapse. The collapsed 56px strip is fully tappable to expand. State persists to `localStorage`.

### Changed
- **Milo rules updated**: Default rule changed from `"start every message with 'ROSE'"` to `"end with a fun fact about cats"` — used to verify that admin-saved rules propagate correctly into the system prompt (and now exercised automatically by the rules injection test).
- **Theme architecture**: The 5 sidebar themes (azure, lavender, stiff, stokt, crystals) are now thin wrappers around `ThemedChat.jsx`. Future feature additions only require editing one file.
- **CPU metric removed** from per-message metrics row — too noisy.
- **tokens/sec metric removed** from per-message metrics row — replaced by the token counts which are more useful.
- **Azure light mode**: Darkened from near-white (`#eff6ff`) to a deeper steel blue (`#cce0ff → #b3cdfa`) with near-black navy text (`#0b1d38`) for significantly better contrast and less eye strain.
- **Sidebar collapse button removed**: The small `‹` button in the MILO header has been removed. Collapsing is now done exclusively via the right-edge strip.

### Fixed
- **`Error: [object Object]` on first message**: Two root causes fixed. (1) `HistoryMessage` Pydantic model now allows `role: "system"` so the session-boundary sentinel `__reset_style__` no longer triggers a 422 validation error. (2) `chat.js` error handler now extracts `.msg` fields from FastAPI's array-formatted `detail` instead of letting it stringify as `[object Object]`.

### Notes
- The `ThemedChat.jsx` `layout` prop accepts: `borderWidth`, `bubbleRadius`, `inputRadius`, `inputGap`, `inputBorderless`, `sendFont`, `loadingText`, `loadingFont`, `loadingItalic`, `loadingColorKey`, `contentPadding`, `messageGap`, `messageFontSize`, `messageLineHeight`, `monoWeight`, `monoLetterSpacing`, `placeholder`. Crystals and stiff themes use several of these to preserve their distinct look.

---

## [2026-06-17] PDF upload support, frozen model comparison table

### Added
- **PDF upload to knowledge library**: The Admin > Library upload now accepts `.pdf` files in addition to `.md` and `.txt`. The backend extracts text page-by-page via `pypdf` and passes it through the existing parent-child chunking pipeline — no changes to RAG retrieval required. Frontend file pickers updated in both `AdminContent.jsx` and `Admin.jsx`.
- **Frozen columns in model comparison table**: The header row and Model name column now stay visible when scrolling the table horizontally or vertically. Uses CSS `position: sticky` with opaque `c.sidebar` backgrounds, a border-right separator on the Model column, and subtle box-shadows on both frozen axes to signal the freeze visually.

### Fixed
- **Model column width**: Capped the frozen Model column at `180px` with wrapping enabled so long model names (e.g. `llama3.3:70b-instruct-q4_K_M`) don't stretch across the table.
- **Missing left padding**: Added `10px` left padding to the frozen Model column cells and the adjacent VRAM column so text isn't flush against the column edge.

---

## [2026-06-17] Claude performance, PDF support groundwork, routing fix

### Added
- **pypdf dependency**: Added `pypdf` to `requirements.txt` — will be used to extract text from PDF files so they can be ingested into Milo's knowledge library (same pipeline as .md and .txt files).
- **Live backend status indicator**: Admin > Models now shows a live badge (polling every 5s) with the actual in-memory provider and model the next chat will use — makes it immediately obvious if provider state didn't save correctly.

### Fixed
- **Claude provider not persisting correctly**: Switching Claude models now always re-asserts the provider to "claude" and surfaces a visible error if it fails — previously the switch could silently succeed while leaving the provider as Ollama, causing phi4:14b to keep running.

### Notes
- **Claude API response quality**: Switching to Claude (Haiku/Sonnet) produced noticeably faster and more accurate responses compared to local Ollama models on this hardware.
- **Knowledge library with Claude**: Uploading documents to the library and querying them via Claude works — RAG retrieval feeds context to the Claude API the same as it does for Ollama.
- **PDF ingestion test**: Tested uploading a PDF of Milo Updates into the knowledge library. Text extraction via `pypdf` worked and Milo was able to answer questions about its own changelog.

---

## [2026-06-17] Streaming responses, context-aware status, and model warm-up

### Added
- **Streaming responses**: Milo now streams its reply token-by-token as it generates, so text appears immediately instead of after a full wait. Backend exposes a new `POST /chat/stream` endpoint using Server-Sent Events (SSE); the frontend reads the stream via the Fetch `ReadableStream` API. All 8 themes updated.
- **Context-aware status messages**: While Milo is working, the loading indicator now shows what it's actually doing — *"Searching your library..."* during RAG retrieval, *"Reading N sources..."* when chunks are found, and *"Composing response..."* for Bedrock/Claude providers. The indicator disappears the moment the first token arrives and the response bubble takes over.
- **Model warm-up ping**: The `useMiloChat` hook now pings `POST /warmup` on mount and every 4 minutes. This keeps the Ollama model loaded in RAM so the first response after an idle period doesn't pay a cold-start penalty.
- **Optimistic message echo**: Confirmed across all themes — user messages appear in the chat bubble instantly on send, before any backend call completes.

### Changed
- **Average RAM in pie tooltip**: The RAM breakdown tooltip header now shows avg RAM% and min–max range pulled from conversation history, alongside the process breakdown donut.
- **RAM pie for stats-only models**: Models with conversation history but no snapshot now show the live system RAM donut on hover instead of nothing.

### Removed
- **Comparison table footnote**: Removed the italicized column explanation text at the bottom of the model comparison table.

### Notes
- Bedrock and Claude providers fall back to a single-chunk response (SSE still used, so the UX is consistent — status shows, then the full reply appears at once).
- The old `POST /chat` endpoint is unchanged and still available.

---

## [2026-06-16] Claude API provider, model comparison improvements, RAM pie for all models

### Added
- **Claude API as a model provider**: Milo can now route LLM calls to Anthropic's Claude API instead of Ollama. Toggle via the Provider selector in Admin > Models. Supports `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, and `claude-opus-4-8`. Provider persists across restarts.
- **Claude API key management UI**: Admin > Models shows a "Claude API" provider button. When selected, a key card appears with a password input (show/hide toggle) and a Save button. Key is stored at `~/.milo_claude_key` — outside OneDrive, never in git.
- **Claude models in the comparison table**: All three Claude models appear in the Model Comparison table with cloud-specific metadata (VRAM: Cloud, Download: API, 200K context, 2025 knowledge cutoff). A "cloud" badge replaces the Run benchmark button.
- **Response Time column**: The model comparison table now includes a measured Response Time column — shows avg seconds and the min–max range from real conversations with that model.
- **RAM pie chart for all models**: The RAM breakdown donut now appears on hover for every model that has been used, not just benchmarked ones. Per-model RAM snapshots are captured automatically after every chat response and persisted to `milo_ram_snapshots.json`. Models with usage stats but no snapshot fall back to live system RAM breakdown. Claude models included.
- **`claude` process color**: Added distinct pink color for the `claude` process in the RAM breakdown pie.

### Removed
- **Floating row-hover tooltip**: The stats tooltip on table row hover has been removed. Only the RAM breakdown donut chart hover remains.
- **`start_milo.bat`**: Deleted — path handling with spaces caused errors. Use `start_milo.ps1` only.

### Security
- Claude API key stored at `C:\Users\<user>\.milo_claude_key` — outside the OneDrive-synced project folder, excluded from git.

---

## [2026-06-12] AWS Bedrock provider, parent-child RAG chunking, benchmark integration, sidebar polish

### Added
- **AWS Bedrock provider**: Backend can now route LLM calls to AWS Bedrock instead of Ollama. Toggle via `POST /admin/provider` — supports Llama 3 8B/70B, Mistral 7B, Claude 3 Haiku/Sonnet, and Titan Text. Credentials via `aws configure` or environment variables. Persists across restarts via `milo_provider.txt`.
- **Parent-child RAG chunking**: Knowledge library now ingests documents as linked parent (12-sentence) and child (3-sentence) chunks. Vector search runs on small, precise child chunks; the matched parent chunk is sent to the model for richer context. Falls back to child chunks for data ingested before this change.
- **Benchmark integration in model comparison table**: Each recommended model now has a Run button. After running, measured columns populate: actual tok/s, CPU %, RAM %, and accuracy score (12 factual/reasoning questions). Hover any row for a tooltip showing avg stats from real conversations.
- **RAM process breakdown donut chart**: Hovering the RAM column in the comparison table shows a color-coded donut breaking down memory by process (Ollama, Python, Chrome, etc.).
- **Source content viewer/editor**: Clicking a source tag in the Knowledge Library opens a modal showing its ingested chunks. Content can be edited and re-ingested in-place without re-uploading the file.
- **Live active model in Settings panel**: The AI Model row now fetches and shows the actual active model from the backend instead of a hardcoded label.
- **Sidebar loads real chat sessions**: Replaced placeholder chats with real sessions from `GET /chats`. Sessions refresh every 10 seconds. Click any session to load it, hover to reveal a delete button.
- **Admin ↔ chat navigation preserves session**: Switching between admin and chat via the sidebar saves and restores the last active session via `localStorage`.
- **Gemma4 added to recommended models**: Added `gemma4:e4b` (multimodal, edge-optimized, 55–165 tok/s with MTP) to the model comparison table.

### Bug fixes
- **Corrected quantized model names** in recommendations: `llama3.1:8b-q4_K_M` → `llama3.1:8b-instruct-q4_K_M`, `llama3.3:70b-q4_K_M` → `llama3.3:70b-instruct-q4_K_M`

### Notes
- **AWS remote desktop requirement**: Investigated using AWS to check whether additional RAM capacity would improve model performance. Running models from an EC2 instance requires VS Code Server (Remote Development) installed on the remote machine — not set up yet, so this is deferred.

---

## [2026-06-09] Performance tuning, markdown rendering, and admin polish

### Added
- **Markdown rendering**: Bot messages now render full markdown across all themes — bold, italics, lists, code blocks, tables, blockquotes (react-markdown + remark-gfm)
- **Response time persistence**: Timing data stored in localStorage per session and restored when loading old conversations — the time-per-message stat no longer disappears
- **Chat history cap**: History sent to the model capped at last 6 messages to keep response times consistent as conversations grow
- **Model selector dropdown**: Replaced the installed models table in admin with a compact dropdown above the diagnostics graphs — shows active model and size clearly
- **Diagnostics synced to active model**: Switching the active model now automatically filters the diagnostics graphs to that model's data
- **Active model moved to Models tab only**: Removed the redundant model selector from the Library tab
- **Efficiency tips moved to bottom of Models tab**: Tips now sit below all other model content

### Bug fixes
- **Style bleed between sessions**: Speaking style instructions (e.g. "talk like a pirate") were carrying over into new chat sessions via history scanning. Fixed with a session boundary sentinel — styles persist within a session but reset cleanly on new chat
- **Duplicate model comparison tables**: Removed the "Model alternatives" table from DiagnosticsPanel — identical to the "Model comparison" table already in AdminContent

---

## [2026-06-09] Admin overhaul, diagnostics, model management, chat persistence, new theme

### Added
- **Persistent chat history**: Every conversation is automatically saved to `backend/chats/`. Sessions survive page reloads and backend restarts. The Sidebar now shows your real chat list — click any to reload it, hover to reveal a delete button.
- **Admin tabs**: Admin page now has a Library tab (upload, create doc, knowledge sources) and a Models tab (diagnostics, installed models, pull helper, comparison table).
- **Model switcher dropdown**: Admin can switch the active Ollama model without editing code. Selection persists across restarts via `milo_model.txt`.
- **Milo Rules**: Admin can write persistent rules in the Markdown File section of the admin page. Rules are saved to `milo_rules.md` and injected into every chat system prompt.
- **Diagnostics panel**: Live sparkline graphs for response time, tokens/sec, CPU %, RAM %, GPU %, and VRAM. History now persists to `milo_metrics.json` so graphs carry over across restarts. Includes efficiency tips checklist and model alternatives table.
- **Delete sources from library**: Each source tag in the knowledge library now has an × button to remove it from ChromaDB.
- **Azure theme**: New blue theme with dark/light mode and blurry background glow orbs.
- **Dark/light mode persists**: Mode is now saved in localStorage and carries over when switching themes.
- **MILO logo navigates to theme picker**: Clicking MILO in the sidebar takes you to the theme chooser.
- **Theme switcher in Settings**: Added Azure to the theme grid in SettingsPanel.
- **Daily summary reminder**: Scheduled agent runs at 8:30pm EDT — adds a placeholder to Milo Updates.md if today's work wasn't documented, removes stale unfilled ones the next day.

### Bug fixes
- **Crystals theme low contrast**: Bot text and muted text were too dim to read. Bumped to `#e8e8e8` dark / `#222` light.
- **Model dropdown invisible options**: `<option>` elements were invisible on dark themes because the background was transparent. Fixed by using `c.sidebar` (always opaque) as the dropdown background.
- **Admin login sent to theme picker**: Routes like `/lavender/admin` didn't exist, so the catch-all sent admins to `/`. All theme logins now navigate to the correct themed admin route.

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
