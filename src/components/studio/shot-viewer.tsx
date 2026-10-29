import { useRef, useState } from 'react'
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Maximize2, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import type { FixSuggestion } from '@/lib/api-types'
import { describeChange } from '@/lib/studio-suggest'
import { snapshotRows } from '@/lib/studio-snapshot'
import { gradeShot, useStudioSession, type StudioShot } from '@/store/useStudioSession'

interface Props {
    shot: StudioShot
    index: number
    total: number
    passScore: number
    onClose: () => void
    /** Đưa cảnh về thiết lập lúc chụp ảnh này (và đóng khu xem ảnh) */
    onReuse: (shot: StudioShot) => void
    onDelete: (shot: StudioShot) => void
    /** Áp một gợi ý khắc phục vào studio */
    onTry: (change: NonNullable<FixSuggestion['change']>) => void
}

/** Khu xem ảnh / AI chấm rộng toàn chiều ngang, thay chỗ khung 3D + bảng bên. Lưới 8 | 4: ảnh + thiết lập | điểm và lỗi. */
export function ShotViewer({ shot, index, total, passScore, onClose, onReuse, onDelete, onTry }: Props) {
    const { status, result } = shot
    const [active, setActive] = useState<number | null>(null)
    const issueRefs = useRef<(HTMLLIElement | null)[]>([])
    const rows = snapshotRows(shot)
    const step = (d: number) => {
        const next = useStudioSession.getState().shots[index + d]
        if (next) useStudioSession.getState().select(next.id)
    }
    const goIssue = (i: number) => {
        setActive(i)
        issueRefs.current[i]?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    }
    const passed = result ? result.overall >= passScore : false

    return (
        <div aria-live="polite" className="pb-10">
            {/* Thanh trên: quay lại | ảnh x/y ‹ › | điểm tổng | xóa */}
            <div className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
                <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full py-1.5 pr-3 text-sm font-bold text-muted-foreground transition hover:text-strong">
                    <ChevronLeft size={16} /> Quay lại studio
                </button>
                <div className="flex items-center gap-1.5">
                    <span className="mr-1 font-mono text-sm font-bold text-strong">
                        Ảnh {index + 1}/{total}
                    </span>
                    <IconBtn label="Ảnh trước" disabled={index <= 0} onClick={() => step(-1)}>
                        <ChevronLeft size={16} />
                    </IconBtn>
                    <IconBtn label="Ảnh sau" disabled={index >= total - 1} onClick={() => step(1)}>
                        <ChevronRight size={16} />
                    </IconBtn>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {status === 'done' && result ? (
                        <>
                            <span className="font-mono text-4xl font-bold leading-none tracking-tight text-brand-ink">
                                {result.overall}
                                <span className="text-xl font-semibold text-muted-foreground">/100</span>
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${passed ? 'bg-success-soft text-success' : 'bg-brand-50 text-brand-ink'}`}>{passed ? 'Đạt' : `Chưa đạt · cần từ ${passScore}`}</span>
                        </>
                    ) : (
                        <span className="text-sm font-semibold text-muted-foreground">{status === 'grading' ? 'Đang chấm…' : status === 'error' ? 'Chưa chấm được' : 'Chưa chấm'}</span>
                    )}
                    <IconBtn label="Xóa ảnh" disabled={status === 'grading'} onClick={() => onDelete(shot)}>
                        <Trash2 size={15} />
                    </IconBtn>
                </div>
            </div>

            <div className="lesson-grid mt-6 items-start">
                {/* Cột 8: ảnh lớn + thiết lập lúc chụp */}
                <div className="min-w-0">
                    <div className="relative overflow-hidden rounded-[20px] border border-border bg-ink shadow-card">
                        <button
                            type="button"
                            onClick={() => useStudioSession.getState().setLightbox(true)}
                            aria-label="Mở ảnh toàn màn hình"
                            className="group block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                            <img src={shot.image} alt="Ảnh đã chụp trong studio" className="block h-auto w-full" />
                            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-ink-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                <Maximize2 size={14} />
                            </span>
                        </button>
                        {status === 'grading' && (
                            <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                                <span className="studio-scanv absolute inset-x-0 top-0 block h-[30%] bg-gradient-to-b from-transparent via-brand-light/35 to-transparent" />
                            </span>
                        )}
                        {status === 'done' && result && (
                            <div className="pointer-events-none absolute inset-0">
                                {result.areas.map((a, i) => (
                                    <span
                                        key={i}
                                        className={`studio-pop absolute rounded-[50%] border-2 transition ${active === i ? 'border-ink-foreground bg-ink-foreground/15 shadow-[0_0_0_3px_hsl(var(--brand-600)/0.7)]' : 'border-brand-light'}`}
                                        style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                                    >
                                        <button
                                            type="button"
                                            aria-label={`Lỗi ${i + 1}: ${a.title}`}
                                            onClick={() => goIssue(i)}
                                            onMouseEnter={() => setActive(i)}
                                            onMouseLeave={() => setActive(null)}
                                            className="pointer-events-auto absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 font-mono text-xs font-bold text-ink-foreground shadow-card ring-2 ring-ink-foreground focus-visible:outline-none focus-visible:ring-4"
                                        >
                                            {i + 1}
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <section aria-label="Thiết lập lúc chụp" className="mt-6">
                        <h3 className="mb-3 text-eyebrow uppercase text-muted-foreground">Thiết lập lúc chụp</h3>
                        <dl className="grid grid-cols-4 gap-3">
                            {rows
                                .filter((r) => r.group !== 'env')
                                .map((r) => (
                                    <div key={r.key} className="rounded-card border border-border bg-card px-3.5 py-2.5">
                                        <dt className="text-xs text-muted-foreground">{r.label}</dt>
                                        <dd className="mt-0.5 font-mono text-sm font-bold text-strong">{r.value}</dd>
                                    </div>
                                ))}
                            {rows
                                .filter((r) => r.group === 'env')
                                .map((r) => (
                                    <div key={r.key} className="col-span-4 rounded-card border border-border bg-card px-3.5 py-2.5">
                                        <dt className="text-xs text-muted-foreground">{r.label}</dt>
                                        <dd className="mt-0.5 text-sm font-semibold text-strong">{r.value}</dd>
                                        {shot.intent.prompt && shot.intent.explanation && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{shot.intent.explanation}</p>}
                                    </div>
                                ))}
                        </dl>
                        <button
                            type="button"
                            onClick={() => onReuse(shot)}
                            className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-strong transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <RotateCcw size={15} /> Áp lại thiết lập này vào studio
                        </button>
                    </section>
                </div>

                {/* Cột 4 (sticky): điểm tiêu chí, điểm sáng tạo, lỗi */}
                <aside className="min-w-0 lg:sticky lg:top-[calc(var(--nav-h)+16px)] lg:max-h-[calc(100svh-var(--nav-h)-32px)] lg:overflow-y-auto">
                    {status === 'idle' && (
                        <button
                            type="button"
                            onClick={() => void gradeShot(shot.id)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <Sparkles size={15} /> Chấm ảnh này
                        </button>
                    )}

                    {status === 'grading' && (
                        <div className="rounded-card border border-border bg-card p-5">
                            <p className="text-[13px] leading-relaxed text-muted-foreground">Đang xem bố cục, ánh sáng và chủ thể… (khoảng 5–10 giây)</p>
                            <div aria-hidden className="mt-3">
                                <div className="studio-skel h-10 w-2/5 rounded-md" />
                                <div className="studio-skel mt-3 h-3 rounded-md" />
                                <div className="studio-skel mt-3 h-3 w-4/5 rounded-md" />
                                <div className="studio-skel mt-3 h-3 w-3/5 rounded-md" />
                            </div>
                            <p className="mt-4 text-[13px] text-muted-foreground">Bạn vẫn có thể quay lại studio, chỉnh và chụp trong lúc chờ.</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div role="alert" className="rounded-card border border-border bg-muted px-4 py-3">
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
                        <div className="flex flex-col gap-5">
                            <section className="rounded-card border border-border bg-card p-5 shadow-card">
                                <h3 className="mb-3 text-eyebrow uppercase text-muted-foreground">Điểm theo tiêu chí</h3>
                                <ul className="flex flex-col gap-4">
                                    {result.criteria.map((c) => (
                                        <li key={c.key}>
                                            <Bar label={c.label} value={c.score} max={c.max} />
                                            {c.comment && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.comment}</p>}
                                        </li>
                                    ))}
                                </ul>
                                {result.creativityBonus > 0 && (
                                    <p className="mt-4 rounded-card bg-success-soft px-3 py-2.5 text-[13px] leading-relaxed text-success">
                                        <b className="font-bold">Cách tiếp cận khác nhưng hiệu quả · +{result.creativityBonus} điểm sáng tạo.</b>
                                        {result.approachNote && <span className="text-foreground"> {result.approachNote}</span>}
                                    </p>
                                )}
                            </section>

                            {(result.areas.length > 0 || result.tips.length > 0) && (
                                <section aria-label="Lỗi cần chỉnh">
                                    <h3 className="mb-3 text-eyebrow uppercase text-muted-foreground">{result.areas.length > 0 ? 'Lỗi cần chỉnh' : 'Gợi ý chỉnh'}</h3>
                                    <ol className="flex flex-col gap-4">
                                        {result.areas.map((a, i) => (
                                            <li
                                                key={i}
                                                ref={(el) => {
                                                    issueRefs.current[i] = el
                                                }}
                                                onMouseEnter={() => setActive(i)}
                                                onMouseLeave={() => setActive(null)}
                                                className="scroll-mt-24"
                                            >
                                                <div className={`flex items-center gap-2.5 rounded-xl border-l-[3px] border-brand-600 bg-brand-soft px-3.5 py-2.5 transition ${active === i ? 'ring-2 ring-brand-600/40' : ''}`}>
                                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-xs font-bold text-ink-foreground">{i + 1}</span>
                                                    <b className="text-[14.5px] font-bold text-strong">{a.title}</b>
                                                </div>
                                                {a.fixes.length > 0 && (
                                                    <ul className="ml-7 mt-2 flex flex-col gap-2">
                                                        {a.fixes.map((f, k) => (
                                                            <li key={k} className="flex items-start gap-2 text-[13.5px] leading-snug text-foreground">
                                                                <ArrowRight size={13} className="mt-1 shrink-0 text-muted-foreground" aria-hidden />
                                                                <span className="min-w-0 flex-1">{f.text}</span>
                                                                {f.change && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onTry(f.change!)}
                                                                        title={`Áp vào studio: ${describeChange(f.change)}`}
                                                                        className="shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-bold text-strong transition hover:border-brand-300 hover:text-brand-ink"
                                                                    >
                                                                        Thử · {describeChange(f.change)}
                                                                    </button>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                    {result.tips.length > 0 && (
                                        <ul className="mt-4 flex flex-col gap-1.5">
                                            {result.tips.map((t) => (
                                                <li key={t} className="flex items-start gap-2 text-[13.5px] leading-snug text-muted-foreground">
                                                    <ArrowRight size={13} className="mt-1 shrink-0" aria-hidden />
                                                    {t}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
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

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
    return (
        <div className="text-[13px]">
            <div className="flex justify-between text-muted-foreground">
                {label}
                <span className="font-mono font-bold text-foreground">
                    {value}
                    <span className="font-medium text-muted-foreground">/{max}</span>
                </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-600 transition-[width] duration-slow ease-out" style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} />
            </div>
        </div>
    )
}
