# Orbit – PTIT Learning Hub

Bản phát triển tiếp của Orbit để dự thi **"Ứng dụng AI trong giảng dạy" 2026** (Công đoàn PTIT). Nhóm đã vào chung kết.
**Hạn nộp: 30/10/2026**: sản phẩm phần mềm + video thuyết minh. Vòng chung khảo demo trực tiếp 10–20/11.
Người dùng: sinh viên khoa Đa phương tiện PTIT và giảng viên. Giám khảo là đại diện các khoa, phòng Đào tạo.

## Phạm vi: bản demo, frontend là chính
Sản phẩm chưa đưa vào sử dụng thực tế, nên **không làm backend** (không database, không đăng nhập thật).
- **Frontend làm đầy đủ, chỉn chu**: đây là phần giám khảo nhìn và bấm.
- **AI chạy thật**: trợ giảng AI và chấm ảnh gọi Gemini thật khi người dùng thao tác; nội dung học (transcript, quiz, bài đọc) do Gemini tạo thật, nhưng tạo sẵn một lần và lưu thành JSON.
- Kiến trúc đầy đủ (database, phân quyền, tính XP ở server) chỉ trình bày trong video thuyết minh như hướng triển khai tại Học viện.

## Tiêu chí chấm (dùng để ra quyết định)
- Nội dung & tính ứng dụng 30%: đúng nhu cầu dạy/học thật, nội dung chính xác, triển khai được tại Học viện
- Sáng tạo & phương pháp 30%: cách dùng AI mới lạ, hiệu quả, mở rộng được
- Công nghệ & kỹ thuật 30%: ổn định, UX tốt, tích hợp AI hiệu quả, an toàn thông tin
- Khác 10%: trình bày, tài liệu hướng dẫn, video demo

## Triết lý sản phẩm
**Học tập trung, có điểm dừng; phần thưởng gắn với việc thực sự hiểu bài.**
- Không có feed cuộn vô hạn. Nội dung khám phá là số lượng bài đọc ngắn có giới hạn mỗi ngày.
- Gamification thưởng cho **mức độ nắm vững** (trả lời đúng, sửa được lỗi sai, hoàn thành lộ trình), không thưởng cho thời gian lướt hay số lần bấm.
- AI là trợ giảng: mọi nội dung AI sinh ra bám vào bài giảng thật, có dẫn nguồn, giảng viên duyệt được.

## Stack
- Vite + React 19 + TypeScript, Tailwind 3, shadcn/ui, lucide-react, react-router-dom 7
- three.js / @react-three/fiber / drei cho phần 3D
- Thư viện `motion` cho chuyển động
- AI: **Gemini API** gọi qua **Vercel serverless functions** trong thư mục `api/`
- Deploy: **Vercel** (miễn phí), chạy local bằng `vercel dev` để có cả frontend lẫn `api/`
- **Bỏ Supabase**: gỡ `src/lib/supabase.ts`, `AuthContext`, `services/api.ts` và mọi chỗ phụ thuộc

## Dữ liệu và AI
- **Nội dung tĩnh trong `src/data/`** (JSON, có type TypeScript): khóa học, bài học, transcript có mốc thời gian, tóm tắt, khái niệm, câu hỏi quiz + câu biến thể, bài đọc Orbit Daily, cây kỹ năng, huy hiệu.
- **Video bài giảng lấy từ kho YouTube có sẵn**: nhúng bằng YouTube IFrame Player API để tạm dừng ở mốc quiz, tua tới mốc thời gian khi bấm chip, theo dõi thời điểm đang xem. Không tự host video.
- **Script `scripts/generate-content.ts`**: chạy local một lần, nhận danh sách link YouTube, gửi từng link cho Gemini để tạo transcript có mốc thời gian, tóm tắt, khái niệm, câu hỏi quiz kèm mốc dừng, bài đọc Daily; ghi kết quả ra `src/data/`. Nội dung là AI tạo thật, nhưng lúc demo không tốn lượt API.
- **Hàm serverless** (mỗi hàm một file trong `api/`):
  - `api/chat.ts`: trợ giảng AI, nhận câu hỏi + transcript bài đang học, trả lời bám nội dung, kèm mốc thời gian dạng có cấu trúc (JSON) để frontend hiện chip bấm tua.
  - `api/grade-photo.ts`: nhận ảnh chụp từ studio 3D (base64), trả điểm bố cục, ánh sáng, nhận xét, vùng cần chỉnh dạng JSON.
  - `api/explain.ts`: giải thích khi sinh viên trả lời sai quiz.
- **Bảo mật**: `GEMINI_API_KEY` chỉ nằm trong biến môi trường của Vercel (và `.env.local` khi chạy local), **không bao giờ dùng tiền tố `VITE_`**, không gọi Gemini từ trình duyệt. Tên model đọc từ biến `GEMINI_MODEL`.
- **Lỗi và hạn mức**: hết lượt hoặc lỗi mạng thì hiện thông báo thân thiện bằng tiếng Việt, không để màn hình trắng; giới hạn độ dài câu hỏi ở server.
- **Trạng thái người dùng** (XP, streak, tiến độ, huy hiệu, nội dung giảng viên đã duyệt): lưu `localStorage` qua một store duy nhất (ví dụ Zustand có persist), bọc try/catch; có nút "Đặt lại dữ liệu demo".
- **Vai trò**: màn chọn "Sinh viên / Giảng viên" thay cho đăng nhập.
- Giao diện tiếng Việt, responsive. Không commit `.env*`.

## Ngôn ngữ thiết kế: PTIT
UI là điểm mạnh nhất của sản phẩm (nhóm học khoa thiết kế), nhưng không được làm chậm hay phá vỡ UX.
- **Nhận diện PTIT**: đỏ PTIT (tạm dùng `#C4161C`) làm màu chủ đạo, kết hợp trắng và trung tính ấm. Không cần đúng tuyệt đối mã màu; tông tham khảo từ sản phẩm số của trường (Slink, Quản lý đào tạo).
- **Mockup đã duyệt** (bám theo khi dựng màn hình): trang chủ 3 tầng (hero tối gradient đỏ + thẻ "Học tiếp" → Orbit Daily với bài ưu tiên to gấp đôi → dải tiến độ thu gọn), trang học bài (video + quiz củng cố + trợ giảng AI bên phải), màn hình nhận XP phủ đỏ.
- **Font**: Be Vietnam Pro cho chữ, JetBrains Mono cho số XP và mốc thời gian.
- **Đỏ là điểm nhấn, không phủ kín màn hình**: nền sáng (mặc định) hoặc tối, khoảng trắng rộng, đỏ dùng cho hành động chính, trạng thái tiến bộ, khoảnh khắc thưởng.
- **Typography kiểu editorial**: tiêu đề lớn, đậm, tương phản mạnh với chữ thân.
- **Design tokens trước, màn hình sau**: màu, font, bo góc, đổ bóng, thời lượng/easing motion định nghĩa một chỗ (Tailwind config + CSS variables), mọi component dùng lại.
- **Giao diện sáng/tối, gắn với cảnh 3D**: một nút chỉ có icon (mặt trời/mặt trăng, có `aria-label` và tooltip) ở góc trên phải chuyển cả web. Sáng = hoàng hôn, tối = buổi tối có đèn cửa sổ trong cảnh 3D; web và cảnh đổi cùng lúc, chuyển mượt (tắt khi `prefers-reduced-motion`). Mặc định sáng, lưu `localStorage` khóa `orbit-theme` (riêng với trạng thái demo, nút "Đặt lại dữ liệu demo" không đổi giao diện); script trong `index.html` đặt class `dark` trước khi vẽ để không nháy.
  - **Bộ màu tối chỉ là giá trị token**: class `dark` trên `<html>` đổi CSS variables trong `src/index.css`; component không viết `dark:` cho màu. Không dùng thang `gray-*` (đã bỏ khỏi Tailwind config): chữ dùng `text-foreground` / `text-muted-foreground`, nền phụ `bg-muted`, viền `border-border`. `brand-50…300` là thang theo giao diện (nền nhạt ở sáng, đỏ sẫm ở tối); chữ đỏ dùng `text-brand-ink`; nền tối cố định (khung video, lớp phủ, thông báo) dùng `bg-ink`; chữ/nền trắng cố định trên nền đỏ hoặc tối dùng `text-ink-foreground` / `bg-ink-foreground`; đỏ nhạt trên nền tối dùng `text-brand-light`.
  - **Không viết cứng màu** (hex, `text-white`/`bg-white`/`*-black`, `gray-*`, màu Tailwind ngoài token) trong component. Ngoại lệ duy nhất: bảng màu vật thể và ánh sáng của mô hình 3D trong `campus-palette.ts`.
  - **Tương phản chữ tối thiểu 4.5:1 ở cả hai giao diện** (cỡ lớn 3:1). Khi đổi giá trị token phải tính lại; các cặp đã kiểm tra: `foreground`, `muted-foreground`, `brand-ink`, `accent-foreground`, `success`, `info` trên `background/surface/card/muted/brand-soft`. Sửa `tailwind.config.js` thì khởi động lại server dev (Tailwind không nạp lại config đang chạy, màu sẽ sai).
  - **Giữ nguyên ở cả hai giao diện**: hero (`.bg-hero`, luôn tối gradient đỏ) và màn hình nhận XP (`.bg-reward`, luôn phủ đỏ) dựng từ token `--hero-*`, `--reward-*`.
  - Vật thể thêm vào trang mới phải kiểm tra cả hai giao diện (trang chủ, học bài, giảng viên, hành trình).
- **Motion có chủ đích**: chuyển trang mượt, phản hồi khi trả lời quiz, hiệu ứng nhận XP/lên cấp/mở huy hiệu. Tôn trọng `prefers-reduced-motion`; animation không chặn thao tác.
- **Hero 3D**: mô hình low-poly khuôn viên PTIT (tòa A2 có đồng hồ và dải kính xanh, A3 vàng mái đỏ, hội trường, A1, canteen, cổng) dựng từ khối cơ bản bằng React Three Fiber; phủ toàn bộ hero (nằm sau chữ), kéo để xoay bằng OrbitControls và tự xoay chậm khi không kéo (cảm ứng chỉ tự xoay), hover nhấc tòa nhà kèm nhãn khóa học, chế độ buổi tối sáng đèn cửa sổ (theo giao diện tối của web); lazy-load, có fallback ảnh tĩnh khi máy yếu.
- Hiệu năng: lazy-load phần 3D và ảnh lớn; ảnh dùng WebP/AVIF.

## Tính năng

### P0 – Lõi học tập + AI (phải xong trước 24/10)
1. **Dọn nền + AI proxy**: gỡ Supabase, dựng cấu trúc `src/data/` + store, design tokens PTIT, `api/chat.ts` chạy được qua `vercel dev`.
2. **Nội dung demo**: `scripts/generate-content.ts`, tạo nội dung cho 2–3 bài giảng thật (ưu tiên môn Nhiếp ảnh hoặc Bố cục).
3. **Trang học bài**: video + trợ giảng AI bám nội dung bài, chip mốc thời gian bấm để tua video.
4. **Micro-quiz trong video + vòng củng cố**: video dừng ở mốc kiến thức; sai → AI giải thích → tua lại đoạn chứa đáp án → câu biến thể cùng cấp độ.
5. **Trang giảng viên**: duyệt/sửa nội dung AI sinh ra trước khi xuất bản; thống kê lớp (dữ liệu mẫu) cho thấy khái niệm nào nhiều sinh viên sai.

### P1 – Điểm nhấn (25–27/10)
6. **Orbit Daily – bài đọc tổng hợp ngắn**:
   - Bài đọc 2–3 phút tổng hợp từ nhiều bài giảng, mỗi đoạn dẫn nguồn về bài học và mốc thời gian.
   - **Giới hạn 3 bài/ngày**, ưu tiên theo lỗ hổng kiến thức; hết lượt hiện màn hình "Hôm nay đủ rồi" kèm tóm tắt đã học.
   - Mỗi bài kết thúc bằng 1–2 câu kiểm tra nhanh; trả lời đúng mới tính hoàn thành.
   - Mở thêm bài bằng cách hoàn thành nhiệm vụ học tập.
7. **Gamification theo mức độ nắm vững**:
   - **XP**: trả lời đúng quiz, sửa đúng sau khi sai (gấp đôi, khuyến khích học từ lỗi), hoàn thành bài đọc, đạt điểm cao trong Virtual Director.
   - **Cấp độ + chuỗi ngày học (streak)**, có 1 lần "đóng băng streak"/tuần.
   - **Cây kỹ năng**: khái niệm sáng dần theo mức nắm vững; khái niệm nâng cao mở khi khái niệm nền đạt 80%.
   - **Nhiệm vụ hằng ngày**, **huy hiệu** gắn năng lực cụ thể, **bảng xếp hạng lớp** (dữ liệu mẫu, có thể ẩn tên).
8. **Virtual Director**: studio 3D đơn giản (phông, vật thể, 2–3 đèn), chỉnh tiêu cự/góc máy/đèn, lưới 1/3; chụp canvas → `api/grade-photo.ts` chấm bố cục & ánh sáng, khoanh vùng cần chỉnh.

### P2 – Nếu còn thời gian
- Test tổng hợp cuối chương + gợi ý lộ trình ôn tập
- Prompt-to-Environment (AI trả JSON thông số đèn cho studio)

### Bỏ
- Supabase và mọi phần backend
- Feed video ngắn (`orbit-feed`, `orbit-discover-view`): thay bằng Orbit Daily
- Video rẽ nhánh
- Phòng VR cũ (`orbit-vr-view`, `vr-viewport`)

## Lịch
- 20–21/10: P0.1, P0.2 · 22–23/10: P0.3, P0.4 · 24/10: P0.5
- 25/10: Orbit Daily · 26/10: Gamification · 27/10: Virtual Director
- 28/10: sửa lỗi, deploy Vercel, README · 29–30/10: video thuyết minh, nộp

## Lệnh
- `npm run dev:vercel` (frontend + `api/` qua `npx vercel dev`, cổng 3000; biến `GEMINI_*` lấy từ môi trường Development trên Vercel, hàm trong `vercel dev` không đọc `.env.local`) · `npm run dev` (Vite, cũng phục vụ `api/` qua middleware dev trong `vite.config.ts`) · `npm run build` · `npm run lint`
- Vercel CLI dùng qua `npx vercel` (không cài global); thư mục đã `vercel link` tới project `orbit-ptitlearninghub`.
- `npx tsx scripts/generate-content.ts` (cần `GEMINI_API_KEY` trong `.env.local`)
- Commit sau mỗi bước chạy được.
