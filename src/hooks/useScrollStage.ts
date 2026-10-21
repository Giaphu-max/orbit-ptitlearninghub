import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
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
export const BUDGET = [null, { TR: 1.1, ST: 1.3 }, { TR: 1.2, ST: 0.85 }, { TR: 1.3, ST: 1.1 }] as const
/** Khoảng S của máy quay trong phần chuyển cảnh của từng chương */
const TRANSIT = [null, [0, 1], [1, 1.8], [1.8, 3]] as const
const LEAD = 0.1 // màn hình đầu section trước khi máy quay bắt đầu chạy
const TAIL = 0.15 // màn hình cuối section: nội dung mờ đi

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
 * `journey` = có hành trình cuộn (máy quay bay, section ghim, Lenis, snap); giảm chuyển động thì không.
 * `staticMode` (narrow hoặc reduce) chỉ quyết định bố cục canvas.
 */
export function useStageMode() {
    const narrow = useMedia(STATIC_QUERY)
    const reduce = useMedia(REDUCE_QUERY)
    return { reduce, narrow, staticMode: narrow || reduce, journey: !reduce }
}

interface Options {
    journey: boolean
    /** Chế độ làm mờ cảnh: không snap */
    calm: MutableRefObject<boolean>
    /** Thanh tiến độ cuộn: hook ghi trực tiếp transform, không qua state. */
    barRef?: RefObject<HTMLElement | null>
    /** Phần tử gốc của trang chủ: hook ghi biến --on-stage và đánh dấu mục thanh chương đang chọn. */
    rootRef: RefObject<HTMLElement | null>
}

/**
 * Đọc vị trí cuộn thành S liên tục 0..3 (nhịp chuyển cảnh/dừng đọc theo BUDGET), hiện nội dung từng bước, snap theo chương và
 * cuộn mượt bằng Lenis. Mọi thứ ghi thẳng vào DOM/ref; chỉ `scrolled` là state và đổi rất ít.
 * S ở đây là giá trị đích (chưa làm mượt); cảnh 3D tự làm mượt.
 */
export function useScrollStage({ journey, calm, barRef, rootRef }: Options) {
    const stage = useRef(0)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const secs = [...document.querySelectorAll<HTMLElement>('[data-chapter]')]
        const cols = secs.map((s) => s.querySelector<HTMLElement>('[data-col]'))
        let lastScrolled: boolean | null = null
        let lastOnStage = ''
        let lastChap = -1

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
                    const inA = band(d, d1 - 0.05, d1 + 0.12)
                    const cv = inA * (1 - band(d, H - TAIL, H))
                    vis[i] = cv
                    const col = cols[i]
                    if (col) {
                        col.style.opacity = cv.toFixed(3)
                        col.style.transform = `translateY(${(1 - inA - band(d, H - TAIL, H)) * 24}px)`
                        col.style.visibility = cv < 0.002 ? 'hidden' : ''
                    }
                    const stepEls = secs[i].querySelectorAll<HTMLElement>('[data-s]')
                    const n = stepEls.length
                    const span = Math.min(0.55, B.ST * 0.5)
                    stepEls.forEach((el, k) => {
                        const a0 = d1 + k * (span / Math.max(n, 1))
                        const e = smooth(band(d, a0, a0 + 0.12))
                        el.style.opacity = e.toFixed(3)
                        el.style.transform = `translateY(${(1 - e) * 18}px)`
                    })
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
                const onStage = Math.max(vis[1], vis[3]).toFixed(2)
                if (onStage !== lastOnStage) {
                    lastOnStage = onStage
                    root.style.setProperty('--on-stage', onStage)
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
            lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85 })
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

        // ── Snap: một cú cuộn = một chương. Dừng giữa chuyển cảnh thì lướt tới phần dừng đọc kế (xuống) / trước (lên) ──
        let lastY = window.scrollY
        let dir = 1
        let snapT = 0
        let snapping = false
        const stops = () => {
            const vh = window.innerHeight
            const out: [number, number][] = [[0, vh * 0.15]]
            for (let i = 1; i < secs.length; i++) {
                const B = BUDGET[i]!
                const top = chapterTop(i) - vh
                out.push([top + (LEAD + B.TR + 0.12) * vh, top + (LEAD + B.TR + B.ST + TAIL - 0.18) * vh])
            }
            const foot = document.getElementById('home-footer')
            out.push([foot ? foot.getBoundingClientRect().top + window.scrollY - vh * 0.3 : Infinity, Infinity])
            return out
        }
        const maybeSnap = () => {
            if (snapping || calm.current || !lenis) return
            const y = window.scrollY
            const S_ = stops()
            if (S_.some(([a, b]) => y >= a - 2 && y <= b + 2)) return
            let target: number | null = null
            if (dir > 0) {
                for (const [a] of S_)
                    if (a > y) {
                        target = a
                        break
                    }
            } else {
                for (let k = S_.length - 1; k >= 0; k--)
                    if (S_[k][1] < y) {
                        target = S_[k][1]
                        break
                    }
            }
            if (target === null || !Number.isFinite(target)) return
            target = Math.min(target, document.documentElement.scrollHeight - window.innerHeight)
            snapping = true
            lenis.scrollTo(target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: () => (snapping = false), lock: true })
        }
        const onScroll = () => {
            read()
            const y = window.scrollY
            if (Math.abs(y - lastY) > 1) dir = y > lastY ? 1 : -1
            lastY = y
            window.clearTimeout(snapT)
            if (journey && !snapping) snapT = window.setTimeout(maybeSnap, 140)
        }

        read()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', read)
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null
        secs.forEach((el) => ro?.observe(el))
        return () => {
            cancelAnimationFrame(raf)
            window.clearTimeout(snapT)
            ro?.disconnect()
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', read)
            setChapterScroller(null)
            setLenis(null)
            lenis?.destroy()
        }
    }, [journey, calm, barRef, rootRef])

    return { stage, scrolled }
}
