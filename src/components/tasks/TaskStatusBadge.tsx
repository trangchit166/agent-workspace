import {
  IconCircleCheck,
  IconCircleFilled,
  IconCircleMinus,
  IconCircleX,
  IconLoader2,
  IconPlayerPause,
  IconRefresh,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RunStatus, TaskState } from "@/lib/scheduled-tasks";

/**
 * Badge trạng thái dùng chung (§6 của spec).
 * Trạng thái không bao giờ chỉ truyền tải bằng màu — luôn kèm icon và chữ.
 */
export function RunStatusBadge({
  status,
  className,
}: {
  status: RunStatus;
  className?: string;
}) {
  switch (status) {
    case "success":
      return (
        <Badge
          variant="secondary"
          className={cn("gap-1 bg-success/10 text-success", className)}
        >
          <IconCircleCheck size={13} stroke={1.75} />
          Thành công
        </Badge>
      );
    case "retrying":
      return (
        <Badge
          variant="outline"
          className={cn("gap-1 border-warning/40 text-warning", className)}
        >
          <IconRefresh size={13} stroke={1.75} className="animate-spin" />
          Đang thử lại
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className={cn("gap-1", className)}>
          <IconCircleX size={13} stroke={1.75} />
          Thất bại
        </Badge>
      );
    case "skipped":
      return (
        <Badge
          variant="outline"
          className={cn("gap-1 text-muted-foreground", className)}
        >
          <IconCircleMinus size={13} stroke={1.75} />
          Bỏ qua
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="outline" className={cn("gap-1", className)}>
          <IconCircleMinus size={13} stroke={1.75} />
          Xếp hàng
        </Badge>
      );
    case "running":
    default:
      return (
        <Badge variant="secondary" className={cn("gap-1", className)}>
          <IconLoader2 size={13} stroke={1.75} className="animate-spin" />
          Đang chạy
        </Badge>
      );
  }
}

export function TaskStateBadge({
  state,
  className,
}: {
  state: TaskState;
  className?: string;
}) {
  if (state === "paused") {
    return (
      <Badge
        variant="outline"
        className={cn("gap-1 text-muted-foreground", className)}
      >
        <IconPlayerPause size={13} stroke={1.75} />
        Đã tắt
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <IconCircleFilled size={9} className="text-success" />
      Đang bật
    </Badge>
  );
}

/** Dòng "— Chưa chạy" cho tác vụ chưa từng chạy. */
export function NeverRun({ className }: { className?: string }) {
  return (
    <span className={cn("text-sm text-muted-foreground", className)}>
      — Chưa chạy
    </span>
  );
}
