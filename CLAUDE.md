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
  - **Hồ sơ demo mặc định** (`makeDemoProfile()` trong store): như đã học khoảng 2 tuần (chuỗi 12 ngày, cấp 7, 2.480 XP, đọc 1/3 bài Daily hôm nay, 1/3 nhiệm vụ xong, đang xem bài ở 46%, cây kỹ năng 5 khái niệm với mức nắm vững khác nhau). Lần đầu mở và nút "Đặt lại dữ liệu demo" đều về hồ sơ này; ngày tính theo hôm nay. Công thức cấp: cấp n bắt đầu ở 60·(n−1)² XP.
- **Vai trò**: màn chọn "Sinh viên / Giảng viên" thay cho đăng nhập.
- Giao diện tiếng Việt, responsive. Không commit `.env*`.

## Ngôn ngữ thiết kế: PTIT
UI là điểm mạnh nhất của sản phẩm (nhóm học khoa thiết kế), nhưng không được làm chậm hay phá vỡ UX.
- **Nhận diện PTIT**: đỏ PTIT (tạm dùng `#C4161C`) làm màu chủ đạo, kết hợp trắng và trung tính ấm. Không cần đúng tuyệt đối mã màu; tông tham khảo từ sản phẩm số của trường (Slink, Quản lý đào tạo).
- **Mockup đã duyệt** (`docs/mockup-trang-chu.pdf`, bám theo khi dựng màn hình): thanh điều hướng ngang trong suốt đè lên hero (logo PTIT + Orbit — dùng `src/assets/brand/logo.(svg|png|webp)` nếu có, không thì khối vuông trắng chữ PTIT đỏ — Trang chủ / Hôm nay / Khóa học / Studio 3D; **mỗi mục mở trang riêng**: `/`, `/today`, `/learning`, `/studio`, mục đang chọn theo route; chỉ "Trang chủ" khi đang ở trang chủ thì về chương hero, chip streak, chip cấp + XP, nút sáng/tối, avatar; mobile thu thành menu; các trang khác dùng thanh nền thường, không còn sidebar) → hero nền kem ấm ban ngày, tối thì buổi tối đèn cửa sổ (lời chào theo tên, "Hôm nay chỉ cần 25 phút.", thẻ "Học tiếp" có ảnh lưới 1/3, thanh tiến độ, vệt sáng; mô hình 3D bên phải; đáy cong mềm) → Orbit Daily ("3 bài đọc. Rồi nghỉ.", thẻ ưu tiên đỏ to gấp đôi + 2 thẻ nhỏ, thẻ đã đọc nhạt đi) → "Tiến độ của bạn" (cây kỹ năng thu gọn + nhiệm vụ hôm nay); trang học bài (video + quiz củng cố + trợ giảng AI bên phải); màn hình nhận XP phủ đỏ.
- **Font**: Be Vietnam Pro cho chữ, JetBrains Mono cho số XP và mốc thời gian.
- **Đỏ là điểm nhấn, không phủ kín màn hình**: nền sáng (mặc định) hoặc tối, khoảng trắng rộng, đỏ dùng cho hành động chính, trạng thái tiến bộ, khoảnh khắc thưởng.
- **Typography kiểu editorial**: tiêu đề lớn, đậm, tương phản mạnh với chữ thân.
- **Design tokens trước, màn hình sau**: màu, font, bo góc, đổ bóng, thời lượng/easing motion định nghĩa một chỗ (Tailwind config + CSS variables), mọi component dùng lại.
- **Giao diện sáng/tối, gắn với cảnh 3D**: một nút chỉ có icon (mặt trời/mặt trăng, có `aria-label` và tooltip) ở góc trên phải chuyển cả web. Sáng = hoàng hôn, tối = buổi tối có đèn cửa sổ trong cảnh 3D; web và cảnh đổi cùng lúc, chuyển mượt (tắt khi `prefers-reduced-motion`). Mặc định sáng, lưu `localStorage` khóa `orbit-theme` (riêng với trạng thái demo, nút "Đặt lại dữ liệu demo" không đổi giao diện); script trong `index.html` đặt class `dark` trước khi vẽ để không nháy.
  - **Bộ màu tối chỉ là giá trị token**: class `dark` trên `<html>` đổi CSS variables trong `src/index.css`; component không viết `dark:` cho màu. Không dùng thang `gray-*` (đã bỏ khỏi Tailwind config): chữ dùng `text-foreground` / `text-muted-foreground`, nền phụ `bg-muted`, viền `border-border`. `brand-50…300` là thang theo giao diện (nền nhạt ở sáng, đỏ sẫm ở tối); chữ đỏ dùng `text-brand-ink`; nền tối cố định (khung video, lớp phủ, thông báo) dùng `bg-ink`; chữ/nền trắng cố định trên nền đỏ hoặc tối dùng `text-ink-foreground` / `bg-ink-foreground`; đỏ nhạt trên nền tối dùng `text-brand-light`.
  - **Không viết cứng màu** (hex, `text-white`/`bg-white`/`*-black`, `gray-*`, màu Tailwind ngoài token) trong component. Ngoại lệ duy nhất: bảng màu vật thể và ánh sáng của mô hình 3D trong `campus-palette.ts`.
  - **Tương phản chữ tối thiểu 4.5:1 ở cả hai giao diện** (cỡ lớn 3:1). Khi đổi giá trị token phải tính lại; các cặp đã kiểm tra: `foreground`, `muted-foreground`, `brand-ink`, `accent-foreground`, `success`, `info` trên `background/surface/card/muted/brand-soft`. Sửa `tailwind.config.js` thì khởi động lại server dev (Tailwind không nạp lại config đang chạy, màu sẽ sai).
  - **Hero không còn nền đỏ cố định**: giao diện sáng = trời kem ấm ban ngày (gradient `--sky-1…4` + quầng `--sky-glow`, nền trang `--stage-bg` #FBF7F2, chữ hero `text-foreground`, đỏ chỉ ở "25 phút." và hành động chính); giao diện tối = buổi tối đèn cửa sổ, trời xanh đêm (navy), không đỏ. Cảnh 3D đọc `--sky-2/3` (sương) và `--stage-deep` (nội thất); màu ánh sáng/hemisphere ở `campus-palette.ts`. Màn kiosk giữ nền tối riêng.
  - **Giữ nguyên ở cả hai giao diện**: màn hình nhận XP (`.bg-reward`, luôn phủ đỏ) dựng từ token `--reward-*`.
  - Vật thể thêm vào trang mới phải kiểm tra cả hai giao diện (trang chủ, học bài, giảng viên, hành trình).
- **Motion có chủ đích**: chuyển trang mượt, phản hồi khi trả lời quiz, hiệu ứng nhận XP/lên cấp/mở huy hiệu. Tôn trọng `prefers-reduced-motion`; animation không chặn thao tác.
- **Hero 3D**: mô hình low-poly khuôn viên PTIT (tòa A2 có đồng hồ và dải kính xanh, A3 vàng mái đỏ, hội trường, A1, canteen, cổng) dựng từ khối cơ bản bằng React Three Fiber; phủ toàn bộ hero (nằm sau chữ), kéo để xoay bằng OrbitControls và tự xoay chậm khi không kéo (cảm ứng chỉ tự xoay), hover nhấc tòa nhà kèm nhãn khóa học, chế độ buổi tối sáng đèn cửa sổ (theo giao diện tối của web); lazy-load, có fallback ảnh tĩnh khi máy yếu.
- **Cuộn trang chủ theo trạng thái**: hero + 3 chương nằm trong MỘT section cao (100 + 4×100)vh với khung sticky 100vh, 4 panel chồng nhau (`useScrollStage`). Vị trí cuộn chỉ chọn chương; máy quay bay theo thời gian (cubic Hermite từ S và vận tốc hiện tại, 1.5/2.8/2.4s, tối đa 3.6s), chữ hiện (class `on`) khi bay được 72%, riêng chương Hôm nay (và chiều về hero) ở 60%, đi lùi ở 50%. Header không cuộn trong trang chủ; chỉ rail bên phải, phím và cuộn mới đổi chương.
  - **Máy quay chạy theo tiến độ p (0→1)**: mỗi khung `p += dt / D × (1 + boost)`; Hermite, `revealAt` và vận tốc khi đổi hướng đều tính từ p. p vượt 0.97 = đã tới nơi (ghi `landedAt`; cắt cảnh/không bay thì `landedAt = now`). `boost` giảm `exp(−dt·2.2)`, về 0 khi bắt đầu chuyến bay mới, tối đa 3. Đang bay mà có bước mới: thời lượng ×0.6 (`CHAIN`, giữ vận tốc hiện tại làm v0); đi lùi ×0.7 (`BACK`), chữ hiện ở 50%.
  - **Wheel**: chuột (`deltaMode === 1` hoặc `wheelDeltaY` chia hết 120) khác touchpad; "cú vuốt mới" (`fresh`) = nghỉ ≥200ms, đổi chiều thật, hoặc delta tăng ≥3 lần liền sau khi đã giảm. Đang bay: mọi wheel bị `preventDefault`; cùng chiều bay thì tua nhanh (chuột: mỗi nấc +0.45; touchpad: +1 chỉ khi `fresh`, quán tính cú đầu không tính); ngược chiều + `fresh` thì bước về chương trước. Đã tới nơi: touchpad chỉ bước khi `fresh` (quán tính còn lại bị nuốt); chuột chưa `fresh` thì chờ 450ms từ `landedAt`, sau đó lăn đều tay đi từng chương; `MIN_GAP` 260ms chỉ chống bấm đúp. Ở hai đầu (hero lên, Studio xuống) chỉ nuốt quán tính (`decaying`, <1.2s từ `landedAt`) rồi thả cuộn tự nhiên, không kẹt trước footer. Cảm ứng vuốt >36px cùng chiều khi đang bay: boost +1.2, không thì bước; phím mũi tên/Page/Space cùng chiều khi đang bay: boost +0.9. Bước kế tính theo chương đích (`state`).
  - **Dòng hướng dẫn** (`[data-guide]`, `aria-live="polite"`, góc dưới trái, hook ghi chữ/độ hiện): hero "Cuộn để đi vào trường", "Hôm nay · 1/3 — cuộn tiếp: Khóa học" … "Studio · 3/3 — cuộn tiếp: cuối trang", đang bay "Cuộn thêm để chạy nhanh hơn"; ẩn ở footer; màn hẹp chỉ hiện ở hero.
  - **Cắt cảnh**: nhảy từ 2 chương trở lên (rail, nút "Trang chủ", Home/End, kéo thanh cuộn) đặt S thẳng tới điểm dừng, cuộn tức thì, phủ lớp màu nền (`[data-cut-veil]`) rồi mờ đi trong 0.5s, chữ mới hiện ngay. Lần đầu tải trang không chớp.
  - **Yên vị**: chưa nằm đúng vị trí chương hiện tại và đã >1s từ bước trước (vào vùng ghim từ footer, kéo thanh cuộn) thì bước đầu tiên về đúng chương đó, không nhảy qua; quán tính từ footer lên dừng ở Studio. Hero cuộn lên và Studio cuộn xuống thì cuộn tự nhiên. Giảm chuyển động và chế độ "Làm mờ cảnh 3D" không khóa cuộn. Đường vào A2 đi dưới dầm cổng trường (CatmullRomCurve3 trong `campus-scene.tsx`).
- Hiệu năng: lazy-load phần 3D và ảnh lớn; ảnh dùng WebP/AVIF.
  - **Hiệu năng cảnh 3D trang chủ**: canvas `dpr [1, 1.5]` + `PerformanceMonitor` (fps thấp → dpr 1); số đèn cố định **7** (hemisphere, sun, 2 đèn sảnh, 1 đèn phòng thực hành, key + fill của studio), không bật/tắt `visible` hay `castShadow` giữa chừng (đổi chúng làm three.js biên dịch lại shader); `shadowMap.autoUpdate = false`, chỉ `needsUpdate` khi tòa nâng lên, cửa kính mở, đổi vào/ra nhà hoặc chất lượng (nếu `dispose` shadow map thì phải đặt `needsUpdate` ngay, không thì shader lấy mẫu texture rỗng); `frameloop 'never'` khi tab ẩn hoặc footer đã phủ kín. Không dùng `filter`/`backdrop-filter` đè lên cảnh trang chủ: cảnh bớt rực bằng lớp `.stage-dim` (opacity theo `--on-stage`), nav kính trên trang chủ là nền gần đục, `lightCard` không blur; chữ hiện chỉ nhòe 4px cho h1/h2 và dòng ngắn. Thêm `?perf` vào URL để hiện FPS, dpr, draw calls, tam giác, số đèn.
  - **Nghẽn ở main thread/compositing, không phải GPU** (Safari ~15–19fps trong khi GPU rảnh): quy tắc khi sửa trang chủ.
    - **Một vòng rAF** (`src/lib/frame-loop.ts`): `useScrollStage` (Lenis + máy quay + thanh tiến độ, order 0) rồi canvas R3F (`FrameDriver`, `frameloop="never"` + `advance`, order 1). Không thêm vòng rAF riêng; không vẽ khi tab ẩn, footer phủ kín hoặc màn chuyển giao diện đang che.
    - **Không đọc layout lúc cuộn/vẽ**: `src/lib/page-metrics.ts` đo sẵn (mount + `ResizeObserver` + resize) `journeyTop`, `dist`, `footerTop`, `max`; vị trí cuộn lấy từ sự kiện scroll. Không gọi `getBoundingClientRect`/`offsetTop`/`scrollHeight` trong `readScroll`, wheel, `useFrame`, pointermove (dùng `offsetX/Y`) hay nav.
    - **Không đổi style ở phần tử cha mỗi khung**: không đặt CSS variable/data-attribute trên khung bọc hay `<html>`. `--on-stage`/`--kiosk-focus` đã bỏ: `onStage` đi qua `stageSignal` (JS), cảnh ghi `opacity` thẳng vào `.stage-dim`, `stage-veil`, rail chương, chỉ khi đổi quá ngưỡng (0,01; dim 0,002). Thanh tiến độ: `scaleX`, tối đa 1 lần/khung.
    - **Ít lớp compositing**: không `will-change` trên `[data-s]`/kiosk; chỉ đặt tạm trên lớp che cắt cảnh trong lúc mờ đi.
    - **Canvas đục trên WebKit** (hoặc `?opaque`): `alpha:false`, bầu trời vẽ bằng `scene.background` (CanvasTexture gradient `--sky-1…4` + quầng `--sky-glow`, dựng lại khi đổi giao diện sáng/tối); Chrome giữ `alpha:true` + gradient CSS.
    - **Nhãn tòa nhà** (drei `Html`) chỉ dựng khi đang hiện (chương hero), các chương khác gỡ hẳn; chưa chuyển sang sprite WebGL.
    - **Công cụ tìm thủ phạm** (`src/lib/perf.ts`, chỉ bật bằng query): `?perf` HUD (fps, JS trung bình mỗi khung gồm cả callback rAF + useFrame + sự kiện cuộn, khung chậm nhất trong 2 giây, dpr/calls/tris/đèn, cờ đang bật); cờ tắt từng phần: `?no3d` `?nolabels` `?nokiosk` `?noreveal` `?nolenis` `?opaque`. Đo trên Safari: thêm `?perf`, cuộn qua 4 chương, rồi thử lần lượt từng cờ xem fps nhảy bao nhiêu; cờ nào làm fps lên nhiều nhất là thủ phạm.
    - **Kết quả đo**: trên Chrome (cờ `?webkit`) JS ~3ms/khung với 3D, ~0,1ms khi `?no3d`, 60fps đủ 4 chương; chưa đo được trên Safari thật (mục tiêu ≥50fps), cần chạy `?perf` trên máy Safari.
  - **Hồ sơ Safari/WebKit** (`src/lib/browser.ts`: cờ `isWebKit` = Safari không phải Chromium, gắn class `is-webkit` lên `<html>`; thêm `?webkit` vào URL để ép bật trên Chrome khi thử): dpr tối đa 1.25 (thay 1.5), shadow map mặt trời 1024 (thay 2048), antialias giữ (thêm `?noaa` để thử tắt nếu `?perf` báo dưới 50fps lúc bay). CSS: `.is-webkit` bỏ hẳn `filter` và `filter` trong `transition` của hiệu ứng hiện chữ (chỉ opacity + trượt). Màn kiosk: `placeKiosk` chỉ ghi opacity/visibility/transform khi đổi (4 góc lệch <0.05px thì bỏ qua), phần tử màn có `will-change: transform`, `transform-style: flat`, `contain: strict`; trên Safari màn 3D dán ảnh tĩnh `drawKioskSnapshot` (cùng bố cục KioskScreen), lớp DOM thật (matrix3d, bấm được) chỉ hiện khi máy quay đã dừng ở kiosk (S không đổi ≥150ms) và không tính matrix khi đang ẩn. Không có `backdrop-filter`/`mix-blend-mode` đè lên cảnh trang chủ.

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
   - **Trang `/today`** (`orbit-today-view.tsx`, hook dùng chung `useTodayDaily` với chương Hôm nay ở trang chủ): tiêu đề "Hôm nay", 3 bài (thẻ ưu tiên đỏ to, bài đã đọc nhạt đi), nhiệm vụ hôm nay (`MissionList`), đủ 3 bài thì khối "Hôm nay đủ rồi" kèm tóm tắt đã học. Mọi chỗ trước đây dẫn tới `/#daily` (nhiệm vụ, footer, bài Daily) nay dẫn tới `/today`.
7. **Gamification theo mức độ nắm vững**:
   - **XP**: trả lời đúng quiz, sửa đúng sau khi sai (gấp đôi, khuyến khích học từ lỗi), hoàn thành bài đọc, đạt điểm cao trong Virtual Director.
   - **Cấp độ + chuỗi ngày học (streak)**, có 1 lần "đóng băng streak"/tuần.
   - **Cây kỹ năng**: khái niệm sáng dần theo mức nắm vững; khái niệm nâng cao mở khi khái niệm nền đạt 80%.
   - **Nhiệm vụ hằng ngày**, **huy hiệu** gắn năng lực cụ thể, **bảng xếp hạng lớp** (dữ liệu mẫu, có thể ẩn tên).
8. **Virtual Director**: studio 3D đơn giản (phông, vật thể, 2–3 đèn), chỉnh tiêu cự/góc máy/đèn, lưới 1/3; chụp canvas → `api/grade-photo.ts` chấm bố cục & ánh sáng, khoanh vùng cần chỉnh.

9. **Test cuối chặng + màn tổng kết chặng** (chặng = một bài trong khóa):
   - **Test cuối chặng** `/checkpoint/:lessonId`: 6 câu từ ngân hàng câu hỏi của bài (mỗi khái niệm ít nhất 1 câu, ưu tiên câu chưa gặp trong video), dùng lại giao diện làm bài của test cuối chương (60s/câu, đạt từ 80%, XP theo `final-test.ts`), cập nhật mức nắm vững; nộp xong sang `/recap/:lessonId`. Màn thưởng khi xong bài: nút chính "Làm test cuối chặng · 6 câu", nút phụ "Xem tổng kết".
   - **Tổng kết chặng** `/recap/:lessonId` (`orbit-recap-view.tsx`, số liệu ở `src/lib/recap.ts`): thanh tiến độ khóa, "Xong chặng N.", vòng điểm test, XP chặng (chia theo nguồn), câu trong video, mức nắm vững từng khái niệm trước/sau (vạch 80%, chip mốc video), "Học từ lỗi sai", huy hiệu mới hoặc gần đạt nhất, ôn tiếp (kèm bài Daily ưu tiên ngày mai), chặng kế. Hiệu ứng chỉ chạy lần đầu mở (`recapSeen`).
   - Store: `stageStart[lessonId]` (mức nắm vững, huy hiệu, XP lúc trả lời câu quiz đầu tiên của bài; hồ sơ demo có sẵn cho `ban-chat-dung-phi-tuyen`), `checkpoints[lessonId]`, `QuizResult.firstWrongOption/fixedByVariantId`. Trang khóa học: chặng đã xong có link "Xem tổng kết".

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
