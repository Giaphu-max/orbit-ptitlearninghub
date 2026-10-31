import { useSyncExternalStore } from 'react'

/**
 * Trạng thái cuộn của trang chủ 5 trang (tòa A2). Cuộn tài liệu chỉ ghi `tp` (đích); hook useTowerScroll làm mượt thành `p`
 * mỗi khung trong vòng rAF chung, cảnh 3D và lớp chữ đọc từ đây. Không đi qua React nên không render lại mỗi khung.
 */
export const TOWER_PAGES = 5

export const tower = {
    /** Tiến độ cuộn đích, đơn vị trang: 0..4 */
    tp: 0,
    /** Tiến độ đã làm mượt (camera bay theo p) */
    p: 0,
    /** Trang đang chọn = round(p) */
    page: 0,
    /** Chiều cao cửa sổ (px), đo khi resize */
    vh: 1,
    /** Chuột chuẩn hóa -0.5..0.5 */
    mx: 0,
    my: 0,
}

// Trang Studio chuyển hoàng hôn: thanh điều hướng đổi chữ sang trắng
let dusk = false
const subs = new Set<() => void>()
export function setTowerDusk(v: boolean) {
    if (v === dusk) return
    dusk = v
    subs.forEach((f) => f())
}
const subscribe = (f: () => void) => {
    subs.add(f)
    return () => void subs.delete(f)
}
export const useTowerDusk = () =>
    useSyncExternalStore(
        subscribe,
        () => dusk,
        () => false,
    )

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __tower: typeof tower }).__tower = tower
