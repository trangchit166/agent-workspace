## Chỉnh menu bên trái theo design system shadcn (preset `b37sR6ujw` — vega / blue / indigo / large radius / tabler)

Chỉ đụng vào phần sidebar trong `src/components/chat/ChatWorkspace.tsx` và một vài token màu/radius trong `src/styles.css`. Không thay đổi logic chat, persistence, mock.

### Đặc trưng cần bám sát từ preset
- Radius "large": các bề mặt/nút bo `rounded-xl` (12px+), item nav `rounded-lg`.
- Nền sidebar sáng, phân tách bằng đường viền 1px mảnh, không đổ bóng.
- Primary = xanh indigo tươi (#4F46E5-ish), foreground trắng, dùng cho CTA "Trò chuyện mới".
- Item active có nền surface trắng nổi trên nền `sidebar` xám nhẹ + shadow-xs (giống card trong preset).
- Icon tabler nét mảnh, stroke 1.75, size 18. Chữ 13–14px, medium.
- Section label uppercase, tracking-wide, 11px, muted (giống "RETIREMENT", "UPCOMING" trong preset).
- Avatar user bo tròn, khối info gọn với divider phía trên.

### Thay đổi cụ thể

1. `src/styles.css`
   - Tinh chỉnh `--radius` từ `0.625rem` → `0.75rem` để khớp radius "large".
   - Đổi `--sidebar` sang tông trắng-xám rất nhẹ (gần `slate-50/60`) để item active nền `--background` (trắng) nổi rõ.
   - Không đụng brand blue (đã là indigo phù hợp).

2. `Sidebar` trong `ChatWorkspace.tsx`
   - CTA "Trò chuyện mới" tách thành nút primary đầy: `bg-primary text-primary-foreground rounded-xl h-10`, icon + label + phím tắt bên phải (kbd trong suốt trên nền primary). Không dùng chung style `SidebarItem` cho nút này nữa.
   - "Tìm kiếm" giữ dạng nav item nhưng phong cách shadcn: `rounded-lg h-9`, hover `bg-accent`, kbd viền mảnh.
   - Nhóm secondary ("Dự án", "Chợ Agent", "Artifacts", "Kết nối", "Xây trong Console"): thêm label section `NAVIGATION` (uppercase, 11px, muted, `px-3 pt-3 pb-1`).
   - Danh sách hội thoại: đổi tiêu đề nhóm sang uppercase tracking-wide 11px muted; item `rounded-lg px-3 h-8`, active dùng `bg-background text-foreground shadow-xs border border-border/60`.
   - Divider dùng `border-t border-border/60` full-bleed thay vì đường 1px inset ngắn.
   - Khối user: bọc trong "card mini" `rounded-xl border border-border/60 bg-background px-2 py-2` để giống card style của preset; giữ avatar, tên, nút selector/bell.
   - Header brand: giữ "FPT.Ai", chỉnh badge `.Ai` sang `rounded-md` (đồng bộ radius mới).
   - Chế độ collapsed (w-14): giữ nguyên hành vi icon-only; đồng bộ radius `rounded-lg`, active `bg-background shadow-xs`, brand chỉ hiện badge vuông primary.

3. `SidebarItem`
   - Bỏ shadow ngoài ý muốn ở active khi expanded, thay bằng `bg-background text-foreground shadow-xs border border-border/60`.
   - Hover: `hover:bg-accent` (đã có), text 13px, icon 18/stroke 1.75.
   - Kbd shortcut: viền `border-border`, nền `bg-background`, text muted, cao 18px, radius 4px.

### Không thay đổi
- Cấu trúc component, props, state (`collapsed`, `onToggle`, phím tắt Ctrl+B).
- Nội dung, thứ tự item, i18n Việt.
- Vùng chat/main, header, home.

### Verify
- So khớp mắt thường với screenshot preset: nút primary xanh indigo bo lớn, item active là "card trắng" nổi trên nền sidebar xám nhạt, section label uppercase, kbd mảnh.
- Toggle sidebar (nút + Ctrl+B) vẫn hoạt động, radius/nền đồng bộ ở cả 2 chế độ.
- Không có lỗi TS/build.
