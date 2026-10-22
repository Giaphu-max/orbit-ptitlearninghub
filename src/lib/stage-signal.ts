/** Tín hiệu từ useScrollStage sang cảnh 3D, không đi qua DOM: 1 khi panel chương có chữ trên màn (cảnh làm tối nền nhẹ). */
export const stageSignal = { onStage: 0 }

/**
 * MỘT lớp phủ màu nền (cố định, chỉ đổi opacity) thay cho ba lớp riêng: nền tối nhẹ khi có chữ (dim), che quanh điểm cắt cảnh trong
 * cảnh (dip) và che khi nhảy chương (cut). Cùng màu nên opacity gộp = 1 − (1−dim)(1−dip)(1−cut).
 */
export const overlay = { el: null as HTMLElement | null, dim: 0, dip: 0, cut: 0, last: -1 }

export function flushOverlay() {
    const o = overlay
    if (!o.el) return
    const a = 1 - (1 - o.dim) * (1 - o.dip) * (1 - o.cut)
    if (Math.abs(a - o.last) >= 0.004 || (a !== o.last && (a <= 0.002 || a >= 0.998))) {
        o.last = a
        o.el.style.opacity = a < 0.002 ? '0' : a.toFixed(3)
    }
}
