import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clock, STRONG_MASTERY, subjectVars, type CourseSummary } from '@/lib/course-map'
import { useOrbitStore } from '@/store/useOrbitStore'
import './course-map.css'

const RING_LEN = 263.9 // 2π · 42
const calm = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Thumbnail YouTube: thử độ phân giải cao nhất trước; maxres không có thì YouTube trả ảnh xám 120×90, khi đó lùi về sd rồi hq.
const THUMB_STEPS = ['maxresdefault', 'sddefault', 'hqdefault'] as const

/** Ảnh thumbnail bài giảng (lazy, fade-in 250ms); trong lúc chờ hoặc khi lỗi hết thì lộ nền gradient của khung cha. */
export function Thumb({ youtubeId, className = '' }: { youtubeId: string; className?: string }) {
    return <ThumbImg key={youtubeId} youtubeId={youtubeId} className={className} />
}

function ThumbImg({ youtubeId, className }: { youtubeId: string; className: string }) {
    const [step, setStep] = useState(0)
    const [loaded, setLoaded] = useState(false)
    const [failed, setFailed] = useState(false)
    const next = () => (step < THUMB_STEPS.length - 1 ? setStep(step + 1) : setFailed(true))
    if (failed) return null
    return (
        <img
            key={step}
            src={`https://i.ytimg.com/vi/${youtubeId}/${THUMB_STEPS[step]}.jpg`}
            alt=""
            loading="lazy"
            onLoad={(e) => (e.currentTarget.naturalWidth <= 120 && step < THUMB_STEPS.length - 1 ? next() : setLoaded(true))}
            onError={next}
            // hqdefault/sddefault có viền đen trên dưới: phóng nhẹ để cắt; maxres là 16:9 nguyên bản
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[250ms] ${step > 0 ? 'cm-img' : ''} ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        />
    )
}

/** Gradient dự phòng: màu nhấn môn pha với nền tối cố định. */
export const FALLBACK_BG = 'linear-gradient(135deg, hsl(var(--subject) / 0.55), hsl(var(--ink)))'

/** Khối nổi bật: tên khóa + vòng % và bản đồ chặng ngang (dọc trên mobile), mỗi bài một trạm, cuối là test. */
export function FeaturedCourse({ summary }: { summary: CourseSummary }) {
    const { course, lessons, status, pct, pcts, curIndex, fill, minutes, conceptCount, strongCount, doneCount, record } = summary
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const [shown, setShown] = useState(calm)
    const stationsRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const rootRef = useRef<HTMLElement>(null)

    // Vào màn: vòng % chạy, đường đỏ vẽ, trạm hiện lần lượt (reduced-motion: hiện thẳng trạng thái cuối)
    // (đợi khối vào khung nhìn: ở trang chủ nó nằm dưới màn hình đầu)
    useEffect(() => {
        const el = rootRef.current
        if (shown || !el) return
        let id = 0
        const go = () => {
            id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
        }
        if (!('IntersectionObserver' in window)) {
            go()
            return () => cancelAnimationFrame(id)
        }
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                io.disconnect()
                go()
            }
        }, { threshold: 0.15 })
        io.observe(el)
        return () => {
            io.disconnect()
            cancelAnimationFrame(id)
        }
    }, [shown])

    // Đặt đường nối theo offset thật của chấm đầu và chấm cuối
    useLayoutEffect(() => {
        const host = stationsRef.current
        const track = trackRef.current
        if (!host || !track) return
        const place = () => {
            const dots = host.querySelectorAll<HTMLElement>('[data-dot]')
            if (dots.length < 2) return
            const base = host.getBoundingClientRect()
            const center = (el: HTMLElement) => {
                const r = el.getBoundingClientRect()
                return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 }
            }
            const a = center(dots[0])
            const z = center(dots[dots.length - 1])
            const vertical = window.matchMedia('(max-width: 759px)').matches
            Object.assign(track.style, vertical ? { left: `${a.x - 2}px`, top: `${a.y}px`, width: '4px', height: `${z.y - a.y}px` } : { left: `${a.x}px`, top: `${a.y - 2}px`, width: `${z.x - a.x}px`, height: '4px' })
        }
        place()
        const ro = new ResizeObserver(place)
        ro.observe(host)
        window.addEventListener('resize', place)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', place)
        }
    }, [lessons.length])

    const tag = status === 'doing' ? 'Đang học' : status === 'done' ? 'Đã xong' : 'Khóa đang xem'
    return (
        <article ref={rootRef} aria-labelledby={`course-title-${course.id}`} data-in={shown} style={{ ...subjectVars(course.subject, course.cover?.accent), ['--fill' as string]: fill }} className="cm-featured overflow-hidden rounded-[28px] border border-border bg-card shadow-card">
            <div className="grid items-center gap-6 px-5 pb-2 pt-6 min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:px-8 min-[760px]:pt-7">
                <div>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-ink">
                            <span aria-hidden className="h-2 w-2 rounded-full bg-brand-600 shadow-[0_0_0_4px_rgb(var(--brand-600)/0.2)]" />
                            {tag}
                        </span>
                        <span className="cm-chip inline-block rounded-full px-2.5 py-1 text-xs font-extrabold">{course.subject}</span>
                    </p>
                    <h2 id={`course-title-${course.id}`} className="mb-1.5 mt-2.5 text-[clamp(1.6rem,3.4vw,2.4rem)] font-black leading-[1.08] tracking-[-0.03em] text-foreground">
                        {course.title}
                    </h2>
                    <p className="text-[15px] text-muted-foreground">Giảng viên: {course.instructor}</p>
                </div>
                <div className="flex items-center gap-[18px]">
                    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Tiến độ khóa ${pct}%`}>
                        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
                            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-muted" />
                            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={RING_LEN} strokeDashoffset={shown ? RING_LEN * (1 - pct / 100) : RING_LEN} className="cm-ring-fg stroke-brand-600" />
                        </svg>
                        <b className="absolute inset-0 grid place-items-center font-mono text-2xl font-bold tracking-tight text-brand-ink">{pct}%</b>
                    </div>
                    <ul className="grid gap-1 text-[13px] text-muted-foreground">
                        <li><b className="font-mono text-foreground">{doneCount}/{lessons.length}</b> bài xong</li>
                        <li><b className="font-mono text-foreground">{minutes}</b> phút video</li>
                        <li><b className="font-mono text-foreground">{strongCount}/{conceptCount}</b> khái niệm vững</li>
                    </ul>
                </div>
            </div>

            <div className="cm-route overflow-x-auto px-5 pb-8 pt-7 min-[760px]:px-8">
                <div ref={stationsRef} className="cm-stations relative isolate" style={{ ['--cm-cols' as string]: [...lessons.map((_, i) => (i === curIndex ? 'minmax(300px,1.4fr)' : 'minmax(180px,1fr)')), 'minmax(150px,0.6fr)'].join(' ') }}>
                    <div ref={trackRef} className="cm-track bg-muted" aria-hidden>
                        <i className="cm-track-fill bg-brand-600" />
                    </div>
                    {lessons.map((l, i) => {
                        const isCur = i === curIndex
                        const p = pcts[i]
                        const done = p >= 100
                        const strong = l.concepts.filter((c) => (mastery[c.id] ?? 0) >= STRONG_MASTERY).length
                        const state = done ? 'Đã xong' : isCur ? (p > 0 ? `Đang học · ${p}%` : 'Chặng tiếp theo') : 'Chưa học'
                        return (
                            <div key={l.id} data-vt={`lesson-${l.id}`} data-cur={isCur} style={{ transitionDelay: `${80 + i * 90}ms` }} className="cm-st group relative flex flex-col rounded-2xl">
                                <div className="cm-thumbbox">
                                    <div data-vt-thumb className="cm-thumb relative overflow-hidden rounded-2xl" style={{ background: FALLBACK_BG }}>
                                        <Thumb youtubeId={l.youtubeId} />
                                        {done && <span aria-hidden className="absolute inset-0 bg-success/25" />}
                                        <span aria-hidden className="cm-play absolute left-1/2 top-1/2 -ml-[22px] -mt-[22px] grid h-11 w-11 place-items-center rounded-full bg-ink-foreground/90">
                                            <span className="ml-[3px] border-y-[8px] border-l-[13px] border-y-transparent border-l-brand-600" />
                                        </span>
                                        <span className="absolute bottom-2 right-2 rounded-md bg-ink/70 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-foreground">{clock(l.durationSec)}</span>
                                    </div>
                                </div>
                                <span data-dot aria-hidden className={`cm-dot z-[1] h-[18px] w-[18px] rounded-full border-[3px] ${done ? 'border-success bg-success' : isCur ? 'border-brand-600 bg-brand-600' : 'border-muted bg-card'}`}>
                                    {isCur && <span className="cm-ping absolute -inset-[9px] rounded-full border-2 border-brand-600" />}
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">Chặng {String(i + 1).padStart(2, '0')}</span>
                                <h3 className={`mb-2 mt-1 leading-[1.3] tracking-tight ${isCur ? 'text-lg font-black text-foreground' : 'text-sm font-bold text-muted-foreground'}`}>{l.title}</h3>
                                <div className="flex items-center gap-[5px]" aria-label={`${strong}/${l.concepts.length} khái niệm vững`}>
                                    {l.concepts.map((c) => (
                                        <span key={c.id} title={c.name} className="relative h-3 w-3 overflow-hidden rounded bg-muted">
                                            <i className="absolute inset-0 bg-brand-600" style={{ opacity: Math.min(1, mastery[c.id] ?? 0) }} />
                                        </span>
                                    ))}
                                    <em className="ml-1.5 text-xs not-italic text-muted-foreground">{strong}/{l.concepts.length} vững</em>
                                </div>
                                <span className={`mt-2.5 text-[13px] font-bold ${isCur ? 'text-brand-ink' : 'text-muted-foreground'}`}>{state}</span>
                                {isCur && (
                                    <span className="tier-1-bob mt-3 inline-flex items-center gap-2 self-start rounded-full bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-ink-foreground shadow-brand">
                                        <span aria-hidden className="border-y-[6px] border-l-[9px] border-y-transparent border-l-ink-foreground" />
                                        {p > 0 ? 'Học tiếp' : 'Bắt đầu'}
                                    </span>
                                )}
                                {done && (
                                    <Link to={`/recap/${l.id}`} className="relative z-10 mt-3 inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-bold text-brand-ink transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
                                        Xem tổng kết
                                    </Link>
                                )}
                                {/* Cả trạm bấm được để vào bài; nút Xem tổng kết nằm trên lớp này */}
                                <Link to={`/lesson/${l.id}`} aria-label={`Chặng ${i + 1}: ${l.title}`} className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-card" />
                            </div>
                        )
                    })}
                    <div style={{ transitionDelay: `${80 + lessons.length * 90}ms` }} className="cm-st flex flex-col rounded-2xl">
                        <div className="cm-thumbbox" aria-hidden />
                        <span data-dot aria-hidden className="cm-dot z-[1] h-[18px] w-[18px] rotate-45 rounded border-[3px] border-muted bg-card" />
                        <span className="font-mono text-[11px] text-muted-foreground">Đích</span>
                        <h3 className="mb-1 mt-1 text-sm font-bold leading-[1.3] text-muted-foreground">Test cuối chương</h3>
                        {record && <span className="font-mono text-xs text-muted-foreground">Tốt nhất {record.bestCorrect}/{record.bestTotal}</span>}
                        <Link to={`/test/${course.id}`} className="mt-1.5 self-start text-[13px] font-bold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
                            Làm test →
                        </Link>
                    </div>
                </div>
            </div>
        </article>
    )
}
