// Dữ liệu mẫu cho trang Lớp học (chỉ để xem): tỉ lệ sinh viên đã làm kiểm tra nhanh từng bài và gợi ý khi lên lớp.
// Số liệu từng bài dẫn xuất ở lib/class-report.ts từ cùng class-stats.json mà Tổng quan và trang Duyệt đang dùng, nên không lệch nhau.
// Gợi ý soạn sẵn theo khái niệm (không gọi AI lúc demo).

/** Tỉ lệ sinh viên đã học bài đó làm kiểm tra nhanh (0–1); thiếu thì 0,9. */
export const QUICK_REACH: Record<string, number> = {
    'ban-chat-dung-phi-tuyen': 0.97,
    'tu-duy-dung-dieu-huong-tiep-nhan': 0.9,
    'nhip-dieu-to-chuc-thoi-gian': 0.82,
    'ba-loai-anh-sang-co-ban': 0.95,
    'nguyen-ly-mau-sac': 0.88,
    'tu-duy-nhiep-anh': 0.8,
}

/** Gợi ý khi lên lớp, theo khái niệm lớp hay hụt. */
export const TEACHING_TIPS: Record<string, string[]> = {
    'tinh-phi-huy-hoai': ['Nhắc lại khác biệt giữa xóa clip trên timeline và xóa file gốc.', 'Cho cả lớp thử cắt một clip rồi khôi phục để thấy file gốc không đổi.'],
    'tai-tri-tue': ['Lấy hai đoạn phim cùng độ dài nhưng lượng thông tin khác nhau để so sánh tải trí tuệ.', 'Hỏi cả lớp: người xem phải xử lý bao nhiêu thứ cùng một lúc ở cảnh này?'],
    'quy-trinh-dung-bon-giai-doan': ['Vẽ lại sơ đồ bốn giai đoạn và đánh dấu Picture lock là điểm khóa thời lượng.', 'Cho xem cùng một cảnh ở bản Rough cut và Fine cut để thấy khác biệt.'],
    'nen-va-keo-dai-thoi-gian': ['Phân biệt nén thời gian (rút gọn sự kiện) với tua nhanh hình bằng một ví dụ phim ngắn.'],
    'ngon-ngu-thi-giac-dien-anh': ['Cho xem một khung hình và hỏi hình ảnh đang kể gì, trước khi nói về kỹ thuật máy.'],
    'he-mau-rgb-va-cmyk': ['Nhắc màn hình dùng màu cộng (RGB), in ấn dùng màu trừ (CMYK) bằng một ví dụ trực quan.'],
    'phoi-hop-mau-sac': ['Cho lớp gọi tên cách phối của vài bức ảnh trên vòng màu: tương đồng hay tương phản.'],
    'practical-light': ['Chỉ ra nguồn sáng có thật trong khung hình (đèn bàn, màn hình) để phân biệt với đèn chính.'],
}

export const GENERIC_TIPS = ['Dành vài phút đầu buổi ôn lại khái niệm lớp sai nhiều nhất bằng một ví dụ cụ thể.', 'Cho sinh viên giải thích lại khái niệm bằng lời của mình trước khi sang nội dung mới.']
