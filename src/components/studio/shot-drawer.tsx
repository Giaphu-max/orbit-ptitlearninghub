import { AlertCircle, ChevronLeft, ChevronRight, History, Maximize2, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { DIRECTOR_MIN_SCORE } from '@/lib/gamification'
import { snapshotRows } from '@/lib/studio-snapshot'
import { gradeShot, useStudioSession, type StudioShot } from '@/store/useStudioSession'

interface Props {
    shot: StudioShot | undefined
    index: number
    total: number
    open: boolean
    onClose: () => void
    /** Tween cảnh về thiết lập lúc chụp ảnh này */
    onReuse: (shot: StudioShot) => void
    onDelete: (shot: StudioShot) => void
}

/** Ngăn phủ lên cột phải (bottom sheet khi dưới 980px): xem ảnh, thiết lập lúc chụp và kết quả AI chấm. */
export function ShotDrawer({ shot, index, total, open, onClose, onReuse, onDelete }: Props) {
    const step = (d: number) => {
        const { shots } = useStudioSession.getState()
        const next = shots[index + d]
        if (next) useStudioSession.getState().select(next.id)
    }

    return (
        <aside
            aria-label="Xem ảnh"
            aria-hidden={!open}
            inert={!open}
            className={`fixed inset-x-4 bottom-4 z-40 flex h-[80svh] flex-col rounded-panel border border-border bg-card shadow-raised transition-[transform,visibility] duration-slow ease-out min-[980px]:absolute min-[980px]:inset-0 min-[980px]:h-auto ${
                open ? 'visible translate-y-0 min-[980px]:translate-x-0' : 'invisible translate-y-[calc(100%+2rem)] min-[980px]:translate-x-[calc(100%+1.5rem)] min-[980px]:translate-y-0'
            }`}
        >
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-3 pl-[18px]">
                <h2 className="flex-1 text-sm font-bold text-foreground">
                    Xem ảnh <span className="ml-1 font-mono text-xs font-medium text-muted-foreground">{index + 1}/{total}</span>
                </h2>
                <IconBtn label="Ảnh trước" disabled={index <= 0} onClick={() => step(-1)}><ChevronLeft size={16} /></IconBtn>
                <IconBtn label="Ảnh sau" disabled={index >= total - 1} onClick={() => step(1)}><ChevronRight size={16} /></IconBtn>
                <IconBtn label="Xóa ảnh" disabled={!shot || shot.status === 'grading'} onClick={() => shot && onDelete(shot)}><Trash2 size={15} /></IconBtn>
                <IconBtn label="Đóng" onClick={onClose}><X size={15} /></IconBtn>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-[18px]">{shot && <Body key={shot.id} shot={shot} onReuse={onReuse} />}</div>
        </aside>
    )
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-foreground transition hover:bg-border disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            {children}
        </button>
    )
}

function Body({ shot, onReuse }: { shot: StudioShot; onReuse: (s: StudioShot) => void }) {
    const { status, result } = shot
    const rows = snapshotRows(shot)

    return (
        <div aria-live="polite">
            <button
                type="button"
                onClick={() => useStudioSession.getState().setLightbox(true)}
                aria-label="Mở ảnh toàn màn hình"
                className="group relative block w-full overflow-hidden rounded-card bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
                <img src={shot.image} alt="Ảnh đã chụp trong studio" className="block h-auto w-full" />
                {status === 'grading' && (
                    <span aria-hidden className="absolute inset-0 overflow-hidden">
                        <span className="studio-scanv absolute inset-x-0 top-0 block h-[30%] bg-gradient-to-b from-transparent via-brand-light/35 to-transparent" />
                    </span>
                )}
                {status === 'done' &&
                    result?.areas.map((a, i) => (
                        <span
                            key={i}
                            className="studio-pop pointer-events-none absolute rounded-md border-2 border-brand-light"
                            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                        >
                            <span className="absolute -top-px left-0 flex h-5 min-w-5 -translate-y-full items-center justify-center rounded-t bg-brand-600 px-1.5 font-mono text-[11px] font-bold text-ink-foreground">{i + 1}</span>
                        </span>
                    ))}
                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/60 text-ink-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Maximize2 size={13} />
                </span>
            </button>

            {status === 'idle' && (
                <button
                    type="button"
                    onClick={() => void gradeShot(shot.id)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                    <Sparkles size={15} /> Chấm ảnh này
                </button>
            )}

            {status === 'grading' && (
                <div className="mt-4">
                    <p className="text-[13px] leading-relaxed text-muted-foreground">Đang xem bố cục, ánh sáng và chủ thể… (khoảng 5–10 giây)</p>
                    <div aria-hidden className="mt-3">
                        <div className="studio-skel h-10 w-2/5 rounded-md" />
                        <div className="studio-skel mt-3 h-3 rounded-md" />
                        <div className="studio-skel mt-3 h-3 w-4/5 rounded-md" />
                        <div className="studio-skel mt-3 h-3 w-3/5 rounded-md" />
                    </div>
                    <p className="mt-4 text-[13px] text-muted-foreground">Bạn vẫn có thể tiếp tục chỉnh và chụp trong lúc chờ.</p>
                </div>
            )}

            {status === 'error' && (
                <div role="alert" className="mt-4 rounded-card border border-border bg-muted px-4 py-3">
                    <p className="flex gap-2 text-sm text-foreground"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {shot.error}</p>
                    <button
                        type="button"
                        onClick={() => void gradeShot(shot.id)}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-[13px] font-bold text-ink-foreground transition hover:bg-brand-700"
                    >
                        <RotateCcw size={14} /> Thử chấm lại
                    </button>
                </div>
            )}

            {status === 'done' && result && (
                <>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="font-mono text-6xl font-bold leading-none tracking-tight text-brand-ink">{result.overall}</span>
                        <span className="text-sm text-muted-foreground">/100 · {result.overall >= DIRECTOR_MIN_SCORE ? 'Đạt mức nhận XP' : `Cần từ ${DIRECTOR_MIN_SCORE} để nhận XP`}</span>
                    </div>
                    <div className="mt-4 grid gap-3">
                        <Bar label="Bố cục" value={result.composition} />
                        <Bar label="Ánh sáng" value={result.lighting} />
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-relaxed">
                        <p><span className="font-bold text-foreground">Bố cục. </span><span className="text-muted-foreground">{result.compositionComment}</span></p>
                        <p><span className="font-bold text-foreground">Ánh sáng. </span><span className="text-muted-foreground">{result.lightingComment}</span></p>
                    </div>
                    {(result.areas.length > 0 || result.tips.length > 0) && (
                        <ol className="mt-4 flex flex-col gap-2" aria-label="Gợi ý chỉnh">
                            {result.areas.map((a, i) => (
                                <li key={`a${i}`} className="flex items-start gap-2.5 rounded-card bg-muted px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
                                    <b className="font-mono text-brand-ink">{i + 1}</b>
                                    {a.note}
                                </li>
                            ))}
                            {result.tips.map((t) => (
                                <li key={t} className="rounded-card bg-brand-soft px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-brand-ink">{t}</li>
                            ))}
                        </ol>
                    )}
                </>
            )}

            <section aria-label="Thiết lập lúc chụp" className="mt-5">
                <h3 className="mb-2 text-eyebrow uppercase text-muted-foreground">Thiết lập lúc chụp</h3>
                <dl className="divide-y divide-border rounded-card border border-border text-[13px]">
                    {rows.map((r) => (
                        <div key={r.key} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                            <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
                            <dd className={`min-w-0 text-right font-semibold text-foreground ${r.group === 'env' ? '' : 'font-mono'}`}>{r.value}</dd>
                        </div>
                    ))}
                </dl>
                {shot.intent.prompt && shot.intent.explanation && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{shot.intent.explanation}</p>}
            </section>

            <button
                type="button"
                onClick={() => onReuse(shot)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-muted px-5 py-3 text-sm font-bold text-foreground transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
                <History size={15} /> Dùng lại thiết lập này
            </button>
        </div>
    )
}

function Bar({ label, value }: { label: string; value: number }) {
    return (
        <div className="text-[13px]">
            <div className="flex justify-between text-muted-foreground">
                {label}
                <span className="font-mono font-bold text-foreground">{value}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-600 transition-[width] duration-slow ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
            </div>
        </div>
    )
}
