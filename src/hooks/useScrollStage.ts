import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { setChapterScroller, setFlyingProbe, setJourneyChapter, setLenis } from '@/lib/scroll'
import { addFrame } from '@/lib/frame-loop'
import { page } from '@/lib/page-metrics'
import { benchState, FLAGS, timed } from '@/lib/perf'
import { stageSignal } from '@/lib/stage-signal'

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
/** Nghỉ ≥ chừng này giữa hai sự kiện wheel = cú vuốt mới */
const FRESH_IDLE_MS = 200
/** Chỉ để chống bấm đúp: bỏ qua input trong chừng này sau một bước chương */
const MIN_GAP_MS = 260
/** Máy quay coi là đã tới nơi khi tiến độ p vượt ngưỡng này */
const LANDED_P = 0.97
/** Tua nhanh: boost tối đa, tốc độ giảm (mũ, /giây); mỗi nấc chuột, cú vuốt touchpad mới, vuốt cảm ứng, phím cộng thêm */
const BOOST_MAX = 3
const BOOST_DECAY = 2.2
const BOOST_NOTCH = 0.45
const BOOST_FLICK = 1
const BOOST_TOUCH = 1.2
const BOOST_KEY = 0.9
/** Ở đầu/cuối: chỉ nuốt quán tính của cú vuốt vừa đưa tới (tối đa chừng này từ lúc tới nơi) rồi thả cuộn tự nhiên */
const END_MOMENTUM_MS = 1200
/** Chuột: mỗi chương được nằm yên chừng này trước khi lăn đều tay bước tiếp */
const WHEEL_DWELL_MS = 450
/** Bước trước chưa quá chừng này thì bước kế tính từ chương đang hướng tới; quá thì phải yên vị ở chương hiện tại trước */
const SETTLE_AFTER_MS = 1000
/** Đang bay mà có bước mới: bay nhanh hơn; đi lùi: bay nhanh hơn nữa và chữ hiện sớm hơn */
const CHAIN = 0.6
const BACK = 0.7
const REVEAL_BACK = 0.5
const FLIGHT_FLOOR = 0.35
/** Dòng hướng dẫn góc dưới trái theo chương hiện tại */
const GUIDE = ['Cuộn để đi vào trường', 'Hôm nay · 1/3 — cuộn tiếp: Khóa học', 'Khóa học · 2/3 — cuộn tiếp: Studio', 'Studio · 3/3 — cuộn tiếp: cuối trang'] as const
const GUIDE_FLYING = 'Cuộn thêm để chạy nhanh hơn'
/** Lớp che khi cắt cảnh mờ đi trong chừng này (giây) */
const CUT_FADE_S = 0.5
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
    /** Phần tử gốc của trang chủ: hook đánh dấu mục thanh chương đang chọn, tìm lớp che cắt cảnh và dòng hướng dẫn. */
    rootRef: RefObject<HTMLElement | null>
    /** Chế độ "Làm mờ cảnh 3D": không khóa cuộn, chữ hiện ngay */
    calmRef: MutableRefObject<boolean>
}

/**
 * Cuộn theo trạng thái (như marketingbigday2026): một section cao có khung sticky 100svh, bốn panel chồng nhau.
 * Vị trí cuộn chỉ chọn CHƯƠNG hiện tại; máy quay (S) bay theo thời gian bằng cubic Hermite từ (S, vận tốc hiện tại) tới điểm dừng của chương,
 * và chữ hiện (class `on`) khi chuyến bay đi được 72%. Mỗi cú vuốt bước đúng một chương; chỉ chặn input cùng luồng quán tính và trong MIN_GAP sau một bước (không khóa theo thời lượng bay).
 * Đang bay mà có bước mới: thời lượng ×CHAIN; đi lùi ×BACK. Nhảy từ 2 chương trở lên (rail, Home/End, kéo thanh cuộn) = cắt cảnh: S tới thẳng điểm dừng, lớp màu nền mờ đi.
 * Mọi thứ ghi thẳng vào DOM/ref; chỉ `scrolled` là state và đổi rất ít. Giảm chuyển động: không khóa, S nhảy thẳng tới chương đang đọc.
 */
export function useScrollStage({ journey, barRef, rootRef, calmRef }: Options) {
    const stage = useRef(0)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        let lastScrolled: boolean | null = null
        let barScale = 0
        let barLast = -1
        const flushBar = () => {
            if (!barRef?.current || Math.abs(barScale - barLast) < 0.0005) return
            barLast = barScale
            barRef.current.style.transform = `scaleX(${barScale.toFixed(4)})`
        }
        const updateChrome = () => {
            // Không đọc layout: scrollY từ sự kiện, scrollHeight đo sẵn ở page-metrics; thanh tiến độ ghi tối đa một lần mỗi khung (transform scaleX)
            const y = window.scrollY
            page.y = y
            barScale = page.max > 0 ? clamp(y / page.max) : 0
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
                flushBar()
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
        // Tiến độ p chạy 0→1 theo thời gian × (1 + boost); Hermite, vận tốc khi đổi hướng đều tính từ p
        let tw = { from: 0, to: 0, v0: 0, p: 1, D: 0 }
        let boost = 0
        /** Sau go(): bỏ qua việc đọc chương từ vị trí cuộn cho tới khi cuộn xong (chương đã chọn sẵn) */
        let holdUntil = 0
        let lastStepAt = -1e9
        let landedAt = 0
        let backFlight = false
        /** Đã cuộn vào vùng ghim từ footer (quán tính còn chạy): dừng ở Studio trước */
        let fromFooter = false
        let lastWheel = 0
        let lastAbs = 0
        let lastDir = 0
        let rises = 0
        let sawDecay = false
        let low = Infinity
        let touchY: number | null = null

        const flying = () => tw.D > 0 && tw.p < LANDED_P
        setFlyingProbe(flying)
        const flightDir = () => Math.sign(tw.to - tw.from)
        // Cubic Hermite từ (from, v0) tới (to, 0) theo tiến độ p: trả [S, vận tốc theo S/giây]
        const twAt = (): [number, number] => {
            const { from, to, v0, D } = tw
            if (D <= 0) return [to, 0]
            const t = clamp(tw.p)
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

        const veil = rootRef.current?.querySelector<HTMLElement>('[data-cut-veil]')
        // Che bằng màu nền rồi mờ đi (ease-out); chữ chương mới đã hiện ngay bên trên
        const flashCut = () => {
            if (!veil) return
            veil.style.transition = 'none'
            veil.style.opacity = '1'
            void veil.offsetWidth
            veil.style.transition = `opacity ${CUT_FADE_S}s cubic-bezier(0.2, 0.7, 0.2, 1)`
            veil.style.willChange = 'opacity' // chỉ trong lúc mờ đi
            veil.style.opacity = '0'
            window.setTimeout(() => (veil.style.willChange = ''), CUT_FADE_S * 1000 + 100)
        }

        // Dòng hướng dẫn cho người mới (góc dưới trái): chỉ ghi DOM khi đổi
        const guideEl = rootRef.current?.querySelector<HTMLElement>('[data-guide]')
        const guideText = guideEl?.querySelector<HTMLElement>('[data-guide-text]')
        const narrowMq = window.matchMedia(STATIC_QUERY)
        const guide = () => {
            if (!guideEl || !guideText) return
            const text = flying() ? GUIDE_FLYING : GUIDE[Math.max(0, state)]
            if (guideText.textContent !== text) guideText.textContent = text
            // Màn hẹp chật chỗ: chỉ hiện ở hero để không đè chữ panel
            const show = inStage() && (!narrowMq.matches || (state <= 0 && !flying()))
            const op = show ? '1' : '0'
            if (guideEl.style.opacity !== op) guideEl.style.opacity = op
        }

        const setState = (i: number, cut = false) => {
            if (i === state) return
            const now = performance.now()
            const first = state < 0
            const midFlight = tw.D > 0 && tw.p < 1
            prevState = state
            state = i
            const [, v] = twAt()
            const to = STOP[i]
            backFlight = !first && to < S
            const still = first || cut
            let D = still ? 0 : flightTime(S, to) * (midFlight ? CHAIN : 1) * (backFlight ? BACK : 1)
            if (D > 0) D = Math.max(D, FLIGHT_FLOOR)
            tw = { from: S, to, v0: still ? 0 : clamp(v, -V_LIMIT, V_LIMIT), p: D > 0 ? 0 : 1, D }
            boost = 0
            if (D <= 0) landedAt = now
            if (still) S = to
            if (cut && !first) flashCut()
            panels.forEach((p, k) => {
                p.classList.remove('on')
                p.classList.toggle('past', k < i)
            })
            shown = -1
            stageSignal.onStage = 0
            markRail(i)
            setJourneyChapter(i)
            guide()
        }
        // Hero ↔ Hôm nay (chuyến bay giữa hai chương đầu) dùng mốc 60% cho cả hai chiều; đi lùi 50%
        const revealAt = () => (backFlight ? REVEAL_BACK : state === 1 || (state === 0 && prevState === 1) ? REVEAL_HERO_LEG : REVEAL[state])
        // Panel mới `on` khi tiến độ bay đạt REVEAL (hoặc ngay nếu không bay / chế độ làm mờ)
        const revealIfReady = () => {
            if (shown === state || state < 0) return
            if (tw.D <= 0 || calmRef.current || tw.p >= revealAt()) {
                panels[state].classList.add('on')
                shown = state
                stageSignal.onStage = state === 1 || state === 3 ? 1 : 0
            }
        }

        // Số đo layout tính sẵn (page-metrics: khi mount và khi resize), không đọc layout lúc cuộn
        const dist = () => page.dist
        const top = () => page.journeyTop
        const chapterY = (c: number) => top() + (dist() * (c + 0.5)) / N
        const readScroll = timed(() => {
            const p = clamp((window.scrollY - top()) / dist(), 0, 0.999)
            const now = performance.now()
            // Lenis còn đang trượt tới chương đã chọn (khung hình chậm): chưa đọc lại chương từ vị trí cuộn dở dang
            const gliding = now < holdUntil + 1500 && lenis.isScrolling === 'smooth'
            if (now >= holdUntil && !gliding) {
                const i = Math.floor(p * N)
                // Kéo thanh cuộn / Home / End nhảy từ 2 chương: cắt cảnh
                setState(i, state >= 0 && Math.abs(i - state) >= 2)
            }
            updateChrome()
            guide()
        })
        const inStage = () => {
            const t = top()
            return window.scrollY >= t - 2 && window.scrollY <= t + dist() + 2
        }

        // ── Lenis: cuộn theo thời gian (mỗi nấc wheel trượt ~1,15s), không snap ──
        const lenis = new Lenis({ duration: 1.15, smoothWheel: !FLAGS.noLenis })
        setLenis(lenis)
        lenis.on('scroll', readScroll)

        // Cuộn tới giữa vùng của chương (rail, nav, bước một chương): chương được chọn ngay, S bay, thanh cuộn chạy theo.
        // Nhảy từ 2 chương trở lên thì cắt cảnh: S tới thẳng, cuộn tức thì.
        const go = (c: number, cut = Math.abs(clamp(c, 0, N - 1) - state) >= 2) => {
            const target = clamp(c, 0, N - 1)
            const now = performance.now()
            if (target === state) landedAt = now
            setState(target, cut)
            lastStepAt = now
            holdUntil = now + (cut ? 300 : 1300)
            if (cut) lenis.scrollTo(chapterY(target), { immediate: true, force: true })
            else lenis.scrollTo(chapterY(target), { duration: 0.9, force: true, easing: (t: number) => 1 - Math.pow(1 - t, 3) })
        }
        setChapterScroller(go)
        // Đã yên vị ở chương hiện tại chưa (hero: ở đầu trang là yên vị)
        const settled = () => {
            const tol = window.innerHeight * 0.03
            const y = chapterY(state)
            return state === 0 ? window.scrollY <= y + tol : Math.abs(window.scrollY - y) <= tol
        }
        // Trả true nếu đã nhận input; hero cuộn lên và Studio cuộn xuống thì thả cho cuộn tự nhiên (xuống footer)
        const step = (dir: number) => {
            if (calmRef.current || !inStage()) return false
            const now = performance.now()
            // Bước trước đã xong mà chưa nằm đúng chương hiện tại (vào từ footer, kéo thanh cuộn): về đúng chương đó trước
            if (now - lastStepAt > SETTLE_AFTER_MS && !settled()) {
                if (state === N - 1 && dir > 0 && window.scrollY >= chapterY(N - 1)) return false
                if (state === 0 && dir < 0) return false
                go(state)
                return true
            }
            // Bước kế tính từ chương đang hướng tới (`state` là chương đích)
            const next = state + dir
            if (next < 0) return false
            if (next >= N) return window.scrollY < chapterY(N - 1) - 4 ? (go(N - 1), true) : false
            go(next)
            return true
        }
        const addBoost = (v: number) => {
            boost = Math.min(BOOST_MAX, boost + v)
        }

        const onWheel = (e: WheelEvent) => {
            if (benchState.active) {
                e.preventDefault()
                e.stopPropagation()
                return
            }
            const now = performance.now()
            const idle = now - lastWheel
            lastWheel = now
            if (calmRef.current) return
            if (!inStage()) {
                // Quán tính của cú vuốt từ footer lên: nhớ để dừng ở Studio khi vào vùng ghim
                fromFooter = window.scrollY > top()
                return
            }
            if (idle >= FRESH_IDLE_MS) fromFooter = false
            const dir = Math.sign(e.deltaY)
            if (!dir) return
            const ad = Math.abs(e.deltaY)
            // Chuột = nấc rời (wheelDeltaY chia hết cho 120, hoặc deltaMode dòng); còn lại là touchpad
            const wd = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY
            const isWheel = e.deltaMode === 1 || (wd !== undefined && wd !== 0 && wd % 120 === 0)
            // Cú vuốt touchpad mới: nghỉ ≥200ms, đổi chiều thật, hoặc delta tăng 3 lần liền sau khi đã giảm (đặt tay xuống lại)
            if (idle >= FRESH_IDLE_MS || dir !== lastDir) {
                rises = 0
                sawDecay = false
                low = Infinity
            }
            if (ad < lastAbs) sawDecay = true
            if (sawDecay) low = Math.min(low, ad)
            rises = ad > lastAbs + 1 ? rises + 1 : 0
            const fresh = idle >= FRESH_IDLE_MS || (dir !== lastDir && ad > 4) || (sawDecay && rises >= 3 && ad > 18 && ad > low * 1.6 + 6)
            if (fresh && idle < FRESH_IDLE_MS && dir === lastDir) {
                sawDecay = false
                rises = 0
                low = Infinity
            }
            const decaying = !fresh && (ad < lastAbs * 0.985 || ad <= 6)
            lastAbs = ad
            lastDir = dir
            const block = () => {
                e.preventDefault()
                e.stopPropagation()
            }

            if (flying()) {
                block()
                if (dir === flightDir()) {
                    // Tua nhanh chính chuyến bay này: mỗi nấc chuột; touchpad chỉ khi là cú vuốt mới (không tính quán tính của cú đầu)
                    if (isWheel) addBoost(Math.min(ad / 120, 1) * BOOST_NOTCH)
                    else if (fresh) addBoost(BOOST_FLICK)
                } else if (fresh && now - lastStepAt > MIN_GAP_MS) step(dir) // cú vuốt mới ngược chiều: bước về chương trước
                return
            }
            // Quán tính từ footer đã vào vùng ghim: dừng ở Studio trước khi cho lùi tiếp
            if (fromFooter && dir < 0 && state === N - 1 && now - lastStepAt > MIN_GAP_MS) {
                fromFooter = false
                go(N - 1)
                block()
                return
            }
            if (now - lastStepAt < MIN_GAP_MS) return block()
            const dwell = now - landedAt
            // Ở hai đầu (hero cuộn lên, Studio cuộn xuống) thả cuộn tự nhiên, trừ quán tính của cú vuốt vừa đưa tới
            const atEnd = (state === 0 && dir < 0) || (state === N - 1 && dir > 0)
            if (atEnd) {
                if (decaying && dwell < END_MOMENTUM_MS) block()
                return
            }
            if (isWheel) {
                // Lăn đều tay thì đi tiếp từng chương, mỗi chương được ~0.45s trên màn hình
                if (!fresh && dwell < WHEEL_DWELL_MS) return block()
            } else if (!fresh) return block() // touchpad: chỉ cú vuốt mới đi tiếp, quán tính còn lại bị nuốt
            if (ad < 2) return
            if (step(dir)) block()
        }
        const onTouchStart = (e: TouchEvent) => {
            touchY = e.touches[0].clientY
        }
        const onTouchMove = (e: TouchEvent) => {
            if (benchState.active) {
                if (e.cancelable) e.preventDefault()
                return
            }
            if (calmRef.current || !inStage() || touchY == null) return
            const dir = Math.sign(touchY - e.touches[0].clientY)
            const releasing = (state === 0 && dir < 0) || (state === N - 1 && dir > 0 && window.scrollY >= chapterY(N - 1) - 4)
            if (!releasing && e.cancelable) e.preventDefault()
        }
        const onTouchEnd = (e: TouchEvent) => {
            if (touchY == null) return
            const dy = touchY - e.changedTouches[0].clientY
            touchY = null
            if (benchState.active || Math.abs(dy) <= SWIPE_PX || calmRef.current || !inStage()) return
            const d = Math.sign(dy)
            if (flying() && d === flightDir()) return addBoost(BOOST_TOUCH)
            if (performance.now() - lastStepAt > MIN_GAP_MS) step(d)
        }
        const onKey = (e: KeyboardEvent) => {
            const dir = ({ ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 } as Record<string, number>)[e.key]
            const el = e.target instanceof Element ? e.target : null
            if (!dir || e.metaKey || e.ctrlKey || e.altKey || el?.closest('input,textarea,select,[contenteditable="true"]')) return
            if (e.key === ' ' && el?.closest('button,a')) return
            if (benchState.active) return void e.preventDefault()
            if (calmRef.current || !inStage()) return
            if (flying() && dir === flightDir()) {
                e.preventDefault()
                addBoost(BOOST_KEY)
                return
            }
            if (performance.now() - lastStepAt < MIN_GAP_MS) return void e.preventDefault()
            if (step(dir)) e.preventDefault()
        }

        let lastT = performance.now()
        let guideAt = 0
        // Chạy trong vòng rAF chung (lib/frame-loop), trước khung vẽ của canvas
        const tick = (t: number) => {
            lenis.raf(t)
            const now = performance.now()
            const dt = Math.min((now - lastT) / 1000, 0.2)
            lastT = now
            if (tw.D > 0 && tw.p < 1) {
                const was = tw.p
                tw.p = Math.min(1, tw.p + (dt / tw.D) * (1 + boost))
                if (was < LANDED_P && tw.p >= LANDED_P) landedAt = now
            }
            boost *= Math.exp(-dt * BOOST_DECAY) // sức đẩy mờ dần khi ngừng cuộn
            S = twAt()[0]
            stage.current = S
            revealIfReady()
            if (now - guideAt > 250) {
                guideAt = now
                guide()
            }
            flushBar()
        }

        window.addEventListener('wheel', onWheel, { passive: false, capture: true })
        window.addEventListener('touchstart', onTouchStart, { passive: true })
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend', onTouchEnd, { passive: true })
        window.addEventListener('keydown', onKey)
        // Lenis đã phát 'scroll' cho mọi cuộn (kể cả kéo thanh cuộn); resize thì đọc lại số đo
        window.addEventListener('resize', readScroll)
        readScroll()
        const stopFrame = addFrame(tick, 0)
        return () => {
            stopFrame()
            window.removeEventListener('wheel', onWheel, { capture: true })
            window.removeEventListener('touchstart', onTouchStart)
            window.removeEventListener('touchmove', onTouchMove)
            window.removeEventListener('touchend', onTouchEnd)
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('resize', readScroll)
            setChapterScroller(null)
            setFlyingProbe(null)
            setJourneyChapter(-1)
            setLenis(null)
            lenis.destroy()
        }
    }, [journey, barRef, rootRef, calmRef])

    return { stage, scrolled }
}
