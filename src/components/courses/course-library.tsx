import { useState } from 'react'
import { CourseArt } from '@/components/courses/course-cover'
import { STATUS_ORDER, type CourseStatus, type CourseSummary } from '@/lib/course-map'

type Filter = 'all' | CourseStatus
const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'doing', label: 'Đang học' },
    { id: 'new', label: 'Chưa học' },
    { id: 'done', label: 'Đã xong' },
]
const STATE_LABEL: Record<CourseStatus, string> = { doing: 'đang học', new: 'chưa bắt đầu', done: 'đã xong' }
const RING = 113.1 // 2π · 18

/** Khối phải của /learning: số liệu, thanh lọc segmented và danh sách học phần; bấm một hàng thì chọn khóa đó ở khối trái. */
export function CourseLibrary({ summaries, selectedId, onSelect }: { summaries: CourseSummary[]; selectedId?: string; onSelect: (id: string) => void }) {
    const [filter, setFilter] = useState<Filter>('all')
    const lessons = summaries.reduce((n, c) => n + c.lessons.length, 0)
    const strong = summaries.reduce((n, c) => n + c.strongCount, 0)
    const concepts = summaries.reduce((n, c) => n + c.conceptCount, 0)
    const list = summaries.filter((c) => filter === 'all' || c.status === filter).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

    return (
        <aside className="col-span-4 flex flex-col">
            <h2 className="mb-3 flex items-baseline text-[15px] font-extrabold text-strong">
                Học phần của bạn<em className="ml-1.5 font-mono text-[13px] font-bold not-italic text-muted-foreground">{summaries.length}</em>
            </h2>
            <div className="flex-1 rounded-[22px] border border-border bg-card px-4 pb-2.5 pt-[18px] shadow-card">
                <p className="flex gap-5 px-1.5 pb-3.5 text-[13.5px] text-muted-foreground">
                    <span><b className="mr-1 font-mono text-[15px] font-extrabold text-strong">{lessons}</b>bài giảng</span>
                    <span><b className="mr-1 font-mono text-[15px] font-extrabold text-strong">{strong}/{concepts}</b>khái niệm vững</span>
                </p>
                <div role="group" aria-label="Lọc học phần" className="mb-1.5 flex gap-1 rounded-xl bg-muted p-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={filter === f.id}
                            onClick={() => setFilter(f.id)}
                            className={`flex-1 rounded-[9px] px-1.5 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${filter === f.id ? 'bg-card text-strong shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <ul>
                    {list.map((c) => {
                        const on = c.course.id === selectedId
                        const sub = c.status === 'doing' ? `Chặng ${c.curIndex + 1}/${c.lessons.length} · ${c.minutes} phút video` : `${c.lessons.length} bài · ${c.minutes} phút`
                        return (
                            <li key={c.course.id}>
                                <button
                                    type="button"
                                    aria-current={on ? 'true' : undefined}
                                    onClick={() => onSelect(c.course.id)}
                                    className={`grid w-full grid-cols-[64px_1fr_auto] items-center gap-3.5 rounded-[14px] p-3 text-left transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${on ? 'bg-brand-50' : 'hover:bg-muted'}`}
                                >
                                    <span className="relative block h-16 w-16 overflow-hidden rounded-[14px]">
                                        <CourseArt course={c.course} className="h-full w-full" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.06em] text-brand-ink">{c.course.subject} · {STATE_LABEL[c.status]}</span>
                                        <b className="block text-[15px] font-extrabold leading-[1.3] text-strong">{c.course.title}</b>
                                        <small className="mt-0.5 block text-[12.5px] text-muted-foreground">{sub}</small>
                                    </span>
                                    {c.status === 'new' ? (
                                        <span className="whitespace-nowrap text-[13px] font-extrabold text-brand-ink">Bắt đầu →</span>
                                    ) : (
                                        <span className="relative h-11 w-11" role="img" aria-label={`Tiến độ ${c.pct}%`}>
                                            <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90" aria-hidden>
                                                <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-muted" />
                                                <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - c.pct / 100)} className="stroke-brand-600" />
                                            </svg>
                                            <b className="absolute inset-0 grid place-items-center font-mono text-[11px] font-bold text-strong">{c.pct}%</b>
                                        </span>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                    {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Chưa có học phần nào ở mục này.</li>}
                </ul>
            </div>
        </aside>
    )
}
