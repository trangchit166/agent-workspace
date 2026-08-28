/**
 * Tầng dữ liệu cho tab "Tác vụ định kỳ".
 *
 * Không có backend ở giai đoạn này: dữ liệu nằm trong một store nhỏ ngoài React
 * (useSyncExternalStore) để danh sách, màn chi tiết và sidebar cùng đọc một
 * nguồn. Mọi thao tác ghi đều đồng bộ và trả về bản ghi đã cập nhật.
 */

import { useSyncExternalStore } from "react";

/* ---------- Kiểu dữ liệu ------------------------------------------------ */

export type Cadence = "daily" | "weekly";

/** 1 = Thứ Hai … 7 = Chủ nhật (theo ISO-8601). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TaskState = "active" | "paused";

export type RunStatus =
  | "success"
  | "failed"
  | "retrying"
  | "skipped"
  | "running"
  | "queued";

export type RunTrigger = "scheduled" | "manual" | "catchup";

export type OverlapPolicy = "skip" | "queue";

export interface AdvancedOptions {
  retryEnabled: boolean;
  /** 1–5 */
  maxRetries: number;
  /** phút */
  retryIntervalMinutes: 5 | 15 | 30 | 60;
  catchUpEnabled: boolean;
  /** giờ */
  catchUpWindowHours: 1 | 3 | 6 | 12;
  overlapPolicy: OverlapPolicy;
}

export const DEFAULT_ADVANCED: AdvancedOptions = {
  retryEnabled: true,
  maxRetries: 2,
  retryIntervalMinutes: 15,
  catchUpEnabled: false,
  catchUpWindowHours: 3,
  overlapPolicy: "skip",
};

export interface TaskRun {
  id: string;
  taskId: string;
  startedAt: Date;
  finishedAt?: Date;
  status: RunStatus;
  trigger: RunTrigger;
  /** Số lần đã thử (1 = chạy một lần, không retry). */
  attempts: number;
  /** Tóm tắt 1 dòng hiển thị trong bảng. */
  summary: string;
  /** Nội dung kết quả đầy đủ (markdown thô). */
  output?: string;
  /** Thông điệp lỗi khi thất bại. */
  errorMessage?: string;
  errorCode?: string;
  /** Lý do khi bị bỏ qua. */
  skipReason?: string;
  /** Số mục thiếu dữ liệu nguồn (EC-4). */
  missingSourceCount?: number;
  /** Tổng số phần khi kết quả bị rút gọn (EC-3). */
  truncatedParts?: number;
  /** Mốc giờ theo lịch gốc, khác startedAt khi là lần chạy bù (EC-2). */
  scheduledFor?: Date;
}

export interface ScheduledTask {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  prompt: string;
  cadence: Cadence;
  /** Chỉ dùng khi cadence = "weekly". */
  weekdays: Weekday[];
  /** "HH:mm" theo giờ Asia/Ho_Chi_Minh. */
  time: string;
  destination: string;
  state: TaskState;
  advanced: AdvancedOptions;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TaskDraft {
  name: string;
  agentId: string;
  prompt: string;
  cadence: Cadence;
  weekdays: Weekday[];
  time: string;
  destination: string;
  advanced: AdvancedOptions;
}

export const TIMEZONE_LABEL = "Asia/Ho_Chi_Minh (UTC+7)";

export const AGENTS = [
  { id: "report", name: "Report Agent" },
  { id: "research", name: "Research Agent" },
  { id: "email", name: "Email Writer Agent" },
  { id: "support", name: "Customer Support Agent" },
  { id: "ops", name: "Ops Agent" },
];

export const DESTINATIONS = [
  "Chat cá nhân với Agent",
  "Email cá nhân",
  "Kênh nội bộ #bao-cao",
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  7: "CN",
};

export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const PROMPT_TEMPLATES = [
  {
    label: "Báo cáo tiến độ hằng ngày",
    prompt:
      "Tổng hợp tiến độ dự án X trong ngày hôm nay, nêu rõ các việc đã xong, đang làm và đang bị chặn.",
  },
  {
    label: "Tổng hợp tuần",
    prompt:
      "Tổng hợp kết quả công việc trong tuần, nêu 5 điểm nổi bật và 3 việc cần ưu tiên tuần tới.",
  },
  {
    label: "Nhắc việc tồn đọng",
    prompt:
      "Liệt kê các đầu việc quá hạn và sắp đến hạn trong 3 ngày tới, sắp xếp theo mức độ ưu tiên.",
  },
  {
    label: "Tóm tắt tin tức ngành",
    prompt:
      "Tóm tắt 10 tin tức công nghệ nổi bật trong 24 giờ qua, mỗi tin 2 câu kèm nguồn.",
  },
];

/* ---------- Tiện ích thời gian ------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

export const parseTime = (time: string): { h: number; m: number } | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
};

/** 1 = Thứ Hai … 7 = Chủ nhật. */
const isoWeekday = (d: Date): Weekday => ((d.getDay() + 6) % 7 + 1) as Weekday;

/**
 * Tính n mốc chạy kế tiếp kể từ `from`. Trả về mảng rỗng nếu lịch không hợp lệ.
 */
export function nextRuns(
  input: Pick<ScheduledTask, "cadence" | "weekdays" | "time">,
  count = 3,
  from: Date = new Date(),
): Date[] {
  const parsed = parseTime(input.time);
  if (!parsed) return [];
  const days =
    input.cadence === "daily" ? WEEKDAY_ORDER : [...input.weekdays].sort();
  if (days.length === 0) return [];

  const out: Date[] = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);

  for (let i = 0; i < 400 && out.length < count; i += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + i);
    day.setHours(parsed.h, parsed.m, 0, 0);
    if (day.getTime() <= from.getTime()) continue;
    if (days.includes(isoWeekday(day))) out.push(day);
  }
  return out;
}

export const nextRunOf = (task: ScheduledTask, from?: Date): Date | null =>
  task.state === "paused" ? null : (nextRuns(task, 1, from)[0] ?? null);

/** "Hằng ngày · 08:00" / "Hằng tuần · T2, T6 · 17:30" */
export function describeSchedule(
  input: Pick<ScheduledTask, "cadence" | "weekdays" | "time">,
): string {
  if (input.cadence === "daily") return `Hằng ngày · ${input.time}`;
  const days = [...input.weekdays].sort();
  if (days.length === 0) return `Hằng tuần · ${input.time}`;
  if (days.length >= 4) return `Hằng tuần · ${days.length} ngày · ${input.time}`;
  return `Hằng tuần · ${days.map((d) => WEEKDAY_LABELS[d]).join(", ")} · ${input.time}`;
}

/** Danh sách ngày đầy đủ, dùng cho tooltip khi rút gọn. */
export const weekdaysFull = (days: Weekday[]) =>
  [...days].sort().map((d) => WEEKDAY_LABELS[d]).join(", ");

/** Câu diễn giải dài: "Hằng tuần vào T2, T6 lúc 17:30". */
export function describeScheduleLong(
  input: Pick<ScheduledTask, "cadence" | "weekdays" | "time">,
): string {
  if (input.cadence === "daily") return `Hằng ngày lúc ${input.time}`;
  const days = [...input.weekdays].sort();
  if (days.length === 0) return "";
  return `Hằng tuần vào ${weekdaysFull(days)} lúc ${input.time}`;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Hôm nay, 08:00" / "Ngày mai, 08:00" / "T2, 01/09 · 17:30" */
export function formatRelativeDateTime(d: Date, now: Date = new Date()): string {
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return `Hôm nay, ${time}`;
  if (sameDay(d, tomorrow)) return `Ngày mai, ${time}`;
  return `${WEEKDAY_LABELS[isoWeekday(d)]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${time}`;
}

/** "28/08/2026 08:00" */
export const formatDateTime = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "28/08 08:00" */
export const formatShortDateTime = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "12s" / "1m 04s" */
export function formatDuration(run: TaskRun): string {
  if (!run.finishedAt) return "—";
  const ms = run.finishedAt.getTime() - run.startedAt.getTime();
  if (ms < 0) return "—";
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${pad(total % 60)}s`;
}

/** "còn 4 ngày" / "còn 3 giờ" / "còn 20 phút" */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "sắp chạy";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `còn ${hours} giờ`;
  return `còn ${Math.round(hours / 24)} ngày`;
}

/* ---------- Dữ liệu mẫu ------------------------------------------------- */

let seq = 0;
const uid = (prefix: string) => `${prefix}-${(seq += 1)}`;

const at = (daysAgo: number, h: number, m: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
};

const plusSeconds = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

interface SeedTask extends Omit<ScheduledTask, "id" | "createdAt" | "updatedAt" | "createdBy" | "agentName"> {
  agentId: string;
}

const seed: SeedTask[] = [
  {
    name: "Báo cáo tiến độ dự án X",
    agentId: "report",
    prompt:
      "Tổng hợp tiến độ dự án X trong ngày hôm nay, nêu rõ các việc đã xong, đang làm và đang bị chặn.",
    cadence: "daily",
    weekdays: [],
    time: "08:00",
    destination: DESTINATIONS[0],
    state: "active",
    advanced: DEFAULT_ADVANCED,
  },
  {
    name: "Tổng hợp tuần Marketing",
    agentId: "research",
    prompt:
      "Tổng hợp kết quả các chiến dịch marketing trong tuần, nêu 5 điểm nổi bật và 3 việc cần ưu tiên.",
    cadence: "weekly",
    weekdays: [1, 5],
    time: "17:30",
    destination: DESTINATIONS[0],
    state: "active",
    advanced: { ...DEFAULT_ADVANCED, maxRetries: 2 },
  },
  {
    name: "Nhắc backlog tồn đọng",
    agentId: "ops",
    prompt:
      "Liệt kê các đầu việc quá hạn và sắp đến hạn trong 3 ngày tới, sắp xếp theo mức độ ưu tiên.",
    cadence: "daily",
    weekdays: [],
    time: "09:00",
    destination: DESTINATIONS[0],
    state: "paused",
    advanced: DEFAULT_ADVANCED,
  },
  {
    name: "Cập nhật giá vàng",
    agentId: "report",
    prompt:
      "Thu thập giá vàng theo từng thương hiệu, dựng biểu đồ biến động 30 ngày và xuất báo cáo.",
    cadence: "daily",
    weekdays: [],
    time: "12:00",
    destination: DESTINATIONS[2],
    state: "active",
    advanced: { ...DEFAULT_ADVANCED, maxRetries: 3, retryIntervalMinutes: 5 },
  },
  {
    name: "Dự báo thời tiết Hà Nội",
    agentId: "research",
    prompt: "Lấy dự báo thời tiết Hà Nội trong ngày và tóm tắt trong 3 câu.",
    cadence: "daily",
    weekdays: [],
    time: "06:00",
    destination: DESTINATIONS[0],
    state: "active",
    advanced: DEFAULT_ADVANCED,
  },
  {
    name: "Nhắc lịch họp giao ban",
    agentId: "email",
    prompt:
      "Soạn email nhắc lịch họp giao ban tuần kèm agenda ba mục và đề nghị xác nhận tham dự.",
    cadence: "weekly",
    weekdays: [5],
    time: "16:00",
    destination: DESTINATIONS[1],
    state: "active",
    advanced: DEFAULT_ADVANCED,
  },
  {
    name: "Tổng hợp phản hồi khách hàng",
    agentId: "support",
    prompt:
      "Tổng hợp các phản hồi khách hàng mới trong 24 giờ, phân loại theo mức độ nghiêm trọng.",
    cadence: "daily",
    weekdays: [],
    time: "18:00",
    destination: DESTINATIONS[0],
    state: "active",
    advanced: { ...DEFAULT_ADVANCED, overlapPolicy: "queue" },
  },
  {
    name: "Sao lưu tài liệu dự án",
    agentId: "ops",
    prompt: "Nén toàn bộ tài liệu trong không gian làm việc và đẩy lên kho lưu trữ.",
    cadence: "weekly",
    weekdays: [7],
    time: "23:00",
    destination: DESTINATIONS[2],
    state: "paused",
    advanced: { ...DEFAULT_ADVANCED, catchUpEnabled: true },
  },
  {
    name: "Điểm tin tuyển dụng",
    agentId: "research",
    prompt: "Tổng hợp các vị trí tuyển dụng mới đăng và số ứng viên đã nộp hồ sơ.",
    cadence: "weekly",
    weekdays: [1, 3, 5],
    time: "10:00",
    destination: DESTINATIONS[0],
    state: "active",
    advanced: DEFAULT_ADVANCED,
  },
  {
    name: "Kiểm tra sức khoẻ hệ thống",
    agentId: "ops",
    prompt: "Kiểm tra tình trạng các dịch vụ và báo cáo dịch vụ nào đang chậm hoặc lỗi.",
    cadence: "daily",
    weekdays: [],
    time: "07:00",
    destination: DESTINATIONS[2],
    state: "active",
    advanced: { ...DEFAULT_ADVANCED, catchUpEnabled: true, catchUpWindowHours: 1 },
  },
  {
    name: "Nhắc chấm công cuối tháng",
    agentId: "email",
    prompt: "Soạn email nhắc toàn bộ nhân sự hoàn tất chấm công trước 17h ngày cuối tháng.",
    cadence: "weekly",
    weekdays: [4],
    time: "14:00",
    destination: DESTINATIONS[1],
    state: "active",
    advanced: DEFAULT_ADVANCED,
  },
  {
    name: "Tóm tắt tin tức ngành",
    agentId: "research",
    prompt: "Tóm tắt 10 tin tức công nghệ nổi bật trong 24 giờ qua, mỗi tin 2 câu kèm nguồn.",
    cadence: "weekly",
    weekdays: [1, 2, 3, 4, 5],
    time: "07:30",
    destination: DESTINATIONS[0],
    state: "active",
    advanced: DEFAULT_ADVANCED,
  },
];

const agentNameOf = (id: string) =>
  AGENTS.find((a) => a.id === id)?.name ?? AGENTS[0].name;

let tasks: ScheduledTask[] = seed.map((s, i) => ({
  ...s,
  id: `task-${i + 1}`,
  agentName: agentNameOf(s.agentId),
  createdAt: at(40 - i, 9, 0),
  updatedAt: at(10 - (i % 8), 15, 30),
  createdBy: "Trang Nguyen Huyen",
}));

const OUTPUT_SAMPLE = `## Tiến độ dự án X — ngày hôm nay

**Đã hoàn thành (3)**
- Hoàn tất API đăng nhập SSO
- Nghiệm thu màn hình danh sách đơn hàng
- Cập nhật tài liệu tích hợp cho đối tác

**Đang làm (4)**
- Tối ưu truy vấn báo cáo doanh thu
- Dựng màn hình cấu hình thông báo
- Viết test cho luồng thanh toán
- Rà soát bảo mật vòng 2

**Đang bị chặn (1)**
- Kết nối cổng thanh toán: đang chờ đối tác cấp chứng chỉ sandbox`;

function buildRuns(task: ScheduledTask): TaskRun[] {
  const out: TaskRun[] = [];
  const parsed = parseTime(task.time) ?? { h: 8, m: 0 };
  const count = task.state === "paused" && task.id === "task-3" ? 0 : 14;

  for (let i = 1; i <= count; i += 1) {
    const started = at(i, parsed.h, parsed.m);
    let status: RunStatus = "success";
    let attempts = 1;
    let summary = "Tổng hợp 8 mục tiến độ, 1 mục đang bị chặn.";
    let errorMessage: string | undefined;
    let errorCode: string | undefined;
    let skipReason: string | undefined;
    let missingSourceCount: number | undefined;
    let trigger: RunTrigger = "scheduled";
    let scheduledFor: Date | undefined;

    if (task.id === "task-4" && i === 1) {
      status = "failed";
      attempts = task.advanced.maxRetries + 1;
      summary = "Không kết nối được nguồn dữ liệu giá vàng.";
      errorMessage = "Không kết nối được tới nguồn dữ liệu sau 4 lần thử.";
      errorCode = "SOURCE_UNREACHABLE";
    } else if (task.id === "task-2" && i === 3) {
      status = "failed";
      attempts = 3;
      summary = "Không đọc được báo cáo chiến dịch từ nguồn.";
      errorMessage = "Nguồn dữ liệu trả về lỗi 502 sau 3 lần thử.";
      errorCode = "UPSTREAM_502";
    } else if (i === 4) {
      status = "skipped";
      summary = "Hệ thống offline vào giờ chạy.";
      skipReason = "Hệ thống offline";
    } else if (i === 6) {
      status = "success";
      trigger = "catchup";
      scheduledFor = started;
      summary = "Chạy bù sau khi hệ thống hoạt động trở lại.";
    } else if (i === 8) {
      status = "success";
      missingSourceCount = 2;
      summary = "Hoàn thành với 2 mục thiếu dữ liệu nguồn.";
    } else if (i === 11) {
      status = "success";
      trigger = "manual";
      summary = "Chạy thủ công theo yêu cầu.";
    }

    const actualStart =
      trigger === "catchup" ? plusSeconds(started, 4320) : started;

    out.push({
      id: uid("run"),
      taskId: task.id,
      startedAt: actualStart,
      finishedAt:
        status === "skipped" || status === "failed"
          ? undefined
          : plusSeconds(actualStart, 9 + (i % 5) * 3),
      status,
      trigger,
      attempts,
      summary,
      output: status === "success" ? OUTPUT_SAMPLE : undefined,
      errorMessage,
      errorCode,
      skipReason,
      missingSourceCount,
      truncatedParts: i === 2 ? 3 : undefined,
      scheduledFor,
    });
  }
  return out;
}

let runs: TaskRun[] = tasks.flatMap(buildRuns);

/* ---------- Store ------------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshotVersion = 0;
let snapshot = { tasks, runs, version: snapshotVersion };

const emit = () => {
  snapshotVersion += 1;
  snapshot = { tasks, runs, version: snapshotVersion };
  listeners.forEach((l) => l());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => snapshot;

export const useScheduledTasksStore = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/* ---------- Truy vấn ---------------------------------------------------- */

export const getTask = (id: string) => tasks.find((t) => t.id === id) ?? null;

export const runsOfTask = (id: string) =>
  runs
    .filter((r) => r.taskId === id)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

export const latestRun = (id: string): TaskRun | null =>
  runsOfTask(id)[0] ?? null;

/** Tác vụ thất bại vĩnh viễn ở lần chạy gần nhất (EC-1). */
export const failedTasks = () =>
  tasks.filter((t) => latestRun(t.id)?.status === "failed");

export interface TaskStats {
  successRate: number | null;
  successCount: number;
  totalIn30Days: number;
  totalRuns: number;
}

export function statsOf(id: string): TaskStats {
  const all = runsOfTask(id);
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recent = all.filter((r) => r.startedAt >= since && r.status !== "running");
  const success = recent.filter((r) => r.status === "success").length;
  return {
    successRate: recent.length ? Math.round((success / recent.length) * 100) : null,
    successCount: success,
    totalIn30Days: recent.length,
    totalRuns: all.length,
  };
}

/* ---------- Thao tác ghi ------------------------------------------------ */

export function toggleTask(id: string, next?: boolean): ScheduledTask | null {
  let updated: ScheduledTask | null = null;
  tasks = tasks.map((t) => {
    if (t.id !== id) return t;
    const state: TaskState =
      (next ?? t.state === "paused") ? "active" : "paused";
    updated = { ...t, state, updatedAt: new Date() };
    return updated;
  });
  emit();
  return updated;
}

export function removeTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  runs = runs.filter((r) => r.taskId !== id);
  emit();
}

export function createTask(draft: TaskDraft): ScheduledTask {
  const now = new Date();
  const task: ScheduledTask = {
    ...draft,
    id: uid("task"),
    agentName: agentNameOf(draft.agentId),
    state: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: "Trang Nguyen Huyen",
  };
  tasks = [task, ...tasks];
  emit();
  return task;
}

export function updateTask(id: string, draft: TaskDraft): ScheduledTask | null {
  let updated: ScheduledTask | null = null;
  tasks = tasks.map((t) => {
    if (t.id !== id) return t;
    updated = {
      ...t,
      ...draft,
      agentName: agentNameOf(draft.agentId),
      updatedAt: new Date(),
    };
    return updated;
  });
  emit();
  return updated;
}

/** Kiểm tra trùng tên trong phạm vi cá nhân. */
export const isNameTaken = (name: string, exceptId?: string) =>
  tasks.some(
    (t) =>
      t.id !== exceptId &&
      t.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

/** Tác vụ có lần chạy đang dở (EC-5). */
export const isRunning = (id: string) =>
  runs.some((r) => r.taskId === id && r.status === "running");

/**
 * Kích hoạt một lần chạy thủ công. Ghi bản ghi "đang chạy" rồi kết thúc sau
 * ~4 giây để giao diện thể hiện được trạng thái trung gian.
 */
export function runNow(id: string): TaskRun | null {
  const task = getTask(id);
  if (!task || isRunning(id)) return null;

  const run: TaskRun = {
    id: uid("run"),
    taskId: id,
    startedAt: new Date(),
    status: "running",
    trigger: "manual",
    attempts: 1,
    summary: "Đang chạy…",
  };
  runs = [run, ...runs];
  emit();

  setTimeout(() => {
    runs = runs.map((r) =>
      r.id === run.id
        ? {
            ...r,
            status: "success",
            finishedAt: new Date(),
            summary: "Tổng hợp 8 mục tiến độ, 1 mục đang bị chặn.",
            output: OUTPUT_SAMPLE,
          }
        : r,
    );
    emit();
  }, 4000);

  return run;
}

export function draftFromTask(task: ScheduledTask): TaskDraft {
  return {
    name: task.name,
    agentId: task.agentId,
    prompt: task.prompt,
    cadence: task.cadence,
    weekdays: [...task.weekdays],
    time: task.time,
    destination: task.destination,
    advanced: { ...task.advanced },
  };
}

export const emptyDraft = (): TaskDraft => ({
  name: "",
  agentId: AGENTS[0].id,
  prompt: "",
  cadence: "daily",
  weekdays: [],
  time: "08:00",
  destination: DESTINATIONS[0],
  advanced: { ...DEFAULT_ADVANCED },
});
