import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, History, Sparkles, Trash2, X } from 'lucide-react'
import { DIRECTOR_MIN_SCORE } from '@/lib/gamification'
import { gradeShot, useStudioSession, type StudioShot } from '@/store/useStudioSession'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)'

/** Ô thumbnail của ảnh trong dải phim, làm điểm xuất phát/đích của hiệu ứng mở/đóng. */
const thumbOf = (id: number | undefined) => (id === undefined ? null : document.querySelector<HTMLElement>(`[data-shot-id="${id}"]`))

function flipFrom(el: HTMLElement, thumb: HTMLElement | null, opts: { duration: number; reverse?: boolean }) {
    const to = el.getBoundingClientRect()
    if (!thumb || to.width === 0) return null
    const from = thumb.getBoundingClientRect()
    const small = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`
    const frames = [{ transform: small }, { transform: 'none' }]
    return el.animate(opts.reverse ? frames.reverse() : frames, { duration: opts.duration, easing: EASE_OUT, fill: 'both' })
}

interface Props {
    onReuse: (shot: StudioShot) => void
    onDelete: (shot: StudioShot) => void
}

/**
 * Xem ảnh toàn màn hình, dựng bằng portal ra document.body (nằm trên mọi lớp, kể cả nav).
 * Mở: ảnh phóng từ thumbnail trong dải phim (FLIP); đóng: thu về thumbnail. Reduced-motion: chỉ fade.
 * Esc đóng do view xử lý chung; ←/→ chuyển ảnh có trượt ngang 200ms; khóa cuộn body, bẫy focus.
 */
export function Lightbox({ onReuse, onDelete }: Props) {
    const { shots, selectedId, lightboxOpen } = useStudioSession()
    const [shown, setShown] = useState(false)
    // Mở: dựng ngay trong lúc render (mẫu "state từ props") để layout effect đo được ảnh ở khung hình đầu
    if (lightboxOpen && !shown) setShown(true)

    const index = shots.findIndex((s) => s.id === selectedId)
    const shot = shots[index]
    const dialogRef = useRef<HTMLDivElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)
    const imgRef = useRef<HTMLImageElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const prevFocus = useRef<HTMLElement | null>(null)
    const prevIndex = useRef(-1)
    const lastShot = useRef<StudioShot | undefined>(undefined)
    if (shot) lastShot.current = shot

    const close = () => useStudioSession.getState().setLightbox(false)
    const go = (d: number) => {
        const next = useStudioSession.getState().shots[index + d]
        if (next) useStudioSession.setState({ selectedId: next.id })
    }

    // Mở
    useLayoutEffect(() => {
        if (!shown || !lightboxOpen) return
        prevFocus.current = document.activeElement as HTMLElement | null
        const thumb = thumbOf(shot?.id)
        thumb?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
        backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out', fill: 'both' })
        const img = imgRef.current
        if (img) {
            if (reduced()) img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'both' })
            else flipFrom(img, thumb, { duration: 320 }) ?? img.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE_OUT, fill: 'both' })
        }
        prevIndex.current = index
        closeRef.current?.focus()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shown])

    // Đóng: thu về thumbnail rồi gỡ khỏi DOM
    useEffect(() => {
        if (lightboxOpen || !shown) return
        const img = imgRef.current
        const done = () => {
            setShown(false)
            prevFocus.current?.focus?.()
        }
        if (!img || !lastShot.current) return done()
        backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'both' })
        const anim = reduced() ? img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'both' }) : flipFrom(img, thumbOf(lastShot.current.id), { duration: 260, reverse: true })
        if (!anim) return done()
        anim.onfinish = done
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lightboxOpen])

    // Chuyển ảnh: trượt ngang 200ms theo hướng đi; giữ thumbnail tương ứng trong tầm nhìn để đóng về đúng chỗ
    useEffect(() => {
        if (!lightboxOpen || prevIndex.current < 0 || index === prevIndex.current) return
        const dir = index > prevIndex.current ? 1 : -1
        prevIndex.current = index
        thumbOf(shot?.id)?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
        if (!reduced()) imgRef.current?.animate([{ opacity: 0, transform: `translateX(${dir * 48}px)` }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index])

    // Khóa cuộn body
    useEffect(() => {
        if (!shown) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [shown])

    // Phím ←/→ và bẫy focus
    useEffect(() => {
        if (!lightboxOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') go(-1)
            else if (e.key === 'ArrowRight') go(1)
            else if (e.key === 'Tab') {
                const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
                if (items.length === 0) return
                const first = items[0]
                const last = items[items.length - 1]
                const active = document.activeElement
                if (!dialogRef.current?.contains(active)) {
                    e.preventDefault()
                    first.focus()
                } else if (e.shiftKey && active === first) {
                    e.preventDefault()
                    last.focus()
                } else if (!e.shiftKey && active === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lightboxOpen, index])

    if (!shown) return null
    const cur = shot ?? lastShot.current
    if (!cur) return null
    const n = shots.indexOf(cur) + 1 || index + 1
    const graded = cur.status === 'done' && cur.result
    const time = new Date(cur.at).toLocaleTimeString('vi-VN', { hour12: false })
    const glassBtn = 'flex shrink-0 items-center justify-center rounded-full border border-ink-foreground/15 bg-ink-foreground/10 text-ink-foreground backdrop-blur-md transition hover:bg-ink-foreground/20 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'
    const action = 'inline-flex shrink-0 items-center gap-2 rounded-full border border-ink-foreground/20 bg-ink-foreground/10 px-4 py-2.5 text-sm font-bold text-ink-foreground transition hover:bg-ink-foreground/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'

    return createPortal(
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Ảnh ${n} trong ${shots.length}`} className="fixed inset-0 z-[90] flex flex-col text-ink-foreground">
            <div ref={backdropRef} aria-hidden className="absolute inset-0 bg-ink/[0.88] backdrop-blur-md" />

            {/* Thanh trên */}
            <div className="relative flex items-center gap-3 px-4 py-3 sm:px-6">
                <p className="min-w-0 flex-1 truncate text-sm">
                    <b className="font-bold">Ảnh {n}/{shots.length}</b>
                    <span className="mx-2 text-ink-foreground/50">·</span>
                    <span className="font-mono text-ink-foreground/80">{time}</span>
                    <span className="mx-2 hidden text-ink-foreground/50 sm:inline">·</span>
                    <span className="hidden font-mono text-ink-foreground/80 sm:inline">{cur.setup.focalLengthMm}mm · đèn chính {cur.setup.key}%</span>
                </p>
                {graded ? (
                    <span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${(cur.result?.overall ?? 0) >= DIRECTOR_MIN_SCORE ? 'bg-success text-success-foreground' : 'bg-ink-foreground/20 text-ink-foreground'}`}>{cur.result?.overall} điểm</span>
                ) : (
                    <span className="rounded-full bg-ink-foreground/15 px-3 py-1 text-xs font-bold text-ink-foreground/80">{cur.status === 'grading' ? 'Đang chấm' : 'Chưa chấm'}</span>
                )}
                <button ref={closeRef} type="button" aria-label="Đóng" onClick={close} className={`${glassBtn} h-10 w-10`}><X size={18} /></button>
            </div>

            {/* Ảnh: bấm nền quanh ảnh để đóng */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-16" onClick={(e) => e.target === e.currentTarget && close()}>
                <img
                    ref={imgRef}
                    src={cur.image}
                    alt={`Ảnh ${n} chụp lúc ${time}`}
                    style={{ maxWidth: '88vw', maxHeight: '74vh', transformOrigin: 'top left' }}
                    className="h-auto w-auto rounded-2xl border border-ink-foreground/15 object-contain shadow-[0_30px_90px_-20px_rgba(0,0,0,0.7)]"
                />
                <button type="button" aria-label="Ảnh trước" disabled={index <= 0} onClick={() => go(-1)} className={`${glassBtn} absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 sm:left-4`}><ChevronLeft size={22} /></button>
                <button type="button" aria-label="Ảnh sau" disabled={index >= shots.length - 1} onClick={() => go(1)} className={`${glassBtn} absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 sm:right-4`}><ChevronRight size={22} /></button>
            </div>

            {/* Thanh dưới: thumbnail + hành động (mobile cuộn ngang cả thanh) */}
            <div className="relative flex items-center gap-4 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6">
                <ul aria-label="Chuyển ảnh" className="flex shrink-0 gap-2 sm:min-w-0 sm:flex-1 sm:overflow-x-auto sm:p-0.5">
                    {shots.map((s, i) => (
                        <li key={s.id} className="shrink-0">
                            <button
                                type="button"
                                aria-label={`Ảnh ${i + 1}`}
                                aria-current={s.id === cur.id}
                                onClick={() => useStudioSession.setState({ selectedId: s.id })}
                                className={`block aspect-[3/2] h-11 overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${s.id === cur.id ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100'}`}
                            >
                                <img src={s.image} alt="" className="h-full w-full object-cover" />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="flex shrink-0 items-center gap-2">
                    {graded ? (
                        <button type="button" className={action} onClick={() => { close(); useStudioSession.getState().select(cur.id) }}><Sparkles size={15} /> Xem kết quả</button>
                    ) : (
                        <button
                            type="button"
                            className={action}
                            disabled={cur.status === 'grading'}
                            onClick={() => {
                                close()
                                useStudioSession.getState().select(cur.id)
                                void gradeShot(cur.id)
                            }}
                        >
                            <Sparkles size={15} /> {cur.status === 'grading' ? 'Đang chấm…' : 'Chấm ảnh này'}
                        </button>
                    )}
                    <button type="button" className={action} onClick={() => { close(); onReuse(cur) }}><History size={15} /> Dùng lại thiết lập</button>
                    <button type="button" className={action} disabled={cur.status === 'grading'} onClick={() => onDelete(cur)}><Trash2 size={15} /> Xóa</button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
