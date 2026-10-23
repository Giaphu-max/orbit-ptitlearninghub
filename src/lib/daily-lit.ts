/** Số tầng cửa sổ của tòa A2: bài Daily thứ k (theo thứ tự đọc trong ngày) đọc xong thì sáng tầng thứ k, thấp → cao. */
export const A2_TIERS = 10
/** Nhịp sáng nối tiếp của các tầng còn lại khi hoàn thành nhiệm vụ ẩn (ms). */
export const FINALE_STEP_MS = 120

/** Trạng thái đèn tầng cho cảnh 3D (ghi vào ref, không render lại cảnh). */
export interface DailyLit {
    /** Số bài Daily đã đọc hôm nay = số tầng sáng từ dưới lên */
    read: number
    /** Các tầng còn lại cũng sáng (đã nhận nhiệm vụ ẩn hôm nay, hoặc đang phát hiệu ứng) */
    finale: boolean
    /** performance.now() lúc bắt đầu hiệu ứng sáng nối tiếp; 0 = sáng ngay không hiệu ứng */
    finaleAt: number
}
