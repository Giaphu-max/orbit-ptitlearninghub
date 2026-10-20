import { Link } from 'react-router-dom'
import { Check, ClipboardCheck, Play } from 'lucide-react'
import { courses } from '@/data'
import type { Course } from '@/data/types'
import { coursePercent, formatDuration, lessonPercent, lessonState, nextLesson } from '@/lib/course-progress'
import { useCourseLessons, useReviewStatus } from '@/lib/lesson-edits'
import { useOrbitStore } from '@/store/useOrbitStore'
import { SiteFooter } from '@/components/site-footer'

/** /learning – khóa học thật từ src/data: tiến độ, danh sách bài, vào từng bài và làm test cuối chương. */
export function OrbitLearningView() {
    return (
        <div className="w-full">
            <div className="container-page flex flex-col gap-10 py-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Khóa học</p>
                    <h1 className="mt-2 text-[clamp(2rem,4.6vw,3.25rem)] font-black leading-none tracking-[-0.04em] text-foreground">Học theo chặng, có đích.</h1>
                    <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                        Mỗi khóa gồm các bài giảng video có trợ giảng AI và câu hỏi ngay trong bài. Học xong thì làm test cuối chương để biết khái niệm nào còn hổng.
                    </p>
                </header>

                <div className="flex flex-col gap-8">
                    {courses.map((c) => (
                        <CourseBlock key={c.id} course={c} />
                    ))}
                    {courses.length === 0 && <p className="rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khóa học nào.</p>}
                </div>
            </div>
            <SiteFooter />
        </div>
    )
}

function CourseBlock({ course }: { course: Course }) {
    const lessons = useCourseLessons(course.id)
    const progress = useOrbitStore((s) => s.lessonProgress)
    const record = useOrbitStore((s) => s.testRecords[course.id])
    const percent = coursePercent(lessons, progress)
    const done = lessons.filter((l) => lessonState(l, progress) === 'done').length
    const totalSec = lessons.reduce((n, l) => n + l.durationSec, 0)
    const conceptCount = lessons.reduce((n, l) => n + l.concepts.length, 0)
    const next = nextLesson(lessons, progress)

    return (
        <article aria-labelledby={`course-${course.id}`} className="overflow-hidden rounded-[28px] border border-border bg-card shadow-card">
            <div className="p-7 lg:p-9">
                <span className="inline-flex rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-extrabold text-brand-ink">{course.subject}</span>
                <h2 id={`course-${course.id}`} className="mt-5 max-w-3xl text-[clamp(1.75rem,3.2vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
                    {course.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">Giảng viên: {course.instructor}</p>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{course.description}</p>

                <div className="mt-7 flex items-center gap-4">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ khóa ${course.title}`}>
                        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="font-mono text-sm font-semibold text-foreground">{percent}%</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                    {done}/{lessons.length} bài hoàn thành · {formatDuration(totalSec)} video · {conceptCount} khái niệm
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                    {next && (
                        <Link to={`/lesson/${next.id}`} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                            <Play size={15} className="fill-current" /> {percent > 0 ? 'Học tiếp' : 'Bắt đầu học'}
                        </Link>
                    )}
                    <Link to={`/test/${course.id}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted">
                        <ClipboardCheck size={15} className="shrink-0" />
                        <span>
                            Làm test cuối chương
                            {record && <span className="text-muted-foreground"> · tốt nhất <span className="font-mono">{record.bestCorrect}/{record.bestTotal}</span></span>}
                        </span>
                    </Link>
                </div>
            </div>

            <div className="border-t border-border bg-muted/50 p-4 sm:p-6 lg:px-9">
                <h3 className="px-2 text-eyebrow uppercase text-muted-foreground">Danh sách bài</h3>
                {lessons.length === 0 ? (
                    <p className="mt-3 px-2 text-sm text-muted-foreground">Chưa có bài nào được giảng viên xuất bản.</p>
                ) : (
                    <ol className="mt-3 flex flex-col gap-2">
                        {lessons.map((l, i) => (
                            <LessonRow key={l.id} index={i} lesson={l} />
                        ))}
                    </ol>
                )}
            </div>
        </article>
    )
}

function LessonRow({ index, lesson }: { index: number; lesson: ReturnType<typeof useCourseLessons>[number] }) {
    const progress = useOrbitStore((s) => s.lessonProgress)
    const status = useReviewStatus(lesson)
    const pct = lessonPercent(lesson, progress)
    const state = lessonState(lesson, progress)
    const action = state === 'done' ? 'Xem lại' : state === 'doing' ? 'Học tiếp' : 'Vào bài'

    return (
        <li className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-card p-4 sm:flex-nowrap">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-bold text-foreground">
                {state === 'done' ? <Check size={16} className="text-success" /> : String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1 basis-56">
                <p className="font-bold leading-snug text-foreground">
                    {lesson.title}
                    {status !== 'published' && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Bản nháp</span>}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {formatDuration(lesson.durationSec)} · {lesson.concepts.length} khái niệm · {lesson.quiz.length} câu hỏi trong bài
                </p>
            </div>
            <div className="flex w-full items-center gap-3 sm:w-44">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${lesson.title}`}>
                    <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-9 text-right font-mono text-xs text-muted-foreground">{pct}%</span>
            </div>
            <Link to={`/lesson/${lesson.id}`} className="shrink-0 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground transition hover:border-brand-300 hover:bg-muted">
                {action}
            </Link>
        </li>
    )
}
