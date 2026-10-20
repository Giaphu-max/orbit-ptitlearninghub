import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { FALLBACK_BG, Thumb } from '@/components/courses/featured-course'
import { SectionHeading } from '@/components/section-heading'
import { STATUS_ORDER, subjectVars, useCourseSummaries, type CourseSummary } from '@/lib/course-map'
import '@/components/courses/course-map.css'

const MAX_CARDS = 3

/** Trang chủ: một hàng thẻ khóa ngang (tối đa 3, đang học trước). Bản đồ chặng đầy đủ ở /learning. */
export function CoursesSection() {
    const summaries = useCourseSummaries()
    const cards = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]).slice(0, MAX_CARDS)

    return (
        <section id="courses" aria-labelledby="courses-title" className="section-anchor">
            <SectionHeading id="courses-title" eyebrow="Khóa học" title="Học theo chặng, có đích.">
                {summaries.length > MAX_CARDS && (
                    <Link to="/learning" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground shadow-card transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
                        Xem tất cả khóa học <ArrowRight size={15} />
                    </Link>
                )}
            </SectionHeading>

            {cards.length === 0 ? (
                <p className="mt-7 rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khóa học nào được giảng viên xuất bản.</p>
            ) : (
                // Cột bằng nhau, số cột = min(số khóa, 3) nên hàng luôn đầy; mobile cuộn ngang có snap
                <ul
                    style={{ ['--cols' as string]: cards.length }}
                    className="-mx-[var(--gutter)] mt-7 flex snap-x snap-mandatory scroll-px-[var(--gutter)] gap-4 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:none] min-[760px]:mx-0 min-[760px]:grid min-[760px]:grid-cols-[repeat(var(--cols),minmax(0,1fr))] min-[760px]:overflow-visible min-[760px]:px-0 min-[760px]:pb-0 lg:gap-5"
                >
                    {cards.map((c) => (
                        <li key={c.course.id} className="w-[84%] shrink-0 snap-start min-[760px]:w-auto min-[760px]:shrink">
                            <CourseCard summary={c} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

function CourseCard({ summary }: { summary: CourseSummary }) {
    const { course, lessons, status, pct, pcts, curIndex, fill, minutes, record } = summary
    const lesson = lessons[curIndex] ?? lessons[0]
    const passed = record && record.bestTotal > 0 && record.bestCorrect / record.bestTotal >= 0.7
    const sub =
        status === 'doing'
            ? `Chặng ${curIndex + 1}/${lessons.length} · ${pct}%`
            : status === 'done'
              ? `Đã xong · test ${record ? `${record.bestCorrect}/${record.bestTotal}` : 'chưa làm'}`
              : `${lessons.length} bài · ${minutes} phút`
    const action = status === 'done' ? 'Xem lại' : pct > 0 ? 'Học tiếp' : 'Bắt đầu'

    return (
        <article style={subjectVars(course.subject)} className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-border bg-card shadow-card transition duration-base ease-out focus-within:ring-2 focus-within:ring-ring/60 hover:-translate-y-[3px] hover:shadow-raised">
            {/* Bấm phần còn lại của thẻ → bản đồ chặng của khóa; nút nhỏ bên dưới nằm trên lớp này */}
            <Link to={`/learning?course=${course.id}`} aria-label={`Xem khóa ${course.title}`} className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-none" />
            <div className={`relative aspect-[16/7] overflow-hidden ${status === 'new' ? 'saturate-[.45]' : ''}`} style={{ background: FALLBACK_BG }}>
                {lesson && <Thumb youtubeId={lesson.youtubeId} />}
                {status === 'doing' && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/65 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-foreground">
                        <span aria-hidden className="h-2 w-2 rounded-full bg-brand-500" />
                        Đang học
                    </span>
                )}
            </div>
            <div className="pointer-events-none relative flex flex-1 flex-col gap-2 p-5">
                <span className="cm-chip self-start rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">{course.subject}</span>
                <h3 className="line-clamp-2 text-lg font-extrabold leading-snug tracking-tight text-foreground">{course.title}</h3>
                <span className="cm-mini mt-1" style={{ ['--f' as string]: fill }} aria-hidden>
                    {lessons.map((l, j) => (
                        <i key={l.id} className={pcts[j] >= 100 ? 'd' : j === curIndex && status === 'doing' ? 'c' : ''} />
                    ))}
                    <i className={`f ${passed ? 'd' : ''}`} />
                </span>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <span className={`text-[13px] ${status === 'doing' ? 'font-bold text-brand-ink' : 'text-muted-foreground'}`}>{sub}</span>
                    {lesson && (
                        <Link
                            to={`/lesson/${lesson.id}`}
                            data-vt={`lesson-${lesson.id}`}
                            className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[13px] font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                        >
                            <span aria-hidden className="border-y-[5px] border-l-[8px] border-y-transparent border-l-ink-foreground" />
                            {action}
                        </Link>
                    )}
                </div>
            </div>
        </article>
    )
}
