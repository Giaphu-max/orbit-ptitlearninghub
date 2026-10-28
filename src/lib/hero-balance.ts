import { page } from '@/lib/page-metrics'

/**
 * Cân bố cục trang chủ (phương án C, "Cân tổng thể"): MỘT hàm dùng chung cho hero và 3 chương cuộn.
 *  - NHÓM CHỮ = cả cột trái của chương, đo một lần khi mount / resize (không đo trong vòng cuộn hay vẽ), lưu vào `page.text`.
 *  - Khung đích của vật thể chính (`page.body`): cao = nhóm chữ + 2×GAP, mép phải đối xứng lề trái, cách mép phải nhóm chữ ≥ MIN_COL.
 *  - Cả cụm có tâm dọc ở CENTER (48%) vùng tự do dưới navbar; nhóm chữ dời bằng transform.
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

const SPACING_STEPS = [1, 0.9, 0.8, 0.7]
const TITLE_STEPS = [0.95, 0.9, 0.85, 0.8]

/**
 * Khung đích của vật thể quanh nhóm chữ `text` (tọa độ lúc chưa dời), trong vùng tự do [safeTop, safeBottom].
 * `aspect` = rộng/cao của vật thể trên màn. Trả khung vật thể và độ dời dọc (px) của nhóm chữ.
 */
export function targetBody(text: Rect, vw: number, safeTop: number, safeBottom: number, aspect: number) {
    const safeH = safeBottom - safeTop
    const textH = text.y1 - text.y0
    let h = Math.min(textH + 2 * GAP, safeH)
    const cy = safeTop + CENTER * safeH
    // Mép phải thân = vw − mép trái nhóm chữ; mép trái thân cách mép phải nhóm chữ ≥ MIN_COL, không đủ thì thu nhỏ (giữ tâm dọc)
    const x1 = vw - text.x0
    const maxW = Math.max(40, x1 - (text.x1 + MIN_COL))
    let w = h * aspect
    if (w > maxW) {
        w = maxW
        h = w / aspect
    }
    const y0 = Math.min(Math.max(cy - h / 2, safeTop), safeBottom - h)
    const body: Rect = { x0: x1 - w, y0, x1, y1: y0 + h }
    // Nhóm chữ nằm giữa thân (cách mỗi đầu GAP) và cùng tâm dọc với cụm
    const dy = (y0 + h / 2 - textH / 2) - text.y0
    return { body, dy }
}

/** Vùng tự do dưới navbar, trên dòng "Cuộn để khám phá" */
function safeArea() {
    const root = document.documentElement
    const rem = parseFloat(getComputedStyle(root).fontSize) || 16
    const nav = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 5
    const guide = document.querySelector<HTMLElement>('[data-guide]')
    const top = nav * rem
    const bottom = guide ? guide.getBoundingClientRect().top - 8 : window.innerHeight - 72
    return { top, bottom: Math.max(bottom, top + 200) }
}

/**
 * Đo nhóm chữ của từng panel, thu khoảng cách / cỡ tiêu đề cho vừa vùng tự do (khoảng cách tối đa còn 70% trước, rồi mới tới cỡ tiêu đề),
 * dời nhóm chữ và ghi khung đích vật thể vào `page.body`. Tỉ lệ rộng/cao vật thể chính từng chương lấy từ `page.aspect` (cảnh 3D ghi khi dựng / resize).
 */
export function measureBalance() {
    const vw = window.innerWidth
    const panels = [...document.querySelectorAll<HTMLElement>('[data-panel] > [data-text]')]
    page.text = []
    page.body = []
    for (const el of panels) el.style.transform = ''
    if (vw < BALANCE_MIN_W || !panels.length) {
        for (const el of panels) {
            el.style.removeProperty('--g')
            el.style.removeProperty('--tt')
        }
        page.balanceKey++
        return
    }
    const safe = safeArea()
    page.safe = { top: safe.top, bottom: safe.bottom }
    const avail = safe.bottom - safe.top - 2 * GAP
    panels.forEach((el, i) => {
        const set = (g: number, tt: number) => {
            el.style.setProperty('--g', String(g))
            el.style.setProperty('--tt', String(tt))
        }
        set(1, 1)
        const fits = () => el.getBoundingClientRect().height <= avail
        let ok = fits()
        for (const g of SPACING_STEPS.slice(1)) {
            if (ok) break
            set(g, 1)
            ok = fits()
        }
        for (const tt of TITLE_STEPS) {
            if (ok) break
            set(0.7, tt)
            ok = fits()
        }
        const r = el.getBoundingClientRect()
        const text: Rect = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }
        const { body, dy } = targetBody(text, vw, safe.top, safe.bottom, page.aspect[i] ?? 1)
        el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`
        page.text[i] = { ...text, y0: text.y0 + dy, y1: text.y1 + dy }
        page.body[i] = body
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
