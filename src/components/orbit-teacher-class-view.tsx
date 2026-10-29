import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, Minus, Play, TrendingDown, TrendingUp } from 'lucide-react'
import { classStats, courses, getConcept } from '@/data'
import type { Course } from '@/data/types'
import { TEACHER_PROFILE, WHY_WRONG } from '@/data/teacher-notes'
import { TitleBlock } from '@/components/lesson/lesson-header'
import { AnswerBars } from '@/components/teacher/answer-bars'
import { courseTest, HOT_RATE, pct, useLessonReviews, type LessonReview } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

interface ConceptRow {
    id: string
    name: string
    review: LessonReview
    /** % sai lần đầu khi xem video */
    video: number | null
    /** % đúng khi làm test cuối chương */
    test: number | null
    /** mức hổng để sắp xếp (cao = hổng nhiều) */
    gap: number
}

function buildRows(course: Course, reviews: LessonReview[]): ConceptRow[] {
    const t = courseTest(course.id)
    const rows: ConceptRow[] = []
    for (const r of reviews) {
        if (r.lesson.courseId !== course.id) continue
        for (const c of r.lesson.concepts) {
            const s = classStats.concepts[c.id]
            const video = s && s.answered > 0 ? pct(s.wrongFirstTry, s.answered) : null
            const tc = t?.concepts[c.id]
            const test = tc && tc.asked > 0 ? pct(tc.correct, tc.asked) : null
            if (video === null && test === null) continue
            const wrongs = [video, test === null ? null : 100 - test].filter((v): v is number => v !== null)
            rows.push({ id: c.id, name: c.name, review: r, video, test, gap: wrongs.reduce((a, b) => a + b, 0) / wrongs.length })
        }
    }
    return rows.sort((a, b) => b.gap - a.gap)
}

const mmss = (sec: number) => formatTime(sec)

/** /teacher/class – gộp thống kê lớp và kết quả test theo môn: dải số liệu, khối cần chú ý nhất, bảng khái niệm, phân bố điểm. */
export function OrbitTeacherClassView() {
    const role = useOrbitStore((s) => s.role)
    const reviews = useLessonReviews()
    const [params] = useSearchParams()
    const course = courses.find((c) => c.id === params.get('course')) ?? courses[0]
    const rows = useMemo(() => (course ? buildRows(course, reviews) : []), [course, reviews])
    if (role !== 'teacher') return <Navigate to="/" replace />
    if (!course) return <p className="p-12 text-center text-muted-foreground">Chưa có học phần nào.</p>

    const test = courseTest(course.id)
    const worst = rows[0]
    const worstQuestion = worst?.review.lesson.quiz.find((q) => q.conceptId === worst.id)
    const maxBucket = Math.max(...(test?.scoreBuckets.map((b) => b.count) ?? [0]), 1)
    const reviewTo = (r: ConceptRow) => {
        const q = r.review.lesson.quiz.find((x) => x.conceptId === r.id)
        return `/teacher/review/${r.review.lesson.id}${q ? `?item=q:${q.id}` : `?t=${getConcept(r.id)?.segment.start ?? 0}`}`
    }

    return (
        <div className="w-full">
            <div className="container-wide py-4 lg:py-6">
                <header className="lesson-grid items-end">
                    <TitleBlock
                        label={course.title}
                        items={courses.map((c, i) => ({
                            key: c.id,
                            to: `/teacher/class?course=${c.id}`,
                            n: String(i + 1).padStart(2, '0'),
                            title: c.title,
                            meta: `${reviews.filter((r) => r.lesson.courseId === c.id).length} bài`,
                            current: c.id === course.id,
                        }))}
                        title="Lớp học"
                    />
                    <p className="pb-1 text-right text-[13px] text-muted-foreground">
                        Dữ liệu mẫu lớp <span className="font-mono font-bold text-strong">{classStats.classSize}</span> sinh viên · {TEACHER_PROFILE.fullName}
                    </p>
                </header>

                <div className="mt-6 flex flex-col gap-6">
                    {test ? (
                        <dl className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-border bg-card shadow-card sm:grid-cols-4">
                            <Stat label="Đã làm test" value={`${test.attempted}/${classStats.classSize}`} note={`${test.attempts} lượt, tính cả làm lại`} />
                            <Stat label="Điểm trung bình" value={`${test.avgCorrectPct}%`} note="câu đúng" />
                            <Stat label="Đạt từ 80%" value={`${pct(test.passed, test.attempted)}%`} note={`${test.passed} sinh viên`} />
                            <Stat label="Thời gian TB" value={mmss(test.avgDurationSec)} note={`${test.timedOut} lượt hết giờ`} />
                        </dl>
                    ) : (
                        <p className="rounded-[20px] border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">Học phần này chưa có dữ liệu test cuối chương.</p>
                    )}

                    {worst && (
                        <div className="surface-red tier-1-bob flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[22px] px-7 py-6 text-ink-foreground shadow-brand">
                            <div className="min-w-0 flex-1 basis-[420px]">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-90">Cần chú ý nhất</p>
                                <p className="mt-1.5 text-2xl font-extrabold leading-snug">
                                    {worst.name}:{' '}
                                    {worst.video !== null ? `${worst.video}% sinh viên sai ngay lần đầu` : `chỉ ${worst.test}% trả lời đúng trong test`}
                                </p>
                                <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed opacity-90">
                                    {WHY_WRONG[worst.id] ?? 'Nên xem lại cách giảng hoặc câu hỏi ở khái niệm này trên lớp.'}
                                    {worst.test !== null && worst.video !== null && <> Trong test cuối chương: {worst.test}% trả lời đúng.</>}
                                </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2.5">
                                <Link to={reviewTo(worst)} className="on-red-btn inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-bold transition hover:opacity-90">
                                    <Play size={13} className="fill-current" aria-hidden /> Xem đoạn{' '}
                                    <span className="font-mono">{mmss(worstQuestion?.pauseAt ?? getConcept(worst.id)?.segment.start ?? 0)}</span>
                                </Link>
                                <Link to={reviewTo(worst)} className="inline-flex h-10 items-center rounded-full border border-ink-foreground/60 px-5 text-sm font-bold transition hover:bg-ink-foreground/10">
                                    Sửa câu hỏi
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="lesson-grid items-start">
                        <section aria-label="Khái niệm" className="rounded-[20px] border border-border bg-card shadow-card">
                            <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px_20px] gap-4 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground max-md:hidden">
                                <span>Khái niệm · sắp theo mức hổng</span>
                                <span>Sai lần đầu</span>
                                <span>Đúng trong test</span>
                                <span>Xu hướng</span>
                                <span />
                            </div>
                            {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Chưa có dữ liệu trả lời của lớp cho học phần này.</p>}
                            {rows.map((r) => (
                                <ConceptLine key={r.id} row={r} to={reviewTo(r)} />
                            ))}
                        </section>

                        {test && (
                            <section aria-label="Phân bố điểm" className="rounded-[20px] border border-border bg-card p-5 shadow-card">
                                <h2 className="text-base font-extrabold text-strong">Phân bố điểm</h2>
                                <p className="mt-1 text-[13px] text-muted-foreground">Số sinh viên theo khoảng điểm test cuối chương.</p>
                                <ul className="mt-5 flex items-end justify-between gap-3" aria-label="Số sinh viên theo khoảng điểm">
                                    {test.scoreBuckets.map((b) => (
                                        <li key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                                            <span className="font-mono text-sm font-bold text-strong">{b.count}</span>
                                            <div className="flex h-[120px] w-full max-w-[36px] items-end rounded-md bg-muted">
                                                <div className="w-full rounded-md bg-brand-600" style={{ height: `${(b.count / maxBucket) * 100}%` }} />
                                            </div>
                                            <span className="text-xs text-muted-foreground">{b.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="border-border px-6 py-5 [&:not(:first-child)]:border-l max-sm:[&:nth-child(n+3)]:border-t max-sm:[&:nth-child(odd)]:border-l-0">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
            <dd className="mt-1.5 font-mono text-[30px] font-extrabold leading-none text-strong">{value}</dd>
            <dd className="mt-1.5 text-xs text-muted-foreground">{note}</dd>
        </div>
    )
}

function ConceptLine({ row, to }: { row: ConceptRow; to: string }) {
    const [open, setOpen] = useState(false)
    const { review } = row
    const question = review.lesson.quiz.find((q) => q.conceptId === row.id)
    const testWrong = row.test === null ? null : 100 - row.test
    const delta = row.video !== null && testWrong !== null ? row.video - testWrong : null
    const hot = row.video !== null && row.video >= HOT_RATE
    return (
        <div className="border-b border-border last:border-b-0">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="grid w-full grid-cols-[minmax(0,1fr)_120px_120px_120px_20px] items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted max-md:grid-cols-[minmax(0,1fr)_auto_20px]"
            >
                <span className="min-w-0">
                    <b className="block text-sm font-bold leading-snug text-strong">{row.name}</b>
                    <small className="mt-0.5 block truncate text-xs text-muted-foreground">{review.lesson.shortTitle ?? review.lesson.title}</small>
                </span>
                <span className="font-mono text-sm font-extrabold">
                    {row.video === null ? (
                        <span className="text-muted-foreground">—</span>
                    ) : (
                        <>
                            <span className={hot ? 'text-brand-ink' : 'text-muted-foreground'}>{row.video}%</span>
                            <i className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-muted">
                                <u className={`block h-full no-underline ${hot ? 'bg-brand-600' : 'bg-muted-foreground/40'}`} style={{ width: `${row.video}%` }} />
                            </i>
                        </>
                    )}
                </span>
                <span className="font-mono text-sm font-extrabold max-md:hidden">
                    {row.test === null ? <span className="text-muted-foreground">—</span> : <span className={row.test < 60 ? 'text-brand-ink' : 'text-success'}>{row.test}%</span>}
                </span>
                <span className="text-[13px] font-semibold max-md:hidden">
                    {delta === null ? (
                        <span className="text-muted-foreground">Chưa đủ dữ liệu</span>
                    ) : delta > 5 ? (
                        <span className="inline-flex items-center gap-1 text-success">
                            <TrendingDown size={14} aria-hidden /> Giảm {delta} điểm
                        </span>
                    ) : delta < -5 ? (
                        <span className="inline-flex items-center gap-1 text-brand-ink">
                            <TrendingUp size={14} aria-hidden /> Tăng {-delta} điểm
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Minus size={14} aria-hidden /> Ổn định
                        </span>
                    )}
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && (
                <div className="border-t border-border bg-muted/50 px-5 pb-4 pt-3.5">
                    {question ? (
                        <div className="max-w-[640px]">
                            <p className="mb-2 text-[13px] font-semibold leading-snug text-strong">{question.prompt}</p>
                            <AnswerBars question={question} />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Khái niệm này chưa có câu hỏi trong video.</p>
                    )}
                    <div className="mt-3.5 flex flex-wrap gap-2">
                        <Link to={to} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-ink transition hover:bg-brand-100">
                            <Play size={13} className="fill-current" aria-hidden /> Xem đoạn <span className="font-mono">{mmss(question?.pauseAt ?? getConcept(row.id)?.segment.start ?? 0)}</span>
                        </Link>
                        <Link to={to} className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-bold text-strong transition hover:bg-muted">
                            Sửa câu hỏi
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
