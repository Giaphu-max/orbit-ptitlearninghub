import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { getLesson } from '@/data'
import type { SourceRef } from '@/data/types'
import { lessonShortTitle } from '@/lib/utils'
import { formatTime } from '@/lib/youtube'

/** Một chip "Nguồn · n" cho cả khối; bấm mới mở danh sách mốc (tên bài rút gọn). */
export function SourceChip({ sources, articleId }: { sources: SourceRef[]; articleId?: string }) {
    const [open, setOpen] = useState(false)
    const listId = useId()
    if (!sources.length) return null
    return (
        <div className="mt-3">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:border-brand-300 hover:text-foreground"
            >
                Nguồn · {sources.length}
                <ChevronDown size={12} className={`transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul id={listId} className="mt-2 flex flex-col gap-1">
                    {sources.map((src) => {
                        const lesson = getLesson(src.lessonId)
                        const full = lesson?.title ?? src.lessonId
                        const href = `/lesson/${src.lessonId}?t=${src.start}${articleId ? `&fromDaily=${encodeURIComponent(articleId)}` : ''}`
                        return (
                            <li key={`${src.lessonId}-${src.start}`}>
                                <Link
                                    to={href}
                                    title={full}
                                    aria-label={`${full}, mốc ${formatTime(src.start)}`}
                                    className="inline-flex max-w-full items-center gap-2 rounded-lg px-2 py-1 text-sm text-foreground transition hover:bg-muted"
                                >
                                    <span className="font-mono text-xs font-bold text-brand-ink">{formatTime(src.start)}</span>
                                    <span className="truncate">{lesson ? lessonShortTitle(lesson) : src.lessonId}</span>
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
