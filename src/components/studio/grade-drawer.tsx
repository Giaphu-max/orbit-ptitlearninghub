import { useEffect } from 'react'
import { AlertCircle, RotateCcw, X } from 'lucide-react'
import { DIRECTOR_MIN_SCORE } from '@/lib/gamification'
import { gradeShot, type StudioShot } from '@/store/useStudioSession'

interface Props {
    shot: StudioShot | undefined
    open: boolean
    onClose: () => void
    /** Khôi phục thông số của ảnh này rồi quay lại chụp */
    onRetake: (shot: StudioShot) => void
}

/** Ngăn trượt phủ lên cột phải (bottom sheet khi dưới 980px) hiện kết quả AI chấm một ảnh. */
export function GradeDrawer({ shot, open, onClose, onRetake }: Props) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    return (
        <aside
            aria-label="Kết quả chấm ảnh"
            aria-hidden={!open}
            inert={!open}
            className={`fixed inset-x-4 bottom-4 z-40 flex h-[80svh] flex-col rounded-panel border border-border bg-card shadow-raised transition-[transform,visibility] duration-slow ease-out min-[980px]:absolute min-[980px]:inset-0 min-[980px]:h-auto ${
                open ? 'visible translate-y-0 min-[980px]:translate-x-0' : 'invisible translate-y-[calc(100%+2rem)] min-[980px]:translate-x-[calc(100%+1.5rem)] min-[980px]:translate-y-0'
            }`}
        >
            <div className="flex items-center gap-3 border-b border-border px-[18px] py-4">
                <h2 className="flex-1 text-sm font-bold text-foreground">AI chấm ảnh</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng kết quả chấm"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-foreground transition hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                    <X size={15} />
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-[18px]">{shot && <Body shot={shot} onRetake={onRetake} />}</div>
        </aside>
    )
}

function Body({ shot, onRetake }: { shot: StudioShot; onRetake: (s: StudioShot) => void }) {
    const { status, result } = shot

    return (
        <div aria-live="polite">
            <div className="relative overflow-hidden rounded-card bg-ink">
                <img src={shot.image} alt="Ảnh đang được chấm" className="block h-auto w-full" />
                {status === 'grading' && (
                    <div aria-hidden className="absolute inset-0 overflow-hidden">
                        <div className="studio-scanv absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-transparent via-brand-light/35 to-transparent" />
                    </div>
                )}
                {status === 'done' &&
                    result?.areas.map((a, i) => (
                        <div
                            key={i}
                            className="studio-pop pointer-events-none absolute rounded-md border-2 border-brand-light"
                            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                        >
                            <span className="absolute -top-px left-0 flex h-5 min-w-5 -translate-y-full items-center justify-center rounded-t bg-brand-600 px-1.5 font-mono text-[11px] font-bold text-ink-foreground">
                                {i + 1}
                            </span>
                        </div>
                    ))}
            </div>

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
                    <p className="flex gap-2 text-sm text-foreground">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {shot.error}
                    </p>
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
                        <p>
                            <span className="font-bold text-foreground">Bố cục. </span>
                            <span className="text-muted-foreground">{result.compositionComment}</span>
                        </p>
                        <p>
                            <span className="font-bold text-foreground">Ánh sáng. </span>
                            <span className="text-muted-foreground">{result.lightingComment}</span>
                        </p>
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
                                <li key={t} className="rounded-card bg-brand-soft px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-brand-ink">
                                    {t}
                                </li>
                            ))}
                        </ol>
                    )}
                    <button
                        type="button"
                        onClick={() => onRetake(shot)}
                        className="mt-5 w-full rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                        Áp gợi ý rồi chụp lại
                    </button>
                </>
            )}
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
