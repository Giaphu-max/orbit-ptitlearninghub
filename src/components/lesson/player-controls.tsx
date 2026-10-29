import { useMemo, type ReactNode } from 'react'
import { Captions, Maximize, Pause, PanelRight, Play } from 'lucide-react'
import type { Lesson } from '@/data/types'
import { formatTime } from '@/lib/youtube'
import type { QuizResult } from '@/store/useOrbitStore'

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const

interface PlayerControlsProps {
    lesson: Lesson
    currentTime: number
    duration: number
    isPlaying: boolean
    rate: number
    results: Record<string, QuizResult>
    captionsOn: boolean
    panelHidden: boolean
    onToggle: () => void
    onSeek: (sec: number) => void
    onToggleCaptions: () => void
    onRate: (rate: number) => void
    onFullscreen: () => void
    onTogglePanel: () => void
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Tô từ khóa trùng tên khái niệm trong dòng phụ đề. */
function highlight(text: string, names: string[]): ReactNode {
    if (!names.length) return text
    const re = new RegExp(`(${names.map(escapeRe).join('|')})`, 'gi')
    return text.split(re).map((part, i) =>
        i % 2 === 1 ? (
            <b key={i} className="font-bold text-brand-light">
                {part}
            </b>
        ) : (
            part
        ),
    )
}

const btn =
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground'
const btnOff = 'border-ink-foreground/35 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20'
const btnOn = 'border-ink-foreground bg-ink-foreground text-ink'

/** Phụ đề + thanh tua + điều khiển đè lên khung video (chỉ vùng control nhận chuột). */
export function PlayerControls(p: PlayerControlsProps) {
    const { lesson, currentTime, isPlaying, rate, results } = p
    const duration = Math.max(p.duration || lesson.durationSec, 1)
    const pct = (sec: number) => `${Math.min(100, Math.max(0, (sec / duration) * 100))}%`

    // Mỗi đoạn một khái niệm theo mốc bắt đầu, đoạn cuối chạy tới hết video; phần trước khái niệm đầu là "Mở đầu"
    const chapters = useMemo(() => {
        const sorted = [...lesson.concepts].sort((a, b) => a.segment.start - b.segment.start)
        const out: { name: string; start: number; end: number }[] = []
        if (sorted.length && sorted[0].segment.start > 1) out.push({ name: 'Mở đầu', start: 0, end: sorted[0].segment.start })
        sorted.forEach((c, i) => out.push({ name: c.name, start: c.segment.start, end: sorted[i + 1]?.segment.start ?? duration }))
        return out.length ? out : [{ name: lesson.title, start: 0, end: duration }]
    }, [lesson, duration])

    const names = useMemo(() => lesson.concepts.map((c) => c.name).filter(Boolean), [lesson.concepts])
    const caption = lesson.transcript.find((s) => currentTime >= s.start && currentTime < s.end)

    const seekFromPointer = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        p.onSeek(((e.clientX - rect.left) / rect.width) * duration)
    }
    const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]) + 1) % PLAYBACK_RATES.length]

    return (
        <>
            {p.captionsOn && caption && (
                <div className="pointer-events-none absolute bottom-[76px] left-1/2 z-10 max-w-[70%] -translate-x-1/2 rounded-[10px] bg-ink/70 px-4 py-2 text-center text-base font-semibold leading-snug text-ink-foreground">
                    {highlight(caption.text, names)}
                </div>
            )}

            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink/70 to-transparent px-[18px] pb-3.5 pt-8">
                <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Thanh tua video"
                    aria-valuemin={0}
                    aria-valuemax={Math.floor(duration)}
                    aria-valuenow={Math.floor(currentTime)}
                    aria-valuetext={`${formatTime(currentTime)} trên ${formatTime(duration)}`}
                    onClick={seekFromPointer}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowRight') p.onSeek(currentTime + 5)
                        if (e.key === 'ArrowLeft') p.onSeek(currentTime - 5)
                    }}
                    className="group relative flex h-[22px] cursor-pointer items-center"
                >
                    <div className="absolute inset-x-0 flex h-[5px] gap-[3px]">
                        {chapters.map((c) => (
                            <span
                                key={c.start}
                                data-c={c.name}
                                style={{ flex: Math.max(c.end - c.start, 1) }}
                                className="relative h-full rounded-sm bg-ink-foreground/30 transition-all hover:-mt-[1.5px] hover:h-2 hover:bg-ink-foreground/45 [&:hover::after]:opacity-100 after:pointer-events-none after:absolute after:bottom-3.5 after:left-1/2 after:-translate-x-1/2 after:whitespace-nowrap after:rounded-[7px] after:bg-ink after:px-2.5 after:py-1 after:text-xs after:font-bold after:text-ink-foreground after:opacity-0 after:content-[attr(data-c)]"
                            />
                        ))}
                    </div>
                    <span className="pointer-events-none absolute left-0 z-[1] h-[5px] rounded-sm bg-brand-600" style={{ width: pct(currentTime) }} />
                    {lesson.quiz.map((q) => {
                        const done = !!results[q.id]
                        return (
                            <button
                                key={q.id}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    p.onSeek(q.pauseAt)
                                }}
                                aria-label={`Tua tới quiz ${formatTime(q.pauseAt)}${done ? ', đã làm' : ''}`}
                                data-t={`Quiz ${formatTime(q.pauseAt)}${done ? ' · đã làm' : ''}`}
                                style={{ left: pct(q.pauseAt) }}
                                className={`absolute top-1/2 z-[2] -ml-1.5 -mt-1.5 h-3 w-3 rotate-45 rounded-[2px] border-2 p-0 after:pointer-events-none after:absolute after:bottom-4 after:left-1/2 after:-translate-x-1/2 after:-rotate-45 after:whitespace-nowrap after:rounded-md after:bg-ink after:px-2 after:py-1 after:text-[11.5px] after:font-semibold after:text-ink-foreground after:opacity-0 after:content-[attr(data-t)] hover:after:opacity-100 ${
                                    done ? 'border-success bg-success' : 'border-ink bg-ink-foreground'
                                }`}
                            />
                        )
                    })}
                    <span
                        className="pointer-events-none absolute z-[2] -ml-[7px] h-3.5 w-3.5 rounded-full bg-ink-foreground ring-4 ring-brand-600/50"
                        style={{ left: pct(currentTime) }}
                    />
                </div>

                <div className="mt-1.5 flex items-center gap-3.5 text-ink-foreground">
                    <button
                        type="button"
                        onClick={p.onToggle}
                        aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink-foreground text-brand-600 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground"
                    >
                        {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="ml-0.5 fill-current" />}
                    </button>
                    <span className="font-mono text-[13px] font-semibold">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <button type="button" aria-pressed={p.captionsOn} onClick={p.onToggleCaptions} className={`${btn} ${p.captionsOn ? btnOn : btnOff}`}>
                            <Captions size={15} /> Phụ đề
                        </button>
                        <button type="button" onClick={() => p.onRate(nextRate)} aria-label={`Tốc độ phát ${rate}×, bấm để đổi`} className={`${btn} ${btnOff} font-mono`}>
                            {rate}×
                        </button>
                        <button type="button" onClick={p.onFullscreen} aria-label="Toàn màn hình" className={`${btn} ${btnOff} px-2.5`}>
                            <Maximize size={15} />
                        </button>
                        <button
                            type="button"
                            aria-pressed={!p.panelHidden}
                            onClick={p.onTogglePanel}
                            title="Ẩn/hiện bảng bên (phím B)"
                            className={`${btn} ${p.panelHidden ? btnOff : btnOn}`}
                        >
                            <PanelRight size={15} /> {p.panelHidden ? 'Hiện bảng' : 'Ẩn bảng'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
