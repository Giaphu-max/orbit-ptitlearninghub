import { useEffect, useRef, useState } from 'react'
import type { TranscriptSegment } from '@/data/types'
import { formatTime } from '@/lib/youtube'

interface TranscriptPanelProps {
    transcript: TranscriptSegment[]
    currentTime: number
    onSeek: (sec: number) => void
}

/** Tab Transcript: dòng đang phát nền đỏ nhạt + vạch trái, tự cuộn theo video; bấm một dòng để tua. */
export function TranscriptPanel({ transcript, currentTime, onSeek }: TranscriptPanelProps) {
    const listRef = useRef<HTMLOListElement>(null)
    const [follow, setFollow] = useState(true)
    const activeIndex = transcript.findIndex((s) => currentTime >= s.start && currentTime < s.end)

    useEffect(() => {
        const list = listRef.current
        if (!follow || !list || activeIndex < 0) return
        const item = list.children[activeIndex] as HTMLElement | undefined
        // Tab đang ẩn (display: none) thì offsetTop = 0, không cuộn
        if (!item || !list.clientHeight) return
        // Chỉ cuộn trong khung transcript, không kéo cả trang (list là offsetParent nhờ class relative)
        const target = item.offsetTop - list.clientHeight / 3
        list.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    }, [activeIndex, follow])

    return (
        <div className="flex h-full min-h-0 flex-col">
            <ol ref={listRef} aria-label="Transcript bài giảng" className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-4">
                {transcript.map((seg, i) => {
                    const isActive = i === activeIndex
                    return (
                        <li key={seg.start}>
                            <button
                                type="button"
                                onClick={() => onSeek(seg.start)}
                                aria-current={isActive ? 'true' : undefined}
                                className={`grid w-full grid-cols-[48px_1fr] gap-2.5 rounded-xl px-2.5 py-[9px] text-left text-sm leading-[1.55] transition duration-fast ${
                                    isActive ? 'bg-brand-50 font-semibold text-strong shadow-[inset_3px_0_0_hsl(var(--brand))]' : 'text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                <span className={`pt-0.5 font-mono text-xs font-semibold ${isActive ? 'text-brand-ink' : 'text-muted-foreground/70'}`}>{formatTime(seg.start)}</span>
                                <span>{seg.text}</span>
                            </button>
                        </li>
                    )
                })}
            </ol>
            <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-[12.5px] text-muted-foreground">
                <span>Bấm một dòng để tua</span>
                <label className="flex cursor-pointer select-none items-center gap-2 font-bold text-brand-ink">
                    <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />
                    Tự cuộn theo video
                </label>
            </div>
        </div>
    )
}
