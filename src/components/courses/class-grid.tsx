import { useState } from 'react'
import { ChevronDown, Play, Search } from 'lucide-react'
import { CourseArt } from '@/components/courses/course-cover'
import { LOGO_URL } from '@/lib/brand'
import { STATUS_ORDER, type CourseStatus, type CourseSummary } from '@/lib/course-map'
import { upcomingCourses } from '@/data/upcoming-courses'
import type { Course } from '@/data/types'

type Filter = 'all' | CourseStatus
const STATUS_OPTIONS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tất cả tiến độ' },
    { id: 'doing', label: 'Đang học' },
    { id: 'new', label: 'Chưa học' },
    { id: 'done', label: 'Đã xong' },
]
// Học kỳ: dữ liệu mẫu, chỉ có một học kỳ hiện tại
const SEMESTER = 'Học kỳ 1 · 2026–2027'

const selectCls = 'h-11 appearance-none rounded-full border border-border bg-card pl-4 pr-10 text-sm font-semibold text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

/** Hàng 3 của /learning: "Lớp học phần" – tìm kiếm, chọn học kỳ / tiến độ, lưới 4 thẻ (mỗi thẻ 3 cột). Học phần "Sắp mở" là dữ liệu mẫu. */
export function ClassGrid({ summaries, selectedId, onSelect, onUpcoming }: { summaries: CourseSummary[]; selectedId?: string; onSelect: (id: string) => void; onUpcoming: () => void }) {
    const [q, setQ] = useState('')
    const [status, setStatus] = useState<Filter>('all')
    const match = (c: Course) => !q.trim() || norm(c.title).includes(norm(q)) || norm(c.classCode ?? '').includes(norm(q))
    const list = summaries.filter((c) => match(c.course) && (status === 'all' || c.status === status)).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    const soon = status === 'all' ? upcomingCourses.filter(match) : []

    return (
        <section aria-labelledby="class-title" className="mt-11">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 id="class-title" className="text-[28px] font-extrabold tracking-[-0.02em] text-strong">Lớp học phần</h2>
                <div className="flex flex-wrap items-center gap-2.5">
                    <label className="relative block">
                        <span className="sr-only">Tìm lớp học phần</span>
                        <Search size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm lớp học phần…" className="h-11 w-80 rounded-full border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70" />
                    </label>
                    <label className="relative block">
                        <span className="sr-only">Học kỳ</span>
                        <select className={selectCls} defaultValue={SEMESTER}>
                            <option>{SEMESTER}</option>
                        </select>
                        <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </label>
                    <label className="relative block">
                        <span className="sr-only">Lọc theo tiến độ</span>
                        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as Filter)}>
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </label>
                </div>
            </div>
            <ul className="grid grid-cols-12 gap-6">
                {list.map((c) => (
                    <li key={c.course.id} className="col-span-3">
                        <Card course={c.course} lessons={c.lessons.length} onClick={() => onSelect(c.course.id)} current={c.course.id === selectedId}>
                            <span className="ml-auto flex items-center gap-2">
                                <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${c.course.title}`}>
                                    <i className="block h-full rounded-full bg-brand-600" style={{ width: `${c.pct}%` }} />
                                </span>
                                <b className="font-mono text-[13px] font-bold text-strong">{c.pct}%</b>
                            </span>
                        </Card>
                    </li>
                ))}
                {soon.map((c) => (
                    <li key={c.id} className="col-span-3">
                        <Card course={c} lessons={0} soon onClick={onUpcoming}>
                            <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Sắp mở</span>
                        </Card>
                    </li>
                ))}
                {list.length + soon.length === 0 && <li className="col-span-12 rounded-[20px] border-[1.5px] border-dashed border-border p-8 text-center text-muted-foreground">Không có lớp học phần nào khớp.</li>}
            </ul>
        </section>
    )
}

function Card({ course, lessons, soon, current, onClick, children }: { course: Course; lessons: number; soon?: boolean; current?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={current ? 'true' : undefined}
            className="group flex h-full w-full flex-col rounded-[20px] border border-border bg-card p-3.5 text-left shadow-card transition duration-base ease-out hover:-translate-y-1 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
            <span className={`relative block aspect-video overflow-hidden rounded-xl ${soon ? 'saturate-[.55]' : ''}`}>
                <CourseArt course={course} className="h-full w-full" />
                {course.classCode && <span className="absolute bottom-2 left-2 rounded-md bg-card/90 px-2 py-1 font-mono text-xs font-semibold text-strong">{course.classCode}</span>}
            </span>
            <span className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                {soon ? 'Đang soạn' : (<><Play size={11} className="fill-current" /> {lessons} bài học</>)}
            </span>
            <b className="mt-1 text-[17px] font-extrabold leading-snug text-strong">{course.title}</b>
            <span className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-sm font-extrabold text-brand-ink" style={{ marginTop: 14 }}>
                {LOGO_URL && <img src={LOGO_URL} alt="" className="h-6 w-6 object-contain" />}
                PTIT
                {children}
            </span>
        </button>
    )
}
