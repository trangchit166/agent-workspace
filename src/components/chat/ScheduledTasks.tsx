import { useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconClockPlay,
  IconDotsVertical,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRepeat,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  SCHEDULED_TASKS,
  type RunStatus,
  type ScheduledTask,
} from "@/lib/scheduled-tasks-mock";

type Filter = "all" | "active" | "paused";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang chạy" },
  { key: "paused", label: "Tạm dừng" },
];

function RunBadge({ status }: { status: RunStatus }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11.5px] font-medium text-primary">
        <IconLoader2 size={12} stroke={2} className="animate-spin" />
        Đang chạy
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11.5px] font-medium text-destructive">
        <IconAlertCircle size={12} stroke={2} />
        Lỗi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11.5px] font-medium text-success">
      <IconCircleCheck size={12} stroke={2} />
      Thành công
    </span>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: ScheduledTask;
  onToggle: (id: string) => void;
}) {
  const paused = task.state === "paused";

  return (
    <li
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-primary/30",
        paused && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            paused
              ? "bg-secondary text-muted-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          <IconRepeat size={19} stroke={1.75} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">
              {task.name}
            </span>
            {paused ? (
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-medium text-secondary-foreground">
                Tạm dừng
              </span>
            ) : (
              <RunBadge status={task.lastStatus} />
            )}
          </div>

          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {task.description}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconClockPlay size={14} stroke={1.75} />
              {task.schedule}
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground">
                {task.cron}
              </code>
            </span>
            <span>
              Lần tới: <span className="text-foreground/80">{task.nextRun}</span>
            </span>
            <span>
              Lần gần nhất:{" "}
              <span className="text-foreground/80">{task.lastRun}</span>
            </span>
            <span className="text-primary/80">{task.agent}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggle(task.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12.5px] font-medium text-foreground/80 transition-colors hover:bg-accent"
          >
            {paused ? (
              <>
                <IconPlayerPlay size={14} stroke={1.75} />
                Bật lại
              </>
            ) : (
              <>
                <IconPlayerPause size={14} stroke={1.75} />
                Tạm dừng
              </>
            )}
          </button>
          <button
            type="button"
            aria-label="Tuỳ chọn khác"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconDotsVertical size={16} stroke={1.75} />
          </button>
        </div>
      </div>
    </li>
  );
}

export function ScheduledTasks() {
  const [filter, setFilter] = useState<Filter>("all");
  const [paused, setPaused] = useState<Record<string, boolean>>({});

  const tasks = useMemo<ScheduledTask[]>(
    () =>
      SCHEDULED_TASKS.map((t) => {
        const isPaused = paused[t.id] ?? t.state === "paused";
        return { ...t, state: isPaused ? "paused" : "active" };
      }),
    [paused],
  );

  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.state === filter)),
    [filter, tasks],
  );

  const activeCount = tasks.filter((t) => t.state === "active").length;

  const toggle = (id: string) =>
    setPaused((prev) => {
      const base = SCHEDULED_TASKS.find((t) => t.id === id)?.state === "paused";
      return { ...prev, [id]: !(prev[id] ?? base) };
    });

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[900px] px-6 pb-16 pt-10">
        {/* Tiêu đề */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
              Tác vụ định kỳ
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Các tác vụ được Agent chạy tự động theo lịch. Hiện có{" "}
              {activeCount} tác vụ đang hoạt động.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[13.5px] font-medium text-primary-foreground shadow-xs transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <IconPlus size={16} stroke={2} />
            Tạo tác vụ
          </button>
        </div>

        {/* Bộ lọc */}
        <div className="mt-5 flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                filter === f.key
                  ? "bg-[#EFF1FC] text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Danh sách */}
        {visible.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-14 text-center">
            <IconClockPlay
              size={26}
              stroke={1.5}
              className="mx-auto text-muted-foreground"
            />
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              Chưa có tác vụ nào trong mục này.
            </p>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {visible.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
