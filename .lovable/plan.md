
## Audit: current UI vs PRD TOVA-4579

Scoring what the current `ChatWorkspace` covers against the PRD's 4 user stories, 4 flows, and the AC list. Everything is design-only / frontend mock in this pass.

### ✅ Already covered

- **US-02 streaming + Stop + Regenerate** — `streamReply`, `handleStop`, `handleRegenerate` all wired; "Thinking…" waiting state shown.
- **US-04 copy** — Copy button on each assistant message writes markdown source to clipboard.
- **FR6 history grouping** — Today / Yesterday / Last 7 days / Older + search filter.
- **FR8 draft per conversation** — in-memory `drafts` map keyed by conversation id.
- **Auto-scroll + "N new messages" jump chip** when scrolled up.
- **FPT.AI theming** — #203BDC primary, Inter, Tabler icons, 10px radius.

### ⚠️ Gaps vs PRD (to fix)

**US-01 — Persistence & recovery on reload (High)**
- Current: everything lives in `useState`; a browser refresh wipes the active conversation, message list, and drafts. PRD success metric is *100%* restore rate.
- Fix: persist `conversations`, `activeId`, `drafts`, and any in-flight `partial_content` to `localStorage` under a namespaced key. Rehydrate on mount. Serialize `Date` as ISO. This keeps the pass frontend-only while satisfying US-01 + AC on reload.
- Also: on reload while a message was `streaming`, mark it `stopped` with a "Resume" affordance (Regenerate) rather than leaving the placeholder spinning.

**US-02 — Streaming edge cases (High)**
- Empty model reply → auto-retry once, then fallback message. Currently not handled.
- Mid-stream disconnect simulation → keep partial content and expose "Try again". Add a `failed` visual state on the message + inline retry button (distinct from Regenerate on the last completed turn).
- `finish_reason` surfacing: show a subtle "Stopped by you" / "Response ended" caption under stopped/failed messages.

**US-03 — Agent selector (High)**
- Current: header shows a *disabled* pill labelled "Only agent in this workspace". PRD requires a real selector with the available agent list and a clear default; even with a single agent, the control should behave as a proper selector (open → list → confirm) and display the assigned agent per conversation.
- Fix: convert the header pill into a real Popover/Menu with the HR Onboarding agent as the only item (checked), agent avatar + tagline + capability chips. Store `agentId` on each conversation and render it in the header for the active conversation. Lock switching once the first message is sent (per PRD "Agent gán cho hội thoại").
- Add: when there is no active conversation, EmptyState shows the same agent card so the user knows who they're about to talk to.

**US-04 — Copy refinements (Medium)**
- Add copy affordance for a selected text range (floating "Copy selection" button when the user selects text within an assistant message), matching Flow 4. Keep the full-message Copy button.
- Copy toast / inline "Copied" confirmation is already there (icon swap); keep as-is.

**Flow / states missing from UI**
- **Loading / empty for the chat frame** (US-01 explicitly asks for both). Add a skeleton state on initial rehydrate; keep the current EmptyState for new-chat.
- **Error state** for failed message with retry button (distinct from Regenerate).
- **Message metadata**: expose `status` visually per message (sending / streaming / completed / stopped / failed) via a small caption row — currently only the assistant streaming cursor is visible.
- **State machine reflection in composer**: disable Send while `waiting`, show Stop while `streaming` — already done; add a subtle "Agent is thinking…" line above the composer while `waiting` (PRD flow 2 explicitly calls this out).

**Copy fidelity**
- Assistant content is rendered as plain text with `\n\n` handling. PRD says "Markdown source" to clipboard, so rendering can stay plain in this pass, but confirm `navigator.clipboard.writeText(m.content)` uses the raw markdown (it does). No change needed — call this out as verified.

**Out of scope (do NOT add — PRD §9)**
- Multi-tab / real-time sync, rename/pin/delete (TOVA-4581), multi-conversation orchestration (TOVA-4580), memory, voice, analytics, real LLM/backend.

### Deliverable changes (files)

- `src/lib/hr-onboarding-mock.ts` — add `agentId` on `Conversation`, add `failed` handling in `streamReply` (simulate occasional empty reply + retry).
- `src/lib/persistence.ts` *(new)* — `loadState()` / `saveState()` with localStorage, Date (de)serialization, streaming-message reconciliation on rehydrate.
- `src/components/chat/ChatWorkspace.tsx` — wire persistence, agent locking per conversation, "thinking" caption above composer, skeleton on rehydrate, failed-message retry, selection-copy popover.
- `src/components/chat/AgentSelector.tsx` *(new)* — Popover-based agent picker used in Header + EmptyState.
- `src/components/chat/MessageStatus.tsx` *(new)* — small caption row for status/finish_reason under each message.

### Verification

- Reload the preview mid-conversation → sidebar + messages restored, in-flight stream shown as stopped with Regenerate.
- Open agent selector → HR Onboarding listed as the only option, checked; header shows assigned agent per conversation.
- Trigger simulated failure → failed message with inline "Try again".
- Playwright pass at 1280×1800: empty state, active convo, streaming, stopped, failed+retry, agent selector open, after-reload restored.

### Explicitly not doing

- No database, no Lovable Cloud, no real LLM.
- No new deps.
- No changes to the FPT.AI tokens already in `styles.css`.
