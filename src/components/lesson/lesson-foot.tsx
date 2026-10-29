import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Info } from 'lucide-react'
import type { Lesson } from '@/data/types'
import { formatTime } from '@/lib/youtube'

interface LessonFootProps {
    lesson: Lesson
    nextLesson?: Lesson
    onSeek: (sec: number) => void
}

/** Hàng dưới: giới thiệu bài thu gọn (mở ra mô tả + chip khái niệm) và link bài tiếp / kiểm tra nhanh. */
export function LessonFootLeft({ lesson, onSeek }: Pick<LessonFootProps, 'lesson' | 'onSeek'>) {
    return (
        <details className="group relative min-w-0">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2.5 text-sm font-bold text-muted-foreground transition hover:text-strong [&::-webkit-details-marker]:hidden">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border">
                    <Info size={13} aria-hidden />
                </span>
                Giới thiệu bài · {lesson.concepts.length} khái niệm
                <ChevronDown size={13} className="transition-transform duration-fast group-open:rotate-180" aria-hidden />
            </summary>
            <div className="pb-1 pt-2">
                <p className="max-w-[90ch] text-[15px] leading-relaxed text-muted-foreground">{lesson.summary}</p>
                {lesson.origin === 'sample' && (
                    <p className="mt-2 inline-block rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-muted-foreground">Dữ liệu mẫu để dựng giao diện</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                    {lesson.concepts.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => onSeek(c.segment.start)}
                            title={c.definition}
                            className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-[7px] text-[13.5px] transition hover:border-brand-200"
                        >
                            <b className="font-bold text-strong">{c.name}</b>
                            <span className="font-mono text-[11.5px] font-bold text-brand-ink">{formatTime(c.segment.start)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </details>
    )
}

export function LessonNextLink({ lesson, nextLesson }: Pick<LessonFootProps, 'lesson' | 'nextLesson'>) {
    const to = nextLesson ? `/lesson/${nextLesson.id}` : `/checkpoint/${lesson.id}`
    return (
        <Link to={to} className="inline-flex h-8 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-strong">
            {nextLesson ? (
                <>
                    Bài tiếp: {nextLesson.shortTitle ?? nextLesson.title}
                </>
            ) : (
                'Làm kiểm tra nhanh'
            )}
            <ArrowRight size={15} className="text-brand-ink" aria-hidden />
        </Link>
    )
}
