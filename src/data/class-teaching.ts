// Dữ liệu mẫu cho trang Lớp học (chỉ để xem): tỉ lệ sinh viên đã làm kiểm tra nhanh từng bài, lý do sai ngắn và gợi ý khi lên lớp.
// Số liệu từng bài dẫn xuất ở lib/class-report.ts từ cùng class-stats.json mà Tổng quan và trang Duyệt đang dùng, nên không lệch nhau.
// Lý do sai và gợi ý gắn THEO KHÁI NIỆM (không dùng chung cho cả lớp), soạn sẵn nên không gọi AI lúc demo.

/** Tỉ lệ sinh viên đã học bài đó làm kiểm tra nhanh (0–1); thiếu thì 0,9. */
export const QUICK_REACH: Record<string, number> = {
    'ban-chat-dung-phi-tuyen': 0.97,
    'tu-duy-dung-dieu-huong-tiep-nhan': 0.9,
    'nhip-dieu-to-chuc-thoi-gian': 0.82,
    'ba-loai-anh-sang-co-ban': 0.95,
    'nguyen-ly-mau-sac': 0.88,
    'tu-duy-nhiep-anh': 0.8,
}

/** Vì sao lớp sai: một câu ngắn (≤ 20 từ). */
export const WHY_SHORT: Record<string, string> = {
    'dung-tuyen-tinh': 'Nhầm dựng tuyến tính với việc luôn phải dựng từ đầu đến cuối.',
    'dung-phi-tuyen': 'Nhầm dựng phi tuyến với dựng không theo kịch bản.',
    'tinh-phi-huy-hoai': 'Hiểu “cắt bỏ trên timeline” là xóa thật khỏi file gốc.',
    'quy-trinh-dung-bon-giai-doan': 'Đảo thứ tự Rough cut và Fine cut, chưa rõ Picture lock.',
    'tu-duy-dung': 'Coi dựng chỉ là nối cảnh, chưa thấy đó là kể chuyện.',
    'vai-tro-nguoi-xem': 'Chưa gắn mỗi lựa chọn dựng với phản ứng của người xem.',
    'muc-tieu-giao-tiep': 'Nhầm mục tiêu giao tiếp với nội dung của cảnh.',
    'tai-tri-tue': 'Nhầm tải trí tuệ với độ dài video.',
    'cong-cu-dan-dat-chu-y': 'Chưa nhận ra công cụ dẫn dắt chú ý nằm ở hình hay âm thanh.',
    'nhip-hinh': 'Nhầm nhịp hình với tốc độ chuyển động trong cảnh.',
    'nhip-am': 'Tách nhịp âm khỏi nhịp hình nên chọn sai đáp án.',
    'thoi-luong-canh': 'Cho rằng cảnh càng ngắn thì nhịp càng hay.',
    'nen-va-keo-dai-thoi-gian': 'Lẫn nén thời gian với tua nhanh hình.',
    'key-light': 'Nhầm đèn chính với đèn mạnh nhất cảnh.',
    'fill-light': 'Quên đèn phụ chỉ để giảm tương phản, không tạo bóng.',
    'back-light': 'Lẫn đèn ven với đèn nền phía sau.',
    'practical-light': 'Xem practical light là đèn chính thay vì nguồn sáng có thật trong cảnh.',
    'cac-thuat-ngu-mau-sac': 'Lẫn họ màu, độ sáng và độ đậm của màu.',
    'he-mau-rgb-va-cmyk': 'Nhầm màu cộng (RGB) với màu trừ (CMYK).',
    'tam-ly-hoc-mau-sac': 'Gán một ý nghĩa cố định cho màu, bỏ qua văn hóa.',
    'phoi-hop-mau-sac': 'Nhầm màu tương phản với màu tương đồng.',
    'dong-luc-nhiep-anh-noi-tai': 'Nhầm động lực bên trong với phần thưởng bên ngoài.',
    'tu-duy-tai-tao-hinh-anh': 'Hiểu tái tạo hình ảnh là sao chép ảnh có sẵn.',
    'ngon-ngu-thi-giac-dien-anh': 'Chọn đáp án về kỹ thuật máy, bỏ qua hình ảnh kể chuyện.',
    'kho-du-lieu-tiem-thuc': 'Chưa hiểu kho dữ liệu tiềm thức hình thành từ việc xem nhiều.',
}

/** Gợi ý khi lên lớp theo khái niệm: 2–3 dòng, mỗi dòng ≤ 15 từ. */
export const TEACHING_TIPS: Record<string, string[]> = {
    'dung-tuyen-tinh': ['Cho xem một cảnh dựng tuyến tính và hỏi vì sao khó sửa.', 'So sánh với dựng trên timeline bằng một cảnh cụ thể.'],
    'dung-phi-tuyen': ['Cho cả lớp đổi thứ tự hai cảnh và nhận xét khác biệt.', 'Nhấn mạnh phi tuyến là dựng theo thứ tự tùy ý.'],
    'tinh-phi-huy-hoai': ['Nhắc lại khác biệt giữa xóa clip trên timeline và xóa file gốc.', 'Cho cả lớp cắt một clip rồi khôi phục để thấy file gốc không đổi.', 'Hỏi: file gốc nằm ở đâu khi đã cắt?'],
    'quy-trinh-dung-bon-giai-doan': ['Vẽ sơ đồ bốn giai đoạn, đánh dấu Picture lock.', 'Cho xem cùng một cảnh ở Rough cut và Fine cut.', 'Hỏi: sau Picture lock còn đổi thời lượng được không?'],
    'tu-duy-dung': ['Cho xem hai bản dựng của cùng một cảnh và hỏi câu chuyện nào rõ hơn.', 'Nhấn mạnh mỗi lần cắt đều mang một ý đồ.'],
    'vai-tro-nguoi-xem': ['Hỏi người xem cảm thấy gì ở mỗi lần cắt trong cảnh mẫu.', 'Cho lớp đoán người xem sẽ nhìn vào đâu trước.'],
    'muc-tieu-giao-tiep': ['Yêu cầu nêu mục tiêu một câu trước khi dựng cảnh mẫu.', 'So sánh hai cảnh cùng nội dung nhưng khác mục tiêu.'],
    'tai-tri-tue': ['Cho xem hai đoạn cùng độ dài, lượng thông tin khác nhau.', 'Hỏi: người xem phải xử lý bao nhiêu thứ cùng lúc?', 'Nhắc tải trí tuệ không phụ thuộc độ dài video.'],
    'cong-cu-dan-dat-chu-y': ['Cho xem một cảnh và hỏi mắt bạn bị dẫn đi đâu.', 'Liệt kê công cụ dẫn dắt bằng hình và bằng âm thanh.'],
    'nhip-hinh': ['Cho xem cảnh chậm nhưng cắt nhanh, hỏi nhịp ở đâu.', 'Tách nhịp hình khỏi tốc độ chuyển động trong cảnh.'],
    'nhip-am': ['Tắt hình, chỉ nghe, hỏi lớp cảm nhận nhịp thế nào.', 'Ghép nhịp âm với nhịp cắt hình trong một ví dụ.'],
    'thoi-luong-canh': ['Cho xem cùng cảnh ở hai độ dài và so cảm giác.', 'Nhắc cảnh ngắn không mặc định là hay hơn.'],
    'nen-va-keo-dai-thoi-gian': ['Phân biệt nén thời gian với tua nhanh hình bằng một ví dụ.', 'Cho lớp rút gọn một sự kiện dài thành vài cảnh.'],
    'key-light': ['Chỉ ra đèn chính trong khung hình mẫu, không phải đèn mạnh nhất.', 'Cho đặt đèn chính ở ba hướng và so sánh.'],
    'fill-light': ['Bật tắt đèn phụ trong studio để thấy tương phản đổi.', 'Nhắc đèn phụ làm dịu bóng, không tạo bóng mới.'],
    'back-light': ['Chỉ ra viền sáng quanh chủ thể do đèn ven tạo ra.', 'Phân biệt đèn ven với đèn chiếu sáng nền.'],
    'practical-light': ['Chỉ ra nguồn sáng có thật trong khung hình (đèn bàn, màn hình).', 'Phân biệt practical light với đèn chính.', 'Hỏi: nguồn sáng này có nằm trong cảnh không?'],
    'cac-thuat-ngu-mau-sac': ['Dùng một màu, đổi lần lượt họ màu, độ sáng, độ đậm.', 'Cho lớp gọi tên từng thuật ngữ trên ảnh mẫu.'],
    'he-mau-rgb-va-cmyk': ['Nhắc màn hình dùng màu cộng, in ấn dùng màu trừ.', 'Cho xem cùng một ảnh ở RGB và CMYK.'],
    'tam-ly-hoc-mau-sac': ['Hỏi cùng một màu gợi cảm giác gì ở các nền văn hóa.', 'Cho xem ảnh cùng bố cục, khác tông màu.'],
    'phoi-hop-mau-sac': ['Cho lớp gọi tên cách phối của vài ảnh trên vòng màu.', 'Tách màu tương đồng và màu tương phản bằng hai ảnh mẫu.'],
    'dong-luc-nhiep-anh-noi-tai': ['Hỏi mỗi bạn vì sao chụp, ngoài điểm số.', 'Phân biệt động lực bên trong và phần thưởng bên ngoài.'],
    'tu-duy-tai-tao-hinh-anh': ['Cho xem một ảnh được tái tạo ý tưởng, không sao chép.', 'Hỏi: bạn giữ lại điều gì, đổi điều gì?'],
    'ngon-ngu-thi-giac-dien-anh': ['Cho xem một khung hình và hỏi hình ảnh đang kể gì.', 'Để bố cục và ánh sáng được nói trước kỹ thuật máy.'],
    'kho-du-lieu-tiem-thuc': ['Cho lớp xem nhiều ảnh cùng chủ đề rồi tự rút nhận xét.', 'Nhắc quan sát đều đặn mới nuôi được kho dữ liệu.'],
}

export const GENERIC_TIPS = ['Dành vài phút đầu buổi ôn lại khái niệm này bằng một ví dụ cụ thể.', 'Cho sinh viên giải thích lại khái niệm bằng lời của mình.']
