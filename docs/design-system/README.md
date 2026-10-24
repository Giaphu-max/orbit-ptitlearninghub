Hệ thống thiết kế cho Orbit khi chạy như một sản phẩm số chính thức của Học viện Công nghệ Bưu chính Viễn thông (PTIT). Mục tiêu: mở Orbit cạnh S-Link, QLĐT, Hệ thống bài giảng số, người dùng thấy ngay đây là "người nhà", nhưng Orbit vẫn giữ chất riêng là học tập trung, có điểm dừng.

## Nguyên tắc

- **Trắng là nền, đỏ là hành động.** Mọi sản phẩm số PTIT đều nền sáng, thẻ trắng, đỏ chỉ dùng cho thanh nhận diện, nút chính, mục đang chọn và link "Xem tiếp ›". Orbit làm đúng như vậy: không phủ đỏ kín màn trừ khoảnh khắc thưởng.
- **Đúng mã màu của logo.** Logo chính thức dùng đỏ `ptit-red-500` (#DE221A) và ngôi sao `star-500` (#EFF003); lockup tên Học viện dùng đỏ `ptit-red-600` (#BC2626) và xám than `ink` (#373D4E). Hành động dùng `ptit-red-600`, thanh nhận diện `ptit-red-700` (#9F2925). Bỏ đỏ hồng #C4161C cũ của Orbit.
- **Chữ navy như LMS.** Tiêu đề và số lớn dùng `ink-strong` (navy #0A1A50), chữ thân `ink`. Navy + đỏ + trắng là bộ ba nhận diện của PTIT trên web.
- **Vàng chỉ là ngôi sao.** `star-500` là vàng ngôi sao trong logo, chỉ dùng trong logo và minh họa ngôi sao. Trên giao diện, phần thưởng (XP, huy hiệu, đèn cửa sổ A2) dùng `gold-500` dịu hơn để đứng được trên nền trắng.
- **Quỹ đạo là sợi chỉ nối.** Logo PTIT có một vầng elip bao quanh chữ; tên Orbit (quỹ đạo) mượn chính hình ảnh đó. Dùng đường cong elip mảnh làm họa tiết (cover, nền hero, loading), không vẽ lại logo.

## Logo

- Dùng file gốc trong nhóm Logos. Không tự vẽ lại, không đổi màu, không kéo giãn, không thêm hiệu ứng.
- `ptit-lockup.svg` (vector): logo + "HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG" + "Posts and Telecommunications Institute of Technology". Dùng ở chân trang, màn đăng nhập/chọn vai trò, trang giới thiệu, slide.
- `ptit-logo.png`: logo đứng (vầng quỹ đạo + PTIT + ngôi sao + dải sách), nền trong suốt. Dùng trong ô logo ở header, favicon lớn, màn chờ.
- `ptit-wordmark.jpg`: chữ PTIT với ngôi sao, không có vầng và sách. Chỉ dùng khi cần chữ to trên nền trắng (bìa, video).
- `ptit-logo-sticker.png` (viền trắng) dùng trên ảnh hoặc nền tối; `ptit-logo-framed.jpg` (khung đỏ vuông) dùng làm ảnh đại diện mạng xã hội, không dùng trong giao diện.
- Trên nền trắng: logo màu gốc. Trên `ptit-red-600`/`ptit-red-700` hoặc nền tối: đặt logo màu gốc trong ô trắng bo `radius-sm` (như header Orbit), hoặc dùng bản sticker.
- Khoảng trống quanh logo tối thiểu bằng chiều cao chữ "T"; logo đứng cao tối thiểu 24px, lockup cao tối thiểu 32px.
- Header: logo trái, cạnh tên sản phẩm "Orbit" đậm và dòng phụ "Học viện Công nghệ BCVT" cỡ `body-sm` màu `ink-muted`, giống S-Link và Hệ thống bài giảng số.

## Màu

- Nền trang `surface-page`, thẻ `surface` với viền `line` và `shadow-card`. Không dùng màu đỏ làm nền thẻ thường.
- Nút chính: nền `ptit-red-600`, chữ `on-brand`, bóng `shadow-brand`; nhấn: `ptit-red-700`.
- Link hành động và eyebrow: `red-ink`.
- Mục đang chọn ở sidebar: nền `ptit-red-100`, chữ `red-ink`, gạch chân hoặc vạch trái `ptit-red-700` (kiểu QLĐT).
- Banner chào, vùng gợi ý: nền `ptit-red-50`, chữ `ink-strong`.
- Chữ lớn, vầng quỹ đạo, minh họa thương hiệu: `ptit-red-500`. Biểu đồ nhiều chuỗi: `ptit-red-600`, `steel-500`, `rose-400`, `gold-500`.
- Thanh nhận diện trên cùng (khi cần giống QLĐT/LMS): nền `ptit-red-700`, chữ `on-brand`.
- Trạng thái: hoàn thành `success` trên `success-bg`; tiến độ thông tin `info`; cảnh báo `warning-ink` trên `gold-100`; lỗi `danger` luôn kèm icon và câu giải thích, vì cùng họ đỏ với thương hiệu.
- Focus bàn phím: viền 2px `focus-ring`, offset 2px. Xanh để không lẫn với đỏ.
- Giao diện tối (trang chủ 3D ban đêm, studio): nền `surface-page` tối ngả navy, chữ đỏ đổi sang `red-ink` sáng (#FF8A80). Nút chính vẫn `ptit-red-600` chữ trắng.

## Chữ

- Be Vietnam Pro cho toàn bộ chữ (thiết kế cho tiếng Việt, dấu đẹp ở cỡ lớn), JetBrains Mono cho số XP, mốc thời gian, mã môn và eyebrow.
- Thang chữ: `display` (hero), `headline` (tiêu đề chương), `title` (tên khóa, thẻ lớn), `section` (đầu mục kiểu "Lớp tín chỉ"), `body`, `body-sm`, `label`, `eyebrow`, `numeric`.
- Tiêu đề viết hoa chữ đầu câu, không viết HOA toàn bộ (trừ `eyebrow` và mã môn). Tiêu đề cân dòng (`text-wrap: balance`).
- Số đếm dùng `numeric` với tabular-nums để không nhảy khi đếm XP.

## Bố cục và khuôn mẫu PTIT

- **Đầu mục có link phải**: mỗi khối bắt đầu bằng tiêu đề `section` bên trái và link `label` màu `red-ink` "Xem tất cả ›" hoặc "Xem tiếp ›" bên phải, như S-Link và QLĐT.
- **Thẻ lớp/khóa**: mã môn `eyebrow` màu `red-ink` → tên môn `title` → hàng ô thống kê trên `surface-sunken` → "Tiếp theo" / "Tiến trình" → thanh tiến độ. Bo `radius-lg`.
- **Chip "Mới"**: nhãn nhỏ nền `ptit-red-600` chữ trắng đặt trước dòng thông báo mới.
- **Lưới**: thẻ 4 cột desktop (S-Link), 2 cột tablet, 1 cột mobile; khe `space-3`. Lề trang `space-8` desktop, `space-4` mobile.
- **Bo góc**: nút và ô nhập `radius-sm`, thẻ `radius-lg`, thẻ hero Orbit `radius-xl`, chip `radius-full`.
- **Đổ bóng**: nhẹ, ngả navy. Sản phẩm PTIT gần như phẳng; chỉ dùng `shadow-raised` cho lớp nổi.

## Chuyển động

- Nhanh và tiết chế: 150ms phản hồi, 250ms chuyển trạng thái, 450ms chuyển trang; easing cubic-bezier(.22,1,.36,1).
- Chỉ khoảnh khắc thưởng (XP, lên cấp, huy hiệu, tòa A2 sáng đèn) mới dùng chuyển động lớn và vàng `gold-500`.
- Tôn trọng `prefers-reduced-motion`: bỏ bay, đổi trạng thái ngay.

## Giọng văn

- Tiếng Việt, gọi người học là "bạn", xưng ngầm (không "tôi", không "chúng tôi" trừ thông báo hệ thống). Gọi "sinh viên", "giảng viên", "Học viện" (viết hoa) như các cổng chính thức.
- Câu ngắn, nói việc cần làm: "Học tiếp", "Xem tất cả", "Đọc ngay", "Mở bằng 60 XP". Không dấu chấm than thừa, không emoji trong giao diện.
- Ngày theo kiểu Việt Nam `24/10/2026`, giờ `09:00`, số ngăn cách hàng nghìn bằng dấu chấm `2.615 XP`.
- Lỗi nói rõ chuyện gì xảy ra và làm gì tiếp: "Trợ giảng AI đang quá tải. Thử lại sau ít phút."

## Icon

- Dùng lucide-react, nét 1.75–2px, cỡ 16/20/24px, màu theo chữ đi kèm. Các cổng PTIT dùng icon nét mảnh tương tự ở sidebar.
- Không dùng emoji làm icon. Không dùng icon nhiều màu ngoài minh họa trống (empty state).

## Áp dụng cho Orbit

- Xem mục "Áp dụng vào code Orbit" để đổi token trong `src/index.css` và `tailwind.config.js`.
- Thứ tự làm: token màu → header + sidebar/nav → thẻ khóa học & đầu mục → nút, chip → màn tối (trang chủ 3D, studio).
