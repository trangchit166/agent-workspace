## Cho phép collapse sidebar

Thêm khả năng thu gọn/mở rộng thanh bên trong `src/components/chat/ChatWorkspace.tsx`.

### Hành vi
- Mặc định sidebar mở (248px). Trạng thái được lưu vào `localStorage` (key `uaw:sidebar-collapsed`) để giữ giữa các lần reload.
- Nút `IconLayoutSidebar` hiện có ở header sidebar sẽ toggle collapse.
- Khi collapsed:
  - Sidebar ẩn hoàn toàn (width 0) để tối đa hoá vùng chat.
  - Hiện một nút nổi `IconLayoutSidebar` ở góc trên-trái của `main` (hoặc trong `Header` / phía trên `Home`) để mở lại.
  - Tooltip/aria-label: "Hiện thanh bên" / "Ẩn thanh bên".
- Phím tắt: `Ctrl/Cmd + B` để toggle.
- Chuyển đổi mượt bằng `transition-[width]` 200ms; nội dung sidebar dùng `overflow-hidden` để không nhảy layout khi thu gọn.

### Thay đổi code
1. `ChatWorkspace` (parent):
   - Thêm state `collapsed` + effect đọc/ghi localStorage.
   - Thêm listener `keydown` cho `Ctrl/Cmd+B`.
   - Truyền `collapsed` và `onToggle` xuống `Sidebar`.
   - Render một nút floating toggle khi `collapsed` (ở đầu `main`, position để không đè lên nội dung: `absolute left-3 top-3` hoặc chèn vào `Header` và `Home`).
2. `Sidebar`:
   - Nhận `collapsed`, `onToggle`.
   - `<aside>` dùng class động: `w-[248px]` vs `w-0 border-r-0` với `transition-[width] duration-200 overflow-hidden`.
   - Nút `IconLayoutSidebar` gọi `onToggle`.

### Không thay đổi
- Không đụng đến logic chat, persistence, mock, tokens.
- Không thêm variant mini/icon-only (đơn giản là ẩn hẳn theo yêu cầu "collapse").

### Verify
- Reload → trạng thái collapsed giữ nguyên.
- Toggle bằng nút và `Ctrl+B` đều hoạt động.
- Không còn hydration mismatch mới; đọc localStorage trong `useEffect` (SSR-safe).
