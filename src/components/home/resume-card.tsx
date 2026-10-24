import { useEffect, useMemo, useRef, type MouseEvent, type PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import type { Lesson } from '@/data/types'
import { useOrbitStore } from '@/store/useOrbitStore'
import './resume-card.css'

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const easeOut = (k: number) => 1 - (1 - k) ** 3
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const WAVE = Array.from({ length: 22 }, (_, i) => ({ h: 25 + Math.abs(Math.sin(i * 1.7)) * 60 + ((i * 37) % 15), d: i }))

interface Props {
    lesson: Lesson
    /** Tên khóa hiển thị ở dòng "Học tiếp · …" */
    courseTitle: string
    /** Giây đã xem (0 = bài chưa bắt đầu) */
    resumeSec: number
}

/**
 * Khối "Học tiếp" trên trang chủ = trình phát mini. Ảnh nhỏ mô phỏng timeline dựng phim; thanh thời gian chia theo mốc quiz của bài
 * (bài chưa có chương nên các đoạn chia ở mốc quiz). Rê chuột trên thanh = tua thử (chỉ xem trước, không đổi tiến độ trong store).
 * Bấm: lớp navy mở rộng từ khung thẻ ra toàn màn hình rồi sang trang học bài tại đúng giây đã xem. Chỉ animate transform/opacity/clip-path.
 */
export function ResumeCard({ lesson, courseTitle, resumeSec }: Props) {
    const navigate = useNavigate()
    const quizResults = useOrbitStore((s) => s.quizResults)
    const cardRef = useRef<HTMLAnchorElement>(null)
    const tlRef = useRef<HTMLSpanElement>(null)
    const playRef = useRef<HTMLSpanElement>(null)
    const segsRef = useRef<HTMLSpanElement>(null)
    const curRef = useRef<HTMLElement>(null)
    const tcRef = useRef<HTMLSpanElement>(null)
    const bubRef = useRef<HTMLSpanElement>(null)
    const pctRef = useRef<HTMLSpanElement>(null)
    const dur = Math.max(1, lesson.durationSec)
    const at = Math.min(Math.max(0, resumeSec), dur)

    // Các đoạn: cắt ở mốc quiz (bài chưa có chương)
    const { bounds, quizzes, nextQuiz } = useMemo(() => {
        const stops = [...new Set(lesson.quiz.map((q) => Math.round(q.pauseAt)))].filter((t) => t > 0 && t < dur).sort((a, b) => a - b)
        const qs = lesson.quiz
            .map((q) => ({ t: q.pauseAt, state: quizResults[q.id] || q.pauseAt < at ? ('done' as const) : ('' as const) }))
            .sort((a, b) => a.t - b.t)
        const next = qs.find((q) => q.state !== 'done')
        return { bounds: [0, ...stops, dur], quizzes: qs.map((q) => ({ ...q, state: q === next ? ('next' as const) : q.state })), nextQuiz: next?.t }
    }, [lesson.quiz, dur, quizResults, at])

    // Ghi vị trí đầu phát / mã thời gian / các đoạn đã xem trực tiếp vào DOM (không render lại mỗi khung)
    const setP = (sec: number, pct = sec) => {
        const card = cardRef.current
        if (!card) return
        card.style.setProperty('--p', String(sec / dur))
        segsRef.current?.childNodes.forEach((n, i) => {
            const a = bounds[i]
            const b = bounds[i + 1]
            ;(n.firstChild as HTMLElement).style.setProperty('--f', String(Math.max(0, Math.min(1, (pct - a) / (b - a)))))
        })
        if (curRef.current) curRef.current.textContent = fmt(sec)
        if (tcRef.current) tcRef.current.textContent = fmt(sec)
        if (bubRef.current) bubRef.current.textContent = fmt(sec)
        if (pctRef.current) pctRef.current.textContent = `${Math.round((pct / dur) * 100)}%`
    }

    // Đo bề rộng thanh để đầu phát dịch bằng transform
    useEffect(() => {
        const tl = tlRef.current
        const card = cardRef.current
        if (!tl || !card) return
        const ro = new ResizeObserver(() => card.style.setProperty('--tw', `${tl.clientWidth}px`))
        ro.observe(tl)
        return () => ro.disconnect()
    }, [])

    // Vào trang: thẻ trượt lên, đầu phát chạy từ 0 tới chỗ đã xem, mã thời gian đếm theo
    useEffect(() => {
        const card = cardRef.current
        if (!card) return
        if (calm()) {
            card.classList.add('in')
            setP(at)
            return
        }
        setP(0)
        let raf = 0
        const timer = window.setTimeout(() => {
            card.classList.add('in')
            const t0 = performance.now() + 200
            const tick = (now: number) => {
                const k = Math.min(1, Math.max(0, (now - t0) / 1300))
                setP(at * easeOut(k))
                if (k < 1) raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }, 250)
        return () => {
            window.clearTimeout(timer)
            cancelAnimationFrame(raf)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lesson.id, at])

    const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
        const card = cardRef.current
        const tl = tlRef.current
        if (!card || !tl || calm()) return
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${e.clientX - r.left}px`)
        card.style.setProperty('--my', `${e.clientY - r.top}px`)
        // Tua thử: vùng ±14px quanh thanh
        const t = tl.getBoundingClientRect()
        if (e.clientY > t.top - 14 && e.clientY < t.bottom + 14 && e.clientX >= t.left && e.clientX <= t.right) {
            card.classList.add('scrub')
            setP(((e.clientX - t.left) / t.width) * dur, at)
        } else if (card.classList.contains('scrub')) {
            card.classList.remove('scrub')
            setP(at)
        }
        // Nút phát bị hút nhẹ khi chuột trong bán kính 120px
        const pb = playRef.current
        if (pb) {
            const b = pb.getBoundingClientRect()
            const dx = e.clientX - (b.left + b.width / 2)
            const dy = e.clientY - (b.top + b.height / 2)
            pb.style.transform = Math.hypot(dx, dy) < 120 ? `translate(${dx * 0.18}px, ${dy * 0.18}px)` : ''
        }
    }
    const onLeave = () => {
        cardRef.current?.classList.remove('scrub')
        if (calm()) return
        setP(at)
        if (playRef.current) playRef.current.style.transform = ''
    }

    const href = `/lesson/${lesson.id}${at > 0 ? `?t=${Math.floor(at)}` : ''}`
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        const card = cardRef.current
        if (!card || calm()) return navigate(href)
        const r = card.getBoundingClientRect()
        const wipe = document.createElement('div')
        wipe.setAttribute('aria-hidden', 'true')
        wipe.style.cssText = 'position:fixed;inset:0;z-index:200;pointer-events:none;background:hsl(var(--navy))'
        document.body.append(wipe)
        const open = wipe.animate(
            [{ clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 22px)` }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }],
            { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' },
        )
        open.finished
            .then(() => {
                navigate(href)
                return wipe.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 250, fill: 'forwards' }).finished
            })
            .catch(() => undefined)
            .finally(() => wipe.remove())
    }

    return (
        <Link
            ref={cardRef}
            to={href}
            onClick={onClick}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            aria-label={`${at > 0 ? 'Học tiếp' : 'Bắt đầu'} ${lesson.title}${at > 0 ? ` từ ${fmt(at)}` : ''}`}
            className="rc"
        >
            <span className="rc-thumb" aria-hidden="true">
                <span className="rc-grid" />
                <span ref={tcRef} className="rc-tc">
                    00:00
                </span>
                <span className="rc-tracks">
                    <span className="rc-clips">
                        <i style={{ width: '44%' }} />
                        <i style={{ width: '22%' }} />
                        <i style={{ width: '30%' }} />
                    </span>
                    <span className="rc-wave">
                        {WAVE.map((w) => (
                            <i key={w.d} style={{ ['--h' as string]: w.h, ['--d' as string]: w.d }} />
                        ))}
                    </span>
                </span>
                <span className="rc-ph" />
            </span>
            <span className="rc-body">
                <span className="rc-eyebrow">
                    <span className="rc-live" aria-hidden />
                    <span>
                        {at > 0 ? 'Học tiếp' : 'Bắt đầu'} · {courseTitle}
                    </span>
                </span>
                <span className="rc-title">{lesson.title}</span>
                <span ref={tlRef} className="rc-tl" aria-hidden="true">
                    <span ref={segsRef} className="rc-segs">
                        {bounds.slice(0, -1).map((a, i) => (
                            <span key={a} style={{ flex: bounds[i + 1] - a }}>
                                <i />
                            </span>
                        ))}
                    </span>
                    {quizzes.map((q, i) => (
                        <span key={q.t} className={`rc-q ${q.state}`} style={{ left: `${(q.t / dur) * 100}%`, transitionDelay: `${900 + i * 90}ms` }} />
                    ))}
                    <span className="rc-head" />
                    <span ref={bubRef} className="rc-bub">
                        00:00
                    </span>
                </span>
                <span className="rc-meta">
                    <span>
                        <b ref={curRef}>00:00</b> / {fmt(dur)}
                    </span>
                    <span className="rc-r">
                        <span ref={pctRef} className="pct">
                            0%
                        </span>
                        <span className="nx">{nextQuiz != null ? `Quiz tiếp · ${fmt(nextQuiz)}` : 'Sắp xong bài'}</span>
                    </span>
                </span>
            </span>
            <span ref={playRef} className="rc-play" aria-hidden="true">
                <Play size={20} className="ml-0.5 fill-current" />
            </span>
        </Link>
    )
}
