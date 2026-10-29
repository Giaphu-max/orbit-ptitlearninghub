import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Grid3x3, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import type { FixSuggestion } from '@/lib/api-types'
import type { StudioBrief } from '@/data/types'
import { compositionHint, lightingHint, type HintLevel } from '@/lib/studio-hints'
import { describeChange } from '@/lib/studio-suggest'
import { elevationLabel, snapshotRows } from '@/lib/studio-snapshot'
import { gradeShot, useStudioSession, type StudioShot } from '@/store/useStudioSession'
import { ViewerBoundary } from '@/components/studio/viewer-boundary'

interface Props {
    shot: StudioShot
    index: number
    total: number
    /** Đề của ảnh này (đề lúc chụp) */
    brief: StudioBrief
    briefIndex: number
    briefCount: number
    onClose: () => void
    /** Đưa cảnh về thiết lập lúc chụp ảnh này (và đóng popup) */
    onReuse: (shot: StudioShot) => void
    onDelete: (shot: StudioShot) => void
    /** Áp một gợi ý khắc phục vào studio */
    onTry: (change: NonNullable<FixSuggestion['change']>) => void
}

/** Popup xem ảnh / AI chấm, nổi trên trang studio (portal ra body). Đặt trong AnimatePresence để có hiệu ứng đóng. */
export function ShotViewer(props: Props) {
    const reduced = useReducedMotion()
    const { onClose } = props
    return createPortal(
        <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/55 p-10 backdrop-blur-[6px]"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: 'easeOut' }}
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <ViewerBoundary onBack={onClose}>
                <ShotDialog {...props} />
            </ViewerBoundary>
        </motion.div>,
        document.body,
    )
}

const DOT: Record<HintLevel, string> = { good: 'bg-mm-teal', near: 'bg-mm-orange', unclear: 'bg-muted-foreground/40' }
const LEVEL_TEXT: Record<HintLevel, string> = { good: 'đạt', near: 'gần đạt', unclear: 'chưa rõ' }

function ShotDialog({ shot, index, total, brief, briefIndex, briefCount, onClose, onReuse, onDelete, onTry }: Props) {
    const reduced = useReducedMotion()
    const { status } = shot
    // Dữ liệu chấm có thể thiếu trường (định dạng cũ/lỗi): đọc phòng thủ
    const result = shot.result && { ...shot.result, criteria: shot.result.criteria ?? [], areas: (shot.result.areas ?? []).map((a) => ({ ...a, fixes: a.fixes ?? [] })), tips: shot.result.tips ?? [], creativityBonus: shot.result.creativityBonus ?? 0 }
    const graded = status === 'done' && Boolean(result)
    const [active, setActive] = useState<number | null>(null)
    const [grid, setGrid] = useState(false)
    const [ratio, setRatio] = useState(3 / 2)
    const issueRefs = useRef<(HTMLLIElement | null)[]>([])
    const dialogRef = useRef<HTMLDivElement>(null)
    const rows = snapshotRows(shot).filter((r) => r.group !== 'env')
    const passed = result ? result.overall >= brief.passScore : false
    const shots = useStudioSession((s) => s.shots)

    // Khóa cuộn body, focus vào hộp khi mở, trả focus về thumbnail khi đóng
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null
        const shotId = shot.id
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialogRef.current?.focus()
        return () => {
            document.body.style.overflow = prevOverflow
            const id = useStudioSession.getState().selectedId ?? shotId
            const thumb = document.querySelector<HTMLElement>(`[data-shot-id="${id}"]`)
            ;(thumb ?? opener)?.focus?.()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => setActive(null), [shot.id])

    const step = (d: number) => {
        const next = useStudioSession.getState().shots[index + d]
        if (next) useStudioSession.getState().select(next.id)
    }
    const goIssue = (i: number) => {
        setActive(i)
        issueRefs.current[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    }
    const ext = /^data:image\/(\w+)/.exec(shot.image)?.[1] ?? 'jpeg'
    const grading = status === 'grading'

    return (
        <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shot-dialog-title"
            tabIndex={-1}
            initial={reduced ? false : { opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: 'easeOut' }}
            className="grid max-h-[calc(100vh-80px)] w-[min(1240px,calc(100vw-80px))] grid-cols-[minmax(0,1fr)_380px] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-[24px] bg-card shadow-raised focus:outline-none"
        >
            {/* Cột trái: ảnh */}
            <div className="flex min-h-0 min-w-0 flex-col bg-ink p-[18px] text-ink-foreground">
                <div className="flex items-center gap-2.5 pb-3.5">
                    <NavBtn label="Ảnh trước" disabled={index <= 0} onClick={() => step(-1)}>
                        <ChevronLeft size={16} />
                    </NavBtn>
                    <b className="font-mono text-[13px] font-bold">
                        Ảnh {index + 1}/{total}
                    </b>
                    <NavBtn label="Ảnh sau" disabled={index >= total - 1} onClick={() => step(1)}>
                        <ChevronRight size={16} />
                    </NavBtn>
                    <span className="ml-auto flex items-center gap-2">
                        <span className="rounded-[7px] bg-ink-foreground/10 px-[9px] py-[5px] font-mono text-xs font-semibold text-ink-foreground/85">
                            {shot.setup.focalLengthMm}mm · {elevationLabel(shot.setup.elevationDeg)}
                        </span>
                        <NavBtn label="Lưới 1/3" pressed={grid} onClick={() => setGrid((g) => !g)}>
                            <Grid3x3 size={15} />
                        </NavBtn>
                    </span>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center">
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-ink-foreground/5">
                        <div className="absolute left-1/2 top-1/2 h-full max-w-full -translate-x-1/2 -translate-y-1/2" style={{ aspectRatio: Math.min(ratio, 16 / 9) }}>
                            <img src={shot.image} alt="Ảnh đã chụp trong studio" onLoad={(e) => setRatio(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))} className="block h-full w-full object-contain" />
                            {grid && (
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0"
                                    style={{
                                        backgroundImage:
                                            'linear-gradient(90deg, transparent calc(33.3% - .5px), hsl(0 0% 100% / .3) 0 calc(33.3% + .5px), transparent 0 calc(66.6% - .5px), hsl(0 0% 100% / .3) 0 calc(66.6% + .5px), transparent 0), linear-gradient(0deg, transparent calc(33.3% - .5px), hsl(0 0% 100% / .3) 0 calc(33.3% + .5px), transparent 0 calc(66.6% - .5px), hsl(0 0% 100% / .3) 0 calc(66.6% + .5px), transparent 0)',
                                    }}
                                />
                            )}
                            {grading && (
                                <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                                    <span className="studio-scanv absolute inset-x-0 top-0 block h-[30%] bg-gradient-to-b from-transparent via-brand-light/35 to-transparent" />
                                </span>
                            )}
                            {graded && result && (
                                <div className="pointer-events-none absolute inset-0">
                                    {result.areas.map((a, i) => (
                                        <span
                                            key={i}
                                            className={`studio-pop absolute rounded-[50%] border-2 transition ${active === i ? 'border-brand-light shadow-[0_0_0_6px_hsl(var(--brand-600)/0.3),0_0_0_2px_hsl(var(--brand-light))]' : 'border-brand-light/80'}`}
                                            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                                        >
                                            <button
                                                type="button"
                                                aria-label={`Lỗi ${i + 1}: ${a.title}`}
                                                onClick={() => goIssue(i)}
                                                onMouseEnter={() => setActive(i)}
                                                onMouseLeave={() => setActive(null)}
                                                className="pointer-events-auto absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 font-mono text-xs font-bold text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground"
                                            >
                                                {i + 1}
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-3.5">
                    <div className="flex min-w-0 gap-2 overflow-x-auto p-0.5 [scrollbar-width:thin]" aria-label="Chuyển ảnh">
                        {shots.map((s, i) => (
                            <button
                                key={s.id}
                                type="button"
                                aria-label={`Ảnh ${i + 1}`}
                                aria-current={s.id === shot.id}
                                onClick={() => useStudioSession.getState().select(s.id)}
                                className={`aspect-[3/2] w-[72px] shrink-0 overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70 ${s.id === shot.id ? 'border-brand-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-90'}`}
                            >
                                <img src={s.image} alt="" className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                    <span className="ml-auto flex shrink-0 gap-3.5 pl-3 text-[12.5px] font-semibold">
                        <button type="button" disabled={grading} onClick={() => onDelete(shot)} className="text-ink-foreground/85 transition hover:text-ink-foreground disabled:opacity-40">
                            Xóa ảnh
                        </button>
                        <a href={shot.image} download={`studio-anh-${index + 1}.${ext === 'jpeg' ? 'jpg' : ext}`} className="text-ink-foreground/85 transition hover:text-ink-foreground">
                            Tải về
                        </a>
                    </span>
                </div>
            </div>

            {/* Cột phải: chấm ảnh */}
            <aside className="flex min-h-0 min-w-0 flex-col border-l border-border bg-card" aria-live="polite">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <span>
                        <b id="shot-dialog-title" className="text-[15px] font-bold text-strong">
                            {graded ? 'Kết quả AI chấm' : 'Chấm ảnh này'}
                        </b>
                        <small className="mt-0.5 block text-[12.5px] font-medium text-muted-foreground">
                            Đề {briefIndex + 1}/{briefCount} · {brief.shortTitle}
                        </small>
                    </span>
                    <button type="button" aria-label="Đóng" onClick={onClose} className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                        <X size={16} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
                    {status === 'error' && (
                        <div role="alert" className="mb-[18px] rounded-card bg-brand-50 px-4 py-3">
                            <p className="flex gap-2 text-sm text-foreground">
                                <AlertCircle size={16} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden /> {shot.error ?? 'Chưa chấm được ảnh này. Bạn thử lại sau ít phút nhé.'}
                            </p>
                            <button type="button" onClick={() => void gradeShot(shot.id)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-[13px] font-bold text-ink-foreground transition hover:bg-brand-700">
                                <RotateCcw size={14} /> Thử chấm lại
                            </button>
                        </div>
                    )}

                    {!graded ? (
                        <>
                            <h4 className="mb-2.5 text-eyebrow uppercase text-muted-foreground">Sẽ chấm theo</h4>
                            <div className="mb-[18px] flex flex-col gap-2">
                                {brief.rubric.map((c) => {
                                    const lv = c.key === 'composition' ? compositionHint(shot.setup).level : c.key === 'lighting' ? lightingHint(shot.setup).level : null
                                    return (
                                        <div key={c.key} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold text-strong">
                                            <span className="flex items-center gap-2">
                                                <i aria-hidden className={`h-2 w-2 rounded-full ${lv ? DOT[lv] : 'bg-muted-foreground/40'}`} />
                                                {c.label}
                                            </span>
                                            <em className="font-mono text-xs font-semibold not-italic text-muted-foreground">
                                                {c.points}đ · {lv ? LEVEL_TEXT[lv] : 'AI đánh giá'}
                                            </em>
                                        </div>
                                    )
                                })}
                            </div>
                            <h4 className="mb-2.5 text-eyebrow uppercase text-muted-foreground">Thiết lập lúc chụp</h4>
                            <dl className="grid grid-cols-2 gap-1.5">
                                {rows.map((r) => (
                                    <div key={r.key} className="flex justify-between gap-2 rounded-[9px] border border-border px-2.5 py-2 text-[12.5px] text-muted-foreground">
                                        <dt>{r.label}</dt>
                                        <dd className="font-mono text-xs font-bold text-strong">{r.value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="mt-3.5 text-[12.5px] leading-normal text-muted-foreground">AI chấm theo hiệu quả của bức ảnh so với đề, không bắt buộc đúng thông số.</p>
                        </>
                    ) : (
                        result && (
                            <>
                                <div className="mb-4 flex items-center gap-3.5 border-b border-border pb-4">
                                    <b className="font-mono text-[44px] font-extrabold leading-none text-brand-ink">
                                        {result.overall}
                                        <small className="text-lg font-bold text-muted-foreground">/100</small>
                                    </b>
                                    <span className={`rounded-full px-2.5 py-[5px] text-[12.5px] font-extrabold ${passed ? 'bg-success-soft text-success' : 'bg-brand-50 text-brand-ink'}`}>{passed ? 'Đạt' : 'Chưa đạt'}</span>
                                    {result.creativityBonus > 0 && <span className="ml-auto text-right text-[12.5px] font-bold text-success">+{result.creativityBonus} điểm<br />sáng tạo</span>}
                                </div>
                                {result.creativityBonus > 0 && result.approachNote && <p className="mb-4 text-[13px] leading-normal text-muted-foreground">{result.approachNote}</p>}
                                {result.criteria.map((c) => (
                                    <div key={c.key} className="mb-3">
                                        <div className="flex justify-between text-sm font-bold text-strong">
                                            {c.label}
                                            <em className="font-mono text-[12.5px] font-bold not-italic">
                                                {c.score}/{c.max}
                                            </em>
                                        </div>
                                        <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, (c.score / Math.max(1, c.max)) * 100))}%` }} />
                                        </div>
                                        {c.comment && <p className="text-[13px] leading-normal text-muted-foreground">{c.comment}</p>}
                                    </div>
                                ))}
                                {(result.areas.length > 0 || result.tips.length > 0) && (
                                    <section aria-label="Lỗi cần chỉnh">
                                        <h4 className="mb-2.5 mt-[18px] text-eyebrow uppercase text-muted-foreground">{result.areas.length > 0 ? 'Lỗi cần chỉnh' : 'Gợi ý chỉnh'}</h4>
                                        <ol>
                                            {result.areas.map((a, i) => (
                                                <li
                                                    key={i}
                                                    ref={(el) => {
                                                        issueRefs.current[i] = el
                                                    }}
                                                    onMouseEnter={() => setActive(i)}
                                                    onMouseLeave={() => setActive(null)}
                                                    className="mb-2.5 scroll-mt-4 overflow-hidden rounded-xl"
                                                >
                                                    <div className="flex items-center gap-2.5 bg-brand-50 px-3 py-2.5 text-sm font-bold text-strong shadow-[inset_3px_0_0_hsl(var(--brand-600))]">
                                                        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-[11.5px] font-bold text-ink-foreground">{i + 1}</span>
                                                        {a.title}
                                                    </div>
                                                    {a.fixes.map((f, k) => (
                                                        <div key={k} className="flex items-start gap-2 pb-0.5 pl-11 pr-3 pt-2 text-[13px] leading-snug text-foreground">
                                                            <span className="flex-1">
                                                                {f.text}
                                                                {f.change && <em className="not-italic text-muted-foreground"> {describeChange(f.change)}</em>}
                                                            </span>
                                                            {f.change && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onTry(f.change!)}
                                                                    title={`Áp vào studio: ${describeChange(f.change)}`}
                                                                    className="shrink-0 rounded-[7px] border border-brand-200 px-2 py-[3px] text-xs font-extrabold text-brand-ink transition hover:bg-brand-50"
                                                                >
                                                                    Thử
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </li>
                                            ))}
                                        </ol>
                                        {result.tips.length > 0 && (
                                            <ul className="mt-3 flex flex-col gap-1.5">
                                                {result.tips.map((t) => (
                                                    <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
                                                        <ArrowRight size={13} className="mt-1 shrink-0" aria-hidden />
                                                        {t}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </section>
                                )}
                            </>
                        )
                    )}
                </div>

                <div className="flex gap-2.5 border-t border-border p-4">
                    <button
                        type="button"
                        onClick={() => onReuse(shot)}
                        title="Áp thiết lập lúc chụp vào studio"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-border px-4 py-3.5 text-[15px] font-extrabold text-strong transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                        <RotateCcw size={15} /> Áp lại
                    </button>
                    <button
                        type="button"
                        disabled={grading}
                        onClick={() => void gradeShot(shot.id)}
                        className="inline-flex bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 flex-1 items-center justify-center gap-2 rounded-[14px] px-4 py-3.5 text-[15.5px] font-extrabold text-ink-foreground shadow-brand transition hover:brightness-105 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                        {grading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Đang chấm…
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} /> {graded ? 'Chấm lại' : 'Chấm ảnh này'}
                            </>
                        )}
                    </button>
                </div>
            </aside>
        </motion.div>
    )
}

function NavBtn({ label, disabled, pressed, onClick, children }: { label: string; disabled?: boolean; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-ink-foreground transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70 ${pressed ? 'bg-ink-foreground/30' : 'bg-ink-foreground/10 hover:bg-ink-foreground/20'}`}
        >
            {children}
        </button>
    )
}
