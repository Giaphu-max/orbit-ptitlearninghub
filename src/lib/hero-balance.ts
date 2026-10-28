import { page } from '@/lib/page-metrics'

/**
 * Cân bố cục trang chủ (phương án C, "Cân tổng thể"): MỘT hàm dùng chung cho hero và 3 chương cuộn.
 *  - NHÓM CHỮ = cả cột trái của chương, đo một lần khi mount / resize (không đo trong vòng cuộn hay vẽ), lưu vào `page.text`.
 *  - Khoảng thở bắt buộc:
 *      + Từ đáy navbar (đo phần tử nav thật, cả dạng viên) tới mép trên nhóm chữ ≥ 72px
 *      + Từ mép dưới nhóm chữ tới dòng hướng dẫn/đáy màn ≥ 72px
 *      + Nếu không đủ (màn thấp): scale cả nhóm chữ bằng transform: scale(s) từ góc trên trái (s tối thiểu 0.82)
 *  - Khung đích của vật thể chính (`page.body`): cao = nhóm chữ + 2×GAP, mép phải đối xứng lề trái, cách mép phải nhóm chữ ≥ MIN_COL.
 *      + Điều kiện bắt buộc: mép trên thân vật thể ≥ đáy navbar + 32px (đồng hồ/ăng-ten tòa A2 không chạm navbar).
 *  - Cả cụm có tâm dọc ở CENTER (48%) vùng tự do; nhóm chữ dời bằng transform.
 * Cảnh 3D (campus-scene) đọc `page.body` để khớp zoom + view offset ở từng điểm dừng.
 */
export const GAP = 36
export const MIN_COL = 96
export const CENTER = 0.48
/** Dưới 1280px (hoặc chế độ tĩnh) không cân */
export const BALANCE_MIN_W = 1280

export interface Rect {
    x0: number
    y0: number
    x1: number
    y1: number
}

/**
 * Khung đích của vật thể quanh nhóm chữ `text` (đã scale và tính vị trí dọc), trong vùng tự do.
 * `aspect` = rộng/cao của vật thể trên màn. Trả khung vật thể (`body`) và độ dời dọc `dy` (nếu có).
 */
export function targetBody(
    text: Rect,
    vw: number,
    safeTop: number,
    safeBottom: number,
    aspect: number,
    navBottom: number = 72,
) {
    const textH = text.y1 - text.y0
    let h = Math.min(textH + 2 * GAP, safeBottom - safeTop + 2 * GAP)
    // Mép phải thân = vw − mép trái nhóm chữ; mép trái thân cách mép phải nhóm chữ ≥ MIN_COL, không đủ thì thu nhỏ (giữ tâm dọc)
    const x1 = vw - text.x0
    const maxW = Math.max(40, x1 - (text.x1 + MIN_COL))
    let w = h * aspect
    if (w > maxW) {
        w = maxW
        h = w / aspect
    }
    // Tâm dọc vật thể đồng bộ với nhóm chữ
    const textCenterY = (text.y0 + text.y1) / 2
    let y0 = textCenterY - h / 2

    // Điều kiện bắt buộc: mép trên thân vật thể ≥ đáy navbar + 32px (đồng hồ/ăng-ten tòa A2 không chạm navbar)
    const minBodyY0 = navBottom + 32
    if (y0 < minBodyY0) {
        y0 = minBodyY0
    }
    const maxBodyY0 = window.innerHeight - 32 - h
    if (y0 > maxBodyY0 && maxBodyY0 >= minBodyY0) {
        y0 = maxBodyY0
    }

    const body: Rect = { x0: x1 - w, y0, x1, y1: y0 + h }
    const dy = (y0 + h / 2 - textH / 2) - text.y0
    return { body, dy }
}

/** Đáy navbar thật (cả dạng viên kính của các chương cuộn) */
function getNavBottom(index: number) {
    const navShell = document.querySelector<HTMLElement>('.nav-shell')
    if (navShell) {
        // Với các chương cuộn (index 1..3), navbar ở dạng viên (pill)
        if (index > 0) {
            return navShell.dataset.state === 'pill' ? navShell.getBoundingClientRect().bottom : 72
        }
        return navShell.getBoundingClientRect().bottom
    }
    return index > 0 ? 72 : 80
}

/** Đáy màn hình / mép trên dòng hướng dẫn [data-guide] */
function getBottomLimit() {
    const guide = document.querySelector<HTMLElement>('[data-guide]')
    const guideTop = guide ? guide.getBoundingClientRect().top : window.innerHeight
    return Math.min(window.innerHeight - 72, guideTop - 72)
}

/**
 * Đo nhóm chữ của từng panel:
 *  - Đảm bảo khoảng thở bắt buộc: đỉnh cách đáy navbar ≥ 72px, đáy cách hướng dẫn/đáy màn ≥ 72px.
 *  - Màn hình thấp: scale(s) với s tối thiểu 0.82 từ góc trên trái.
 *  - Dời nhóm chữ bằng transform translate3d, ghi khung đích vật thể vào `page.body` (đỉnh thân ≥ đáy navbar + 32px).
 */
export function measureBalance() {
    const vw = window.innerWidth
    const panels = [...document.querySelectorAll<HTMLElement>('[data-panel] > [data-text]')]
    page.text = []
    page.body = []
    for (const el of panels) {
        el.style.transform = ''
        el.style.transformOrigin = 'top left'
    }
    if (vw < BALANCE_MIN_W || !panels.length) {
        for (const el of panels) {
            el.style.removeProperty('--g')
            el.style.removeProperty('--tt')
            el.style.transformOrigin = ''
        }
        page.balanceKey++
        return
    }

    const bottomLimit = getBottomLimit()

    panels.forEach((el, i) => {
        // 1. Đo kích thước tự nhiên lúc chưa dời/scale
        const r = el.getBoundingClientRect()
        const naturalH = r.height
        // scrollWidth gồm cả phần chữ tràn ra ngoài cột (tiêu đề chương Học phần rộng 6 cột)
        const naturalW = Math.max(r.width, el.scrollWidth)
        const naturalY0 = r.top
        const naturalX0 = r.left

        // 2. Khoảng thở bắt buộc theo navbar
        const navBottom = getNavBottom(i)
        const topLimit = navBottom + 72
        const maxAvailH = Math.max(100, bottomLimit - topLimit)

        // 3. Nếu không đủ chiều cao: scale(s) với s tối thiểu 0.82 từ góc trên trái
        let s = 1
        if (naturalH > maxAvailH) {
            s = Math.max(0.82, Math.min(1, maxAvailH / naturalH))
        }

        const scaledH = naturalH * s
        const scaledW = naturalW * s

        // 4. Vị trí dọc: tâm thị giác CENTER (48%) trong vùng [topLimit, bottomLimit]
        const safeH = bottomLimit - topLimit
        const cy = topLimit + CENTER * safeH
        let targetTop = cy - scaledH / 2

        // Kẹp để luôn thoả mãn khoảng thở bắt buộc:
        // Đỉnh cách đáy navbar ≥ 72px (targetTop >= topLimit), và đáy cách hướng dẫn/đáy màn ≥ 72px (targetBottom <= bottomLimit)
        targetTop = Math.max(topLimit, Math.min(targetTop, bottomLimit - scaledH))
        const targetBottom = targetTop + scaledH

        const dy = targetTop - naturalY0

        // 5. Áp dụng transform cho panel
        el.style.transformOrigin = 'top left'
        el.style.transform = s < 0.999
            ? `translate3d(0, ${dy.toFixed(1)}px, 0) scale(${s.toFixed(4)})`
            : `translate3d(0, ${dy.toFixed(1)}px, 0)`

        const textRect: Rect = {
            x0: naturalX0,
            y0: targetTop,
            x1: naturalX0 + scaledW,
            y1: targetBottom,
        }

        // 6. Khung đích của vật thể 3D
        const { body } = targetBody(textRect, vw, topLimit, bottomLimit, page.aspect[i] ?? 1, navBottom)

        page.text[i] = textRect
        page.body[i] = body
        if (i === 1 || (i === 0 && !page.safe.top)) {
            page.safe = { top: topLimit, bottom: bottomLimit }
        }
    })
    page.balanceKey++
}

/** Mount + resize + khi font tải xong (đổi chiều cao chữ). Gộp qua requestAnimationFrame. */
export function trackBalance() {
    let raf = 0
    const run = () => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => measureBalance())
    }
    run()
    window.addEventListener('resize', run)
    void document.fonts?.ready.then(run)
    return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', run)
        page.text = []
        page.body = []
        page.balanceKey++
    }
}
