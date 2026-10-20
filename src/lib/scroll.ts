// Cuộn tới phần trên trang chủ. scroll-margin-top của .section-anchor (= chiều cao thanh nav) giữ tiêu đề không bị che.

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** id "top" cuộn về đầu trang. Tôn trọng prefers-reduced-motion (nhảy thẳng, không cuộn mượt). */
export function scrollToSection(id: string) {
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    if (id === 'top') {
        window.scrollTo({ top: 0, behavior })
        return true
    }
    const el = document.getElementById(id)
    if (!el) return false
    el.scrollIntoView({ behavior, block: 'start' })
    return true
}
