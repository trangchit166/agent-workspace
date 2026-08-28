import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconBell,
  IconBolt,
  IconBrowser,
  IconBuildingStore,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconCopy,
  IconDots,
  IconEdit,
  IconEye,
  IconFileText,
  IconFolder,
  IconFolderSearch,
  IconLayoutGrid,
  IconMail,
  IconMicrophone,
  IconPackage,
  IconPaperclip,
  IconPlayerStop,
  IconPlugConnected,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSelector,
  IconSend,
  IconStack2,
  IconLayoutSidebar,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import {
  AVAILABLE_AGENTS,
  HR_AGENT,
  getAgent,
  seedConversations,
  streamReply,
  uid,
  type ChatMessage,
  type Conversation,
  type StreamHandle,
} from "@/lib/hr-onboarding-mock";
import { loadState, saveState } from "@/lib/persistence";

type ChatStatus = "idle" | "waiting" | "streaming";

const USER_NAME = "Trang Nguyen Huyen";
const USER_SUBTITLE = "Trang Nguyen Huyen Workspace";

const suggestions = [
  "What's covered in my benefits package?",
  "How do I request time off?",
  "Walk me through my first-day IT setup.",
  "Can I expense a monitor for my home office?",
];

export function ChatWorkspace() {
  // Rehydrate synchronously from localStorage so a reload restores the
  // active conversation without a visible flash (US-01).
  const initial = useMemo(() => loadState(), []);
  const [conversations, setConversations] = useState<Conversation[]>(
    () => initial?.conversations ?? seedConversations(),
  );
  const [activeId, setActiveId] = useState<string | null>(
    initial?.activeId ?? null,
  );
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>(
    initial?.drafts ?? {},
  );

  const streamRef = useRef<StreamHandle | null>(null);

  useEffect(() => () => streamRef.current?.stop(), []);

  // Sidebar collapse. Start false on SSR to avoid hydration mismatch, then
  // read the persisted preference in an effect.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("uaw:sidebar-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("uaw:sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  // Persist on every meaningful change.
  useEffect(() => {
    saveState({ conversations, activeId, drafts });
  }, [conversations, activeId, drafts]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const draftKey = activeId ?? "__new__";
  const draft = drafts[draftKey] ?? "";

  const setDraft = useCallback(
    (value: string) => setDrafts((d) => ({ ...d, [draftKey]: value })),
    [draftKey],
  );

  const patchConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) =>
      setConversations((list) =>
        list.map((c) => (c.id === id ? updater(c) : c)),
      ),
    [],
  );

  const startStream = useCallback(
    (conversationId: string, prompt: string, replaceId?: string) => {
      const assistantId = replaceId ?? uid();

      if (replaceId) {
        patchConversation(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === replaceId
              ? {
                  ...m,
                  content: "",
                  status: "waiting",
                  finishReason: undefined,
                  errorMessage: undefined,
                  createdAt: new Date(),
                }
              : m,
          ),
          updatedAt: new Date(),
        }));
      } else {
        const placeholder: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date(),
          status: "waiting",
        };
        patchConversation(conversationId, (c) => ({
          ...c,
          messages: [...c.messages, placeholder],
          updatedAt: new Date(),
        }));
      }

      setStatus("waiting");

      streamRef.current = streamReply(prompt, {
        onToken: (chunk) => {
          setStatus("streaming");
          patchConversation(conversationId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + chunk, status: "streaming" }
                : m,
            ),
          }));
        },
        onDone: (final, reason) => {
          patchConversation(conversationId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: final || m.content,
                    status: reason === "user_stop" ? "stopped" : "completed",
                    finishReason: reason,
                  }
                : m,
            ),
          }));
          streamRef.current = null;
          setStatus("idle");
        },
        onError: (partial, message) => {
          patchConversation(conversationId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: partial,
                    status: "failed",
                    finishReason: "error",
                    errorMessage: message,
                  }
                : m,
            ),
          }));
          streamRef.current = null;
          setStatus("idle");
        },
      });
    },
    [patchConversation],
  );

  const handleSend = useCallback(
    (agentIdForNew?: string) => {
      const text = draft.trim();
      if (!text || status !== "idle") return;

      let convoId = activeId;
      if (!convoId) {
        convoId = uid();
        const newConvo: Conversation = {
          id: convoId,
          agentId: agentIdForNew ?? HR_AGENT.id,
          title: text.length > 48 ? text.slice(0, 48) + "…" : text,
          updatedAt: new Date(),
          messages: [],
        };
        setConversations((list) => [newConvo, ...list]);
        setActiveId(convoId);
      }

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        createdAt: new Date(),
        status: "completed",
      };

      patchConversation(convoId, (c) => ({
        ...c,
        messages: [...c.messages, userMsg],
        updatedAt: new Date(),
      }));

      setDraft("");
      startStream(convoId, text);
    },
    [activeId, draft, patchConversation, setDraft, startStream, status],
  );

  const handleStop = useCallback(() => {
    streamRef.current?.stop();
  }, []);

  const handleRegenerate = useCallback(() => {
    if (!active || status !== "idle") return;
    const lastUser = [...active.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const lastUserIdx = active.messages.lastIndexOf(lastUser);
    patchConversation(active.id, (c) => ({
      ...c,
      messages: c.messages.slice(0, lastUserIdx + 1),
    }));
    startStream(active.id, lastUser.content);
  }, [active, patchConversation, startStream, status]);

  // Retry a specific failed/stopped assistant message in place.
  const handleRetryMessage = useCallback(
    (messageId: string) => {
      if (!active || status !== "idle") return;
      const idx = active.messages.findIndex((m) => m.id === messageId);
      if (idx < 1) return;
      const prompt = active.messages[idx - 1];
      if (prompt.role !== "user") return;
      startStream(active.id, prompt.content, messageId);
    },
    [active, startStream, status],
  );

  const handleNewChat = useCallback(() => {
    streamRef.current?.stop();
    setActiveId(null);
    setStatus("idle");
  }, []);

  // Change the agent on the active conversation. Locked after the first
  // message is sent (PRD: "Agent gán cho hội thoại").
  const handleChangeAgent = useCallback(
    (agentId: string) => {
      if (!active) return;
      if (active.messages.length > 0) return;
      patchConversation(active.id, (c) => ({ ...c, agentId }));
    },
    [active, patchConversation],
  );

  // Flat, most-recent-first conversation list (no date grouping).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q))
      : conversations;
    return [...list].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }, [conversations, search]);

  const headerAgent = active ? getAgent(active.agentId) : HR_AGENT;
  const agentLocked = !!active && active.messages.length > 0;

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar
        conversations={filtered}
        activeId={activeId}
        search={search}
        onSearch={setSearch}
        onSelect={(id) => {
          streamRef.current?.stop();
          setActiveId(id);
          setStatus("idle");
        }}
        onNewChat={handleNewChat}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Quay lại nền tảng cũ */}
        <button
          type="button"
          className="absolute right-6 top-5 z-10 inline-flex h-9 items-center gap-2 rounded-full bg-[#F2F5F9] px-4 text-[13px] font-medium text-slate-500 transition-colors hover:bg-[#E8ECF3] hover:text-slate-700"
        >
          <IconRefresh size={16} stroke={1.75} />
          Chuyển về nền tảng cũ
        </button>

        {active ? (
          <>
            <Header
              agent={headerAgent}
              locked={agentLocked}
              onChangeAgent={handleChangeAgent}
            />
            <ChatArea
              conversation={active}
              status={status}
              onRegenerate={handleRegenerate}
              onRetry={handleRetryMessage}
            />
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => handleSend()}
              onStop={handleStop}
              status={status}
              agentName={headerAgent.name}
            />
          </>
        ) : (
          <Home
            userName={USER_NAME}
            draft={draft}
            onDraftChange={setDraft}
            onSend={() => handleSend()}
            status={status}
          />
        )}
      </main>
    </div>
  );
}

/* ---------- Sidebar ---------------------------------------------------- */

function Sidebar({
  conversations,
  activeId,
  search,
  onSearch,
  onSelect,
  onNewChat,
  collapsed,
  onToggle,
}: {
  conversations: Conversation[];
  activeId: string | null;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const secondary = [
    { key: "projects", label: "Dự án", icon: IconFolder },
    { key: "market", label: "Chợ Agent", icon: IconBuildingStore },
    { key: "artifacts", label: "Artifacts", icon: IconPackage },
    { key: "connections", label: "Kết nối", icon: IconPlugConnected },
    { key: "mcp", label: "Xác thực MCP", icon: IconStack2 },
    { key: "console", label: "Xây trong Console", icon: IconLayoutGrid },
  ];

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col overflow-hidden border-r border-border/70 bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-[288px]",
      )}
    >
      {/* Brand + search + collapse toggle */}
      <div
        className={cn(
          "flex h-16 items-center px-4",
          collapsed ? "flex-col justify-center gap-2 px-0" : "justify-between",
        )}
      >
        {collapsed ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground">
            .Ai
          </span>
        ) : (
          <img
            src="/fpt-ai-logo.png"
            alt="FPT.AI"
            className="h-7 w-auto select-none"
            draggable={false}
          />
        )}
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "gap-1")}>
          <button
            type="button"
            aria-label="Tìm kiếm"
            title="Tìm kiếm hội thoại"
            onClick={() => setSearchOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconSearch size={18} stroke={1.75} />
          </button>
          <button
            type="button"
            aria-label={collapsed ? "Hiện thanh bên" : "Ẩn thanh bên"}
            title={`${collapsed ? "Hiện" : "Ẩn"} thanh bên (Ctrl+B)`}
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconLayoutSidebar size={18} stroke={1.75} />
          </button>
        </div>
      </div>

      {/* Primary CTA — Trò chuyện mới */}
      <div className={cn("pt-1", collapsed ? "px-1.5" : "px-3")}>
        <button
          type="button"
          onClick={onNewChat}
          title={collapsed ? "Trò chuyện mới" : undefined}
          aria-label={collapsed ? "Trò chuyện mới" : undefined}
          className={cn(
            "flex w-full items-center rounded-lg bg-[#EFF1FC] text-[14px] font-medium text-primary transition-colors hover:bg-[#E4E8FA]",
            collapsed ? "h-10 justify-center px-0" : "h-10 gap-3 px-3",
          )}
        >
          <IconEdit size={19} stroke={1.75} />
          {!collapsed && <span className="flex-1 text-left">Trò chuyện mới</span>}
        </button>
      </div>

      {/* Secondary nav */}
      <div className={cn("pt-1", collapsed ? "px-1.5" : "px-3")}>
        {secondary.map(({ key, ...item }) => (
          <SidebarItem key={key} {...item} collapsed={collapsed} />
        ))}
      </div>

      {/* Inline search */}
      {!collapsed && searchOpen && (
        <div className="px-3 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
            <IconSearch size={14} className="text-muted-foreground" stroke={2} />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Tìm hội thoại"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </label>
        </div>
      )}

      {!collapsed ? (
        <nav className="mt-5 flex-1 overflow-y-auto px-3 pb-3">
          {conversations.length > 0 && (
            <>
              <div className="px-3 pb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Cuộc trò chuyện
              </div>
              <ul className="flex flex-col gap-0.5">
                {conversations.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        className={cn(
                          "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] transition-colors",
                          isActive
                            ? "bg-accent font-medium text-foreground"
                            : "text-foreground/75 hover:bg-accent",
                        )}
                      >
                        <span className="truncate">{c.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      {/* User card */}
      <div className={cn("p-2", collapsed ? "px-1.5" : "px-3 py-3")}>
        {collapsed ? (
          <div className="flex justify-center">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
              title={USER_NAME}
            >
              TH
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl px-1 py-2 hover:bg-accent">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4056E0] to-[#1B2B8F] text-[11.5px] font-semibold text-white">
              TH
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
                {USER_NAME}
              </div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                {USER_SUBTITLE}
              </div>
            </div>
            <button
              type="button"
              aria-label="Đổi tài khoản"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <IconSelector size={15} stroke={1.75} />
            </button>
            <button
              type="button"
              aria-label="Thông báo"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <IconBell size={15} stroke={1.75} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}


function SidebarItem({
  label,
  icon: Icon,
  shortcut,
  active,
  onClick,
  collapsed,
}: {
  label: string;
  icon: typeof IconSearch;
  shortcut?: string[];
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group flex w-full items-center rounded-lg text-left text-[14px] transition-colors",
        collapsed ? "h-10 justify-center px-0" : "h-10 gap-3 px-3",
        active
          ? "bg-accent font-semibold text-foreground"
          : "text-foreground/80 hover:bg-accent",
      )}
    >
      <Icon
        size={19}
        stroke={1.75}
        className={cn(active ? "text-foreground" : "text-muted-foreground")}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {shortcut && (
            <span className="flex items-center gap-0.5">
              {shortcut.map((k) => (
                <kbd
                  key={k}
                  className="flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-background px-1 text-[10px] font-medium text-muted-foreground"
                >
                  {k}
                </kbd>
              ))}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/* ---------- Header ----------------------------------------------------- */

function Header({
  agent,
  locked,
  onChangeAgent,
}: {
  agent: { id: string; name: string; capability: string };
  locked: boolean;
  onChangeAgent: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-agent-selector]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconRobot size={20} stroke={1.75} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {agent.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Live
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {agent.capability}
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-2" data-agent-selector>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={locked}
          title={
            locked
              ? "Agent is locked once the conversation starts"
              : "Change agent"
          }
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm transition-colors",
            locked
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "bg-background text-foreground hover:bg-accent",
          )}
        >
          <IconRobot size={14} stroke={1.75} className="text-primary" />
          {agent.name}
          <IconChevronDown size={14} stroke={2} />
        </button>
        {open && (
          <div className="absolute right-11 top-11 z-20 w-72 rounded-xl border border-border bg-popover p-1 shadow-lg">
            <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Available agents
            </div>
            {AVAILABLE_AGENTS.map((a) => {
              const selected = a.id === agent.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onChangeAgent(a.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    selected ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IconRobot size={16} stroke={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {a.name}
                      </span>
                      {selected && (
                        <IconCheck
                          size={14}
                          stroke={2.25}
                          className="text-primary"
                        />
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.tagline}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="More actions"
        >
          <IconDots size={16} stroke={2} />
        </button>
      </div>
    </header>
  );
}

/* ---------- Chat area -------------------------------------------------- */

function ChatArea({
  conversation,
  status,
  onRegenerate,
  onRetry,
}: {
  conversation: Conversation;
  status: ChatStatus;
  onRegenerate: () => void;
  onRetry: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const lastCount = useRef(conversation.messages.length);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastCount.current = conversation.messages.length;
    setAtBottom(true);
    setUnread(0);
  }, [conversation.id]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = conversation.messages.length - lastCount.current;
    lastCount.current = conversation.messages.length;
    if (atBottom) {
      el.scrollTop = el.scrollHeight;
    } else if (delta > 0) {
      setUnread((n) => n + delta);
    }
  }, [conversation.messages, atBottom]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation.messages, atBottom]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(near);
    if (near) setUnread(0);
  };

  const jumpToLatest = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnread(0);
    setAtBottom(true);
  };

  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const canRegenerate =
    status === "idle" &&
    lastMsg?.role === "assistant" &&
    (lastMsg.status === "completed" || lastMsg.status === "stopped");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          {conversation.messages.map((m, i) => (
            <MessageRow
              key={m.id}
              message={m}
              isLast={i === conversation.messages.length - 1}
              canRegenerate={
                canRegenerate && i === conversation.messages.length - 1
              }
              onRegenerate={onRegenerate}
              onRetry={() => onRetry(m.id)}
              canRetry={status === "idle" && m.status === "failed"}
            />
          ))}
        </div>
      </div>

      {!atBottom && unread > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-md transition-colors hover:bg-accent"
        >
          <IconArrowDown size={14} stroke={2} />
          {unread} new {unread === 1 ? "message" : "messages"}
        </button>
      )}
    </div>
  );
}

/* ---------- Message ---------------------------------------------------- */

function MessageRow({
  message,
  canRegenerate,
  canRetry,
  onRegenerate,
  onRetry,
}: {
  message: ChatMessage;
  isLast: boolean;
  canRegenerate: boolean;
  canRetry: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  if (isUser) {
    return (
      <div className="group flex justify-end">
        <div className="flex max-w-[80%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-xs">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 pr-1 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <span>{formatTime(message.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  const isFailed = message.status === "failed";
  const isStopped = message.status === "stopped";
  const isWaiting = message.status === "waiting" && message.content === "";

  return (
    <div className="group flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isFailed
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary",
        )}
      >
        {isFailed ? (
          <IconAlertTriangle size={18} stroke={1.75} />
        ) : (
          <IconRobot size={18} stroke={1.75} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">
            {HR_AGENT.name}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {isWaiting ? (
          <div className="flex items-center gap-2 py-1">
            <span className="shimmer-text text-sm font-medium">Thinking…</span>
          </div>
        ) : message.content ? (
          <div
            className={cn(
              "prose prose-sm max-w-none text-sm leading-relaxed text-foreground",
              message.status === "streaming" && "typing-caret",
            )}
          >
            {message.content.split("\n").map((line, i) => (
              <p key={i} className="my-1.5 whitespace-pre-wrap">
                {line || "\u00A0"}
              </p>
            ))}
          </div>
        ) : null}

        {(isStopped || isFailed) && (
          <MessageStatusCaption
            isFailed={isFailed}
            message={
              isFailed
                ? message.errorMessage ?? "Something went wrong."
                : "Generation stopped by you."
            }
          />
        )}

        {(message.status === "completed" ||
          isStopped ||
          isFailed) && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 transition-opacity",
              isFailed
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
          >
            {message.content && (
              <MsgAction
                icon={copied ? IconCheck : IconCopy}
                label={copied ? "Copied" : "Copy"}
                onClick={copy}
              />
            )}
            {canRetry && (
              <MsgAction
                icon={IconRefresh}
                label="Try again"
                onClick={onRetry}
                emphasis
              />
            )}
            {canRegenerate && !canRetry && (
              <MsgAction
                icon={IconRefresh}
                label="Regenerate"
                onClick={onRegenerate}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatusCaption({
  isFailed,
  message,
}: {
  isFailed: boolean;
  message: string;
}) {
  return (
    <div
      className={cn(
        "mt-1.5 flex items-center gap-1.5 text-xs",
        isFailed ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {isFailed && <IconAlertTriangle size={12} stroke={2} />}
      <span>{message}</span>
    </div>
  );
}

function MsgAction({
  icon: Icon,
  label,
  onClick,
  emphasis = false,
}: {
  icon: typeof IconCopy;
  label: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
        emphasis
          ? "border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon size={13} stroke={2} />
      {label}
    </button>
  );
}

/* ---------- Composer --------------------------------------------------- */

function Composer({
  value,
  onChange,
  onSend,
  onStop,
  status,
  agentName,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  status: ChatStatus;
  agentName: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const streaming = status !== "idle";
  const canSend = value.trim().length > 0 && status === "idle";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  useEffect(() => {
    if (status === "idle") ref.current?.focus();
  }, [status]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-background px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        {status === "waiting" && (
          <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span>{agentName} is thinking…</span>
          </div>
        )}
        {status === "streaming" && (
          <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span>Streaming response — press Stop to interrupt.</span>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Attach file"
          >
            <IconPaperclip size={18} stroke={1.75} />
          </button>
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Message ${agentName}…`}
            className="min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <IconPlayerStop size={14} stroke={2} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                canSend
                  ? "bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)]"
                  : "bg-muted text-muted-foreground",
              )}
              aria-label="Send message"
            >
              <IconSend size={16} stroke={2} />
            </button>
          )}
        </div>
        <div className="mt-2 px-1 text-[11px] text-muted-foreground">
          FPT.AI responses are guidance, not policy. Confirm anything critical with your HR partner.
        </div>
      </div>
    </div>
  );
}

/* ---------- Home ------------------------------------------------------ */

const QUICK_ACTIONS = [
  { label: "Tổng hợp báo cáo", icon: IconChartBar, tint: "text-rose-500" },
  { label: "Soạn email", icon: IconMail, tint: "text-emerald-500" },
  { label: "Tìm tài liệu", icon: IconFolderSearch, tint: "text-amber-500" },
  { label: "Tạo website", icon: IconBrowser, tint: "text-sky-500" },
  { label: "Viết code", icon: IconCode, tint: "text-violet-500" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** Small brand glyph used inside the model selector chip. */
function ModelGlyph() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white">
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="11.5" y1="13" x2="13" y2="5.5" />
          <line x1="11.5" y1="13" x2="21" y2="4" />
          <line x1="11.5" y1="13" x2="3.5" y2="11.5" />
          <line x1="11.5" y1="13" x2="19.5" y2="19.5" />
        </g>
        <g fill="currentColor">
          <circle cx="11.5" cy="13" r="3.1" />
          <circle cx="13" cy="5.5" r="2.3" />
          <circle cx="21" cy="4" r="1.9" />
          <circle cx="3.5" cy="11.5" r="2.1" />
          <circle cx="19.5" cy="19.5" r="2.2" />
        </g>
      </svg>
    </span>
  );
}

function Home({
  userName,
  draft,
  onDraftChange,
  onSend,
  status,
}: {
  userName: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  status: ChatStatus;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canSend = draft.trim().length > 0 && status === "idle";

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [draft]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[816px] flex-1 flex-col justify-center px-6 pb-40 pt-16">
        {/* Greeting */}
        <div className="text-center">
          <p className="text-[17px] text-muted-foreground">
            {greeting()}, {userName} <span aria-hidden>👋</span>
          </p>
          <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight text-[#030816]">
            Chúng ta cùng{" "}
            <span className="text-[#5644DE]">bắt đầu từ đâu nhỉ?</span>
          </h1>
        </div>

        {/* Hero composer */}
        <div className="mt-8 rounded-[20px] border border-border bg-card px-5 pb-3 pt-4 shadow-xs transition-colors focus-within:border-primary/40">
          <textarea
            ref={taRef}
            rows={1}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Soạn giúp nội dung"
            className="block w-full resize-none bg-transparent text-[16px] leading-relaxed text-foreground placeholder:text-muted-foreground/90 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Đính kèm"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <IconPlus size={20} stroke={1.75} />
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[14px] text-foreground/80 transition-colors hover:bg-accent"
              >
                <IconBolt size={18} stroke={1.75} className="text-amber-500" />
                Tự động
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-accent hover:text-foreground"
              >
                <ModelGlyph />
                Mặc định
                <IconChevronDown
                  size={16}
                  stroke={1.75}
                  className="text-muted-foreground"
                />
              </button>
              <button
                type="button"
                aria-label="Ghi âm"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
              >
                <IconMicrophone size={19} stroke={1.75} />
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                aria-label="Gửi"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                  canSend
                    ? "bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)]"
                    : "bg-[#F2F4F8] text-slate-400",
                )}
              >
                <IconArrowUp size={18} stroke={2} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onDraftChange(a.label + ": ")}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[14px] text-foreground/85 transition-colors hover:border-primary/30 hover:bg-accent"
            >
              <a.icon size={17} stroke={1.75} className={a.tint} />
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
