import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Award, ArrowRight, Camera, CalendarCheck, CircleCheck, ClipboardCheck, Flame, Map as MapIcon, Play, RotateCcw, Sparkles, TrendingUp } from 'lucide-react'
import { lessons } from '@/data'
import { useDailyLit } from '@/hooks/useDailyLit'
import { useTowerScroll } from '@/hooks/useTowerScroll'
import { FLAGS, mountPerfHud } from '@/lib/perf'
import { introMark } from '@/lib/role-intro'
import { CAMPUS_STILL_URL } from '@/lib/campus-still'
import { useOrbitStore } from '@/store/useOrbitStore'
import './home/tower.css'

// Phần 3D tải riêng (three.js + R3F nặng), chỉ kéo về khi trang chủ được dựng.
const TowerScene = lazy(() => import('./home/tower-scene'))

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
const CALM_KEY = 'orbit-calm'

/** Máy yếu hoặc không có WebGL thì dùng ảnh tĩnh thay cho cảnh 3D. */
function canRender3D() {
    try {
        const nav = navigator as Navigator & { deviceMemory?: number }
        if ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2) return false
        const cv = document.createElement('canvas')
        return Boolean(cv.getContext('webgl2') || cv.getContext('webgl'))
    } catch {
        return false
    }
}

function useReduce() {
    const [reduce, setReduce] = useState(() => window.matchMedia(REDUCE_QUERY).matches)
    useEffect(() => {
        const mq = window.matchMedia(REDUCE_QUERY)
        const on = () => setReduce(mq.matches)
        mq.addEventListener('change', on)
        return () => mq.removeEventListener('change', on)
    }, [])
    return reduce
}

/** Chế độ "Ẩn mô hình 3D" cho máy yếu, nhớ trong localStorage (bọc try/catch). */
function useCalm() {
    const [calm, set] = useState(() => {
        try {
            return localStorage.getItem(CALM_KEY) === '1'
        } catch {
            return false
        }
    })
    const setCalm = (v: boolean) => {
        set(v)
        try {
            localStorage.setItem(CALM_KEY, v ? '1' : '0')
        } catch {
            /* không lưu được thì thôi */
        }
    }
    return [calm, setCalm] as const
}

interface Item {
    icon: ReactNode
    text: string
}
interface PageDef {
    word: string
    /** 'solid' = PTIT (gradient dọc đỏ đặc, sau mô hình); còn lại là vị trí chữ khổng lồ */
    pos: 'solid' | 'tr' | 'bl' | 'tl' | 'tc'
    /** Màu đỏ đặc (không gradient) cho chữ nằm trước canvas, tránh lẫn với mô hình phía sau */
    flat?: boolean
    color: string
    ix: string
    title: ReactNode
    items: Item[]
    cta: string
    to: string
}
const ic = 15
const PAGES: PageDef[] = [
    {
        word: 'PTIT',
        pos: 'solid',
        color: '',
        ix: 'Học viện PTIT',
        title: (
            <>
                Học bài giảng của thầy cô, cùng <em>trợ giảng AI</em>.
            </>
        ),
        items: [],
        cta: 'Học tiếp',
        to: '/learning',
    },
    {
        word: 'HỌC PHẦN',
        pos: 'tr',
        color: '#E2261C',
        ix: 'Học phần',
        title: (
            <>
                Học theo <em>bài giảng thật</em>.
            </>
        ),
        items: [
            { icon: <Play size={ic} />, text: 'Video tự dừng để hỏi bạn' },
            { icon: <Sparkles size={ic} />, text: 'Trợ giảng AI trả lời kèm mốc video' },
            { icon: <CircleCheck size={ic} />, text: 'Kiểm tra nhanh sau mỗi bài' },
            { icon: <ClipboardCheck size={ic} />, text: 'Kiểm tra cuối khóa' },
        ],
        cta: 'Vào Học phần',
        to: '/learning',
    },
    {
        word: 'ÔN TẬP',
        pos: 'bl',
        flat: true,
        color: '#E8382B',
        ix: 'Ôn tập',
        title: (
            <>
                Ôn đúng <em>chỗ bạn hổng</em>.
            </>
        ),
        items: [
            { icon: <Sparkles size={ic} />, text: 'AI biến câu sai thành bài đọc ngắn' },
            { icon: <CalendarCheck size={ic} />, text: 'Mỗi ngày mở 3 bài, thêm bài bằng XP' },
            { icon: <CircleCheck size={ic} />, text: 'Đọc xong trả lời đúng mới tính' },
        ],
        cta: 'Mở Ôn tập',
        to: '/today',
    },
    {
        word: 'STUDIO 3D',
        pos: 'tl',
        color: '#FF6A55',
        ix: 'Studio 3D',
        title: (
            <>
                Thực hành <em>nhiếp ảnh</em> trong 3D.
            </>
        ),
        items: [
            { icon: <Sparkles size={ic} />, text: 'Gõ một câu, AI dựng đèn' },
            { icon: <Camera size={ic} />, text: 'Chụp ảnh, AI chấm điểm và khoanh lỗi' },
            { icon: <RotateCcw size={ic} />, text: 'Bấm “Thử” để áp gợi ý sửa ngay' },
        ],
        cta: 'Vào Studio',
        to: '/studio',
    },
    {
        word: 'TIẾN ĐỘ',
        pos: 'tc',
        color: '#D41F16',
        ix: 'Tiến độ & Kỹ năng',
        title: (
            <>
                Thấy rõ <em>mình đã vững gì</em>.
            </>
        ),
        items: [
            { icon: <MapIcon size={ic} />, text: 'Bản đồ kỹ năng' },
            { icon: <TrendingUp size={ic} />, text: 'Lên cấp' },
            { icon: <Flame size={ic} />, text: 'Chuỗi ngày học' },
            { icon: <Award size={ic} />, text: 'Huy hiệu' },
        ],
        cta: 'Xem tiến độ',
        to: '/journey',
    },
]

/**
 * Trang chủ sinh viên: 5 trang (PTIT · Học phần · Ôn tập · Studio 3D · Tiến độ) trên một stage cố định 100vh.
 * Cuộn tài liệu bắt dính từng trang, camera trong cảnh khuôn viên bay theo tiến độ cuộn (xem tower-scene.tsx, useTowerScroll).
 * Máy yếu / không WebGL / bật "Ẩn mô hình 3D": ảnh tĩnh khuôn viên, chữ và thẻ giữ nguyên bố cục.
 */
export function OrbitHomeView() {
    const reduce = useReduce()
    const rootRef = useRef<HTMLDivElement>(null)
    const veilRef = useRef<HTMLDivElement>(null)
    const [calm, setCalm] = useCalm()
    const [enabled] = useState(canRender3D)
    const use3D = enabled && !calm && !FLAGS.no3d
    const dailyLit = useDailyLit(reduce)
    const resume = useResumeTarget()

    useTowerScroll(rootRef, veilRef, reduce)
    useFitWords(rootRef)
    useEffect(() => mountPerfHud(), [])

    // Báo trang đã sẵn sàng cho màn intro. Có 3D thì Tower3D báo SAU khung 3D đầu tiên (camera trang 01) để lỗ thủng mở ra đã thấy mô hình đúng chỗ;
    // không 3D (máy yếu, tắt mô hình) thì báo ngay khi chữ và thẻ đã vẽ.
    useEffect(() => {
        if (use3D) return
        const id = requestAnimationFrame(() => requestAnimationFrame(() => notifyPageReady()))
        return () => cancelAnimationFrame(id)
    }, [use3D])

    return (
        <div ref={rootRef} data-page="0" className="tower-root text-foreground">
            <div className="tower-track" aria-hidden>
                {PAGES.map((_, i) => (
                    <span key={i} className="tower-snap" style={{ top: `${i * 100}vh` }} />
                ))}
            </div>
            <div className="tower-stage">
                <div className="tower-sky" aria-hidden />
                <div className="tower-sky-dusk" aria-hidden />
                {PAGES.map((p, i) => (
                    <div
                        key={p.word}
                        data-i={i}
                        data-fit=""
                        aria-hidden
                        className={`tower-word ${p.pos === 'solid' ? 'is-solid' : `${p.flat ? 'is-flat' : 'is-grad'} p-${p.pos}`}`}
                        style={p.color ? ({ '--wc': p.color } as React.CSSProperties) : undefined}
                    >
                        <span className="tower-word-ink">{p.word}</span>
                    </div>
                ))}
                {use3D ? <Tower3D reduce={reduce} dailyLit={dailyLit} /> : <StillCampus />}
                {/* Mây khói trắng sau chữ ÔN TẬP (trang 03): nằm trên canvas (z 3), dưới chữ (z 4) */}
                <div className="tower-smoke-layer" aria-hidden>
                    {Array.from({ length: 6 }, (_, i) => (
                        <i key={i} className={`tower-puff pf-${i}`} />
                    ))}
                </div>
                <div ref={veilRef} className="tower-veil" aria-hidden />
                {PAGES.map((p, i) => (
                    <section key={p.word} data-i={i} aria-label={p.ix} className={`tower-card c-${i}`}>
                        {i === 0 ? (
                            <>
                                <div>
                                    <div className="ix">{p.ix}</div>
                                    <h1 className="m-0 mt-[6px] text-[24px] font-black leading-[1.2] tracking-[-0.02em] text-[color:var(--t-navy)] [&_em]:not-italic [&_em]:text-[color:var(--t-red-ink)]">{p.title}</h1>
                                </div>
                                <Link to={resume} className="tower-cta">
                                    <b>{p.cta}</b>
                                    <span>
                                        <ArrowRight size={18} />
                                    </span>
                                </Link>
                            </>
                        ) : (
                            <>
                                <div className="ix">{p.ix}</div>
                                <h2>{p.title}</h2>
                                <ul>
                                    {p.items.map((it) => (
                                        <li key={it.text}>
                                            <i aria-hidden>{it.icon}</i>
                                            {it.text}
                                        </li>
                                    ))}
                                </ul>
                                <Link to={p.to} className="tower-cta">
                                    <b>{p.cta}</b>
                                    <span>
                                        <ArrowRight size={18} />
                                    </span>
                                </Link>
                            </>
                        )}
                    </section>
                ))}
                {enabled && (
                    <button type="button" aria-pressed={calm} onClick={() => setCalm(!calm)} className="tower-calm">
                        {calm ? 'Hiện mô hình 3D' : 'Ẩn mô hình 3D'}
                    </button>
                )}
            </div>
        </div>
    )
}

/** Bài đang dở (sinh viên chỉ thấy bài đã xuất bản) → đường dẫn nút "Học tiếp"; chưa có bài thì về trang Học phần. */
function useResumeTarget() {
    const progress = useOrbitStore((s) => s.lessonProgress)
    const visible = lessons
    const inProgress = visible.find((l) => progress[l.id] && !progress[l.id].completed && progress[l.id].lastPositionSec > 0)
    const resume = inProgress ?? visible.find((l) => !progress[l.id]?.completed) ?? visible[0]
    return resume ? `/lesson/${resume.id}` : '/learning'
}

/** Ảnh tĩnh khuôn viên (fallback máy yếu / không WebGL). */
function StillCampus() {
    return (
        <div className="tower-still" aria-hidden>
            <img src={CAMPUS_STILL_URL} alt="" draggable={false} />
        </div>
    )
}

/** Chỉ báo một lần cho mỗi lần mở trang */
let readyAnnounced = false
const notifyPageReady = () => {
    if (readyAnnounced) return
    readyAnnounced = true
    window.dispatchEvent(new Event('orbit:page-ready'))
}

/**
 * Canvas 3D: dựng ngay (kể cả lúc intro chạy: khung đầu được vẽ thẳng bằng camera trang 01, xem Driver trong tower-scene) và ẩn hoàn toàn
 * (opacity 0) cho tới khi R3F vẽ xong khung đầu; lúc đó mới mờ dần vào 400ms và báo intro "page-ready". Không dùng ảnh tĩnh cũ
 * (chụp từ khung hero khuôn viên cũ nên mô hình nhỏ, sai bố cục trang 01).
 */
function Tower3D({ reduce, dailyLit }: { reduce: boolean; dailyLit: ReturnType<typeof useDailyLit> }) {
    const [ready, setReady] = useState(false)
    useEffect(() => {
        readyAnnounced = false
    }, [])
    // Chốt chặn: cảnh không báo khung đầu trong 2,5s thì vẫn hiện canvas và báo intro
    useEffect(() => {
        const t = window.setTimeout(() => {
            setReady(true)
            notifyPageReady()
        }, 2500)
        return () => clearTimeout(t)
    }, [])
    const onReady = useCallback(() => {
        introMark('khung 3D đầu tiên')
        setReady(true)
        requestAnimationFrame(() => requestAnimationFrame(notifyPageReady))
    }, [])
    return (
        <div className="tower-gl" style={{ opacity: ready ? 1 : 0 }}>
            <Suspense fallback={null}>
                <TowerScene reduce={reduce} dailyLit={dailyLit} onReady={onReady} />
            </Suspense>
        </div>
    )
}

/**
 * Chữ khổng lồ tự co theo hộp chứa (đo span inline-block ở cỡ 100px) để không bao giờ bị cắt; tối đa 24% chiều cao màn.
 * Đo một lần khi mount, khi resize và khi font tải xong; không đo trong vòng cuộn hay vẽ.
 */
function useFitWords(rootRef: React.RefObject<HTMLElement | null>) {
    useLayoutEffect(() => {
        const root = rootRef.current
        if (!root) return
        const fit = () => {
            root.querySelectorAll<HTMLElement>('.tower-word[data-fit]').forEach((el) => {
                const span = el.firstElementChild as HTMLElement | null
                if (!span) return
                el.style.fontSize = '100px'
                const box = el.clientWidth
                const w = span.offsetWidth
                if (!w || !box) return
                // PTIT (chữ lớn đầu trang, giãn chữ) co theo bề rộng màn nhưng chừa lề; các chữ còn lại co theo hộp và tối đa 24% chiều cao màn
                const solid = el.classList.contains('is-solid')
                const cap = solid ? Math.min(window.innerWidth * 0.34, window.innerHeight * 0.52) : window.innerHeight * 0.24
                const fs = Math.min((100 * box) / w * (solid ? 0.9 : 0.97), cap)
                el.style.fontSize = `${fs}px`
                // Chiều cao khối chữ ÔN TẬP (gồm padding) để lớp mây khói phủ đúng quanh chữ
                if (el.dataset.i === '2') root.style.setProperty('--word-h', `${span.offsetHeight}px`)
            })
        }
        fit()
        window.addEventListener('resize', fit)
        void document.fonts?.ready.then(fit)
        return () => window.removeEventListener('resize', fit)
    }, [rootRef])
}
