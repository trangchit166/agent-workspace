import { useEffect, useMemo, useRef, useState } from "react";
import { IconClock, IconInfoCircle } from "@tabler/icons-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AGENTS,
  DESTINATIONS,
  PROMPT_TEMPLATES,
  TIMEZONE_LABEL,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  createTask,
  describeScheduleLong,
  emptyDraft,
  formatCountdown,
  formatDateTime,
  formatRelativeDateTime,
  formatShortDateTime,
  getTask,
  isNameTaken,
  isRunning,
  nextRuns,
  parseTime,
  updateTask,
  type Cadence,
  type TaskDraft,
  type Weekday,
} from "@/lib/scheduled-tasks";

type FieldKey = "name" | "agentId" | "prompt" | "weekdays" | "time" | "destination";
type Errors = Partial<Record<FieldKey, string>>;

const PROMPT_MAX = 2000;
const NAME_MAX = 80;

export function TaskFormSheet({
  open,
  onOpenChange,
  taskId,
  initialDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = tạo mới; có giá trị = chỉnh sửa tác vụ đó. */
  taskId: string | null;
  /** Giá trị điền sẵn (chỉnh sửa hoặc nhân bản). */
  initialDraft: TaskDraft | null;
}) {
  const isEdit = !!taskId;
  const task = taskId ? getTask(taskId) : null;

  const [draft, setDraft] = useState<TaskDraft>(() => initialDraft ?? emptyDraft());
  const [baseline, setBaseline] = useState<TaskDraft>(draft);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const weekdaysRef = useRef<HTMLDivElement>(null);

  // Nạp lại giá trị mỗi khi mở drawer.
  useEffect(() => {
    if (!open) return;
    const next = initialDraft ?? emptyDraft();
    setDraft(next);
    setBaseline(next);
    setErrors({});
    setTouched({});
    setServerError(null);
  }, [open, initialDraft]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  const patch = (part: Partial<TaskDraft>) =>
    setDraft((d) => ({ ...d, ...part }));

  const validateField = (key: FieldKey, value: TaskDraft): string | undefined => {
    switch (key) {
      case "name": {
        const name = value.name.trim();
        if (!name) return "Vui lòng nhập tên tác vụ.";
        if (name.length < 3) return "Tên tác vụ tối thiểu 3 ký tự.";
        if (name.length > NAME_MAX) return `Tên tác vụ tối đa ${NAME_MAX} ký tự.`;
        if (isNameTaken(name, taskId ?? undefined))
          return "Tên tác vụ này đã tồn tại. Hãy chọn tên khác.";
        return undefined;
      }
      case "agentId":
        return value.agentId ? undefined : "Vui lòng chọn Agent.";
      case "prompt": {
        const prompt = value.prompt.trim();
        if (!prompt)
          return "Vui lòng mô tả nội dung bạn muốn Agent thực hiện.";
        if (prompt.length < 10)
          return "Mô tả quá ngắn, hãy nêu rõ hơn nội dung cần tổng hợp.";
        if (prompt.length > PROMPT_MAX)
          return `Nội dung tối đa ${PROMPT_MAX} ký tự.`;
        return undefined;
      }
      case "weekdays":
        if (value.cadence === "weekly" && value.weekdays.length === 0)
          return "Chọn ít nhất một ngày trong tuần.";
        return undefined;
      case "time":
        return parseTime(value.time)
          ? undefined
          : "Giờ chạy không hợp lệ. Nhập theo định dạng HH:mm.";
      case "destination":
        return value.destination ? undefined : "Vui lòng chọn nơi nhận kết quả.";
      default:
        return undefined;
    }
  };

  const blur = (key: FieldKey) => {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors((e) => ({ ...e, [key]: validateField(key, draft) }));
  };

  const errorOf = (key: FieldKey) => (touched[key] ? errors[key] : undefined);

  const preview = useMemo(() => nextRuns(draft, 3), [draft]);
  const scheduleValid = preview.length > 0;

  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(false);
  };

  const submit = () => {
    const keys: FieldKey[] = [
      "name",
      "agentId",
      "prompt",
      "weekdays",
      "time",
      "destination",
    ];
    const next: Errors = {};
    for (const k of keys) next[k] = validateField(k, draft);
    setErrors(next);
    setTouched(Object.fromEntries(keys.map((k) => [k, true])));

    const firstBad = keys.find((k) => next[k]);
    if (firstBad) {
      const target =
        firstBad === "name"
          ? nameRef.current
          : firstBad === "prompt"
            ? promptRef.current
            : firstBad === "time"
              ? timeRef.current
              : firstBad === "weekdays"
                ? weekdaysRef.current
                : null;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      (target as HTMLElement | null)?.focus?.();
      return;
    }

    setSubmitting(true);
    setServerError(null);

    // Không có backend: mô phỏng độ trễ để thể hiện trạng thái đang lưu.
    setTimeout(() => {
      try {
        const clean: TaskDraft = {
          ...draft,
          name: draft.name.trim(),
          prompt: draft.prompt.trim(),
          weekdays: draft.cadence === "daily" ? [] : draft.weekdays,
        };
        const saved = isEdit ? updateTask(taskId!, clean) : createTask(clean);
        if (!saved) throw new Error("save failed");

        const when = nextRuns(saved, 1)[0];
        if (isEdit) {
          toast.success(`Đã cập nhật ${saved.name}.`, {
            description: "Thay đổi áp dụng từ lần chạy kế tiếp.",
          });
        } else {
          toast.success(`Đã tạo tác vụ ${saved.name}.`, {
            description: when
              ? `Lần chạy kế tiếp: ${formatRelativeDateTime(when)}.`
              : undefined,
          });
        }
        setSubmitting(false);
        onOpenChange(false);
      } catch {
        setSubmitting(false);
        setServerError("Không lưu được tác vụ. Vui lòng thử lại.");
      }
    }, 500);
  };

  const applyTemplate = (prompt: string) => {
    if (draft.prompt.trim() && !window.confirm("Ghi đè nội dung đang nhập?")) {
      setTemplateOpen(false);
      return;
    }
    patch({ prompt });
    setTemplateOpen(false);
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]"
          onEscapeKeyDown={(e) => {
            if (dirty) {
              e.preventDefault();
              setConfirmDiscard(true);
            }
          }}
          onInteractOutside={(e) => {
            if (dirty) {
              e.preventDefault();
              setConfirmDiscard(true);
            }
          }}
        >
          <SheetHeader className="border-b p-6">
            <SheetTitle>
              {isEdit ? "Chỉnh sửa tác vụ" : "Tạo tác vụ định kỳ"}
            </SheetTitle>
            <SheetDescription>
              Agent sẽ tự chạy nội dung bên dưới theo lịch bạn đặt.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-6">
              {isEdit && task && isRunning(task.id) && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
                >
                  <IconInfoCircle
                    size={16}
                    stroke={1.75}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Tác vụ đang chạy. Thay đổi sẽ áp dụng từ lần chạy kế tiếp,
                    không ảnh hưởng lần chạy hiện tại.
                  </span>
                </div>
              )}

              {serverError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {serverError}
                </div>
              )}

              {/* 1. Tên tác vụ */}
              <Field
                label="Tên tác vụ"
                htmlFor="task-name"
                error={errorOf("name")}
                required
              >
                <Input
                  id="task-name"
                  ref={nameRef}
                  value={draft.name}
                  maxLength={NAME_MAX + 20}
                  onChange={(e) => patch({ name: e.target.value })}
                  onBlur={() => blur("name")}
                  aria-invalid={!!errorOf("name")}
                  aria-describedby={errorOf("name") ? "task-name-error" : undefined}
                  placeholder="Ví dụ: Báo cáo tiến độ dự án X"
                />
              </Field>

              {/* 2. Agent thực thi */}
              <Field
                label="Agent thực thi"
                htmlFor="task-agent"
                error={errorOf("agentId")}
                required
              >
                <Select
                  value={draft.agentId}
                  onValueChange={(v) => patch({ agentId: v })}
                >
                  <SelectTrigger id="task-agent">
                    <SelectValue placeholder="Chọn Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENTS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* 3. Prompt */}
              <Field
                label="Nội dung yêu cầu"
                htmlFor="task-prompt"
                error={errorOf("prompt")}
                required
                hint="Ví dụ: Tổng hợp tiến độ dự án X trong ngày hôm nay, nêu rõ các việc đã xong, đang làm và đang bị chặn."
                action={
                  <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline underline-offset-4"
                      >
                        Dùng mẫu có sẵn
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-2">
                      {PROMPT_TEMPLATES.map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => applyTemplate(t.prompt)}
                          className="w-full rounded-md p-2 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <span className="font-medium">{t.label}</span>
                          <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                            {t.prompt}
                          </span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                }
              >
                <Textarea
                  id="task-prompt"
                  ref={promptRef}
                  rows={6}
                  value={draft.prompt}
                  onChange={(e) => patch({ prompt: e.target.value })}
                  onBlur={() => blur("prompt")}
                  aria-invalid={!!errorOf("prompt")}
                  aria-describedby={
                    errorOf("prompt") ? "task-prompt-error" : undefined
                  }
                  className="max-h-[280px] min-h-[132px]"
                />
                <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                  {draft.prompt.length}/{PROMPT_MAX}
                </div>
              </Field>

              {/* 4. Chu kỳ */}
              <div className="flex flex-col gap-2">
                <Label>Chu kỳ</Label>
                <Tabs
                  value={draft.cadence}
                  onValueChange={(v) => patch({ cadence: v as Cadence })}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="daily">Hằng ngày</TabsTrigger>
                    <TabsTrigger value="weekly">Hằng tuần</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 5. Ngày trong tuần */}
              {draft.cadence === "weekly" && (
                <Field
                  label="Ngày trong tuần"
                  error={errorOf("weekdays")}
                  required
                  action={
                    <button
                      type="button"
                      onClick={() => patch({ weekdays: [1, 2, 3, 4, 5] })}
                      className="text-xs font-medium text-primary underline underline-offset-4"
                    >
                      Ngày làm việc (T2–T6)
                    </button>
                  }
                >
                  <div ref={weekdaysRef} tabIndex={-1}>
                    <ToggleGroup
                      type="multiple"
                      value={draft.weekdays.map(String)}
                      onValueChange={(vals) => {
                        patch({
                          weekdays: vals
                            .map((v) => Number(v) as Weekday)
                            .sort((a, b) => a - b),
                        });
                        setTouched((t) => ({ ...t, weekdays: true }));
                      }}
                      className="justify-start gap-1.5"
                    >
                      {WEEKDAY_ORDER.map((d) => (
                        <ToggleGroupItem
                          key={d}
                          value={String(d)}
                          aria-label={WEEKDAY_LABELS[d]}
                          className="h-9 w-11 rounded-md border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                        >
                          {WEEKDAY_LABELS[d]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </Field>
              )}

              {/* 6. Giờ chạy */}
              <Field
                label="Giờ chạy"
                htmlFor="task-time"
                error={errorOf("time")}
                required
                hint={`Theo múi giờ ${TIMEZONE_LABEL}.`}
              >
                <Input
                  id="task-time"
                  ref={timeRef}
                  type="time"
                  step={300}
                  value={draft.time}
                  onChange={(e) => patch({ time: e.target.value })}
                  onBlur={() => blur("time")}
                  aria-invalid={!!errorOf("time")}
                  className="w-40 tabular-nums"
                />
              </Field>

              {/* 7. Đích gửi kết quả */}
              <Field
                label="Đích gửi kết quả"
                htmlFor="task-destination"
                error={errorOf("destination")}
                required
              >
                <Select
                  value={draft.destination}
                  onValueChange={(v) => patch({ destination: v })}
                >
                  <SelectTrigger id="task-destination">
                    <SelectValue placeholder="Chọn nơi nhận kết quả" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Xem trước lịch chạy */}
              <div className="rounded-lg border bg-muted/40 p-4">
                {scheduleValid ? (
                  <div className="flex items-start gap-3">
                    <IconClock
                      size={20}
                      stroke={1.75}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{describeScheduleLong(draft)}</p>
                      <p className="text-muted-foreground">
                        Lần chạy kế tiếp:{" "}
                        <span className="tabular-nums text-foreground">
                          {formatDateTime(preview[0])}
                        </span>{" "}
                        ({formatCountdown(preview[0])})
                      </p>
                      <p className="text-muted-foreground">
                        3 lần kế tiếp:{" "}
                        <span className="tabular-nums">
                          {preview.map((d) => formatShortDateTime(d)).join(" · ")}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Hoàn tất phần lịch chạy để xem lần chạy kế tiếp.
                  </p>
                )}
              </div>

              {/* Tuỳ chọn nâng cao */}
              <Accordion type="single" collapsible className="rounded-lg border">
                <AccordionItem value="advanced" className="border-b-0">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="text-left">
                      <span className="block text-sm font-medium">
                        Tuỳ chọn nâng cao
                      </span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Xử lý khi chạy lỗi, khi hệ thống offline, khi lần chạy
                        trước chưa xong.
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-5 px-4 pb-4">
                    {/* Retry — EC-1 */}
                    <SwitchRow
                      label="Tự động thử lại khi lỗi"
                      description="Nếu lần chạy thất bại, hệ thống sẽ tự thử lại."
                      checked={draft.advanced.retryEnabled}
                      onChange={(v) =>
                        patch({ advanced: { ...draft.advanced, retryEnabled: v } })
                      }
                    />
                    {draft.advanced.retryEnabled && (
                      <div className="ml-6 flex flex-col gap-4 border-l pl-4">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="retry-count" className="font-normal">
                            Số lần thử lại tối đa
                          </Label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label="Giảm"
                              disabled={draft.advanced.maxRetries <= 1}
                              onClick={() =>
                                patch({
                                  advanced: {
                                    ...draft.advanced,
                                    maxRetries: draft.advanced.maxRetries - 1,
                                  },
                                })
                              }
                            >
                              −
                            </Button>
                            <span
                              id="retry-count"
                              className="w-8 text-center text-sm tabular-nums"
                            >
                              {draft.advanced.maxRetries}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label="Tăng"
                              disabled={draft.advanced.maxRetries >= 5}
                              onClick={() =>
                                patch({
                                  advanced: {
                                    ...draft.advanced,
                                    maxRetries: draft.advanced.maxRetries + 1,
                                  },
                                })
                              }
                            >
                              +
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <Label className="font-normal">
                            Khoảng cách giữa các lần thử
                          </Label>
                          <Select
                            value={String(draft.advanced.retryIntervalMinutes)}
                            onValueChange={(v) =>
                              patch({
                                advanced: {
                                  ...draft.advanced,
                                  retryIntervalMinutes: Number(
                                    v,
                                  ) as typeof draft.advanced.retryIntervalMinutes,
                                },
                              })
                            }
                          >
                            <SelectTrigger className="h-9 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 15, 30, 60].map((m) => (
                                <SelectItem key={m} value={String(m)}>
                                  {m} phút
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Catch-up — EC-2 */}
                    <SwitchRow
                      label="Chạy bù khi hệ thống offline"
                      description="Khi bật, nếu hệ thống offline đúng giờ chạy, tác vụ sẽ chạy bù ngay khi hoạt động trở lại. Khi tắt, lần chạy đó được bỏ qua để tránh chồng lịch."
                      checked={draft.advanced.catchUpEnabled}
                      onChange={(v) =>
                        patch({ advanced: { ...draft.advanced, catchUpEnabled: v } })
                      }
                    />
                    {draft.advanced.catchUpEnabled && (
                      <div className="ml-6 flex flex-col gap-2 border-l pl-4">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="font-normal">Cửa sổ chạy bù</Label>
                          <Select
                            value={String(draft.advanced.catchUpWindowHours)}
                            onValueChange={(v) =>
                              patch({
                                advanced: {
                                  ...draft.advanced,
                                  catchUpWindowHours: Number(
                                    v,
                                  ) as typeof draft.advanced.catchUpWindowHours,
                                },
                              })
                            }
                          >
                            <SelectTrigger className="h-9 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 3, 6, 12].map((h) => (
                                <SelectItem key={h} value={String(h)}>
                                  {h} giờ
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Quá thời gian này thì bỏ qua thay vì chạy bù.
                        </p>
                      </div>
                    )}

                    {/* Overlap — EC-5 */}
                    <div className="flex flex-col gap-2">
                      <Label>Khi lần chạy trước chưa xong</Label>
                      <RadioGroup
                        value={draft.advanced.overlapPolicy}
                        onValueChange={(v) =>
                          patch({
                            advanced: {
                              ...draft.advanced,
                              overlapPolicy: v as "skip" | "queue",
                            },
                          })
                        }
                        className="gap-2"
                      >
                        <label className="flex items-start gap-2 text-sm">
                          <RadioGroupItem value="skip" className="mt-0.5" />
                          <span>
                            Bỏ qua lần chạy mới
                            <span className="block text-xs text-muted-foreground">
                              Ghi lịch sử với trạng thái Bỏ qua.
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-sm">
                          <RadioGroupItem value="queue" className="mt-0.5" />
                          <span>
                            Xếp hàng chạy sau
                            <span className="block text-xs text-muted-foreground">
                              Chạy ngay khi lần trước kết thúc.
                            </span>
                          </span>
                        </label>
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        Không bao giờ chạy song song cùng một tác vụ.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {isEdit && task && (
                <p className="text-xs text-muted-foreground">
                  Tạo lúc {formatDateTime(task.createdAt)} · Cập nhật lần cuối{" "}
                  {formatDateTime(task.updatedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t bg-background p-4">
            <Button variant="ghost" onClick={requestClose} disabled={submitting}>
              Huỷ
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting
                ? "Đang lưu…"
                : isEdit
                  ? "Lưu thay đổi"
                  : "Tạo tác vụ"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ các thay đổi chưa lưu?</AlertDialogTitle>
            <AlertDialogDescription>
              Những gì bạn vừa nhập sẽ không được lưu lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Bỏ thay đổi
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------- Khối trường dùng chung ------------------------------------- */

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  action,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {action}
      </div>
      {children}
      {hint && !error && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className={cn("text-sm text-destructive")}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
