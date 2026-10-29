import { useEffect, useRef, useState } from 'react'
import { Check, Clapperboard, Lamp, Lightbulb, Moon, Palette, Sparkles, Sun, X, type LucideIcon } from 'lucide-react'
import type { StudioBrief, StudioThumbTone } from '@/data/types'
import { BRIEF_GROUPS, briefConceptNames, briefGroupOf } from '@/lib/studio-briefs'

const THUMB: Record<StudioThumbTone, { bg: string; icon: LucideIcon }> = {
    orange: { bg: 'from-mm-orange', icon: Sun },
    blue: { bg: 'from-mm-blue', icon: Moon },
    pink: { bg: 'from-mm-pink', icon: Sparkles },
    yellow: { bg: 'from-mm-yellow', icon: Lamp },
    teal: { bg: 'from-mm-teal', icon: Palette },
    sky: { bg: 'from-mm-sky', icon: Lightbulb },
    red: { bg: 'from-mm-red', icon: Clapperboard },
}

/** Thumbnail đề: gradient token --mm-* + biểu tượng, chưa có ảnh minh họa thật. */
export function BriefThumb({ brief, className = '' }: { brief: StudioBrief; className?: string }) {
    const t = THUMB[brief.thumbnail.tone]
    const Icon = t.icon
    return (
        <div aria-hidden className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${t.bg} to-ink text-ink-foreground ${className}`}>
            <Icon size={34} strokeWidth={1.6} className="opacity-90" />
        </div>
    )
}

export function Difficulty({ level }: { level: number }) {
    return (
        <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Độ khó ${level}/3`}>
            {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? 'bg-brand-600' : 'bg-border'}`} />
            ))}
        </span>
    )
}

interface BriefPickerProps {
    briefs: StudioBrief[]
    currentId: string
    best: Record<string, number>
    onPick: (id: string) => void
    onClose: () => void
}

/** Hộp thoại chọn đề: bộ lọc theo nhóm khái niệm + lưới 3 cột thẻ đề. */
export function BriefPicker({ briefs, currentId, best, onPick, onClose }: BriefPickerProps) {
    const [group, setGroup] = useState<string>('all')
    const panelRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const prevFocus = document.activeElement as HTMLElement | null
        panelRef.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onClose()
            }
        }
        window.addEventListener('keydown', onKey, true)
        return () => {
            window.removeEventListener('keydown', onKey, true)
            prevFocus?.focus?.()
        }
    }, [onClose])

    const shown = group === 'all' ? briefs : briefs.filter((b) => briefGroupOf(b) === group)

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/55 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Chọn đề thực hành"
                tabIndex={-1}
                className="flex max-h-[min(86svh,760px)] w-[880px] max-w-full flex-col rounded-[24px] border border-border bg-card shadow-raised outline-none"
            >
                <header className="flex items-center justify-between gap-4 px-7 pb-3 pt-6">
                    <h2 className="text-xl font-black tracking-tight text-strong">Chọn đề thực hành</h2>
                    <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-strong">
                        <X size={18} />
                    </button>
                </header>
                <div className="flex flex-wrap gap-2 px-7 pb-4" role="group" aria-label="Lọc theo nhóm khái niệm">
                    {[{ id: 'all', title: 'Tất cả' }, ...BRIEF_GROUPS.map((g) => ({ id: g.title, title: g.title }))].map((g) => (
                        <button
                            key={g.id}
                            type="button"
                            aria-pressed={group === g.id}
                            onClick={() => setGroup(g.id)}
                            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition ${
                                group === g.id ? 'border-brand-600 bg-brand-50 text-brand-ink' : 'border-border bg-card text-muted-foreground hover:border-brand-300 hover:text-strong'
                            }`}
                        >
                            {g.title}
                        </button>
                    ))}
                </div>
                <ul className="grid min-h-0 grid-cols-3 gap-4 overflow-y-auto px-7 pb-7">
                    {shown.map((b) => {
                        const cur = b.id === currentId
                        const score = best[b.id] ?? 0
                        return (
                            <li key={b.id}>
                                <button
                                    type="button"
                                    aria-current={cur ? 'true' : undefined}
                                    onClick={() => onPick(b.id)}
                                    className={`flex h-full w-full flex-col gap-2 rounded-2xl border-2 p-3 text-left transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                                        cur ? 'border-brand-600 bg-brand-50/50' : 'border-border bg-card'
                                    }`}
                                >
                                    <BriefThumb brief={b} />
                                    <b className="text-[14.5px] font-extrabold leading-snug text-strong">{b.shortTitle}</b>
                                    <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{b.goal}</span>
                                    <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                        <Difficulty level={b.difficulty} />
                                        <span className="min-w-0 truncate">{briefConceptNames(b).join(' · ')}</span>
                                    </span>
                                    <span className="mt-auto flex items-center gap-1.5 font-mono text-xs font-bold text-strong">
                                        {score >= b.passScore && <Check size={13} strokeWidth={3} className="text-success" aria-label="đã đạt" />}
                                        {score > 0 ? `Kỷ lục: ${score} điểm` : <span className="font-sans font-semibold text-muted-foreground">Chưa thử</span>}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    )
}
