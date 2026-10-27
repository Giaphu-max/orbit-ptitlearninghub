import { useEffect, useRef, useState } from 'react'
import { ListVideo } from 'lucide-react'
import type { TranscriptSegment } from '@/data/types'
import { formatTime } from '@/lib/youtube'

interface TranscriptPanelProps {
    transcript: TranscriptSegment[]
    currentTime: number
    onSeek: (sec: number) => void
}

/** Transcript có mốc giờ: đoạn đang phát được tô đậm và tự cuộn theo; bấm để tua. */
export function TranscriptPanel({ transcript, currentTime, onSeek }: TranscriptPanelProps) {
    const listRef = useRef<HTMLOListElement>(null)
    const [follow, setFollow] = useState(true)
    const activeIndex = transcript.findIndex((s) => currentTime >= s.start && currentTime < s.end)

    useEffect(() => {
        const list = listRef.current
        if (!follow || !list || activeIndex < 0) return
        const item = list.children[activeIndex] as HTMLElement | undefined
        if (!item) return
        // Chỉ cuộn trong khung transcript, không kéo cả trang (list là offsetParent nhờ class relative)
        const target = item.offsetTop - list.clientHeight / 3
        list.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    }, [activeIndex, follow])

    return (
        <section aria-label="Transcript bài giảng" className="flex flex-col rounded-card border border-border bg-card shadow-card">
            <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
                <h2 className="flex items-center gap-2 font-bold text-foreground">
                    <ListVideo size={18} className="text-brand-ink" /> Transcript
                </h2>
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={follow}
                        onChange={(e) => setFollow(e.target.checked)}
                        className="h-3.5 w-3.5 accent-brand-600"
                    />
                    Tự cuộn theo video
                </label>
            </header>
            <ol ref={listRef} className="relative max-h-[420px] space-y-1 overflow-y-auto overscroll-contain p-3">
                {transcript.map((seg, i) => {
                    const isActive = i === activeIndex
                    return (
                        <li key={seg.start}>
                            <button
                                type="button"
                                onClick={() => onSeek(seg.start)}
                                aria-current={isActive ? 'true' : undefined}
                                className={`flex w-full gap-3.5 rounded-xl px-3 py-2.5 text-left transition duration-fast ${
                                    isActive
                                        ? 'bg-brand-50/80 dark:bg-brand-950/40 font-semibold text-foreground border-l-2 border-brand-600 pl-3.5 shadow-2xs'
                                        : 'text-muted-foreground/65 hover:text-foreground hover:bg-muted/40 transition-opacity'
                                }`}
                            >
                                <span className={`shrink-0 pt-0.5 font-mono text-xs ${isActive ? 'font-bold text-brand-ink' : 'text-muted-foreground/60'}`}>
                                    {formatTime(seg.start)}
                                </span>
                                <span className={`text-[15px] leading-relaxed ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground/70'}`}>{seg.text}</span>
                            </button>
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
