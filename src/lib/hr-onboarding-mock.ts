/**
 * In-memory mock store + simulated streaming responder for the HR Onboarding
 * agent. No network, no persistence — the workspace UI drives everything
 * through these helpers so that FR1–FR8 can be exercised end-to-end.
 */

export type MessageRole = "user" | "assistant";

export type MessageStatus =
  | "sending"
  | "waiting"
  | "streaming"
  | "completed"
  | "failed"
  | "stopped";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  status: MessageStatus;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
  messages: ChatMessage[];
}

export const HR_AGENT = {
  id: "hr-onboarding",
  name: "HR Onboarding",
  tagline: "Guides new hires through their first 30 days.",
  capability: "Policy Q&A · Onboarding checklists · Benefits explainer",
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const daysAgo = (n: number, hour = 10, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
};

export const seedConversations = (): Conversation[] => [
  {
    id: uid(),
    title: "First-day IT setup checklist",
    updatedAt: daysAgo(0, 9, 12),
    messages: [
      {
        id: uid(),
        role: "user",
        content: "What do I need to set up on day one?",
        createdAt: daysAgo(0, 9, 10),
        status: "completed",
      },
      {
        id: uid(),
        role: "assistant",
        content:
          "Welcome aboard. On day one you'll want to finish four things:\n\n1. Activate your corporate account and enable 2FA.\n2. Install the VPN client and sign in with your SSO credentials.\n3. Join the #new-hires and #announcements channels.\n4. Book your 30-min buddy intro from the calendar invite in your inbox.\n\nMost people wrap this up before lunch. Ping me if any step blocks you.",
        createdAt: daysAgo(0, 9, 12),
        status: "completed",
      },
    ],
  },
  {
    id: uid(),
    title: "Parental leave policy",
    updatedAt: daysAgo(1, 15, 40),
    messages: [
      {
        id: uid(),
        role: "user",
        content: "How much parental leave do I get?",
        createdAt: daysAgo(1, 15, 38),
        status: "completed",
      },
      {
        id: uid(),
        role: "assistant",
        content:
          "Full-time employees get 16 weeks of fully paid parental leave, usable any time in the first 12 months after the child's arrival. You can take it in up to three blocks — just file the request 30 days before each block.",
        createdAt: daysAgo(1, 15, 40),
        status: "completed",
      },
    ],
  },
  {
    id: uid(),
    title: "Benefits enrollment window",
    updatedAt: daysAgo(3, 11, 5),
    messages: [
      {
        id: uid(),
        role: "user",
        content: "When does benefits enrollment close for new hires?",
        createdAt: daysAgo(3, 11, 3),
        status: "completed",
      },
      {
        id: uid(),
        role: "assistant",
        content:
          "You have 30 days from your start date to enroll. After that the next opportunity is the annual open-enrollment window in November. I can walk you through the health, dental, and 401(k) elections whenever you're ready.",
        createdAt: daysAgo(3, 11, 5),
        status: "completed",
      },
    ],
  },
  {
    id: uid(),
    title: "Requesting equipment reimbursement",
    updatedAt: daysAgo(5, 16, 22),
    messages: [
      {
        id: uid(),
        role: "user",
        content: "Can I expense a monitor for my home office?",
        createdAt: daysAgo(5, 16, 20),
        status: "completed",
      },
      {
        id: uid(),
        role: "assistant",
        content:
          "Yes — you have a USD 500 home-office stipend in your first 90 days. Buy the equipment, upload the receipt to the Expenses portal under \"Home office setup\", and reimbursement lands with your next paycheck.",
        createdAt: daysAgo(5, 16, 22),
        status: "completed",
      },
    ],
  },
  {
    id: uid(),
    title: "Probation period expectations",
    updatedAt: daysAgo(14, 10, 30),
    messages: [
      {
        id: uid(),
        role: "user",
        content: "What's expected during the 90-day probation?",
        createdAt: daysAgo(14, 10, 28),
        status: "completed",
      },
      {
        id: uid(),
        role: "assistant",
        content:
          "Three checkpoints: a 30-day settling review with your manager, a 60-day feedback round with your team, and a 90-day formal confirmation. Focus on ramp-up projects, not shipping big features — nobody expects heroics in month one.",
        createdAt: daysAgo(14, 10, 30),
        status: "completed",
      },
    ],
  },
  {
    id: uid(),
    title: "Public holiday calendar",
    updatedAt: daysAgo(28, 9, 0),
    messages: [
      {
        id: uid(),
        role: "user",
        content: "Where can I see the public holiday calendar?",
        createdAt: daysAgo(28, 8, 58),
        status: "completed",
      },
      {
        id: uid(),
        role: "assistant",
        content:
          "It's synced to your work calendar automatically under \"Company holidays\". You can also find the printable PDF in the HR portal under Resources → Time off.",
        createdAt: daysAgo(28, 9, 0),
        status: "completed",
      },
    ],
  },
];

/* ----- Mock responder ------------------------------------------------- */

const RESPONSES: { match: RegExp; reply: string }[] = [
  {
    match: /leave|vacation|pto|day off/i,
    reply:
      "You accrue 1.75 vacation days per month, on top of the public holiday calendar. Request time off in the HR portal at least a week in advance — your manager gets the approval ping automatically.",
  },
  {
    match: /benefit|insurance|health|dental|401/i,
    reply:
      "Your benefits package covers medical, dental, and vision from day one, plus a 4% 401(k) match after 90 days. Open the Benefits tab in the HR portal to compare plans side by side.",
  },
  {
    match: /equipment|laptop|monitor|expense|reimburs/i,
    reply:
      "You have a USD 500 home-office stipend in your first 90 days. Buy what you need, upload receipts under \"Home office setup\" in the Expenses portal, and reimbursement lands with your next paycheck.",
  },
  {
    match: /buddy|mentor|onboard|first day|first week/i,
    reply:
      "Your onboarding buddy handles the human side — org intros, unspoken norms, where to grab coffee. I handle the paperwork side. Between us you should have a smooth first two weeks.",
  },
  {
    match: /policy|handbook|rule/i,
    reply:
      "The employee handbook lives in the HR portal under Documents → Policies. Tell me the topic and I'll point to the exact section instead of dumping the whole PDF on you.",
  },
];

const FALLBACK =
  "Good question. Give me a bit more context — for example, are you asking about time off, benefits, equipment, or something else? I'll pull up the exact policy once I know which area to look in.";

export function pickReply(prompt: string): string {
  const hit = RESPONSES.find((r) => r.match.test(prompt));
  return hit ? hit.reply : FALLBACK;
}

export interface StreamHandle {
  stop: () => void;
}

/**
 * Simulates token-by-token streaming. Calls `onToken` with each new chunk,
 * `onDone` when finished, and stops immediately on `stop()`.
 */
export function streamReply(
  prompt: string,
  onToken: (chunk: string) => void,
  onDone: (final: string) => void,
): StreamHandle {
  const full = pickReply(prompt);
  const tokens = full.split(/(\s+)/); // keep whitespace
  let i = 0;
  let stopped = false;
  let acc = "";

  const tick = () => {
    if (stopped) return;
    if (i >= tokens.length) {
      onDone(acc);
      return;
    }
    acc += tokens[i];
    onToken(tokens[i]);
    i += 1;
    setTimeout(tick, 22 + Math.random() * 40);
  };

  // Initial "thinking" delay before first token
  const kickoff = setTimeout(tick, 550);

  return {
    stop: () => {
      stopped = true;
      clearTimeout(kickoff);
      onDone(acc);
    },
  };
}

export { uid };
