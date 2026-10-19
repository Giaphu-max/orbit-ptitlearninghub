import type { Lesson } from '@/data/types'
import { formatTime } from '@/lib/youtube'

interface ConceptTimelineProps {
    lesson: Lesson
    currentTime: number
    onSeek: (sec: number) => void
}

/**
 * Dải "chương" dưới video: mỗi khái niệm là một đoạn bấm để tua tới,
 * chấm đỏ là điểm video sẽ dừng hỏi quiz.
 */
export function ConceptTimeline({ lesson, currentTime, onSeek }: ConceptTimelineProps) {
    const duration = Math.max(lesson.durationSec, 1)
    const pct = (sec: number) => `${Math.min(100, Math.max(0, (sec / duration) * 100))}%`
    const active = lesson.concepts.find((c) => currentTime >= c.segment.start && currentTime < c.segment.end)

    return (
        <section aria-label="Các khái niệm trong bài" className="rounded-card border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-baseline justify-between gap-4">
                <p className="text-eyebrow uppercase text-gray-500">Khái niệm trong bài</p>
                <p className="font-mono text-xs text-gray-500">
                    {formatTime(currentTime)} / {formatTime(lesson.durationSec)}
                </p>
            </div>

            <div className="relative h-9">
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-100" />
                <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-200" style={{ width: pct(currentTime) }} />
                {lesson.concepts.map((c) => {
                    const isActive = active?.id === c.id
                    return (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => onSeek(c.segment.start)}
                            title={`${c.name} · ${formatTime(c.segment.start)}`}
                            aria-label={`Tua tới khái niệm ${c.name}, ${formatTime(c.segment.start)}`}
                            className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full border-2 border-white transition duration-fast hover:h-4 ${isActive ? 'bg-brand-600' : 'bg-gray-400 hover:bg-brand-400'}`}
                            style={{ left: pct(c.segment.start), width: `calc(${pct(c.segment.end - c.segment.start)} - 2px)` }}
                        />
                    )
                })}
                {lesson.quiz.map((q) => (
                    <span
                        key={q.id}
                        className="pointer-events-none absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-brand-600 ring-2 ring-white"
                        style={{ left: pct(q.pauseAt) }}
                        title={`Câu hỏi ở ${formatTime(q.pauseAt)}`}
                    />
                ))}
                <span
                    className="pointer-events-none absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900"
                    style={{ left: pct(currentTime) }}
                />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {lesson.concepts.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => onSeek(c.segment.start)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-fast ${
                            active?.id === c.id
                                ? 'border-brand-200 bg-brand-50 text-brand-700'
                                : 'border-border bg-white text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <span className="font-mono text-[11px] text-gray-500">{formatTime(c.segment.start)}</span>
                        {c.name}
                    </button>
                ))}
            </div>
        </section>
    )
}
