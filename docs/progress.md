# Tiến độ và danh sách lỗi cần sửa

Cập nhật 20/10/2026, sau đợt làm 3 chức năng còn lại. Phần "Lỗi" là danh sách để sửa ở bước sau (chưa sửa gì ngoài chức năng).

## Đợt 5 (21/10): chuyển cảnh vai trò, Studio, nav giảng viên, kết quả test

- Chọn/đổi vai trò có màn đỏ lan từ thẻ/nút vừa bấm (tái dùng theme-curtain: `playRoleCurtain` trong `src/lib/theme-switch.ts`, `src/lib/role-switch.ts`), logo + vòng quỹ đạo + "Chào Phú" / "Chào thầy/cô", đổi vai và về trang chủ phía sau màn, mở màn từ tâm logo, các phần trang chủ trồi lên lần lượt. Menu avatar có "Chuyển sang vai …" dùng cùng hiệu ứng. Reduced-motion thì đổi ngay. Chưa đo thời gian chạy trên tab đang hiển thị (trong khung xem trước bị làm chậm); thiết kế ~1,4 giây.
- Studio: thanh thao tác (Chụp và chấm điểm, Lưới, Đặt lại) dính dưới khung 3D; thêm "Ảnh đã chụp" (tối đa 6, bấm để xem lại ảnh và nhận xét) lấp chỗ trống; nhân vật low-poly (đầu, tóc, mặt, cổ, vai, tay, thân) thay khối trụ.
- Giảng viên: nav ẩn chip chuỗi ngày/XP; mục nav: Trang chủ, Duyệt nội dung, Thống kê lớp, Kết quả test (`/teacher?tab=`), Khóa học.
- Test: khái niệm đạt từ 80% sau test không ghi "Còn hổng", không vào lộ trình ôn; "Đã nắm chắc N" đếm đúng; dưới 50% số câu đúng thì không cộng XP.
- Chưa làm: hero trang chủ vẫn dùng lời chào của sinh viên cho cả giảng viên.

## Đợt 4 (21/10): khóa "Nhiếp ảnh và ánh sáng", liên kết Studio, nhãn khuôn viên

- Khóa thứ hai `nhiep-anh-va-anh-sang` (3 video: 3 loại ánh sáng cơ bản, nguyên lý màu sắc, tư duy nhiếp ảnh) tạo bằng `scripts/generate-content.ts`; khóa cũ lấy từ cache, không gọi lại Gemini. 12 khái niệm, 12 câu quiz.
- Daily: `dailyCount` tăng lên 5 nên cả bộ Daily được tạo lại (3 bài cũ thay bằng 5 bài mới, đủ 25 khái niệm của hai khóa). Chỉ 1 bài (`daily-3`) nối chéo hai khóa (màu sắc ↔ điều hướng sự chú ý của người xem). Trang chủ chọn 3 bài/ngày: bài đã đọc hôm nay, rồi bài chưa đọc ưu tiên theo lỗ hổng.
- Trang học bài có thẻ "Thực hành trong Studio" (`/studio?concept=<id>`); Studio có panel "Đề bài theo khái niệm" (8 đề bài trong `src/lib/studio-briefs.ts`), nút "Tạo ánh sáng gợi ý" gọi Prompt-to-Environment.
- Nhãn tòa nhà (`src/lib/campus-courses.ts`): Tòa A2 → Nhiếp ảnh và ánh sáng, Tòa A3 → Dựng audio và video phi tuyến, các tòa còn lại "Sắp mở". Bấm tòa có khóa thì mở `/learning#course-<id>`.
- Trang chủ, phần Khóa học: chọn khóa bằng nút. `class-stats.json` có số liệu mẫu cho khóa mới.
- Chưa làm: ảnh Studio ở trang chủ chưa theo đề bài; tòa nhãn "Sắp mở" chưa có trang riêng; chưa xem trên điện thoại.

## Đợt 3 (21/10): sửa lỗi Studio, Test, dữ liệu và giao diện

Các mục đã sửa được đánh dấu "**→ Đã sửa (đợt 3)**" ngay trên dòng lỗi bên dưới. Ngoài danh sách:
- Sửa lỗi console khi rời Studio (khung hình cuối đọc `scene.background` đã null).
- `shortTitle` (tên rút gọn) thêm vào bài học, schema và prompt tạo nội dung.
- Daily được tạo lại bằng Gemini (`gemini-3.8-flash`): 3 bài mới phủ đủ 13 khái niệm, tiêu đề đúng chữ hoa.
- Chưa sửa (không nằm trong đợt này): xem các dòng không có dấu "Đã sửa" ở dưới.

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

## Đợt 2 (21/10): trang chủ nhiều phần, nav cuộn, footer, /learning thật

### Đã làm
- Nav: thứ tự Trang chủ, Orbit Daily, Khóa học, Studio 3D; thanh nav cố định ở mọi trang (trong suốt đè hero ở đầu trang chủ, đổi sang nền mờ khi cuộn qua hero); `--nav-h` trong `index.css`.
- Trang chủ: Hero → Orbit Daily → Khóa học → Studio 3D → Tiến độ của bạn → Footer. Mỗi phần dùng `SectionHeading` (dòng nhỏ viết hoa + tiêu đề lớn, cùng lề trái).
- Khóa học: thẻ khóa thật (tiến độ, Học tiếp, Làm test cuối chương) + 3 thẻ bài của khóa kèm tiến độ; nút "Xem tất cả khóa học".
- Studio 3D: ảnh tĩnh chụp từ studio thật (mặc định và "hoàng hôn gắt, bóng đổ dài") trong `src/assets/`, nút "Vào Studio"; không dựng cảnh 3D thứ hai.
- Bấm nav cuộn mượt tới phần (scroll-margin = chiều cao nav), mục đang xem sáng theo IntersectionObserver; ở trang khác thì về trang chủ rồi cuộn; reduced-motion thì nhảy thẳng. Kiểm tra bằng trình duyệt: cả 4 mục cuộn đúng (đỉnh phần cách đỉnh 80px), mục sáng đúng khi cuộn, từ `/studio` bấm "Khóa học" về `/#courses`.
- Footer (`site-footer.tsx`): logo + mô tả, nhóm link Học tập / Công cụ / Về dự án, bốn dòng thông tin theo yêu cầu; dùng ở trang chủ và `/learning`.
- `/learning`: viết lại hoàn toàn, bỏ dữ liệu giả; mỗi khóa có tiến độ, danh sách bài (tiến độ từng bài, nút Vào bài/Học tiếp/Xem lại), nút Làm test cuối chương.
- Sửa lỗi tràn ngang trên điện thoại ở trang chủ (hàng khái niệm của cây kỹ năng và chữ `sr-only` làm khung nhìn nới rộng, đẩy nút menu/theme ra ngoài màn hình khi nav cố định); thêm `overflow-x: clip` cho body.
- Đã xem ở 375px, 1280px, 1920px, giao diện sáng và tối (trang chủ, `/learning`, footer, menu điện thoại).

### Lỗi và chỗ chưa ổn mới thấy
- Trang chủ, phần Khóa học: dữ liệu chỉ có 1 khóa, nên 4 thẻ là 1 thẻ khóa + 3 thẻ bài, chưa phải 3–4 khóa khác nhau.
- Trang chủ, nav: phần "Tiến độ của bạn" không có mục nav riêng, nên khi cuộn tới đó không mục nào sáng (hoặc giữ Studio 3D khi ở cuối trang).
- Trang chủ, nav: cuộn mượt qua quãng dài (từ đầu trang tới Studio) mất vài giây trong khung xem trước; chưa thử trên máy thật.
- Trang chủ, Studio 3D: ảnh chụp 901×600 hơi mờ trên màn 1920px; ảnh hoàng hôn nền gần đen, nhân vật tối; chưa có ảnh riêng cho giao diện sáng/tối.
- Trang chủ, Hero: nút theme và avatar trong nav kiểu hero (nền tối) đổi sang kiểu thường khi cuộn qua hero, có thoáng chớp trong lúc chuyển.
- Footer: link "Mã nguồn" trỏ GitHub `Giaphu-max/orbit-ptitlearninghub` (có thể cần đặt công khai hoặc đổi) và "Học viện PTIT" trỏ `ptit.edu.vn` (chưa kiểm tra đường dẫn); chưa có trang "Về dự án" thật.
- Footer: link "Trợ giảng AI" chỉ mở bài đầu tiên, không phải trang riêng; nhóm "Về dự án" chỉ có 2 link.
- `/learning`: chỉ 1 khóa; trên điện thoại hàng bài xếp dọc khá dài; nút test dài, xuống dòng.
- `/learning`: thanh điều hướng cũ "Lộ trình đang học" và lưới khóa giả đã bỏ, nhưng chưa có tìm kiếm/lọc khi số khóa tăng.
- Giao diện tối: lúc chuyển giao diện có vòng tròn đỏ (theme-curtain) còn sót trong ảnh chụp giữa chừng, chưa rõ có biến mất hẳn trên mọi trình duyệt.
- Nav: trên màn hẹp, mục đang xem trong menu điện thoại chỉ đổi nền, không có dấu hiệu khác; menu không tự cuộn khi cao hơn màn hình.
- Trang giảng viên và `/test`: nav cố định mới chưa kiểm tra riêng bố cục ở màn hẹp (đã chừa `--nav-h` ở trên).

## Lỗi và chỗ chưa ổn (đợt 1; mỗi dòng một mục)

### Giao diện
- `/studio`: trang rộng hơn khung nhìn (scrollWidth 1100 > 1024), có thanh cuộn ngang; chưa rõ cột nào tràn. **→ Đã sửa (đợt 3, 21/10):** Trang không còn rộng hơn khung nhìn (scrollWidth = 1024 ở 1024px).
- `/studio`: ở khung nhìn ~1000px canvas chỉ rộng ~600px, bố cục 2 cột hơi chật; cột trái bị lép. **→ Đã sửa (đợt 3, 21/10):** Dưới 1280px bố cục xếp canvas full rộng, các bảng điều khiển thành 2 cột bên dưới; từ 1280px mới chia 2 cột canvas | bảng (340px).
- `/test/:courseId` (màn giới thiệu): thẻ "Phần thưởng" xuống dòng 3 lần ("+10 XP / câu đúng"), lệch độ cao với hai thẻ còn lại. **→ Đã sửa (đợt 3, 21/10):** Thẻ rút gọn thành "+10 XP/câu", chữ không xuống dòng, ba thẻ cùng chiều cao.
- `/test/:courseId` (đang làm): trên màn hình hẹp 10 chấm điều hướng + 2 nút Câu trước/Câu sau chưa được xem thử; có thể xuống nhiều hàng.
- `/test/:courseId` (kết quả): 10 thẻ khái niệm xếp dọc rất dài, nên gộp hoặc thu gọn; thẻ đúng nên nhỏ hơn thẻ hổng. **→ Đã sửa (đợt 3, 21/10):** Khái niệm còn hổng hiện thẻ đầy đủ ở trên; khái niệm đã đạt gom vào mục "Đã nắm chắc N khái niệm" thu gọn (mở sẵn nếu không còn hổng).
- `/daily/:id`: chip nguồn hiện nguyên tên bài giảng rất dài ("Tổ chức cấu trúc nội dung và điều hướng tiếp nhận trong dựng phim 01:48"), xuống dòng xấu, lặp lại nhiều lần trong một bài. **→ Đã sửa (đợt 3, 21/10):** Chip hiện tên rút gọn (`shortTitle`, 2–5 từ) + mốc; tên đầy đủ hiện khi hover (title) và trong aria-label.
- `/lesson/:id?t=…`: banner "Đang tiếp tục từ 01:48, chỗ bạn dừng lần trước" sai ngữ cảnh khi vào từ link nguồn Daily hoặc lộ trình ôn (không phải chỗ dừng lần trước). **→ Đã sửa (đợt 3, 21/10):** Banner chỉ hiện khi mở từ vị trí đã lưu; vào bằng `?t=` (link nguồn, lộ trình ôn) thì không hiện.
- `/lesson/:id`: thẻ đỏ "Làm test tổng hợp" đặt trên khung "Khái niệm chính"; chưa xem thử với dark mode và mobile.
- `/studio`: màu sàn, vật thể và nhân vật không đổi theo môi trường AI tạo (chỉ đổi đèn, phông, sương), cảnh đêm vẫn có sàn màu be sáng. **→ Đã sửa (đợt 3, 21/10):** Sàn, vật thể, nhân vật pha màu theo độ sáng màu phông: cảnh đêm thì sàn và vật thể tối đi. Vật liệu giờ riêng cho từng canvas.
- Chưa kiểm tra bố cục mobile (≤390px) cho: `/test`, tab "Kết quả test" của giảng viên, panel mô tả ánh sáng ở Studio.

### Dữ liệu
- `src/data/daily.json`: khái niệm "Vai trò của người xem" (`vai-tro-nguoi-xem`) không có bài Daily nào nhắc tới, nên lộ trình ôn của nó hiện "Chưa có bài Daily về khái niệm này". **→ Đã sửa (đợt 3, 21/10):** Daily tạo lại với yêu cầu mọi khái niệm phải có ít nhất một bài; 13/13 khái niệm đã được phủ (kiểm tra: script không còn cảnh báo "khái niệm chưa có bài Daily").
- `src/data/daily.json`: ràng buộc "≥2 video" áp ở mức cả bài; đoạn 2 của bài 3 chỉ dẫn 1 nguồn từ 1 video (đúng yêu cầu nhưng chưa nối chéo ở mọi đoạn).
- `src/data/daily.json`: id bài Daily đổi mỗi lần chạy lại script (`daily-N-<slug tiêu đề>`), nên link cũ và `dailyRead` đã lưu trong localStorage của người dùng sẽ mất khớp sau khi tạo lại nội dung (hồ sơ demo thì đã tự theo dữ liệu). **→ Đã sửa (đợt 3, 21/10):** Id bài Daily nay là `daily-<số thứ tự>`, không phụ thuộc tiêu đề (đã đổi ở script và dữ liệu). Link/`dailyRead` lưu từ id cũ dạng `daily-N-<slug>` vẫn sẽ mất khớp một lần.
- `src/data/class-stats.json` mục `tests`: số liệu do viết tay (30/32 sinh viên, điểm TB 68%…), chưa khớp với số liệu quiz theo khái niệm ở mục `concepts` (ví dụ "Tính phi hủy hoại": test 44% đúng, trong khi quiz ghi 17/29 sai lần đầu tức 41% đúng). **→ Đã sửa (đợt 3, 21/10):** `class-stats.json`: thêm số liệu quiz cho đủ 13 khái niệm; tỉ lệ đúng trong test suy ra từ quiz (đúng ngay lần đầu + 30% số người đã sửa được), tổng số lượt hỏi = số lượt × 10 câu, điểm TB và phân bố điểm tính lại cho khớp.
- Ngân hàng test chỉ có 29 câu cho 13 khái niệm, mỗi lượt đúng 1 câu/khái niệm nên làm lại ít khác biệt; nhiều khái niệm chỉ 2 câu (gốc + biến thể) và Daily check.
- Câu test lấy lẫn câu quiz-trong-video có ngữ cảnh "vừa xem đoạn video"; chưa rà xem có câu nào mất nghĩa khi đứng riêng. **→ Đã sửa (đợt 3, 21/10):** Rà ngân hàng: không có câu nào thật sự dẫn chiếu "đoạn video vừa xem"; thêm `standaloneQuestion` loại câu có cụm dẫn chiếu như vậy và bỏ cụm "theo bài giảng/bài học" khi đưa vào test; prompt tạo nội dung cũng cấm kiểu câu này.
- Nội dung do Gemini tạo: tên bài/ khái niệm vẫn lệch giữa bài ("Nhịp Điệu Dựng Phim" viết hoa từng chữ, các tiêu đề Daily kết thúc bằng dấu "?" dù là câu khẳng định); chưa duyệt kiến thức từng câu với giảng viên. **→ Đã sửa (đợt 3, 21/10):** Phần viết hoa và dấu "?" đã sửa: `scripts/lib/vi-text.ts` (sentence case, chỉ giữ "?" khi là câu hỏi thật) chạy trong `postprocess.ts` cho tên bài, tên khái niệm, tiêu đề Daily; đã áp dụng cho dữ liệu hiện có. Việc giảng viên duyệt kiến thức từng câu vẫn còn.
- Script tạo nội dung cảnh báo "dời điểm dừng" ở 3 câu quiz (`q-tinh-phi-huy-hoai-1`, `q-quy-trinh-dung-bon-giai-doan-1`, `q-vai-tro-nguoi-xem-1`): mốc dừng bị dời tới 43 giây ở câu quy trình (272s → 315s), cần xem thử video xem có hợp lý.

### Chức năng
- Test: lượt đang làm không được lưu; tải lại trang hoặc rời trang là mất bài và đồng hồ bắt đầu lại, chỉ hiện cảnh báo "Thoát, không tính kết quả" ở nút, không chặn khi đóng tab. **→ Đã sửa (đợt 3, 21/10):** Đã thêm cảnh báo của trình duyệt khi đóng/tải lại tab giữa chừng và hỏi xác nhận ở nút "Thoát" khi đã trả lời câu nào. Lượt đang làm vẫn chưa được lưu để tiếp tục.
- Test: kỷ lục chỉ lưu `bestCorrect/bestTotal`, so sánh theo tỉ lệ; bộ câu mỗi lần khác nhau nên "vượt kỷ lục" có thể do bộ câu dễ hơn.
- Test: mức nắm vững mới = trung bình mức cũ và kết quả test, mỗi khái niệm chỉ 1 câu nên một câu sai kéo mức xuống mạnh (ví dụ "Dựng tuyến tính" 92% → 59%) và có thể khóa lại các khái niệm nâng cao đang mở; làm lại nhiều lần có thể kéo mức xuống mãi hoặc lên 100% bằng làm lặp. **→ Đã sửa (đợt 3, 21/10):** Mức mới = 70% mức cũ + 30% kết quả; khái niệm đã đạt 80% không tụt dưới 80% vì một câu test nên không khóa lại khái niệm nâng cao.
- Test: câu bỏ trống hoặc hết giờ tính là sai và vẫn trừ mức nắm vững như trả lời sai. **→ Đã sửa (đợt 3, 21/10):** Câu bỏ trống/hết giờ chỉ trừ một nửa mức trừ của câu sai; khái niệm chưa có dữ liệu mà bỏ trống thì không ghi gì vào cây kỹ năng. Kết quả đánh dấu "Chưa trả lời".
- Test: không có huy hiệu riêng cho test; nhiệm vụ hằng ngày không có nhiệm vụ nào liên quan test. **→ Đã sửa (đợt 3, 21/10):** Thêm huy hiệu "Vượt ải cuối chương" (đạt từ 80% trong một lượt test) và nhiệm vụ hằng ngày "Làm một bài test cuối chương" (+25 XP).
- Test: XP tính theo chênh lệch với kỷ lục cũ nhưng kỷ lục được lưu theo tỉ lệ; nếu số câu một lượt khác 10 (ngân hàng nhỏ hơn) thì cách so sánh `bestCorrect` thuần số câu có thể lệch.
- Test: phím tắt 1–4/A–D hoạt động toàn trang, chưa kiểm tra xung đột với trình đọc màn hình.
- Test: `useCourseLessons` loại bài chưa xuất bản khỏi ngân hàng, nhưng lộ trình ôn vẫn có thể trỏ tới bài sau này bị giảng viên gỡ (link dẫn tới màn "Chưa xuất bản").
- Studio / `api/environment.ts`: hạn mức Gemini free của 4 model đầu đã cạn, mỗi lần gọi đi qua chuỗi dự phòng 429 rồi mới tới `gemini-3.5-flash-lite`; có lần chờ >60 giây và bị client ngắt ("AI nghĩ lâu quá"), có lần chỉ 3 giây. Cần bỏ qua model đã hết hạn mức trong cùng instance hoặc đổi thứ tự. **→ Đã sửa (đợt 3, 21/10):** `withFallback` viết lại: nhớ model trả 429 (nghỉ 15 phút) và model chậm (nghỉ 3 phút) trong instance; nếu model chưa trả lời sau 3,5 giây thì chạy thêm model dự phòng song song, lấy kết quả về trước; timeout mỗi model 10s, tổng 20s (chấm ảnh 15s/30s) rồi báo thân thiện. Thứ tự model và các mốc thời gian đọc từ biến môi trường `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_MODEL_TIMEOUT_MS`, `GEMINI_TOTAL_TIMEOUT_MS`, `GEMINI_HEDGE_MS`. Thử thật: `gemini-3.8-flash` đang mất ~75s/lượt, `3.5-flash-lite` 1–3s; chấm ảnh xong sau 13s ở lần đầu.
- Studio: chấm ảnh (`api/grade-photo.ts`) vẫn chấm theo đề "ánh sáng ba điểm" và không biết sinh viên đã chọn không khí nào (hoàng hôn, sương, ánh sáng cứng…), nên có thể trừ điểm oan những cảnh AI vừa tạo. **→ Đã sửa (đợt 3, 21/10):** `api/grade-photo.ts` nhận thêm `intent` (mô tả sinh viên nhập, lời giải thích của AI, màu phông, sương, có chỉnh tay hay không) và chấm theo ý đồ đó; không có ý đồ thì chấm theo độ rõ chủ thể, chiều sâu, không bắt buộc ba điểm.
- Studio: nội suy ánh sáng chạy trên mỗi lần kéo thanh trượt nên thanh trượt có độ trễ nhẹ (~0,5 giây) so với cảnh; chụp ảnh đã ép về thông số đích nên ảnh không bị lệch.
- Studio: thông báo lỗi khi AI từ chối nội dung không phải ánh sáng hiện như lỗi (`role="alert"`), và lời giải thích thành công bị xóa khi lần sau gặp lỗi (cảnh vẫn giữ nhưng lời giải thích cũ biến mất). **→ Đã sửa (đợt 3, 21/10):** Từ chối vì không phải ánh sáng nay hiện như gợi ý nhẹ (không phải `role="alert"`), và lời giải thích cũ được giữ.
- Studio: tạo ánh sáng bằng gợi ý nhanh gọi API ngay khi bấm chip, không có bước xác nhận; bấm liên tục chip tốn hạn mức (chỉ chặn khi đang tải). **→ Đã sửa (đợt 3, 21/10):** Chip gợi ý bị khóa bằng ref trong lúc gọi và chờ 1,5 giây sau mỗi lần; kiểm tra bấm dồn chỉ ra đúng 1 request.
- `api/environment.ts` rate limit theo IP chỉ có hiệu lực trong một instance serverless; không có giới hạn tổng theo ngày.
- `/lesson/:id?t=`: `t` lớn hơn độ dài video bị kẹp về giây cuối; banner "Đang tiếp tục" hiện cho mọi `t` > 0, kể cả vài giây đầu.

### Kỹ thuật
- Build cảnh báo `INEFFECTIVE_DYNAMIC_IMPORT`: `orbit-studio-view.tsx` vừa `lazy()` vừa import tĩnh `DEFAULT_SETUP`/`setupFromEnvironment` từ `studio-scene.tsx`, nên three.js nằm trong chunk trang Studio và `studio-scene-*.js` chỉ còn 0,13 kB; lazy-load thực chất không có tác dụng. Nên tách hằng số và hàm ra file không import three. **→ Đã sửa (đợt 3, 21/10):** Hằng số/hàm chuyển sang `src/lib/studio-setup.ts` (không import three); cảnh báo `INEFFECTIVE_DYNAMIC_IMPORT` đã hết.
- Build cảnh báo chunk >500 kB (three.js, trang chủ 3D).
- Lint còn các cảnh báo cũ: `studio-scene.tsx` (sửa camera trong hook, export hằng + component chung file), `top-nav.tsx:74`, `useLessonQuiz.ts:78`, `quiz-reward-toast.tsx:17`, `campus-scene.tsx:262,495`, `ui/button.tsx`, `ui/badge.tsx`.
- `studio-scene.tsx`: `wallMaterial` là vật liệu mức module dùng chung, bị sửa màu mỗi frame; ổn khi chỉ có một canvas nhưng sẽ rò trạng thái nếu có hai cảnh studio. **→ Đã sửa (đợt 3, 21/10):** Vật liệu studio nay tạo riêng cho từng canvas (không còn dùng chung ở mức module).
- `api/environment.ts` và `src/lib/environment.ts` nhân đôi miền giá trị (schema Gemini viết tay song song với `validateEnvironment`); đổi khoảng giá trị phải sửa hai nơi.
- `scripts/generate-content.ts`: lần chạy này Gemini hết hạn mức ở 3 model đầu, Daily được tạo bằng `gemini-3.6-flash`; nội dung phụ thuộc model còn quota nên chất lượng giữa các lần chạy không đồng đều.
- `npm run dev:vercel` (`vercel dev`) chưa chạy lại sau các thay đổi này, chỉ chạy qua middleware dev của Vite.
- `docs/mockup*`, `docs/*.html` và `.claude/` vẫn chưa được git theo dõi (cố ý không commit trong đợt này).
