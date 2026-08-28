/**
 * Dữ liệu mẫu cho trang "Tác vụ định kỳ".
 * Không gọi mạng — trang chỉ đọc từ đây để dựng giao diện.
 */

export type ScheduleState = "active" | "paused";
export type RunStatus = "success" | "failed" | "running";

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  agent: string;
  /** Lịch chạy, mô tả bằng tiếng Việt cho dễ đọc. */
  schedule: string;
  /** Biểu thức cron tương ứng, hiển thị dạng phụ. */
  cron: string;
  nextRun: string;
  lastRun: string;
  lastStatus: RunStatus;
  state: ScheduleState;
}

export const SCHEDULED_TASKS: ScheduledTask[] = [
  {
    id: "st-1",
    name: "Báo cáo doanh thu hằng ngày",
    description:
      "Tổng hợp doanh thu ngày hôm trước theo từng khối và gửi email cho ban điều hành.",
    agent: "Report Agent",
    schedule: "Hằng ngày lúc 08:00",
    cron: "0 8 * * *",
    nextRun: "Ngày mai, 08:00",
    lastRun: "Hôm nay, 08:00",
    lastStatus: "success",
    state: "active",
  },
  {
    id: "st-2",
    name: "Tổng hợp tin tức ngành",
    description:
      "Quét các nguồn tin công nghệ, tóm tắt 10 tin nổi bật và đăng vào kênh nội bộ.",
    agent: "Research Agent",
    schedule: "Thứ Hai hằng tuần lúc 07:30",
    cron: "30 7 * * 1",
    nextRun: "Thứ Hai, 07:30",
    lastRun: "Thứ Hai tuần trước, 07:30",
    lastStatus: "success",
    state: "active",
  },
  {
    id: "st-3",
    name: "Nhắc lịch họp tuần",
    description:
      "Gửi email nhắc lịch họp giao ban kèm agenda cho toàn bộ thành viên dự án.",
    agent: "Email Agent",
    schedule: "Thứ Sáu hằng tuần lúc 16:00",
    cron: "0 16 * * 5",
    nextRun: "Thứ Sáu, 16:00",
    lastRun: "Thứ Sáu tuần trước, 16:00",
    lastStatus: "success",
    state: "active",
  },
  {
    id: "st-4",
    name: "Dự báo thời tiết Hà Nội",
    description:
      "Lấy dự báo trong ngày và gửi tin nhắn tóm tắt trước giờ làm việc.",
    agent: "Weather Agent",
    schedule: "Hằng ngày lúc 06:00",
    cron: "0 6 * * *",
    nextRun: "Ngày mai, 06:00",
    lastRun: "Hôm nay, 06:00",
    lastStatus: "running",
    state: "active",
  },
  {
    id: "st-5",
    name: "Cập nhật giá vàng",
    description:
      "Thu thập giá vàng theo thương hiệu, dựng biểu đồ biến động và xuất báo cáo HTML.",
    agent: "Report Agent",
    schedule: "Mỗi 4 giờ",
    cron: "0 */4 * * *",
    nextRun: "Hôm nay, 16:00",
    lastRun: "Hôm nay, 12:00",
    lastStatus: "failed",
    state: "active",
  },
  {
    id: "st-6",
    name: "Sao lưu tài liệu dự án",
    description:
      "Nén toàn bộ tài liệu trong không gian làm việc và đẩy lên kho lưu trữ.",
    agent: "Ops Agent",
    schedule: "Ngày 1 hằng tháng lúc 23:00",
    cron: "0 23 1 * *",
    nextRun: "Đang tạm dừng",
    lastRun: "01/08, 23:00",
    lastStatus: "success",
    state: "paused",
  },
];

export const activeScheduledTaskCount = () =>
  SCHEDULED_TASKS.filter((t) => t.state === "active").length;
