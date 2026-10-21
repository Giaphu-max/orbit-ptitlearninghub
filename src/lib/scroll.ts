import type Lenis from 'lenis'

// Cuộn trang: dùng chung cho nav, footer và các nút điều hướng. Trang chủ đăng ký Lenis và hàm cuộn tới giữa phần dừng đọc của từng chương.

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let lenis: Lenis | null = null
let chapterScroller: ((index: number) => void) | null = null

export const setLenis = (l: Lenis | null) => {
    lenis = l
}
export const getLenis = () => lenis
export const setChapterScroller = (fn: ((index: number) => void) | null) => {
    chapterScroller = fn
}

/** Cuộn mượt tới vị trí y (Lenis nếu có, không thì cuộn mượt của trình duyệt; giảm chuyển động thì nhảy thẳng). */
export function scrollToY(y: number, duration = 1.6) {
    if (lenis) lenis.scrollTo(y, { duration })
    else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

const CHAPTER_OF: Record<string, number> = { top: 0, daily: 1, courses: 2, studio: 3 }

/** id "top" cuộn về đầu trang. Trang chủ kể chuyện: cuộn tới giữa phần dừng đọc của chương. */
export function scrollToSection(id: string) {
    const c = CHAPTER_OF[id]
    const el = id === 'top' ? null : document.getElementById(id)
    if (c !== undefined && chapterScroller) {
        chapterScroller(c)
        return true
    }
    // Chương kể chuyện đã dựng nhưng hàm cuộn chưa đăng ký: báo chưa xong để nơi gọi thử lại
    if (el?.hasAttribute('data-journey')) return false
    if (id === 'top') {
        scrollToY(0)
        return true
    }
    if (!el) return false
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    return true
}
