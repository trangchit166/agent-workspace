## What we're building

A static UI implementation of the **Unified Agent Workspace (Chat)** feature from the PRD, styled with the **FPT.AI design system**. Single agent: **HR Onboarding**. This pass is design-only — mock data in memory, simulated streaming, no database, no AI calls.

## Layout

Full-height 3-region layout on the home route (`/`):

```text
+----------------------------------------------------------+
| Sidebar (280px)   | Header (56px)                        |
| - New chat btn    +--------------------------------------+
| - Search input    | Chat area (scroll)                   |
| - Conversations   |  - User messages (blue bubble)       |
|   grouped by:     |  - Assistant messages (plain)        |
|   Today           |  - Streaming cursor + "Thinking…"    |
|   Yesterday       |  - Copy / Retry actions on hover     |
|   Last 7 days     |                                      |
|   Older           |                                      |
|                   +--------------------------------------+
|                   | Composer                             |
|                   | [attachment] [textarea] [stop][send] |
+----------------------------------------------------------+
```

## FPT.AI theme wiring (src/styles.css)

Replace the current shadcn defaults with FPT.AI tokens:
- Brand primary: `#203BDC` (hover `#1932B5`)
- Neutrals: slate ramp (50–950)
- Background white, muted `slate-50`, border `slate-200`, muted-foreground `slate-500`
- Radius base 10px (`--radius: 0.625rem`) — matches shadcn `rounded-lg`
- Shadows: low-lift slate tones per spec
- Font sans: **Inter** (via `@fontsource-variable/inter`), mono: **JetBrains Mono** (`@fontsource-variable/jetbrains-mono`)
- Iconography: **Tabler Icons React** (`@tabler/icons-react`) — no Lucide for agent/chat glyphs

Convert hex → oklch when populating `:root` tokens so the existing `@theme inline` mappings pick them up (bg-primary, text-primary, etc. keep working).

## Route & files

- `src/routes/__root.tsx` — update `head()` title/description ("HR Onboarding Agent · FPT.AI"), preserve Outlet.
- `src/routes/index.tsx` — replace placeholder with `<ChatWorkspace />`.
- `src/components/chat/ChatWorkspace.tsx` — 3-region shell, holds conversation state (useState).
- `src/components/chat/Sidebar.tsx` — new chat button, search, grouped conversation list.
- `src/components/chat/ConversationHeader.tsx` — agent avatar + name (HR Onboarding · Live badge) + more menu.
- `src/components/chat/ChatArea.tsx` — messages list, auto-scroll to bottom, "N new messages" jump chip when scrolled up.
- `src/components/chat/Message.tsx` — user/assistant variants, timestamp, hover actions (Copy, Retry for assistant).
- `src/components/chat/Composer.tsx` — textarea (auto-grow), attachment icon, Send/Stop toggle based on state.
- `src/components/chat/StreamingIndicator.tsx` — "Thinking…" shimmer + typing cursor.
- `src/components/chat/EmptyState.tsx` — shown when no conversation is selected.
- `src/lib/hr-onboarding-mock.ts` — seed conversations (Today/Yesterday/Last 7 days/Older) and a fake streaming responder that emits tokens on a timer for HR topics (leave policy, benefits enrollment, first-day checklist, IT setup, etc.). Includes Stop and Regenerate.
- `src/lib/format.ts` — small time-group helper.

## Behavior covered (from PRD)

- **FR1 Start conversation** — New chat clears state; agent is fixed to HR Onboarding.
- **FR2 Continue conversation** — Click sidebar item → loads messages from in-memory store, restores scroll to bottom.
- **FR3 Streaming** — Simulated token-by-token render, "Thinking…" state, Stop button visible while streaming.
- **FR4 Retry** — Regenerate button on last assistant message replaces its content via the mock responder.
- **FR5 Agent selector** — Header shows the pinned HR Onboarding agent (disabled dropdown with "Only agent in this workspace" tooltip — reflects locked-agent scope).
- **FR6 History** — Sidebar groups by Today / Yesterday / Last 7 days / Older; search filters by title.
- **FR7 Copy** — Copy button per message; browser text-selection copy also works.
- **FR8 Draft** — Composer text kept in a Map keyed by conversation id (in-memory only for this pass) so switching conversations preserves the draft.
- **State machine** — Idle → Typing → Sending → Waiting → Streaming → Completed (or Failed → Retry) reflected in composer/send state.

Explicitly out of scope this pass: real persistence, real LLM, auth, attachments upload, sequence diagram wiring, non-functional targets.

## Verification

- App builds; `/` renders the workspace with seeded conversations.
- Playwright screenshot pass at 1280×1800: initial state, mid-stream, after stop, after regenerate, sidebar search filtering.
- Manual click-through of AC-01…AC-11 that don't require a backend (streaming, thinking, stop, regenerate, agent locked after first message, copy, draft preserved across sidebar switch, scroll restored).

## Technical notes

- Tailwind v4 theme values live in `src/styles.css` under `:root` + existing `@theme inline` block; keep dark-mode variables in sync so the palette renders even without an explicit theme toggle.
- Inter/JetBrains Mono via `@fontsource-variable/*` npm packages imported in `src/styles.css` (not a Google Fonts `<link>` in this pass — package import keeps the design system self-contained).
- Tabler icons imported per component (`import { IconRobot, IconPlus, ... } from "@tabler/icons-react"`) to avoid pulling the full set.
- Message list uses `react` state + `useEffect` for the simulated stream timer; cleanup on unmount and on Stop.
- No new packages beyond `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@tabler/icons-react`.
