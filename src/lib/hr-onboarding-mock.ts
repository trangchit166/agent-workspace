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

export type FinishReason = "stop" | "user_stop" | "error" | "empty";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  status: MessageStatus;
  finishReason?: FinishReason;
  errorMessage?: string;
}

export interface Conversation {
  id: string;
  title: string;
  agentId: string;
  updatedAt: Date;
  messages: ChatMessage[];
}

export interface AgentDescriptor {
  id: string;
  name: string;
  tagline: string;
  capability: string;
}

export const HR_AGENT: AgentDescriptor = {
  id: "hr-onboarding",
  name: "HR Onboarding",
  tagline: "Guides new hires through their first 30 days.",
  capability: "Policy Q&A · Onboarding checklists · Benefits explainer",
};

export const AVAILABLE_AGENTS: AgentDescriptor[] = [HR_AGENT];

export const getAgent = (id: string): AgentDescriptor =>
  AVAILABLE_AGENTS.find((a) => a.id === id) ?? HR_AGENT;

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

const convo = (
  title: string,
  ago: [number, number, number],
  ask: string,
  reply: string,
): Conversation => ({
  id: uid(),
  agentId: HR_AGENT.id,
  title,
  updatedAt: daysAgo(ago[0], ago[1], ago[2]),
  messages: [
    {
      id: uid(),
      role: "user",
      content: ask,
      createdAt: daysAgo(ago[0], ago[1], Math.max(0, ago[2] - 2)),
      status: "completed",
    },
    {
      id: uid(),
      role: "assistant",
      content: reply,
      createdAt: daysAgo(ago[0], ago[1], ago[2]),
      status: "completed",
      finishReason: "stop",
    },
  ],
});

export const seedConversations = (): Conversation[] => [
  convo(
    "Dự báo thời tiết Hà Nội",
    [0, 16, 20],
    "Thời tiết Hà Nội ngày mai thế nào?",
    "Hà Nội ngày mai nhiều mây, nhiệt độ 26–32°C, có mưa rào rải rác vào chiều tối. Độ ẩm khoảng 80%, gió đông nam cấp 2–3.",
  ),
  convo(
    "Dự báo thời tiết Hà Nội",
    [0, 14, 5],
    "Cuối tuần này Hà Nội có mưa không?",
    "Thứ Bảy trời nắng gián đoạn, 27–33°C. Chủ nhật khả năng mưa dông cao hơn vào buổi chiều, bạn nên mang theo ô.",
  ),
  convo(
    "Chào buổi sáng",
    [0, 8, 30],
    "Chào buổi sáng!",
    "Chào buổi sáng! Hôm nay bạn muốn bắt đầu từ việc gì? Mình có thể giúp tổng hợp báo cáo, soạn email hoặc tra cứu tài liệu.",
  ),
  convo(
    "Giải bài tập đọc hiểu tiếng Anh",
    [1, 15, 40],
    "Giúp mình giải bài đọc hiểu tiếng Anh này với.",
    "Được. Bạn gửi đoạn văn và câu hỏi nhé — mình sẽ phân tích ý chính từng đoạn, chỉ ra từ khoá và giải thích vì sao mỗi đáp án đúng hoặc sai.",
  ),
  convo(
    "Thiết kế giao diện CRM HTML",
    [2, 11, 5],
    "Thiết kế giúp mình giao diện CRM bằng HTML.",
    "Mình đã dựng bố cục gồm thanh bên điều hướng, bảng danh sách khách hàng có tìm kiếm và lọc, cùng khung chi tiết bên phải. Toàn bộ dùng HTML + Tailwind, responsive từ 1024px trở lên.",
  ),
  convo(
    "Yêu cầu gửi email",
    [3, 9, 25],
    "Soạn giúp mình email nhắc lịch họp với đối tác.",
    "Đây là bản nháp: tiêu đề \"Nhắc lịch họp ngày 12/9\", nội dung gồm thời gian, địa điểm, agenda ba mục và lời đề nghị xác nhận trước 17h ngày 10/9.",
  ),
  convo(
    "Xuất báo cáo giá vàng file html",
    [6, 16, 10],
    "Xuất báo cáo giá vàng ra file HTML giúp mình.",
    "Báo cáo đã sẵn sàng: bảng giá mua/bán theo từng thương hiệu, biểu đồ biến động 30 ngày và phần nhận định ngắn. File HTML đơn lẻ, mở trực tiếp bằng trình duyệt.",
  ),
  convo(
    "Báo cáo doanh thu FPT năm 2025",
    [12, 10, 0],
    "Tổng hợp báo cáo doanh thu FPT năm 2025.",
    "Mình đã tổng hợp doanh thu theo bốn quý, tách theo ba khối kinh doanh, kèm so sánh cùng kỳ và biểu đồ tăng trưởng. Bạn muốn xuất ra Excel hay PowerPoint?",
  ),
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

export interface StreamCallbacks {
  onToken: (chunk: string) => void;
  onDone: (final: string, reason: FinishReason) => void;
  onError: (partial: string, message: string) => void;
}

/**
 * Simulates token-by-token streaming. Includes:
 *  - a "thinking" delay before the first token
 *  - deterministic failure demo: prompts containing "simulate error" or
 *    "trigger fail" fail mid-stream after a few tokens
 *  - empty-reply auto-retry once, then fallback
 */
export function streamReply(
  prompt: string,
  { onToken, onDone, onError }: StreamCallbacks,
): StreamHandle {
  let full = pickReply(prompt);
  // Empty-reply guard: retry once, then use fallback text.
  if (!full.trim()) full = pickReply(prompt) || FALLBACK;

  const shouldFail = /simulate error|trigger fail|fail now/i.test(prompt);
  const failAt = shouldFail ? 6 : -1;

  const tokens = full.split(/(\s+)/); // keep whitespace
  let i = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let acc = "";

  const tick = () => {
    if (stopped) return;
    if (failAt >= 0 && i === failAt) {
      onError(acc, "Connection lost while streaming. You can try again.");
      return;
    }
    if (i >= tokens.length) {
      onDone(acc, "stop");
      return;
    }
    acc += tokens[i];
    onToken(tokens[i]);
    i += 1;
    timer = setTimeout(tick, 22 + Math.random() * 40);
  };

  const kickoff = setTimeout(tick, 550);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(kickoff);
      if (timer) clearTimeout(timer);
      onDone(acc, "user_stop");
    },
  };
}

export { uid };
