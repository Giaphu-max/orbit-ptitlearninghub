/**
 * Số đo trang chủ tính sẵn để vòng khung hình không phải đọc layout (getBoundingClientRect / offsetTop / scrollHeight):
 * đo khi mount và khi kích thước đổi (ResizeObserver), vị trí cuộn lấy từ sự kiện scroll.
 */
export const page = {
    /** scrollY mới nhất */
    y: 0,
    vh: 1,
    /** Mép trên của footer trong tọa độ tài liệu */
    footerTop: Infinity,
    /** Mép trên của section hành trình trong tọa độ tài liệu, và quãng cuộn trong khung ghim */
    journeyTop: 0,
    dist: 1,
    /** scrollHeight - innerHeight */
    max: 0,
    /** Trang chủ paged (không cuộn tài liệu): footer là tấm phủ fixed, footerP = tiến độ trượt lên 0..1 */
    paged: false,
    footerP: 0,
    /** Cân bố cục (hero-balance): nhóm chữ và khung đích của vật thể chính từng chương (px, trống khi < 1280px), vùng tự do, tỉ lệ rộng/cao vật thể (cảnh ghi), và số lần đo (cảnh tính lại khi đổi) */
    text: [] as { x0: number; y0: number; x1: number; y1: number }[],
    body: [] as { x0: number; y0: number; x1: number; y1: number }[],
    safe: { top: 80, bottom: 800 },
    aspect: [] as number[],
    balanceKey: 0,
}

/** Footer còn cách đáy màn bao nhiêu (px, âm = đã vào) → 0..1 mức footer phủ lên màn */
export const footerCover = () => (page.paged ? page.footerP : Math.max(0, Math.min(1, 1 - (page.footerTop - page.y) / page.vh)))

export function trackPage(getFooter: () => HTMLElement | null) {
    const measure = () => {
        const de = document.documentElement
        page.vh = window.innerHeight
        page.y = window.scrollY
        page.max = Math.max(0, de.scrollHeight - page.vh)
        const f = getFooter()
        page.footerTop = f ? f.getBoundingClientRect().top + page.y : Infinity
        const j = document.getElementById('journey')
        const pin = j?.firstElementChild as HTMLElement | null | undefined
        if (j && pin) {
            page.journeyTop = j.getBoundingClientRect().top + page.y
            page.dist = Math.max(1, j.offsetHeight - pin.offsetHeight)
        }
    }
    const onScroll = () => {
        page.y = window.scrollY
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    const j = document.getElementById('journey')
    if (j) ro.observe(j)
    const f = getFooter()
    if (f) ro.observe(f)
    return {
        measure,
        stop: () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', measure)
            ro.disconnect()
        },
    }
}
