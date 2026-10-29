// Dữ liệu mẫu cho trang giảng viên: lý do sinh viên sai và ghi chú đáp án nhiễu.
// Bản triển khai thật do AI phân tích từ kết quả quiz của lớp; bản demo không gọi AI lúc xem.

/** Một câu giải thích vì sao nhiều sinh viên sai khái niệm này. */
export const WHY_WRONG: Record<string, string> = {
    'tinh-phi-huy-hoai': 'Nhiều bạn hiểu "cắt bỏ trên timeline" là xóa thật khỏi file gốc, trong khi timeline chỉ lưu chỉ dẫn cắt ghép.',
    'tai-tri-tue': 'Các bạn nhầm tải trí tuệ với độ dài của video, chưa gắn nó với lượng thông tin người xem phải xử lý cùng lúc.',
    'ngon-ngu-thi-giac-dien-anh': 'Các bạn chọn đáp án nói về kỹ thuật máy móc, bỏ qua ý chính là hình ảnh kể chuyện bằng bố cục và ánh sáng.',
    'nen-va-keo-dai-thoi-gian': 'Các bạn lẫn giữa nén thời gian (rút gọn sự kiện) và tua nhanh hình, hai khái niệm này đi liền nhau trong bài.',
    'quy-trinh-dung-bon-giai-doan': 'Thứ tự Rough cut và Fine cut hay bị đảo; nhiều bạn chưa nắm Picture lock là điểm khóa thời lượng.',
    'he-mau-rgb-va-cmyk': 'Các bạn nhầm màu cộng (RGB, màn hình) với màu trừ (CMYK, in ấn), đặc biệt ở câu hỏi về màu thành phần.',
    'phoi-hop-mau-sac': 'Các bạn nhầm màu tương phản với màu tương đồng khi gọi tên các cách phối trên vòng màu.',
    'practical-light': 'Các bạn xem practical light là đèn chính, trong khi đây là nguồn sáng có thật trong khung cảnh như đèn bàn, màn hình.',
}

/** Ghi chú về đáp án nhiễu bị chọn nhiều (id câu → chỉ số đáp án + lý do). */
export const TRAP_NOTES: Record<string, { option: number; note: string }> = {
    'q-tinh-phi-huy-hoai-1': {
        option: 0,
        note: 'Đáp án đầu bị chọn nhiều vì chữ "cắt bỏ" dễ bị hiểu thành xóa khỏi file gốc. Nên viết lại đáp án nhiễu cho khác bản chất hơn.',
    },
    'q-quy-trinh-dung-bon-giai-doan-1': {
        option: 0,
        note: 'Rough cut hay bị chọn thay cho Picture lock vì cả hai đều là bản dựng gần hoàn chỉnh.',
    },
}

/** Giảng viên của lớp mẫu (lời chào ở Tổng quan). */
export const TEACHER_PROFILE = { honorific: 'thầy', name: 'Châu', fullName: 'ThS. Nguyễn Cảnh Châu' }
