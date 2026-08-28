import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  IconChevronRight,
  IconCopy,
  IconDotsVertical,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  RunStatusBadge,
  TaskStateBadge,
} from "@/components/tasks/TaskStatusBadge";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { DeleteTaskDialog } from "@/components/tasks/DeleteTaskDialog";
import { RunDetailSheet } from "@/components/tasks/RunDetailSheet";
import {
  TIMEZONE_LABEL,
  WEEKDAY_LABELS,
  describeSchedule,
  draftFromTask,
  formatDateTime,
  formatDuration,
  formatRelativeDateTime,
  formatShortDateTime,
  getTask,
  isRunning,
  latestRun,
  nextRunOf,
  removeTask,
  runNow,
  runsOfTask,
  statsOf,
  toggleTask,
  useScheduledTasksStore,
  type RunStatus,
  type ScheduledTask,
  type TaskDraft,
  type TaskRun,
} from "@/lib/scheduled-tasks";

type RunFilter = "all" | RunStatus;
type RangeFilter = "7" | "30" | "90" | "all";

const RUNS_PER_PAGE = 20;

export function TaskDetailPage({ taskId }: { taskId: string }) {
  // Đăng ký với store để trang tự cập nhật khi có thay đổi.
  useScheduledTasksStore();
  const navigate = useNavigate();

  const task = getTask(taskId);

  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState<TaskDraft | null>(null);
  /** null khi đang nhân bản (tạo mới), id khi đang sửa chính tác vụ này. */
  const [formTaskId, setFormTaskId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledTask | null>(null);
  const [openRun, setOpenRun] = useState<TaskRun | null>(null);
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [range, setRange] = useState<RangeFilter>("30");
  const [page, setPage] = useState(1);

  const runs = useMemo(() => (task ? runsOfTask(task.id) : []), [task]);

  const filteredRuns = useMemo(() => {
    const since = new Date();
    if (range !== "all") since.setDate(since.getDate() - Number(range));
    return runs.filter((r) => {
      if (runFilter !== "all" && r.status !== runFilter) return false;
      if (range !== "all" && r.startedAt < since) return false;
      return true;
    });
  }, [runs, runFilter, range]);

  if (!task) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <p className="font-medium">Không tìm thấy tác vụ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tác vụ có thể đã bị xoá.
          </p>
          <Button variant="outline" className="mt-5" asChild>
            <Link to="/tasks">Về danh sách tác vụ</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats = statsOf(task.id);
  const last = latestRun(task.id);
  const next = nextRunOf(task);
  const running = isRunning(task.id);
  const paused = task.state === "paused";

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / RUNS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visibleRuns = filteredRuns.slice(
    (currentPage - 1) * RUNS_PER_PAGE,
    currentPage * RUNS_PER_PAGE,
  );

  const handleRunNow = () => {
    const run = runNow(task.id);
    if (!run) {
      toast.error("Tác vụ đang chạy. Vui lòng đợi lần chạy hiện tại kết thúc.");
      return;
    }
    toast(`Đang chạy ${task.name}…`);
  };

  const handleToggle = (nextState: boolean) => {
    const updated = toggleTask(task.id, nextState);
    if (!updated) return;
    if (nextState) {
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
        action: { label: "Hoàn tác", onClick: () => toggleTask(task.id, true) },
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[1120px] px-6 pb-16 pt-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/tasks" className="hover:text-foreground hover:underline">
            Tác vụ định kỳ
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-foreground">{task.name}</span>
        </nav>

        {/* Header */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {task.name}
              </h1>
              {running ? (
                <RunStatusBadge status="running" />
              ) : (
                <TaskStateBadge state={task.state} />
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {describeSchedule(task)} · gửi tới {task.destination}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleRunNow} disabled={running}
              title={running ? "Tác vụ đang chạy. Vui lòng đợi lần chạy hiện tại kết thúc." : undefined}
            >
              <IconPlayerPlay size={20} stroke={1.75} />
              Chạy ngay
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFormDraft(draftFromTask(task));
                setFormTaskId(task.id);
                setFormOpen(true);
              }}
            >
              <IconPencil size={20} stroke={1.75} />
              Sửa
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Hành động khác">
                  <IconDotsVertical size={16} stroke={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => handleToggle(paused)}>
                  {paused ? (
                    <IconPlayerPlay size={16} stroke={1.75} />
                  ) : (
                    <IconPlayerPause size={16} stroke={1.75} />
                  )}
                  {paused ? "Tiếp tục" : "Tạm dừng"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setFormDraft({
                      ...draftFromTask(task),
                      name: `${task.name} (bản sao)`,
                    });
                    setFormTaskId(null);
                    setFormOpen(true);
                  }}
                >
                  <IconCopy size={16} stroke={1.75} />
                  Nhân bản
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setPendingDelete(task)}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash size={16} stroke={1.75} />
                  Xoá
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Lần chạy kế tiếp">
            {next ? (
              <span className="tabular-nums">{formatRelativeDateTime(next)}</span>
            ) : (
              <>
                <span>—</span>
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  Đang tạm dừng
                </span>
              </>
            )}
          </StatCard>

          <StatCard label="Chạy gần nhất">
            {last ? (
              <div className="flex flex-col items-start gap-1">
                <RunStatusBadge status={last.status} />
                <span className="text-sm font-normal tabular-nums text-muted-foreground">
                  {formatShortDateTime(last.startedAt)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </StatCard>

          <StatCard label="Tỷ lệ thành công (30 ngày)">
            {stats.successRate === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <>
                <span
                  className={cn(
                    "tabular-nums",
                    stats.successRate < 80 && "text-destructive",
                  )}
                >
                  {stats.successRate}%
                </span>
                <span className="mt-1 block text-sm font-normal tabular-nums text-muted-foreground">
                  {stats.successCount}/{stats.totalIn30Days} lần
                </span>
              </>
            )}
          </StatCard>

          <StatCard label="Tổng số lần chạy">
            <span className="tabular-nums">{stats.totalRuns}</span>
          </StatCard>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="runs">Lịch sử chạy</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold">Cấu hình</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <Row label="Agent" value={task.agentName} />
                  <div>
                    <dt className="text-muted-foreground">Nội dung yêu cầu</dt>
                    <dd className="mt-1">
                      <div className="rounded-md bg-muted p-4 leading-relaxed">
                        {task.prompt}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          navigator.clipboard?.writeText(task.prompt);
                          toast.success("Đã sao chép nội dung yêu cầu.");
                        }}
                      >
                        <IconCopy size={16} stroke={1.75} />
                        Sao chép
                      </Button>
                    </dd>
                  </div>
                  <Row
                    label="Chu kỳ"
                    value={task.cadence === "daily" ? "Hằng ngày" : "Hằng tuần"}
                  />
                  {task.cadence === "weekly" && (
                    <Row
                      label="Ngày trong tuần"
                      value={[...task.weekdays]
                        .sort()
                        .map((d) => WEEKDAY_LABELS[d])
                        .join(", ")}
                    />
                  )}
                  <Row label="Giờ chạy" value={task.time} />
                  <Row label="Đích gửi" value={task.destination} />
                  <Row label="Múi giờ" value={TIMEZONE_LABEL} />
                </dl>
              </section>

              <section className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold">Quy tắc vận hành</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <Row
                    label="Tự động thử lại"
                    value={
                      task.advanced.retryEnabled
                        ? `Bật · tối đa ${task.advanced.maxRetries} lần · cách nhau ${task.advanced.retryIntervalMinutes} phút`
                        : "Tắt"
                    }
                    hint="Áp dụng khi một lần chạy thất bại."
                  />
                  <Row
                    label="Chạy bù khi offline"
                    value={
                      task.advanced.catchUpEnabled
                        ? `Bật · cửa sổ ${task.advanced.catchUpWindowHours} giờ`
                        : "Tắt · bỏ qua lần chạy đó"
                    }
                    hint="Xử lý khi hệ thống không hoạt động đúng giờ chạy."
                  />
                  <Row
                    label="Khi lần chạy trước chưa xong"
                    value={
                      task.advanced.overlapPolicy === "skip"
                        ? "Bỏ qua lần chạy mới"
                        : "Xếp hàng chạy sau"
                    }
                    hint="Không bao giờ chạy song song cùng một tác vụ."
                  />
                </dl>
              </section>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Tạo bởi {task.createdBy} lúc {formatDateTime(task.createdAt)} ·
              Cập nhật lần cuối {formatDateTime(task.updatedAt)}
            </p>
          </TabsContent>

          <TabsContent value="runs" className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={runFilter}
                onValueChange={(v) => {
                  setRunFilter(v as RunFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[160px]" aria-label="Lọc trạng thái">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="success">Thành công</SelectItem>
                  <SelectItem value="failed">Thất bại</SelectItem>
                  <SelectItem value="skipped">Bỏ qua</SelectItem>
                  <SelectItem value="running">Đang chạy</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={range}
                onValueChange={(v) => {
                  setRange(v as RangeFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[150px]" aria-label="Khoảng thời gian">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 ngày</SelectItem>
                  <SelectItem value="30">30 ngày</SelectItem>
                  <SelectItem value="90">90 ngày</SelectItem>
                  <SelectItem value="all">Toàn bộ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredRuns.length === 0 ? (
              <div className="mt-4 flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
                <p className="font-medium">Tác vụ này chưa từng chạy</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {next
                    ? `Lần chạy đầu tiên sẽ diễn ra vào ${formatRelativeDateTime(next)}.`
                    : "Bật tác vụ để bắt đầu lịch chạy."}
                </p>
                <Button className="mt-5" onClick={handleRunNow} disabled={running}>
                  <IconPlayerPlay size={20} stroke={1.75} />
                  Chạy ngay
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Thời điểm chạy</TableHead>
                        <TableHead scope="col">Trạng thái</TableHead>
                        <TableHead scope="col" className="hidden sm:table-cell">
                          Thời lượng
                        </TableHead>
                        <TableHead scope="col">Tóm tắt kết quả</TableHead>
                        <TableHead scope="col" className="w-12">
                          <span className="sr-only">Chi tiết</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRuns.map((run) => (
                        <TableRow
                          key={run.id}
                          className={cn(
                            "cursor-pointer",
                            run.status === "running" && "bg-muted/40",
                          )}
                          onClick={() => setOpenRun(run)}
                        >
                          <TableCell className="tabular-nums">
                            <div className="flex flex-wrap items-center gap-2">
                              {formatDateTime(run.startedAt)}
                              {run.trigger === "manual" && (
                                <Badge variant="outline">Thủ công</Badge>
                              )}
                              {run.trigger === "catchup" && (
                                <Badge variant="outline">Chạy bù</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <RunStatusBadge status={run.status} />
                            {run.attempts > 1 && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                đã thử {run.attempts} lần
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden tabular-nums sm:table-cell">
                            {formatDuration(run)}
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            <span className="block truncate text-muted-foreground">
                              {run.status === "failed"
                                ? (run.errorMessage ?? run.summary)
                                : run.status === "skipped"
                                  ? (run.skipReason ?? run.summary)
                                  : run.summary}
                            </span>
                          </TableCell>
                          <TableCell>
                            <IconChevronRight
                              size={16}
                              stroke={1.75}
                              className="text-muted-foreground"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredRuns.length > RUNS_PER_PAGE && (
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      Hiển thị {(currentPage - 1) * RUNS_PER_PAGE + 1}–
                      {Math.min(currentPage * RUNS_PER_PAGE, filteredRuns.length)} /{" "}
                      {filteredRuns.length}
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
          </TabsContent>
        </Tabs>
      </div>

      <TaskFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        taskId={formTaskId}
        initialDraft={formDraft}
      />

      <RunDetailSheet
        run={openRun}
        task={task}
        onOpenChange={(open) => !open && setOpenRun(null)}
        onRunAgain={() => {
          setOpenRun(null);
          handleRunNow();
        }}
      />

      <DeleteTaskDialog
        task={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={(t) => {
          removeTask(t.id);
          setPendingDelete(null);
          toast.success(`Đã xoá ${t.name} và huỷ các lần chạy sắp tới.`);
          navigate({ to: "/tasks" });
        }}
        onPauseInstead={(t) => {
          setPendingDelete(null);
          toggleTask(t.id, false);
          toast(`Đã tạm dừng ${t.name}.`);
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 text-2xl font-semibold">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
