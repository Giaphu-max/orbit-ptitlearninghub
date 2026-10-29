import { Check, GitCompare, X } from 'lucide-react'
import { DIRECTOR_MIN_SCORE } from '@/lib/gamification'
import { diffRows } from '@/lib/studio-snapshot'
import { useStudioSession, type GalleryFilter, type StudioShot } from '@/store/useStudioSession'

const FILTERS: { id: GalleryFilter; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'graded', label: 'Đã chấm' },
    { id: 'ungraded', label: 'Chưa chấm' },
]

export function ScoreBadge({ shot, className = '' }: { shot: StudioShot; className?: string }) {
    if (shot.status !== 'done' || !shot.result) return null
    const good = shot.result.overall >= DIRECTOR_MIN_SCORE
    return <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold ${good ? 'bg-success text-success-foreground' : 'bg-ink/70 text-ink-foreground'} ${className}`}>{shot.result.overall}</span>
}

/** Bảng lưới phủ lên vùng canvas: lọc, mở Xem ảnh, và chế độ So sánh hai ảnh. */
export function GalleryPanel() {
    const { shots, selectedId, galleryFilter, compareMode, compareIds } = useStudioSession()
    const st = useStudioSession.getState
    const visible = shots.filter((s) => (galleryFilter === 'all' ? true : galleryFilter === 'graded' ? s.status === 'done' : s.status !== 'done'))
    // Hai ảnh so sánh xếp theo thứ tự chụp: cũ → mới
    const pair = compareIds.length === 2 ? compareIds.map((id) => shots.find((s) => s.id === id)).filter((s): s is StudioShot => Boolean(s)).sort((a, b) => shots.indexOf(a) - shots.indexOf(b)) : []

    return (
        <section aria-label="Tất cả ảnh đã chụp" className="absolute inset-0 z-10 flex flex-col bg-card/95 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <h2 className="mr-1 text-sm font-bold text-foreground">Tất cả ảnh <span className="font-mono text-xs font-medium text-muted-foreground">{shots.length}</span></h2>
                <div role="group" aria-label="Lọc ảnh" className="flex gap-1 rounded-full bg-muted p-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={galleryFilter === f.id}
                            onClick={() => st().setFilter(f.id)}
                            className={`rounded-full px-3 py-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${galleryFilter === f.id ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    aria-pressed={compareMode}
                    onClick={() => st().setCompareMode(!compareMode)}
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${compareMode ? 'border-brand-600 bg-brand-50 text-brand-ink' : 'border-border bg-muted text-foreground hover:border-brand-300'}`}
                >
                    <GitCompare size={13} /> So sánh
                </button>
                <button type="button" aria-label="Đóng bảng ảnh" onClick={() => st().setGallery(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-foreground transition hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                    <X size={15} />
                </button>
            </div>

            {compareMode && <p className="px-4 pt-2.5 text-xs text-muted-foreground">{compareIds.length < 2 ? `Chọn đúng 2 ảnh để so sánh (${compareIds.length}/2).` : 'Bấm một ảnh khác để đổi ảnh so sánh.'}</p>}

            <div className={`min-h-0 overflow-y-auto p-4 ${pair.length === 2 ? 'max-h-[38%] shrink-0 border-b border-border' : 'flex-1'}`}>
                {visible.length === 0 ? (
                    <p className="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Không có ảnh nào trong nhóm này.</p>
                ) : (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                        {visible.map((shot) => {
                            const picked = compareIds.includes(shot.id)
                            const active = compareMode ? picked : shot.id === selectedId
                            return (
                                <li key={shot.id}>
                                    <button
                                        type="button"
                                        aria-pressed={active}
                                        aria-label={`Ảnh ${shots.indexOf(shot) + 1}${shot.status === 'done' ? `, ${shot.result?.overall} điểm` : ', chưa chấm'}`}
                                        onClick={() => {
                                            if (compareMode) st().toggleCompare(shot.id)
                                            else st().openShot(shot.id)
                                        }}
                                        className={`relative block aspect-[3/2] w-full overflow-hidden rounded-xl border-2 bg-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${active ? 'border-brand-600' : 'border-transparent hover:border-brand-300'}`}
                                    >
                                        <img src={shot.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                                        <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/70 px-1.5 py-0.5 font-mono text-[11px] text-ink-foreground">{shots.indexOf(shot) + 1}</span>
                                        <ScoreBadge shot={shot} className="absolute bottom-1.5 right-1.5" />
                                        {compareMode && picked && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-ink-foreground"><Check size={12} strokeWidth={3} /></span>}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>

            {pair.length === 2 && <Compare a={pair[0]} b={pair[1]} index={(s) => shots.indexOf(s) + 1} />}
        </section>
    )
}

function Compare({ a, b, index }: { a: StudioShot; b: StudioShot; index: (s: StudioShot) => number }) {
    const diffs = diffRows(a, b)
    return (
        <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
            <div className="grid grid-cols-2 gap-3">
                {[a, b].map((s) => (
                    <figure key={s.id}>
                        <div className="relative overflow-hidden rounded-xl bg-ink">
                            <img src={s.image} alt={`Ảnh ${index(s)}`} className="block aspect-[3/2] w-full object-cover" />
                            <ScoreBadge shot={s} className="absolute bottom-1.5 right-1.5" />
                        </div>
                        <figcaption className="mt-1.5 font-mono text-xs text-muted-foreground">Ảnh {index(s)}{s.status === 'done' ? ` · ${s.result?.overall} điểm` : ' · chưa chấm'}</figcaption>
                    </figure>
                ))}
            </div>
            <h3 className="mb-2 mt-4 text-eyebrow uppercase text-muted-foreground">Khác nhau</h3>
            {diffs.length === 0 && a.status === 'done' && b.status === 'done' && a.result?.overall === b.result?.overall ? (
                <p className="text-sm text-muted-foreground">Hai ảnh dùng cùng thiết lập.</p>
            ) : (
                <ul className="flex flex-col gap-1.5 text-[13px]">
                    {diffs.map((d) => (
                        <li key={d.label} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-muted px-3 py-1.5">
                            <span className="text-foreground">{d.label}</span>
                            <span className="font-mono font-semibold text-foreground">{d.from} <span className="text-brand-ink">→</span> {d.to}</span>
                        </li>
                    ))}
                    {a.status === 'done' && b.status === 'done' && (
                        <li className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-brand-soft px-3 py-1.5">
                            <span className="text-brand-ink">Điểm</span>
                            <span className="font-mono font-semibold text-brand-ink">{a.result?.overall} → {b.result?.overall}</span>
                        </li>
                    )}
                    {diffs.length === 0 && <li className="text-muted-foreground">Hai ảnh dùng cùng thiết lập.</li>}
                </ul>
            )}
        </div>
    )
}
