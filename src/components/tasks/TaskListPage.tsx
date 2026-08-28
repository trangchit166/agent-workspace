import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconClockPlay,
  IconCopy,
  IconDotsVertical,
  IconEye,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconSearchOff,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  TIMEZONE_LABEL,
  describeSchedule,
  draftFromTask,
  formatRelativeDateTime,
  formatShortDateTime,
  isRunning,
  latestRun,
  nextRunOf,
  removeTask,
  runNow,
  toggleTask,
  useScheduledTasksStore,
  weekdaysFull,
  type ScheduledTask,
  type TaskDraft,
} from "@/lib/scheduled-tasks";
import { NeverRun, RunStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { DeleteTaskDialog } from "@/components/tasks/DeleteTaskDialog";

type StateFilter = "all" | "active" | "paused";
type CadenceFilter = "all" | "daily" | "weekly";
type ResultFilter = "all" | "success" | "failed" | "never";
type SortKey = "next" | "name" | "created" | "result";

const PAGE_SIZE = 10;

const SORT_LABELS: Record<SortKey, string> = {
  next: "Lần chạy kế tiếp",
  name: "Tên A→Z",
  created: "Mới tạo nhất",
  result: "Kết quả gần nhất",
};

export function TaskListPage() {
  const { tasks } = useScheduledTasksStore();

  // Bộ lọc giữ trong session để quay lại tab vẫn còn nguyên (§1).
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [sort, setSort] = useState<SortKey>("next");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState<TaskDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledTask | null>(null);

  // Skeleton ngắn thay cho vòng quay toàn trang (§2.7c).
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debounced, stateFilter, cadenceFilter, resultFilter, sort]);

  const failing = useMemo(
    () => tasks.filter((t) => latestRun(t.id)?.status === "failed"),
    [tasks],
  );

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    const list = tasks.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (stateFilter !== "all" && t.state !== stateFilter) return false;
      if (cadenceFilter !== "all" && t.cadence !== cadenceFilter) return false;
      if (resultFilter !== "all") {
        const last = latestRun(t.id);
        if (resultFilter === "never" && last) return false;
        if (resultFilter !== "never" && last?.status !== resultFilter) return false;
      }
      return true;
    });

    const byNext = (t: ScheduledTask) =>
      nextRunOf(t)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name, "vi");
        case "created":
          return b.createdAt.getTime() - a.createdAt.getTime();
        case "result": {
          const rank = (t: ScheduledTask) => {
            const s = latestRun(t.id)?.status;
            if (s === "failed") return 0;
            if (s === "running") return 1;
            if (s === "success") return 2;
            return 3;
          };
          return rank(a) - rank(b);
        }
        case "next":
        default:
          return byNext(a) - byNext(b);
      }
    });
  }, [tasks, debounced, stateFilter, cadenceFilter, resultFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const activeFilters = [
    stateFilter !== "all" && {
      key: "state",
      label: stateFilter === "active" ? "Đang bật" : "Đã tắt",
      clear: () => setStateFilter("all"),
    },
    cadenceFilter !== "all" && {
      key: "cadence",
      label: cadenceFilter === "daily" ? "Hằng ngày" : "Hằng tuần",
      clear: () => setCadenceFilter("all"),
    },
    resultFilter !== "all" && {
      key: "result",
      label:
        resultFilter === "success"
          ? "Thành công"
          : resultFilter === "failed"
            ? "Thất bại"
            : "Chưa chạy",
      clear: () => setResultFilter("all"),
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const clearAllFilters = () => {
    setStateFilter("all");
    setCadenceFilter("all");
    setResultFilter("all");
    setQuery("");
  };

  const openCreate = (draft?: TaskDraft) => {
    setEditingId(null);
    setFormDraft(draft ?? null);
    setFormOpen(true);
  };

  const openEdit = (task: ScheduledTask) => {
    setEditingId(task.id);
    setFormDraft(draftFromTask(task));
    setFormOpen(true);
  };

  const handleToggle = (task: ScheduledTask, next: boolean) => {
    const updated = toggleTask(task.id, next);
    if (!updated) {
      toast.error("Không cập nhật được trạng thái. Vui lòng thử lại.");
      return;
    }
    if (next) {
      const when = nextRunOf(updated);
      toast.success(
        `Đã bật ${updated.name}.`,
        when
          ? { description: `Lần chạy kế tiếp: ${formatRelativeDateTime(when)}.` }
          : undefined,
      );
    } else {
      toast(`Đã tạm dừng ${updated.name}.`, {
        description: "Tác vụ sẽ không tự chạy cho tới khi bạn bật lại.",
        action: {
          label: "Hoàn tác",
          onClick: () => toggleTask(task.id, true),
        },
      });
    }
  };

  const handleRunNow = (task: ScheduledTask) => {
    const run = runNow(task.id);
    if (!run) {
      toast.error("Tác vụ đang chạy. Vui lòng đợi lần chạy hiện tại kết thúc.");
      return;
    }
    toast(`Đang chạy ${task.name}…`);
  };

  const handleDelete = (task: ScheduledTask) => {
    removeTask(task.id);
    setPendingDelete(null);
    toast.success(`Đã xoá ${task.name} và huỷ các lần chạy sắp tới.`);
  };

  const hasNoTasks = tasks.length === 0;
  const hasNoMatches = !hasNoTasks && filtered.length === 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[1120px] px-6 pb-16 pt-8">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Tác vụ định kỳ
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Để Agent tự chạy công việc lặp lại và gửi kết quả cho bạn đúng hạn.
              </p>
            </div>
            <Button onClick={() => openCreate()}>
              <IconPlus size={20} stroke={1.75} />
              Tạo tác vụ
            </Button>
          </div>

          {/* Banner cảnh báo — chỉ khi có tác vụ thất bại vĩnh viễn (EC-1) */}
          {failing.length > 0 && !bannerDismissed && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
            >
              <IconAlertTriangle
                size={20}
                stroke={1.75}
                className="mt-0.5 shrink-0 text-destructive"
              />
              <p className="flex-1 text-sm text-foreground">
                {failing.length} tác vụ đã thất bại ở lần chạy gần nhất.{" "}
                <button
                  type="button"
                  onClick={() => setResultFilter("failed")}
                  className="font-medium text-destructive underline underline-offset-4"
                >
                  Xem
                </button>
              </p>
              <button
                type="button"
                aria-label="Đóng cảnh báo"
                onClick={() => setBannerDismissed(true)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <IconX size={16} stroke={1.75} />
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <IconSearch
                size={16}
                stroke={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên tác vụ…"
                aria-label="Tìm theo tên tác vụ"
                className="h-9 pl-9 pr-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Xoá từ khoá"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <IconX size={14} stroke={1.75} />
                </button>
              )}
            </div>

            <Select
              value={stateFilter}
              onValueChange={(v) => setStateFilter(v as StateFilter)}
            >
              <SelectTrigger className="h-9 w-[170px]" aria-label="Lọc trạng thái">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Đang bật</SelectItem>
                <SelectItem value="paused">Đã tắt</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={cadenceFilter}
              onValueChange={(v) => setCadenceFilter(v as CadenceFilter)}
            >
              <SelectTrigger className="h-9 w-[160px]" aria-label="Lọc chu kỳ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chu kỳ</SelectItem>
                <SelectItem value="daily">Hằng ngày</SelectItem>
                <SelectItem value="weekly">Hằng tuần</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={resultFilter}
              onValueChange={(v) => setResultFilter(v as ResultFilter)}
            >
              <SelectTrigger
                className="h-9 w-[160px]"
                aria-label="Lọc kết quả gần nhất"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi kết quả</SelectItem>
                <SelectItem value="success">Thành công</SelectItem>
                <SelectItem value="failed">Thất bại</SelectItem>
                <SelectItem value="never">Chưa chạy</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="ml-auto h-9 w-[190px]" aria-label="Sắp xếp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chip bộ lọc đang áp */}
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <Badge key={f.key} variant="secondary" className="gap-1 pr-1">
                  {f.label}
                  <button
                    type="button"
                    aria-label={`Bỏ lọc ${f.label}`}
                    onClick={f.clear}
                    className="rounded-sm p-0.5 hover:bg-background/60"
                  >
                    <IconX size={12} stroke={2} />
                  </button>
                </Badge>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Xoá tất cả bộ lọc
              </button>
            </div>
          )}

          {/* Nội dung */}
          {loading ? (
            <TableSkeleton />
          ) : hasNoTasks ? (
            <EmptyState onCreate={openCreate} />
          ) : hasNoMatches ? (
            <EmptySearch onClear={clearAllFilters} />
          ) : (
            <>
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className="w-16">
                        <span className="sr-only">Bật/Tắt</span>
                      </TableHead>
                      <TableHead scope="col">Tên tác vụ</TableHead>
                      <TableHead scope="col" className="hidden lg:table-cell">
                        Lịch chạy
                      </TableHead>
                      <TableHead scope="col">Lần chạy kế tiếp</TableHead>
                      <TableHead scope="col" className="hidden md:table-cell">
                        Kết quả gần nhất
                      </TableHead>
                      <TableHead scope="col" className="w-12">
                        <span className="sr-only">Hành động</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={handleToggle}
                        onEdit={openEdit}
                        onRunNow={handleRunNow}
                        onDuplicate={(t) =>
                          openCreate({
                            ...draftFromTask(t),
                            name: `${t.name} (bản sao)`,
                          })
                        }
                        onDelete={setPendingDelete}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filtered.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} /{" "}
                    {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      Trước
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Button
                        key={p}
                        variant={p === currentPage ? "secondary" : "ghost"}
                        size="sm"
                        aria-current={p === currentPage ? "page" : undefined}
                        onClick={() => setPage(p)}
                        className="tabular-nums"
                      >
                        {p}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <TaskFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        taskId={editingId}
        initialDraft={formDraft}
      />

      <DeleteTaskDialog
        task={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        onPauseInstead={(task) => {
          setPendingDelete(null);
          handleToggle(task, false);
        }}
      />
    </TooltipProvider>
  );
}

/* ---------- Một hàng trong bảng ---------------------------------------- */

function TaskRow({
  task,
  onToggle,
  onEdit,
  onRunNow,
  onDuplicate,
  onDelete,
}: {
  task: ScheduledTask;
  onToggle: (task: ScheduledTask, next: boolean) => void;
  onEdit: (task: ScheduledTask) => void;
  onRunNow: (task: ScheduledTask) => void;
  onDuplicate: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
}) {
  const last = latestRun(task.id);
  const next = nextRunOf(task);
  const paused = task.state === "paused";
  const running = isRunning(task.id);
  const scheduleText = describeSchedule(task);
  const scheduleTooltip =
    task.cadence === "weekly" && task.weekdays.length >= 4
      ? weekdaysFull(task.weekdays)
      : null;

  return (
    <TableRow className={cn(paused && "opacity-60")}>
      <TableCell>
        <Switch
          checked={!paused}
          onCheckedChange={(v) => onToggle(task, v)}
          aria-label={`Bật tác vụ ${task.name}`}
        />
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Link
            to="/tasks/$taskId"
            params={{ taskId: task.id }}
            title={task.name}
            className="max-w-[280px] truncate font-medium hover:underline"
          >
            {task.name}
          </Link>
          {paused && (
            <Badge variant="outline" className="text-muted-foreground">
              Đã tắt
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          → {task.destination}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground lg:hidden">
          {scheduleText}
        </div>
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        {scheduleTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dashed border-border">
                {scheduleText}
              </span>
            </TooltipTrigger>
            <TooltipContent>{scheduleTooltip}</TooltipContent>
          </Tooltip>
        ) : (
          scheduleText
        )}
      </TableCell>

      <TableCell className="tabular-nums">
        {running ? (
          <RunStatusBadge status="running" />
        ) : paused || !next ? (
          <span className="text-muted-foreground">— Đang tạm dừng</span>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{formatRelativeDateTime(next)}</span>
            </TooltipTrigger>
            <TooltipContent>Theo giờ {TIMEZONE_LABEL}</TooltipContent>
          </Tooltip>
        )}
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {last ? (
          <div className="flex flex-col items-start gap-1">
            <Link to="/tasks/$taskId" params={{ taskId: task.id }}>
              <RunStatusBadge status={last.status} />
            </Link>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatShortDateTime(last.startedAt)}
            </span>
            {last.status === "failed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRunNow(task)}
                disabled={running}
              >
                Thử lại
              </Button>
            )}
          </div>
        ) : (
          <NeverRun />
        )}
      </TableCell>

      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Hành động cho ${task.name}`}>
              <IconDotsVertical size={16} stroke={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link to="/tasks/$taskId" params={{ taskId: task.id }}>
                <IconEye size={16} stroke={1.75} />
                Xem chi tiết
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(task)}>
              <IconPencil size={16} stroke={1.75} />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={running}
              onSelect={() => onRunNow(task)}
              title={running ? "Tác vụ đang chạy" : undefined}
            >
              <IconPlayerPlay size={16} stroke={1.75} />
              Chạy ngay
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggle(task, paused)}>
              {paused ? (
                <IconPlayerPlay size={16} stroke={1.75} />
              ) : (
                <IconPlayerPause size={16} stroke={1.75} />
              )}
              {paused ? "Tiếp tục" : "Tạm dừng"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate(task)}>
              <IconCopy size={16} stroke={1.75} />
              Nhân bản
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete(task)}
              className="text-destructive focus:text-destructive"
            >
              <IconTrash size={16} stroke={1.75} />
              Xoá
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/* ---------- Trạng thái màn hình ---------------------------------------- */

function TableSkeleton() {
  return (
    <div className="mt-4 rounded-lg border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b p-4 last:border-b-0"
        >
          <Skeleton className="h-5 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: (draft?: TaskDraft) => void }) {
  return (
    <div className="mt-4 flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <IconClockPlay size={24} stroke={1.75} className="text-muted-foreground" />
      </span>
      <p className="mt-4 font-medium">Chưa có tác vụ định kỳ nào</p>
      <p className="mt-1 max-w-[420px] text-sm text-muted-foreground">
        Tạo một tác vụ để Agent tự chạy công việc lặp lại — ví dụ tổng hợp tiến
        độ dự án mỗi sáng — và gửi kết quả cho bạn đúng hạn.
      </p>
      <Button className="mt-5" onClick={() => onCreate()}>
        <IconPlus size={20} stroke={1.75} />
        Tạo tác vụ đầu tiên
      </Button>
    </div>
  );
}

function EmptySearch({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-4 flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <IconSearchOff size={24} stroke={1.75} className="text-muted-foreground" />
      </span>
      <p className="mt-4 font-medium">Không tìm thấy tác vụ nào</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Thử từ khoá khác hoặc xoá bớt bộ lọc.
      </p>
      <Button variant="outline" className="mt-5" onClick={onClear}>
        Xoá bộ lọc
      </Button>
    </div>
  );
}

/** Dùng khi tải danh sách thất bại (§2.7d). */
export function TaskListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
      <IconAlertCircle size={24} stroke={1.75} className="text-muted-foreground" />
      <p className="mt-3 font-medium">Không tải được danh sách tác vụ</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Vui lòng thử lại sau ít phút.
      </p>
      <Button variant="outline" className="mt-5" onClick={onRetry}>
        Tải lại
      </Button>
    </div>
  );
}
