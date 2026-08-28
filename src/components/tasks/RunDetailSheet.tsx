import { useState } from "react";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCopy,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/tasks/TaskStatusBadge";
import {
  formatDateTime,
  formatDuration,
  type ScheduledTask,
  type TaskRun,
} from "@/lib/scheduled-tasks";

const PREVIEW_LIMIT = 1000;

const TRIGGER_LABEL: Record<TaskRun["trigger"], string> = {
  scheduled: "Theo lịch",
  manual: "Thủ công",
  catchup: "Chạy bù",
};

/** Chi tiết một lần chạy (§4.6, EC-3, EC-4). */
export function RunDetailSheet({
  run,
  task,
  onOpenChange,
  onRunAgain,
}: {
  run: TaskRun | null;
  task: ScheduledTask | null;
  onOpenChange: (open: boolean) => void;
  onRunAgain: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const output = run?.output ?? "";
  const isTruncated = !expanded && output.length > PREVIEW_LIMIT;
  const shown = isTruncated ? output.slice(0, PREVIEW_LIMIT) : output;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success("Đã sao chép nội dung.");
  };

  return (
    <Sheet open={!!run} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
        {run && (
          <>
            <SheetHeader className="border-b p-6">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">
                  Lần chạy {formatDateTime(run.startedAt)}
                </span>
                <RunStatusBadge status={run.status} />
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {/* Meta */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Meta label="Bắt đầu" value={formatDateTime(run.startedAt)} />
                <Meta
                  label="Kết thúc"
                  value={run.finishedAt ? formatDateTime(run.finishedAt) : "—"}
                />
                <Meta label="Thời lượng" value={formatDuration(run)} />
                <Meta label="Số lần thử" value={String(run.attempts)} />
                <Meta label="Đích gửi" value={task?.destination ?? "—"} />
                <Meta label="Kiểu kích hoạt" value={TRIGGER_LABEL[run.trigger]} />
              </dl>

              {run.trigger === "catchup" && run.scheduledFor && (
                <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Lịch gốc: {formatDateTime(run.scheduledFor)} · Thực chạy:{" "}
                  {formatDateTime(run.startedAt)}
                </p>
              )}

              {run.skipReason && (
                <p className="rounded-lg border bg-muted/40 p-3 text-sm">
                  Lý do bỏ qua: {run.skipReason}
                </p>
              )}

              {/* Thất bại */}
              {run.status === "failed" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">
                    {run.errorMessage ?? "Lần chạy thất bại."}
                  </p>
                  <Accordion type="single" collapsible className="mt-2">
                    <AccordionItem value="tech" className="border-b-0">
                      <AccordionTrigger className="py-2 text-xs">
                        Chi tiết kỹ thuật
                      </AccordionTrigger>
                      <AccordionContent>
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                          <Meta label="Mã lỗi" value={run.errorCode ?? "—"} />
                          <Meta
                            label="Thời điểm"
                            value={formatDateTime(run.startedAt)}
                          />
                          <Meta
                            label="Số lần đã thử"
                            value={String(run.attempts)}
                          />
                        </dl>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <Button className="mt-3" size="sm" onClick={onRunAgain}>
                    <IconPlayerPlay size={16} stroke={1.75} />
                    Chạy lại ngay
                  </Button>
                </div>
              )}

              {/* Cảnh báo thiếu nguồn — EC-4 */}
              {!!run.missingSourceCount && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                  <IconAlertTriangle
                    size={16}
                    stroke={1.75}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    {run.missingSourceCount} mục không có dữ liệu nguồn. Nội
                    dung của các mục này được để trống thay vì suy diễn.
                  </span>
                </div>
              )}

              {/* Nội dung kết quả */}
              {output && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Nội dung kết quả</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(output)}
                      >
                        <IconCopy size={16} stroke={1.75} />
                        Sao chép
                      </Button>
                      <Button variant="ghost" size="sm">
                        Mở trong hội thoại
                        <IconArrowRight size={16} stroke={1.75} />
                      </Button>
                    </div>
                  </div>

                  {/* EC-3: luôn báo rõ khi bị rút gọn, không cắt cụt âm thầm */}
                  {isTruncated && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        Đã rút gọn — nội dung đầy đủ gồm{" "}
                        {run.truncatedParts ?? 2} phần
                      </Badge>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setExpanded(true)}
                      >
                        Xem toàn bộ
                      </Button>
                    </div>
                  )}

                  <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
                    {shown}
                    {isTruncated && "…"}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular-nums">{value}</dd>
    </div>
  );
}
