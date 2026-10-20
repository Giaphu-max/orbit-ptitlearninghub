import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ClipboardCheck, Play } from 'lucide-react'
import { courses } from '@/data'
import { coursePercent, formatDuration, lessonPercent, lessonState, nextLesson } from '@/lib/course-progress'
import { useCourseLessons } from '@/lib/lesson-edits'
import { useOrbitStore } from '@/store/useOrbitStore'
import { SectionHeading } from '@/components/section-heading'

/** Khóa học thật từ src/data: thẻ lớn của khóa (tiến độ, vào học, test) + thẻ từng bài kèm tiến độ. */
export function CoursesSection() {
    const [selectedId, setSelectedId] = useState(courses[0]?.id)
    const course = courses.find((c) => c.id === selectedId) ?? courses[0]
    const lessons = useCourseLessons(course?.id)
    const progress = useOrbitStore((s) => s.lessonProgress)
    const record = useOrbitStore((s) => (course ? s.testRecords[course.id] : undefined))

    return (
        <section id="courses" aria-labelledby="courses-title" className="section-anchor">
            <SectionHeading id="courses-title" eyebrow="Khóa học" title="Học theo chặng, có đích.">
                <Link to="/learning" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground shadow-card transition hover:border-brand-300">
                    Xem tất cả khóa học <ArrowRight size={15} />
                </Link>
            </SectionHeading>

            {courses.length > 1 && (
                <ul className="mt-6 flex flex-wrap gap-2" aria-label="Chọn khóa học">
                    {courses.map((c) => (
                        <li key={c.id}>
                            <button
                                type="button"
                                aria-pressed={c.id === course?.id}
                                onClick={() => setSelectedId(c.id)}
                                className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                                    c.id === course?.id ? 'border-brand-600 bg-brand-600 text-ink-foreground' : 'border-border bg-card text-foreground hover:border-brand-300'
                                }`}
                            >
                                {c.title}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {!course || lessons.length === 0 ? (
                <p className="mt-7 rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khóa học nào được giảng viên xuất bản.</p>
            ) : (
                <div className="mt-7 grid gap-5 lg:grid-cols-3 lg:grid-rows-3">
                    <CourseCard
                        title={course.title}
                        subject={course.subject}
                        description={course.description}
                        percent={coursePercent(lessons, progress)}
                        lessonCount={lessons.length}
                        doneCount={lessons.filter((l) => lessonState(l, progress) === 'done').length}
                        nextLessonId={nextLesson(lessons, progress)?.id}
                        courseId={course.id}
                        testLabel={record ? `Test cuối chương · tốt nhất ${record.bestCorrect}/${record.bestTotal}` : 'Làm test cuối chương'}
                    />
                    {lessons.slice(0, 3).map((l, i) => {
                        const pct = lessonPercent(l, progress)
                        const state = lessonState(l, progress)
                        return (
                            <Link
                                key={l.id}
                                to={`/lesson/${l.id}`}
                                data-vt={`lesson-${l.id}`}
                                className={`group flex min-h-[140px] flex-col justify-between rounded-3xl border p-6 transition duration-base ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                                    state === 'done' ? 'border-transparent bg-muted' : 'border-border bg-card shadow-card hover:-translate-y-1 hover:border-brand-200 hover:shadow-raised'
                                }`}
                            >
                                <div>
                                    <p className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                                        <span>
                                            Bài {String(i + 1).padStart(2, '0')} · {formatDuration(l.durationSec)}
                                        </span>
                                        {state === 'done' && <Check size={16} className="text-success" />}
                                    </p>
                                    <h3 className={`mt-3 line-clamp-3 text-lg font-extrabold leading-snug tracking-tight ${state === 'done' ? 'text-muted-foreground' : 'text-foreground'}`}>{l.title}</h3>
                                </div>
                                <div className="mt-5 flex items-center gap-3">
                                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${l.title}`}>
                                        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                                    </span>
                                    <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function CourseCard({
    title,
    subject,
    description,
    percent,
    lessonCount,
    doneCount,
    nextLessonId,
    courseId,
    testLabel,
}: {
    title: string
    subject: string
    description: string
    percent: number
    lessonCount: number
    doneCount: number
    nextLessonId?: string
    courseId: string
    testLabel: string
}) {
    return (
        <article className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[28px] border border-border bg-card p-7 shadow-card lg:col-span-2 lg:row-span-3 lg:p-9">
            <div>
                <span className="inline-flex rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-extrabold text-brand-ink">{subject}</span>
                <h3 className="mt-6 max-w-xl text-[clamp(1.75rem,3.2vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">{title}</h3>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <div>
                <div className="mt-8 flex items-center gap-4">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ khóa học">
                        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="font-mono text-sm font-semibold text-foreground">{percent}%</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                    {doneCount}/{lessonCount} bài hoàn thành
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                    {nextLessonId && (
                        <Link to={`/lesson/${nextLessonId}`} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                            <Play size={15} className="fill-current" /> {percent > 0 ? 'Học tiếp' : 'Bắt đầu học'}
                        </Link>
                    )}
                    <Link to={`/test/${courseId}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted">
                        <ClipboardCheck size={15} /> {testLabel}
                    </Link>
                </div>
            </div>
        </article>
    )
}
