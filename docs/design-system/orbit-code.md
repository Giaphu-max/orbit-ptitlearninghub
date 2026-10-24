# Áp dụng vào code Orbit

Đổi token tại một chỗ (`src/index.css`, khối `:root` và `.dark`), Tailwind tự ăn theo. Giá trị dưới đây là đích; tên biến giữ nguyên để không phải sửa component.

## Thang đỏ `--brand-*` (kênh RGB)

| Biến | Cũ | Mới | Nguồn |
|---|---|---|---|
| `--brand-50` | 253 243 242 | 251 241 241 (#FBF1F1) | nền banner LMS |
| `--brand-100` | 251 227 226 | 243 219 219 (#F3DBDB) | đầu thẻ LMS |
| `--brand-200` | 246 196 195 | 236 214 215 (#ECD6D7) | mục chọn QLĐT |
| `--brand-500` | 212 47 49 | 222 34 26 (#DE221A) | đỏ logo chính thức |
| `--brand-600` | 196 22 28 | 188 38 38 (#BC2626) | đỏ chữ lockup Học viện |
| `--brand-700` | 161 17 23 | 159 41 37 (#9F2925) | thanh QLĐT |
| `--brand-800` | 129 15 20 | 122 31 28 (#7A1F1C) | nội suy |
| `--brand-900` | 94 12 16 | 74 19 17 (#4A1311) | nền thưởng |

`--brand`, `--primary`, `--ring` (HSL): đổi sang `0 67% 44%` (#BC2626). `--brand-ink` sáng giữ cùng giá trị, tối `5 100% 75%` (#FF8A80).

## Chữ và nền

- `--foreground`, `--card-foreground`: `225 17% 26%` (#373D4E, xám than của lockup). Thêm `--foreground-strong: 226 78% 18%` (#0A1A50) cho tiêu đề, map Tailwind `text-strong`.
- `--muted-foreground`: `230 12% 45%` (#646880).
- `--surface`: `0 0% 96%` (#F5F5F5) làm nền trang; `--card` giữ trắng.
- `--border`: `300 5% 90%` (#E6E3E6).
- Đổ bóng đổi tông từ nâu ấm sang navy: `hsl(226 78% 18% / …)`.

## Logo

- Thay ô chữ "PTIT" ở header bằng `ptit-logo.png` (nhóm Logos của design system, hoặc `docs/design-system/assets/Logos/`), đặt vào `public/brand/`.
- Chân trang và màn chọn vai trò dùng `ptit-lockup.svg`.
- Favicon giữ biểu tượng Orbit riêng; không dùng logo Học viện làm favicon của sản phẩm.

## Vàng thưởng

- `--reward-gain` và màu đèn cửa sổ A2 (`CAMPUS.windowTier`) dùng #EAAE3C (gold-500); chip XP nền #FCF1D9 chữ #3A2408.

## Giao diện tối

- `--background` tối: `229 30% 7%` (#0E1019); `--card` tối `229 27% 12%` (#161927). Ngả navy để khớp cảnh trời đêm của trang chủ 3D.

## Kiểm tra sau khi đổi

- Chữ trắng trên `--brand-600` 6.1:1, trên `--brand-700` 7.4:1.
- `red-ink` trên nền trắng 6:1, trên nền tối 7.6:1.
- Chạy lại `npm run build`, chụp trang chủ, trang học bài, /today, /studio ở cả sáng và tối.
