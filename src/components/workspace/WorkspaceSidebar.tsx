import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  IconBell,
  IconBuildingStore,
  IconClockPlay,
  IconEdit,
  IconFolder,
  IconLayoutGrid,
  IconLayoutSidebar,
  IconPackage,
  IconPlugConnected,
  IconSearch,
  IconSelector,
  IconStack2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/hr-onboarding-mock";
import { loadState, saveState } from "@/lib/persistence";
import { useScheduledTasksStore } from "@/lib/scheduled-tasks";

export const USER_NAME = "Trang Nguyen Huyen";
export const USER_SUBTITLE = "Trang Nguyen Huyen Workspace";

/** Mục điều hướng đang được chọn ở sidebar. */
export type WorkspaceNav = "chat" | "tasks";

const COLLAPSE_KEY = "uaw:sidebar-collapsed";

/** Trạng thái thu gọn sidebar, dùng chung cho mọi màn hình. */
export function useSidebarCollapsed() {
  // Bắt đầu ở false khi SSR để không lệch hydrate, rồi đọc tuỳ chọn đã lưu.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  return { collapsed, toggle };
}

export function WorkspaceSidebar({
  conversations,
  activeId,
  nav,
  search,
  onSearch,
  onSelect,
  onNewChat,
  collapsed,
  onToggle,
}: {
  conversations: Conversation[];
  activeId: string | null;
  nav: WorkspaceNav;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const { tasks } = useScheduledTasksStore();
  const activeTaskCount = tasks.filter((t) => t.state === "active").length;

  const secondary = [
    { key: "projects", label: "Dự án", icon: IconFolder },
    { key: "market", label: "Chợ Agent", icon: IconBuildingStore },
    { key: "artifacts", label: "Artifacts", icon: IconPackage },
    {
      key: "tasks",
      label: "Tác vụ định kỳ",
      icon: IconClockPlay,
      badge: activeTaskCount,
      active: nav === "tasks",
      onClick: () => navigate({ to: "/tasks" }),
    },
    { key: "connections", label: "Kết nối", icon: IconPlugConnected },
    { key: "mcp", label: "Xác thực MCP", icon: IconStack2 },
    { key: "console", label: "Xây trong Console", icon: IconLayoutGrid },
  ];

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
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
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-[9px] font-bold text-sidebar-primary-foreground">
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
            className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <IconSearch size={18} stroke={1.75} />
          </button>
          <button
            type="button"
            aria-label={collapsed ? "Hiện thanh bên" : "Ẩn thanh bên"}
            title={`${collapsed ? "Hiện" : "Ẩn"} thanh bên (Ctrl+B)`}
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <IconLayoutSidebar size={18} stroke={1.75} />
          </button>
        </div>
      </div>

      {/* Điều hướng — mọi mục dùng chung một kiểu (SidebarItem) */}
      <nav className={cn("pt-1", collapsed ? "px-1.5" : "px-3")}>
        <SidebarItem
          label="Trò chuyện mới"
          icon={IconEdit}
          active={nav === "chat" && !activeId}
          onClick={onNewChat}
          collapsed={collapsed}
        />
        {secondary.map(({ key, ...item }) => (
          <SidebarItem key={key} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Inline search */}
      {!collapsed && searchOpen && (
        <div className="px-3 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-md border border-sidebar-border bg-background px-3 focus-within:border-sidebar-ring focus-within:ring-[3px] focus-within:ring-sidebar-ring/50">
            <IconSearch size={14} className="text-muted-foreground" stroke={2} />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Tìm hội thoại"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:outline-none"
            />
          </label>
        </div>
      )}

      {!collapsed ? (
        <nav className="mt-5 flex-1 overflow-y-auto px-3 pb-3">
          {conversations.length > 0 && (
            <>
              <div className="px-3 pb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
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
                          "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
                          isActive
                            ? "bg-sidebar-primary/10 font-medium text-sidebar-primary"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground"
              title={USER_NAME}
            >
              TH
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg px-1 py-2 hover:bg-sidebar-accent">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[11.5px] font-semibold text-sidebar-primary-foreground">
              TH
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight text-sidebar-foreground">
                {USER_NAME}
              </div>
              <div className="truncate text-[11.5px] text-sidebar-foreground/60">
                {USER_SUBTITLE}
              </div>
            </div>
            <button
              type="button"
              aria-label="Đổi tài khoản"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <IconSelector size={15} stroke={1.75} />
            </button>
            <button
              type="button"
              aria-label="Thông báo"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
  badge,
  active,
  onClick,
  collapsed,
}: {
  label: string;
  icon: typeof IconSearch;
  shortcut?: string[];
  badge?: number;
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
        "group flex w-full items-center rounded-lg text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
        collapsed ? "h-10 justify-center px-0" : "h-10 gap-3 px-3",
        active
          ? "bg-sidebar-primary/10 font-medium text-sidebar-primary hover:bg-sidebar-primary/15"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        size={19}
        stroke={1.75}
        className={cn(
          "shrink-0",
          active ? "text-sidebar-primary" : "text-sidebar-foreground/60",
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {typeof badge === "number" && badge > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[11px] font-semibold tabular-nums text-sidebar-primary-foreground">
              {badge}
            </span>
          )}
          {shortcut && (
            <span className="flex items-center gap-0.5">
              {shortcut.map((k) => (
                <kbd
                  key={k}
                  className="flex h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-sidebar-border bg-background px-1 text-[10px] font-medium text-sidebar-foreground/60"
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

/**
 * Khung workspace cho các trang ngoài màn chat (ví dụ Tác vụ định kỳ).
 * Sidebar đọc danh sách hội thoại từ bộ nhớ đã lưu; chọn một hội thoại sẽ ghi
 * lại activeId rồi điều hướng về màn chat.
 */
export function WorkspaceShell({
  nav,
  children,
}: {
  nav: WorkspaceNav;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebarCollapsed();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const state = loadState();
    if (state) setConversations(state.conversations);
  }, []);

  const openConversation = (id: string | null) => {
    const state = loadState();
    if (state) saveState({ ...state, activeId: id });
    navigate({ to: "/" });
  };

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q))
      : conversations;
    return [...list].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  })();

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <WorkspaceSidebar
        conversations={filtered}
        activeId={null}
        nav={nav}
        search={search}
        onSearch={setSearch}
        onSelect={openConversation}
        onNewChat={() => openConversation(null)}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
