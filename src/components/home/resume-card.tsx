import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import type { Lesson } from '@/data/types'
import './resume-card.css'

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const W = 340
const OFF = 18

/** Thumbnail YouTube: maxresdefault; video không có bản đó thì YouTube trả ảnh xám 120px (không báo lỗi) nên cũng rơi về hqdefault. */
function useThumb(videoId: string) {
    const [src, setSrc] = useState(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`)
    useEffect(() => {
        let alive = true
        const hq = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        const max = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
        const img = new Image()
        img.onload = () => alive && setSrc(img.naturalWidth > 120 ? max : hq)
        img.onerror = () => alive && setSrc(hq)
        img.src = max
        return () => {
            alive = false
        }
    }, [videoId])
    return src
}

interface Props {
    lesson: Lesson
    /** Tên môn / khóa hiển thị ở dòng "Học tiếp · …" */
    courseTitle: string
    /** Giây đã xem (0 = bài chưa bắt đầu) */
    resumeSec: number
}

/**
 * Khối "Học tiếp": cả thẻ là một nút bấm sang trang học bài (video tua tới giây đã xem).
 * Đứng yên: nhấp nhô / nảy / vệt sáng cùng nhịp 3s (resume-card.css). Hover: dừng, và khung xem trước video bật ra tại con trỏ, đi theo chuột.
 */
export function ResumeCard({ lesson, courseTitle, resumeSec }: Props) {
    const dur = Math.max(1, lesson.durationSec)
    const at = Math.min(Math.max(0, resumeSec), dur)
    const pct = at / dur
    const left = Math.max(0, dur - at)
    const mins = Math.ceil(left / 60)
    const thumb = useThumb(lesson.youtubeId)

    const cardRef = useRef<HTMLAnchorElement>(null)
    const pvRef = useRef<HTMLDivElement>(null)
    const pos = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0, open: false, anim: null as Animation | null })
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const t = window.setTimeout(() => cardRef.current?.classList.add('in'), calm() ? 0 : 250)
        const p = pos.current
        return () => {
            window.clearTimeout(t)
            cancelAnimationFrame(p.raf)
        }
    }, [])

    /** Góc dưới-trái của khung cách con trỏ 18px về phía trên-phải; tràn phải thì sang trái con trỏ, tràn trên thì xuống dưới. */
    const place = (cx: number, cy: number) => {
        const h = pvRef.current?.offsetHeight ?? 0
        let px = cx + OFF
        let py = cy - h - OFF
        if (px + W > window.innerWidth - 12) px = cx - W - OFF
        if (py < 12) py = cy + OFF
        return { px, py, ox: cx - px, oy: cy - py }
    }
    const apply = (e: PointerEvent, first: boolean) => {
        const pv = pvRef.current
        if (!pv) return
        const { px, py, ox, oy } = place(e.clientX, e.clientY)
        const p = pos.current
        p.tx = px
        p.ty = py
        if (first) {
            p.x = px
            p.y = py
            pv.style.translate = `${px}px ${py}px`
        }
        pv.style.transformOrigin = `${ox}px ${oy}px`
    }
    const loop = () => {
        const p = pos.current
        const pv = pvRef.current
        if (!pv) return
        p.x += (p.tx - p.x) * 0.18
        p.y += (p.ty - p.y) * 0.18
        pv.style.translate = `${p.x}px ${p.y}px`
        if (p.open) p.raf = requestAnimationFrame(loop)
    }
    const onEnter = (e: PointerEvent<HTMLAnchorElement>) => {
        const pv = pvRef.current
        if (!pv || e.pointerType !== 'mouse' || calm()) return
        const p = pos.current
        p.open = true
        apply(e, true)
        pv.classList.remove('show')
        void pv.offsetWidth
        pv.classList.add('show')
        p.anim?.cancel()
        p.anim = pv.animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1.03)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' })
        cancelAnimationFrame(p.raf)
        p.raf = requestAnimationFrame(loop)
    }
    const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
        if (pos.current.open) apply(e, false)
    }
    const onLeave = () => {
        const pv = pvRef.current
        const p = pos.current
        if (!pv || !p.open) return
        p.open = false
        p.anim?.cancel()
        p.anim = pv.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' })
    }

    const href = `/lesson/${lesson.id}${at > 0 ? `?t=${Math.floor(at)}` : ''}`
    return (
        <>
            <Link
                ref={cardRef}
                to={href}
                onPointerEnter={onEnter}
                onPointerMove={onMove}
                onPointerLeave={onLeave}
                aria-label={`${at > 0 ? 'Học tiếp' : 'Bắt đầu'} ${lesson.title}${at > 0 ? ` từ ${fmt(at)}` : ''}`}
                className="rc"
                style={{ ['--pct' as string]: pct }}
            >
                <span className="rc-play" aria-hidden>
                    <Play size={26} className="fill-current" />
                </span>
                <span className="rc-body">
                    <span className="rc-eyebrow">
                        {at > 0 ? 'Học tiếp' : 'Bắt đầu'} · {courseTitle}
                    </span>
                    <span className="rc-title">{lesson.title}</span>
                    <span className="rc-prog" aria-hidden>
                        <b>{fmt(at)}</b>
                        <span className="rc-bar">
                            <i />
                        </span>
                        <span>{fmt(dur)}</span>
                    </span>
                </span>
                <span className="rc-go" aria-hidden>
                    <ArrowRight size={20} />
                </span>
            </Link>
            {mounted &&
                createPortal(
                    <div ref={pvRef} className="rc-pv" aria-hidden style={{ ['--pct' as string]: pct }}>
                        <div className="rc-scr">
                            <img src={thumb} alt="" draggable={false} />
                            <span className="rc-tc">
                                {fmt(at)} / {fmt(dur)}
                            </span>
                            <span className="rc-mid">
                                <Play size={20} className="fill-current" />
                            </span>
                            <span className="rc-pb">
                                <i />
                            </span>
                        </div>
                        <div className="rc-cap">
                            {at > 0 ? `Xem tiếp từ ${fmt(at)}` : 'Xem từ đầu'}
                            <span>{left < 60 ? 'còn dưới 1 phút' : `còn ${mins} phút`}</span>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    )
}
