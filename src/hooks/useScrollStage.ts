import { useEffect, useRef, useState, type RefObject } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { scrollToY, setChapterScroller, setLenis } from '@/lib/scroll'

/** Dưới ngưỡng này trang chủ dùng canvas 55svh phía trên (bố cục màn hẹp); máy quay vẫn bay như desktop. */
export const STATIC_QUERY = '(max-width: 859px)'
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** Số chương trên trang chủ: S chạy liên tục 0..CHAPTERS-1. */
export const CHAPTERS = 4

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const band = (s: number, a: number, b: number) => clamp((s - a) / (b - a))

/**
 * Mỗi chương (01–03) = hai nhịp: CHUYỂN CẢNH (máy quay chạy, cột chữ ẩn) rồi DỪNG ĐỌC (máy quay đứng yên, nội dung ghim giữa màn).
 * Quãng cuộn tính theo số màn hình: TR = chuyển cảnh, ST = dừng đọc. Chiều cao section = (0.1 + TR + ST + 0.15) × 100vh.
 */
export const BUDGET = [null, { TR: 0.9, ST: 1.2 }, { TR: 0.9, ST: 1.1 }, { TR: 0.8, ST: 1.2 }] as const
/** Khoảng S của máy quay trong phần chuyển cảnh của từng chương */
const TRANSIT = [null, [0, 1], [1, 1.8], [1.8, 3]] as const
const LEAD = 0.1 // màn hình đầu section trước khi máy quay bắt đầu chạy
const TAIL = 0.15 // màn hình cuối section
/** Chữ hiện khi máy quay đã đi được 70% quãng chuyển cảnh, và rời đi khi còn 0,3 màn hình cuối section */
const ON_LEAD = 0.3
const ON_END = 0.3

/** Chiều cao section chương i (svh) */
export const stageHeightSvh = (i: number) => {
    const B = BUDGET[i]
    return B ? (LEAD + B.TR + B.ST + TAIL) * 100 : 100
}

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

/**
 * `narrow`: canvas 55svh phía trên, không dịch cảnh sang phải; `reduce`: giảm chuyển động.
 * `journey` = có hành trình cuộn (máy quay bay, section ghim, Lenis); giảm chuyển động thì không.
 * `staticMode` (narrow hoặc reduce) chỉ quyết định bố cục canvas.
 */
export function useStageMode() {
    const narrow = useMedia(STATIC_QUERY)
    const reduce = useMedia(REDUCE_QUERY)
    return { reduce, narrow, staticMode: narrow || reduce, journey: !reduce }
}

interface Options {
    journey: boolean
    /** Thanh tiến độ cuộn: hook ghi trực tiếp transform, không qua state. */
    barRef?: RefObject<HTMLElement | null>
    /** Phần tử gốc của trang chủ: hook ghi biến --on-stage và đánh dấu mục thanh chương đang chọn. */
    rootRef: RefObject<HTMLElement | null>
}

/**
 * Đọc vị trí cuộn thành S liên tục 0..3 (nhịp chuyển cảnh/dừng đọc theo BUDGET) và đánh dấu từng section chương bằng class rời rạc
 * `on` (đang đọc) / `past` (đã qua); CSS lo phần hiện chữ theo nhịp cố định. Cuộn mượt bằng Lenis, không có snap tự kéo.
 * Mọi thứ ghi thẳng vào DOM/ref; chỉ `scrolled` là state và đổi rất ít.
 * S ở đây là giá trị đích (chưa làm mượt); cảnh 3D tự làm mượt.
 */
export function useScrollStage({ journey, barRef, rootRef }: Options) {
    const stage = useRef(0)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const secs = [...document.querySelectorAll<HTMLElement>('[data-chapter]')]
        let lastScrolled: boolean | null = null
        let lastOnStage = ''
        let lastChap = -1
        const stepCount: number[] = []

        const read = () => {
            const vh = window.innerHeight
            const y = window.scrollY
            const vis = [clamp(1 - (y / vh) * 1.4), 0, 0, 0]
            let st = 0
            if (journey) {
                for (let i = 1; i < secs.length; i++) {
                    const B = BUDGET[i]!
                    const r = secs[i].getBoundingClientRect()
                    const d = (vh - r.top) / vh // số màn hình đã cuộn kể từ khi section vào khung
                    const H = r.height / vh
                    const d1 = LEAD + B.TR
                    if (d > LEAD) st = lerp(TRANSIT[i]![0], TRANSIT[i]![1], smooth(band(d, LEAD, d1)))
                    // Trạng thái rời rạc: trước / on / past. CSS animate với nhịp cố định, không buộc theo vị trí cuộn.
                    const on = d >= d1 - B.TR * ON_LEAD && d < H - ON_END
                    secs[i].classList.toggle('on', on)
                    secs[i].classList.toggle('past', d >= H - ON_END)
                    vis[i] = on ? 1 : 0
                    // Thứ tự phần tử cho độ trễ lần lượt (--n)
                    const stepEls = secs[i].querySelectorAll<HTMLElement>('[data-s]')
                    if (stepCount[i] !== stepEls.length) {
                        stepCount[i] = stepEls.length
                        stepEls.forEach((el, k) => el.style.setProperty('--n', String(k)))
                    }
                }
            } else {
                // Giảm chuyển động: không bay, S nhảy tới số nguyên của chương đang đọc
                const mid = vh * 0.5
                secs.forEach((el, i) => {
                    if (el.getBoundingClientRect().top < mid) st = i
                })
            }
            stage.current = clamp(st, 0, CHAPTERS - 1)

            const max = document.documentElement.scrollHeight - vh
            if (barRef?.current) barRef.current.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`
            const isScrolled = y > 40
            if (isScrolled !== lastScrolled) {
                lastScrolled = isScrolled
                setScrolled(isScrolled)
            }
            const root = rootRef.current
            if (root) {
                // Đích 0/1: cảnh 3D tự làm mượt theo thời gian rồi ghi --on-stage
                const onStage = String(Math.max(vis[1], vis[3]))
                if (onStage !== lastOnStage) {
                    lastOnStage = onStage
                    root.dataset.onStage = onStage
                }
                let chap = 0
                let best = -1
                vis.forEach((v, i) => {
                    if (v > best + 0.001) {
                        best = v
                        chap = i
                    }
                })
                if (best < 0.05) chap = st < 1 ? 0 : st < 1.8 ? 1 : st < 2.6 ? 2 : 3
                if (chap !== lastChap) {
                    lastChap = chap
                    root.querySelectorAll<HTMLElement>('[data-rail-link]').forEach((a, i) => a.setAttribute('data-on', String(i === chap)))
                }
            }
        }

        // ── Lenis (cuộn mượt) ──
        let lenis: Lenis | null = null
        let raf = 0
        if (journey) {
            lenis = new Lenis({ duration: 1.15, smoothWheel: true })
            setLenis(lenis)
            lenis.on('scroll', read)
            const tick = (t: number) => {
                lenis!.raf(t)
                raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }

        // ── Cuộn tới giữa phần dừng đọc của chương (nút thanh chương, nav) ──
        const chapterTop = (i: number) => secs[i].getBoundingClientRect().top + window.scrollY
        if (journey) {
            setChapterScroller((c) => {
                const B = BUDGET[c]
                scrollToY(c === 0 || !B ? 0 : chapterTop(c) - window.innerHeight + window.innerHeight * (LEAD + B.TR + B.ST * 0.5), 1.6)
            })
        }

        const onScroll = () => read()

        read()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', read)
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null
        secs.forEach((el) => ro?.observe(el))
        return () => {
            cancelAnimationFrame(raf)
            ro?.disconnect()
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', read)
            setChapterScroller(null)
            setLenis(null)
            lenis?.destroy()
        }
    }, [journey, barRef, rootRef])

    return { stage, scrolled }
}
