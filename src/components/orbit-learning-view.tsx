import { useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { CourseTile, COURSE_GRID } from '@/components/courses/course-tile'
import { FeaturedCourse } from '@/components/courses/featured-course'
import { SiteFooter } from '@/components/site-footer'
import { defaultCourse, STATUS_ORDER, useCourseSummaries, type CourseStatus } from '@/lib/course-map'

type Filter = 'all' | CourseStatus
const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'doing', label: 'Đang học' },
    { id: 'new', label: 'Chưa bắt đầu' },
    { id: 'done', label: 'Đã xong' },
]

/** /learning – bản đồ chặng: khóa nổi bật (mặc định khóa đang học) + lưới tất cả khóa. Khóa đang xem lưu trong ?course=id. */
export function OrbitLearningView() {
    const summaries = useCourseSummaries()
    const [params, setParams] = useSearchParams()
    const { hash } = useLocation()
    const [filter, setFilter] = useState<Filter>('all')
    const featuredRef = useRef<HTMLDivElement>(null)

    // Vào từ mô hình khuôn viên (/learning#course-<id>) cũng chọn đúng khóa đó
    const wanted = params.get('course') ?? (hash.startsWith('#course-') ? decodeURIComponent(hash.slice(8)) : null)
    const featured = summaries.find((c) => c.course.id === wanted) ?? defaultCourse(summaries)

    const totals = {
        courses: summaries.length,
        lessons: summaries.reduce((n, c) => n + c.lessons.length, 0),
        strong: summaries.reduce((n, c) => n + c.strongCount, 0),
        concepts: summaries.reduce((n, c) => n + c.conceptCount, 0),
    }
    // Khóa đang hiện ở thẻ lớn không lặp lại trong lưới
    const others = summaries.filter((c) => c.course.id !== featured?.course.id)
    const counts = (f: Filter) => (f === 'all' ? others.length : others.filter((c) => c.status === f).length)
    const list = others.filter((c) => filter === 'all' || c.status === filter).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

    const select = (id: string) => {
        setParams({ course: id }, { replace: true, preventScrollReset: true })
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        featuredRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
    }

    return (
        <div className="w-full">
            <div className="container-wide py-8 lg:py-10">
                <header className="flex flex-wrap items-center justify-between gap-6">
                    <h1 className="text-headline text-foreground">Học phần</h1>
                    <dl className="flex gap-7">
                        <Total value={String(totals.courses)} label="học phần" />
                        <Total value={String(totals.lessons)} label="bài giảng" />
                        <Total value={`${totals.strong}/${totals.concepts}`} label="khái niệm vững" />
                    </dl>
                </header>

                {!featured ? (
                    <p className="mt-10 rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khóa học nào được giảng viên xuất bản.</p>
                ) : (
                    <>
                        <div ref={featuredRef} id={`course-${featured.course.id}`} className="section-anchor mt-6">
                            <FeaturedCourse key={featured.course.id} summary={featured} />
                        </div>

                        <div className="mb-4 mt-12 flex flex-wrap items-center justify-between gap-4">
                            <h2 className="text-[22px] font-black tracking-tight text-foreground">Tất cả khóa</h2>
                            <div role="group" aria-label="Lọc khóa học" className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none]">
                                {FILTERS.map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        aria-pressed={filter === f.id}
                                        onClick={() => setFilter(f.id)}
                                        className={`flex-none rounded-full border px-3 py-[7px] text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                                            filter === f.id ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-brand-300'
                                        }`}
                                    >
                                        {f.label}
                                        <b className="ml-1.5 font-mono opacity-70">{counts(f.id)}</b>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={COURSE_GRID}>
                            {list.map((c) => (
                                <CourseTile key={c.course.id} summary={c} selected={c.course.id === featured.course.id} onSelect={() => select(c.course.id)} />
                            ))}
                            {list.length === 0 && <p className="col-span-full rounded-[20px] border-[1.5px] border-dashed border-border p-8 text-center text-muted-foreground">Chưa có khóa nào ở mục này.</p>}
                        </div>
                    </>
                )}
            </div>
            <SiteFooter />
        </div>
    )
}

function Total({ value, label }: { value: string; label: string }) {
    return (
        <div className="flex flex-col">
            <dd className="order-1 font-mono text-2xl font-bold tracking-[-0.04em] text-foreground">{value}</dd>
            <dt className="order-2 text-[13px] text-muted-foreground">{label}</dt>
        </div>
    )
}
