import { useEffect, useRef, useState, type RefObject } from 'react'

/** Dưới ngưỡng này (hoặc khi bật giảm chuyển động) trang chủ không chuyển cảnh: canvas 55vh phía trên, mỗi chương một khung máy cố định. */
export const STATIC_QUERY = '(max-width: 859px)'
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** Số chương trên trang chủ: S chạy liên tục 0..CHAPTERS-1. */
export const CHAPTERS = 4

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

function useMedia(query: string) {
    const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
    useEffect(() => {
        const mq = window.matchMedia(query)
        const on = () => setMatch(mq.matches)
        on()
        mq.addEventListener('change', on)
        return () => mq.removeEventListener('change', on)
    }, [query])
    return match
}

/** Chế độ sân khấu: `static` = không chuyển cảnh (màn hẹp hoặc prefers-reduced-motion). */
export function useStageMode() {
    const narrow = useMedia(STATIC_QUERY)
    const reduce = useMedia(REDUCE_QUERY)
    return { reduce, narrow, staticMode: narrow || reduce }
}

interface Options {
    /** Không chuyển cảnh: S nhảy thẳng tới số nguyên của chương đang đọc, không làm mượt. */
    staticMode: boolean
    /** Thanh tiến độ cuộn: hook ghi trực tiếp transform, không qua state. */
    barRef?: RefObject<HTMLElement | null>
    /** Phần tử chương, theo thứ tự từ trên xuống. */
    selector?: string
}

/**
 * Đọc vị trí cuộn (listener passive + rAF) thành giá trị S liên tục 0..3, rồi làm mượt bằng lerp theo dt.
 * Chương i "đã tới" khi giữa chương đó chạm giữa màn hình (S = i). S nằm trong ref (không setState mỗi khung hình);
 * chỉ `chapter` (làm tròn) và `scrolled` là state và đổi rất ít.
 */
export function useScrollStage({ staticMode, barRef, selector = '[data-chapter]' }: Options) {
    const stage = useRef(0)
    const [chapter, setChapter] = useState(0)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        let sections: HTMLElement[] = []
        let target = 0
        let raf = 0
        let last = 0
        let lastChapter = -1
        let lastScrolled: boolean | null = null

        const collect = () => {
            sections = [...document.querySelectorAll<HTMLElement>(selector)]
        }
        const read = () => {
            const mid = window.innerHeight * 0.5
            let s = 0
            sections.forEach((el, i) => {
                const r = el.getBoundingClientRect()
                if (r.top < mid) s = i + clamp((mid - r.top) / r.height)
            })
            target = clamp(s - 0.5, 0, Math.max(sections.length - 1, 0))
            const max = document.documentElement.scrollHeight - window.innerHeight
            if (barRef?.current) barRef.current.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`
            const isScrolled = window.scrollY > 40
            if (isScrolled !== lastScrolled) {
                lastScrolled = isScrolled
                setScrolled(isScrolled)
            }
        }
        const publishChapter = () => {
            const c = Math.round(stage.current)
            if (c !== lastChapter) {
                lastChapter = c
                setChapter(c)
            }
        }
        const frame = (now: number) => {
            raf = 0
            const dt = Math.min((now - last) / 1000, 0.05)
            last = now
            if (staticMode) {
                stage.current = Math.round(target)
            } else {
                stage.current += (target - stage.current) * (1 - Math.pow(0.0009, dt))
                // Đã đủ gần: chốt hẳn và dừng vòng lặp tới lần cuộn sau
                if (Math.abs(target - stage.current) < 0.0005) stage.current = target
            }
            publishChapter()
            if (stage.current !== target) raf = requestAnimationFrame(frame)
        }
        const kick = () => {
            if (!raf) {
                last = performance.now()
                raf = requestAnimationFrame(frame)
            }
        }
        const onScroll = () => {
            read()
            kick()
        }
        const onResize = () => {
            collect()
            onScroll()
        }

        collect()
        read()
        // Vào trang giữa chừng (tải lại khi đã cuộn): đặt S ngay, không trượt từ 0
        stage.current = target
        publishChapter()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onResize)
        // Nội dung chương có thể đổi chiều cao khi dữ liệu tải xong
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
        sections.forEach((el) => ro?.observe(el))
        return () => {
            cancelAnimationFrame(raf)
            ro?.disconnect()
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onResize)
        }
    }, [staticMode, barRef, selector])

    return { stage, chapter, scrolled }
}
