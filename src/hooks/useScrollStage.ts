import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { setChapterScroller, setJourneyChapter, setLenis } from '@/lib/scroll'

/** Dưới ngưỡng này trang chủ dùng canvas 55svh phía trên (bố cục màn hẹp); máy quay vẫn bay như desktop. */
export const STATIC_QUERY = '(max-width: 859px)'
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** Số chương trên trang chủ: Hero, Hôm nay, Khóa học, Studio. */
export const CHAPTERS = 4

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

/** S của máy quay ở từng chương (cảnh 3D đọc S liên tục 0..3) */
const STOP = [0, 1, 1.8, 3] as const
/** Số giây bay giữa hai chương liền nhau: hero→Hôm nay (vòng quanh trường), →Khóa học (qua cổng, cửa kính, kiosk), →Studio */
const SEG = [1.5, 2.8, 2.4] as const
const FLIGHT_MIN = 0.6
const FLIGHT_MAX = 3.6
/** Chữ vào khi máy quay đã bay được chừng này, để chữ hiện đúng lúc cảnh dừng; theo chương đích. Đoạn hero ↔ Hôm nay ngắn (vòng quay nhanh) nên chữ vào sớm hơn. */
const REVEAL = [0.72, 0.6, 0.72, 0.72] as const
const REVEAL_HERO_LEG = 0.6
/** Hạn mức vận tốc đầu của đoạn bay mới (S/giây) để không giật khi đổi hướng giữa chừng */
const V_LIMIT = 1.5
/** Một khoảng nghỉ lâu chừng này giữa hai sự kiện wheel = cú vuốt trước (và quán tính của nó) đã hết */
const WHEEL_GAP_MS = 160
const MIN_LOCK_MS = 900
const SWIPE_PX = 36

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
    /** Phần tử gốc của trang chủ: hook ghi data-on-stage và đánh dấu mục thanh chương đang chọn. */
    rootRef: RefObject<HTMLElement | null>
    /** Chế độ "Làm mờ cảnh 3D": không khóa cuộn, chữ hiện ngay */
    calmRef: MutableRefObject<boolean>
}

/**
 * Cuộn theo trạng thái (như marketingbigday2026): một section cao có khung sticky 100svh, bốn panel chồng nhau.
 * Vị trí cuộn chỉ chọn CHƯƠNG hiện tại; máy quay (S) bay theo thời gian bằng cubic Hermite từ (S, vận tốc hiện tại) tới điểm dừng của chương,
 * và chữ hiện (class `on`) khi chuyến bay đi được 72%. Mỗi cú vuốt bước đúng một chương: input bị chặn khi đang bay hoặc khi còn quán tính của cú vuốt trước.
 * Mọi thứ ghi thẳng vào DOM/ref; chỉ `scrolled` là state và đổi rất ít. Giảm chuyển động: không khóa, S nhảy thẳng tới chương đang đọc.
 */
export function useScrollStage({ journey, barRef, rootRef, calmRef }: Options) {
    const stage = useRef(0)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        let lastScrolled: boolean | null = null
        const updateChrome = () => {
            const vh = window.innerHeight
            const y = window.scrollY
            const max = document.documentElement.scrollHeight - vh
            if (barRef?.current) barRef.current.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`
            const isScrolled = y > 40
            if (isScrolled !== lastScrolled) {
                lastScrolled = isScrolled
                setScrolled(isScrolled)
            }
        }
        const markRail = (chap: number) => {
            rootRef.current?.querySelectorAll<HTMLElement>('[data-rail-link]').forEach((a, i) => a.setAttribute('data-on', String(i === chap)))
        }

        const journeyEl = document.getElementById('journey')
        const pin = journeyEl?.firstElementChild as HTMLElement | null | undefined
        const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')]

        // ── Không có hành trình (giảm chuyển động): S nhảy tới số nguyên của chương đang đọc, không khóa cuộn ──
        if (!journey || !journeyEl || !pin || panels.length === 0) {
            const secs = [...document.querySelectorAll<HTMLElement>('[data-chapter]')]
            const read = () => {
                const mid = window.innerHeight * 0.5
                let st = 0
                secs.forEach((el, i) => {
                    if (el.getBoundingClientRect().top < mid) st = i
                })
                stage.current = clamp(st, 0, CHAPTERS - 1)
                updateChrome()
            }
            read()
            window.addEventListener('scroll', read, { passive: true })
            window.addEventListener('resize', read)
            return () => {
                window.removeEventListener('scroll', read)
                window.removeEventListener('resize', read)
            }
        }

        const N = panels.length
        panels.forEach((p) => [...p.querySelectorAll<HTMLElement>('[data-s]')].forEach((el, k) => el.style.setProperty('--n', String(k))))

        let S = 0
        let state = -1
        let prevState = -1
        let shown = -1
        let tw = { from: 0, to: 0, v0: 0, t0: 0, D: 0 }
        /** Sau go(): bỏ qua việc đọc chương từ vị trí cuộn cho tới khi cuộn xong (chương đã chọn sẵn) */
        let holdUntil = 0
        let stepLock = 0
        let lastWheel = 0
        let stream = false
        let native = false
        let touchY: number | null = null

        // Cubic Hermite từ (from, v0) tới (to, 0) trong D giây: trả [S, vận tốc theo S/giây]
        const twAt = (now: number): [number, number] => {
            const { from, to, v0, t0, D } = tw
            if (D <= 0) return [to, 0]
            const t = clamp((now - t0) / 1000 / D)
            if (t >= 1) return [to, 0]
            const t2 = t * t
            const t3 = t2 * t
            const p = (2 * t3 - 3 * t2 + 1) * from + (t3 - 2 * t2 + t) * D * v0 + (-2 * t3 + 3 * t2) * to
            const v = ((6 * t2 - 6 * t) * from + (3 * t2 - 4 * t + 1) * D * v0 + (-6 * t2 + 6 * t) * to) / D
            return [p, v]
        }
        const flightTime = (a: number, b: number) => {
            const lo = Math.min(a, b)
            const hi = Math.max(a, b)
            let d = 0
            for (let i = 0; i < SEG.length; i++) d += SEG[i] * clamp((Math.min(hi, STOP[i + 1]) - Math.max(lo, STOP[i])) / (STOP[i + 1] - STOP[i]))
            return clamp(d, FLIGHT_MIN, FLIGHT_MAX)
        }

        const setState = (i: number) => {
            if (i === state) return
            const now = performance.now()
            const first = state < 0
            prevState = state
            state = i
            const [, v] = twAt(now)
            const to = STOP[i]
            tw = { from: S, to, v0: first ? 0 : clamp(v, -V_LIMIT, V_LIMIT), t0: now, D: first ? 0 : flightTime(S, to) }
            if (first) S = to
            panels.forEach((p, k) => {
                p.classList.remove('on')
                p.classList.toggle('past', k < i)
            })
            shown = -1
            if (rootRef.current) rootRef.current.dataset.onStage = '0'
            markRail(i)
            setJourneyChapter(i)
        }
        // Hero ↔ Hôm nay (chuyến bay giữa hai chương đầu) dùng mốc 60% cho cả hai chiều
        const revealAt = () => (state === 1 || (state === 0 && prevState === 1) ? REVEAL_HERO_LEG : REVEAL[state])
        // Panel mới `on` khi chuyến bay đi được REVEAL (hoặc ngay nếu không bay / chế độ làm mờ)
        const revealIfReady = (now: number) => {
            if (shown === state || state < 0) return
            if (tw.D <= 0 || calmRef.current || (now - tw.t0) / 1000 >= tw.D * revealAt()) {
                panels[state].classList.add('on')
                shown = state
                if (rootRef.current) rootRef.current.dataset.onStage = state === 1 || state === 3 ? '1' : '0'
            }
        }

        const dist = () => Math.max(1, journeyEl.offsetHeight - pin.offsetHeight)
        const top = () => journeyEl.getBoundingClientRect().top + window.scrollY
        const chapterY = (c: number) => top() + (dist() * (c + 0.5)) / N
        const readScroll = () => {
            const p = clamp((window.scrollY - top()) / dist(), 0, 0.999)
            if (performance.now() >= holdUntil) setState(Math.floor(p * N))
            updateChrome()
        }
        const inStage = () => {
            const t = top()
            return window.scrollY >= t - 2 && window.scrollY <= t + dist() + 2
        }

        // ── Lenis: cuộn theo thời gian (mỗi nấc wheel trượt ~1,15s), không snap ──
        const lenis = new Lenis({ duration: 1.15, smoothWheel: true })
        setLenis(lenis)
        lenis.on('scroll', readScroll)

        // Cuộn tới giữa vùng của chương (rail, nav, bước một chương): chương được chọn ngay, S bay, thanh cuộn chạy theo
        const go = (c: number) => {
            const target = clamp(c, 0, N - 1)
            const now = performance.now()
            setState(target)
            stepLock = now + Math.max(MIN_LOCK_MS, tw.D * 1000 * 0.8)
            holdUntil = now + 1300
            lenis.scrollTo(chapterY(target), { duration: 1.1, force: true, easing: (t: number) => 1 - Math.pow(1 - t, 3) })
        }
        setChapterScroller(go)
        // Trả true nếu đã nhận input; hero cuộn lên và Studio cuộn xuống thì thả cho cuộn tự nhiên (xuống footer)
        const step = (dir: number) => {
            if (calmRef.current || !inStage()) return false
            const next = state + dir
            if (next < 0) return false
            if (next >= N) return window.scrollY < chapterY(N - 1) - 4 ? (go(N - 1), true) : false
            go(next)
            return true
        }

        const onWheel = (e: WheelEvent) => {
            const now = performance.now()
            if (now - lastWheel >= WHEEL_GAP_MS) {
                stream = false
                native = false
            }
            lastWheel = now
            if (calmRef.current) return
            if (!inStage()) {
                native = true // quán tính của cú vuốt từ footer lên không được bước chương
                return
            }
            if (native) return
            const dir = Math.sign(e.deltaY)
            if (!dir) return
            if (now < stepLock || stream) {
                e.preventDefault()
                e.stopPropagation()
                return
            }
            if (Math.abs(e.deltaY) < 3) return
            if (step(dir)) {
                stream = true
                e.preventDefault()
                e.stopPropagation()
            } else native = true
        }
        const onTouchStart = (e: TouchEvent) => {
            touchY = e.touches[0].clientY
        }
        const onTouchMove = (e: TouchEvent) => {
            if (calmRef.current || !inStage() || touchY == null) return
            const dir = Math.sign(touchY - e.touches[0].clientY)
            const releasing = (state === 0 && dir < 0) || (state === N - 1 && dir > 0 && window.scrollY >= chapterY(N - 1) - 4)
            if (!releasing && e.cancelable) e.preventDefault()
        }
        const onTouchEnd = (e: TouchEvent) => {
            if (touchY == null) return
            const dy = touchY - e.changedTouches[0].clientY
            touchY = null
            if (Math.abs(dy) > SWIPE_PX && performance.now() > stepLock) step(Math.sign(dy))
        }
        const onKey = (e: KeyboardEvent) => {
            const dir = ({ ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 } as Record<string, number>)[e.key]
            const el = e.target instanceof Element ? e.target : null
            if (!dir || e.metaKey || e.ctrlKey || e.altKey || el?.closest('input,textarea,select,[contenteditable="true"]')) return
            if (e.key === ' ' && el?.closest('button,a')) return
            if (performance.now() < stepLock && inStage()) return void e.preventDefault()
            if (step(dir)) e.preventDefault()
        }

        let raf = 0
        const tick = (t: number) => {
            lenis.raf(t)
            S = twAt(performance.now())[0]
            stage.current = S
            revealIfReady(performance.now())
            raf = requestAnimationFrame(tick)
        }

        window.addEventListener('wheel', onWheel, { passive: false, capture: true })
        window.addEventListener('touchstart', onTouchStart, { passive: true })
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend', onTouchEnd, { passive: true })
        window.addEventListener('keydown', onKey)
        window.addEventListener('scroll', readScroll, { passive: true })
        window.addEventListener('resize', readScroll)
        readScroll()
        raf = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('wheel', onWheel, { capture: true })
            window.removeEventListener('touchstart', onTouchStart)
            window.removeEventListener('touchmove', onTouchMove)
            window.removeEventListener('touchend', onTouchEnd)
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('scroll', readScroll)
            window.removeEventListener('resize', readScroll)
            setChapterScroller(null)
            setJourneyChapter(-1)
            setLenis(null)
            lenis.destroy()
        }
    }, [journey, barRef, rootRef, calmRef])

    return { stage, scrolled }
}
