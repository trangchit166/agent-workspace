/**
 * Simple localStorage-backed persistence for the HR Onboarding chat workspace.
 * Frontend-only mock of US-01: restore the active conversation after a reload
 * or transient disconnect. In-flight streams are reconciled to `stopped` on
 * rehydrate so the UI never resumes a spinner that has no backing stream.
 */

import type { Conversation, ChatMessage } from "./hr-onboarding-mock";

const KEY = "fptai.hr-onboarding.workspace.v1";

interface Persisted {
  conversations: Conversation[];
  activeId: string | null;
  drafts: Record<string, string>;
}

interface RawMessage extends Omit<ChatMessage, "createdAt"> {
  createdAt: string;
}
interface RawConversation extends Omit<Conversation, "updatedAt" | "messages"> {
  updatedAt: string;
  messages: RawMessage[];
}
interface RawPersisted {
  conversations: RawConversation[];
  activeId: string | null;
  drafts: Record<string, string>;
}

const reconcileMessage = (m: RawMessage): ChatMessage => {
  const base: ChatMessage = {
    ...m,
    createdAt: new Date(m.createdAt),
  };
  // If we crashed/reloaded while a stream was in flight, mark the message
  // as stopped so the UI shows a retry affordance instead of a live cursor.
  if (base.status === "streaming" || base.status === "waiting") {
    return {
      ...base,
      status: base.content ? "stopped" : "failed",
      finishReason: base.content ? "user_stop" : "error",
      errorMessage: base.content
        ? undefined
        : "Response was interrupted before it started.",
    };
  }
  return base;
};

export function loadState(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RawPersisted;
    return {
      conversations: parsed.conversations.map((c) => ({
        ...c,
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map(reconcileMessage),
      })),
      activeId: parsed.activeId ?? null,
      drafts: parsed.drafts ?? {},
    };
  } catch {
    return null;
  }
}

export function saveState(state: Persisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota — swallow */
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
