# Tiến độ và danh sách lỗi cần sửa

Cập nhật 20/10/2026, sau đợt làm 3 chức năng còn lại. Phần "Lỗi" là danh sách để sửa ở bước sau (chưa sửa gì ngoài chức năng).

## Đã làm

### 1. Orbit Daily tổng hợp thật (commit 049ba3b)
- `scripts/generate-content.ts`: prompt Daily bắt buộc mỗi bài lấy kiến thức từ ít nhất 2 bài giảng khác nhau, đoạn nối hai bài phải ghi nguồn của từng bài; cache Daily có `promptVersion` để không dùng lại bản cũ.
- `scripts/lib/postprocess.ts`: `normalizeDaily` loại bài chỉ dẫn nguồn từ 1 video; mốc nguồn vẫn được gắn lại về đúng đầu đoạn transcript.
- `scripts/lib/schemas.ts`: mỗi bài tối thiểu 2 khái niệm.
- Đã chạy thật bằng Gemini: 3 bài Daily mới trong `src/data/daily.json`, mỗi bài nối đúng 2 video (kiểm tra trong file: bài 1 nối "Bản chất" với "Tư duy dựng", bài 2 nối "Tư duy dựng" với "Nhịp điệu", bài 3 nối "Bản chất" với "Nhịp điệu").
- Link nguồn trong bài Daily mở `/lesson/:id?t=<giây>` và video tua đúng mốc (trang học bài đọc `?t=`).
- Hồ sơ demo không còn gắn cứng id bài Daily (id đổi mỗi lần tạo lại nội dung).

### 2. Test tổng hợp cuối chương (commit a08e29f)
- Trang `/test/:courseId` (`src/components/orbit-test-view.tsx`): giới thiệu, làm bài, kết quả.
- Ngân hàng câu hỏi gồm câu quiz trong video, câu biến thể và câu kiểm tra Daily (29 câu, 13 khái niệm). Mỗi lượt chọn 10 câu, mỗi khái niệm tối đa một câu, trộn thứ tự câu và đáp án, giới hạn 60 giây/câu (10:00), hết giờ tự nộp. Tôn trọng chỉnh sửa/xuất bản của giảng viên.
- Kết quả: điểm, thời gian, mức nắm vững từng khái niệm (thanh %, trước/sau), đánh dấu khái niệm còn hổng, danh sách câu sai kèm giải thích.
- Lộ trình ôn tập: mỗi khái niệm hổng có link tua đúng đoạn giảng (`?t=`) và bài Daily liên quan.
- Cập nhật `conceptMastery` (cây kỹ năng) = trung bình mức cũ và điểm test; XP 10/câu đúng vượt kỷ lục + 30 XP thưởng một lần khi đạt 80%; tính vào chuỗi ngày; hiện màn nhận XP.
- Lối vào: thẻ đỏ ở trang học bài, mục "Test cuối chương" ở trang Hành trình.
- Trang giảng viên: thêm tab "Kết quả test" (dữ liệu mẫu trong `class-stats.json` mục `tests`): số người làm, điểm TB, tỉ lệ đạt, phân bố điểm, tỉ lệ đúng theo khái niệm, cảnh báo khái niệm hổng nhất.

### 3. Prompt-to-Environment (commit 1c902bd)
- Studio 3D: ô mô tả ánh sáng tiếng Việt, 4 gợi ý bấm nhanh, nút "Tạo ánh sáng", hiện lời giải thích "Vì sao chọn vậy".
- `api/environment.ts`: Gemini trả JSON (vị trí, cường độ, màu từng đèn, màu nền, độ mờ sương, giải thích); có cờ `isLightingRequest` để từ chối nội dung không phải ánh sáng (422), giới hạn 200 ký tự, rate limit.
- `src/lib/environment.ts`: `validateEnvironment` dùng ở cả server lẫn trình duyệt (đủ trường, đúng kiểu, màu `#RRGGBB`, số ngoài khoảng được kẹp, đèn viền luôn ở phía sau chủ thể). JSON sai thì không áp dụng gì.
- `studio-scene.tsx`: đèn/màu nền/sương nội suy mượt tới thông số mới (đi đường ngắn nhất cho góc, tôn trọng `prefers-reduced-motion`); chụp ảnh luôn lấy thông số đích. Thanh trượt vẫn chỉnh được sau khi AI áp dụng.
- Lỗi/hết lượt/quá giờ: báo tiếng Việt, giữ cảnh cũ.

### Đã kiểm tra
- `npm run build` qua sau mỗi phần; `tsc` (app + api) sạch.
- Chạy thật trên `npm run dev`: Daily (link `?t=` đúng), làm test từ đầu đến kết quả, tab giảng viên, Studio với Gemini thật (hoàng hôn gắt cho ra cảnh ấm tối, bóng dài), gọi `/api/environment` với nội dung lạc đề trả 422 thân thiện, nhánh lỗi quá giờ giữ cảnh cũ. Giao diện tối của trang kết quả test xem ổn.
- Chưa kiểm tra: `vercel dev`, điện thoại thật, màn hình nhỏ cho trang `/test`, thao tác bàn phím trên trang test, đo độ mượt chuyển cảnh Studio.

## Lỗi và chỗ chưa ổn (mỗi dòng một mục)

### Giao diện
- `/studio`: trang rộng hơn khung nhìn (scrollWidth 1100 > 1024), có thanh cuộn ngang; chưa rõ cột nào tràn.
- `/studio`: ở khung nhìn ~1000px canvas chỉ rộng ~600px, bố cục 2 cột hơi chật; cột trái bị lép.
- `/test/:courseId` (màn giới thiệu): thẻ "Phần thưởng" xuống dòng 3 lần ("+10 XP / câu đúng"), lệch độ cao với hai thẻ còn lại.
- `/test/:courseId` (đang làm): trên màn hình hẹp 10 chấm điều hướng + 2 nút Câu trước/Câu sau chưa được xem thử; có thể xuống nhiều hàng.
- `/test/:courseId` (kết quả): 10 thẻ khái niệm xếp dọc rất dài, nên gộp hoặc thu gọn; thẻ đúng nên nhỏ hơn thẻ hổng.
- `/daily/:id`: chip nguồn hiện nguyên tên bài giảng rất dài ("Tổ chức cấu trúc nội dung và điều hướng tiếp nhận trong dựng phim 01:48"), xuống dòng xấu, lặp lại nhiều lần trong một bài.
- `/lesson/:id?t=…`: banner "Đang tiếp tục từ 01:48, chỗ bạn dừng lần trước" sai ngữ cảnh khi vào từ link nguồn Daily hoặc lộ trình ôn (không phải chỗ dừng lần trước).
- `/lesson/:id`: thẻ đỏ "Làm test tổng hợp" đặt trên khung "Khái niệm chính"; chưa xem thử với dark mode và mobile.
- `/learning`: toàn bộ là dữ liệu giả (ảnh picsum, 26 khóa bịa, "UI/UX", "Blender" trong thanh "Lộ trình đang học"); không có khóa thật nào và không có đường vào test từ đây; bấm khóa đều dẫn tới `/lesson` chung.
- `/studio`: màu sàn, vật thể và nhân vật không đổi theo môi trường AI tạo (chỉ đổi đèn, phông, sương), cảnh đêm vẫn có sàn màu be sáng.
- Chưa kiểm tra bố cục mobile (≤390px) cho: `/test`, tab "Kết quả test" của giảng viên, panel mô tả ánh sáng ở Studio.

### Dữ liệu
- `src/data/daily.json`: khái niệm "Vai trò của người xem" (`vai-tro-nguoi-xem`) không có bài Daily nào nhắc tới, nên lộ trình ôn của nó hiện "Chưa có bài Daily về khái niệm này".
- `src/data/daily.json`: ràng buộc "≥2 video" áp ở mức cả bài; đoạn 2 của bài 3 chỉ dẫn 1 nguồn từ 1 video (đúng yêu cầu nhưng chưa nối chéo ở mọi đoạn).
- `src/data/daily.json`: id bài Daily đổi mỗi lần chạy lại script (`daily-N-<slug tiêu đề>`), nên link cũ và `dailyRead` đã lưu trong localStorage của người dùng sẽ mất khớp sau khi tạo lại nội dung (hồ sơ demo thì đã tự theo dữ liệu).
- `src/data/class-stats.json` mục `tests`: số liệu do viết tay (30/32 sinh viên, điểm TB 68%…), chưa khớp với số liệu quiz theo khái niệm ở mục `concepts` (ví dụ "Tính phi hủy hoại": test 44% đúng, trong khi quiz ghi 17/29 sai lần đầu tức 41% đúng).
- Ngân hàng test chỉ có 29 câu cho 13 khái niệm, mỗi lượt đúng 1 câu/khái niệm nên làm lại ít khác biệt; nhiều khái niệm chỉ 2 câu (gốc + biến thể) và Daily check.
- Câu test lấy lẫn câu quiz-trong-video có ngữ cảnh "vừa xem đoạn video"; chưa rà xem có câu nào mất nghĩa khi đứng riêng.
- Nội dung do Gemini tạo: tên bài/ khái niệm vẫn lệch giữa bài ("Nhịp Điệu Dựng Phim" viết hoa từng chữ, các tiêu đề Daily kết thúc bằng dấu "?" dù là câu khẳng định); chưa duyệt kiến thức từng câu với giảng viên.
- Script tạo nội dung cảnh báo "dời điểm dừng" ở 3 câu quiz (`q-tinh-phi-huy-hoai-1`, `q-quy-trinh-dung-bon-giai-doan-1`, `q-vai-tro-nguoi-xem-1`): mốc dừng bị dời tới 43 giây ở câu quy trình (272s → 315s), cần xem thử video xem có hợp lý.

### Chức năng
- Test: lượt đang làm không được lưu; tải lại trang hoặc rời trang là mất bài và đồng hồ bắt đầu lại, chỉ hiện cảnh báo "Thoát, không tính kết quả" ở nút, không chặn khi đóng tab.
- Test: kỷ lục chỉ lưu `bestCorrect/bestTotal`, so sánh theo tỉ lệ; bộ câu mỗi lần khác nhau nên "vượt kỷ lục" có thể do bộ câu dễ hơn.
- Test: mức nắm vững mới = trung bình mức cũ và kết quả test, mỗi khái niệm chỉ 1 câu nên một câu sai kéo mức xuống mạnh (ví dụ "Dựng tuyến tính" 92% → 59%) và có thể khóa lại các khái niệm nâng cao đang mở; làm lại nhiều lần có thể kéo mức xuống mãi hoặc lên 100% bằng làm lặp.
- Test: câu bỏ trống hoặc hết giờ tính là sai và vẫn trừ mức nắm vững như trả lời sai.
- Test: không có huy hiệu riêng cho test; nhiệm vụ hằng ngày không có nhiệm vụ nào liên quan test.
- Test: XP tính theo chênh lệch với kỷ lục cũ nhưng kỷ lục được lưu theo tỉ lệ; nếu số câu một lượt khác 10 (ngân hàng nhỏ hơn) thì cách so sánh `bestCorrect` thuần số câu có thể lệch.
- Test: phím tắt 1–4/A–D hoạt động toàn trang, chưa kiểm tra xung đột với trình đọc màn hình.
- Test: `useCourseLessons` loại bài chưa xuất bản khỏi ngân hàng, nhưng lộ trình ôn vẫn có thể trỏ tới bài sau này bị giảng viên gỡ (link dẫn tới màn "Chưa xuất bản").
- Studio / `api/environment.ts`: hạn mức Gemini free của 4 model đầu đã cạn, mỗi lần gọi đi qua chuỗi dự phòng 429 rồi mới tới `gemini-3.5-flash-lite`; có lần chờ >60 giây và bị client ngắt ("AI nghĩ lâu quá"), có lần chỉ 3 giây. Cần bỏ qua model đã hết hạn mức trong cùng instance hoặc đổi thứ tự.
- Studio: chấm ảnh (`api/grade-photo.ts`) vẫn chấm theo đề "ánh sáng ba điểm" và không biết sinh viên đã chọn không khí nào (hoàng hôn, sương, ánh sáng cứng…), nên có thể trừ điểm oan những cảnh AI vừa tạo.
- Studio: nội suy ánh sáng chạy trên mỗi lần kéo thanh trượt nên thanh trượt có độ trễ nhẹ (~0,5 giây) so với cảnh; chụp ảnh đã ép về thông số đích nên ảnh không bị lệch.
- Studio: thông báo lỗi khi AI từ chối nội dung không phải ánh sáng hiện như lỗi (`role="alert"`), và lời giải thích thành công bị xóa khi lần sau gặp lỗi (cảnh vẫn giữ nhưng lời giải thích cũ biến mất).
- Studio: tạo ánh sáng bằng gợi ý nhanh gọi API ngay khi bấm chip, không có bước xác nhận; bấm liên tục chip tốn hạn mức (chỉ chặn khi đang tải).
- `api/environment.ts` rate limit theo IP chỉ có hiệu lực trong một instance serverless; không có giới hạn tổng theo ngày.
- `/lesson/:id?t=`: `t` lớn hơn độ dài video bị kẹp về giây cuối; banner "Đang tiếp tục" hiện cho mọi `t` > 0, kể cả vài giây đầu.

### Kỹ thuật
- Build cảnh báo `INEFFECTIVE_DYNAMIC_IMPORT`: `orbit-studio-view.tsx` vừa `lazy()` vừa import tĩnh `DEFAULT_SETUP`/`setupFromEnvironment` từ `studio-scene.tsx`, nên three.js nằm trong chunk trang Studio và `studio-scene-*.js` chỉ còn 0,13 kB; lazy-load thực chất không có tác dụng. Nên tách hằng số và hàm ra file không import three.
- Build cảnh báo chunk >500 kB (three.js, trang chủ 3D).
- Lint còn các cảnh báo cũ: `studio-scene.tsx` (sửa camera trong hook, export hằng + component chung file), `top-nav.tsx:74`, `useLessonQuiz.ts:78`, `quiz-reward-toast.tsx:17`, `campus-scene.tsx:262,495`, `ui/button.tsx`, `ui/badge.tsx`.
- `studio-scene.tsx`: `wallMaterial` là vật liệu mức module dùng chung, bị sửa màu mỗi frame; ổn khi chỉ có một canvas nhưng sẽ rò trạng thái nếu có hai cảnh studio.
- `api/environment.ts` và `src/lib/environment.ts` nhân đôi miền giá trị (schema Gemini viết tay song song với `validateEnvironment`); đổi khoảng giá trị phải sửa hai nơi.
- `scripts/generate-content.ts`: lần chạy này Gemini hết hạn mức ở 3 model đầu, Daily được tạo bằng `gemini-3.6-flash`; nội dung phụ thuộc model còn quota nên chất lượng giữa các lần chạy không đồng đều.
- `npm run dev:vercel` (`vercel dev`) chưa chạy lại sau các thay đổi này, chỉ chạy qua middleware dev của Vite.
- `docs/mockup*`, `docs/*.html` và `.claude/` vẫn chưa được git theo dõi (cố ý không commit trong đợt này).
