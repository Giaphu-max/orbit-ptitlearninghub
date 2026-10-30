import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ChevronDown, Play } from 'lucide-react'
import { getConcept, staticCourses } from '@/data'
import type { ClassStats, Course } from '@/data/types'
import { ClassPicker } from '@/components/teacher/class-picker'
import { WHY_WRONG } from '@/data/teacher-notes'
import { AnswerBars } from '@/components/teacher/answer-bars'
import { FINAL_RULES } from '@/lib/test-sets'
import { courseTest, HOT_RATE, pct, questionPicks, useLessonReviews, useTeacherClass, type LessonReview } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

interface ConceptRow {
    id: string
    name: string
    review: LessonReview
    /** Số sinh viên sai ngay lần đầu / số sinh viên đã trả lời */
    wrong: number
    answered: number
    /** % sai lần đầu khi xem video */
    video: number | null
    /** % đúng khi làm bài kiểm tra cuối khóa */
    test: number | null
    /** mức hổng để sắp xếp (cao = hổng nhiều) */
    gap: number
}

function buildRows(course: Course, reviews: LessonReview[], stats: ClassStats): ConceptRow[] {
    const t = courseTest(stats, course.id)
    const rows: ConceptRow[] = []
    for (const r of reviews) {
        // Chỉ bài đã xuất bản mới có lượt làm thật của sinh viên
        if (r.lesson.courseId !== course.id || r.state !== 'published') continue
        for (const c of r.lesson.concepts) {
            const s = stats.concepts[c.id]
            const video = s && s.answered > 0 ? pct(s.wrongFirstTry, s.answered) : null
            const tc = t?.concepts[c.id]
            const test = tc && tc.asked > 0 ? pct(tc.correct, tc.asked) : null
            if (video === null && test === null) continue
            const wrongs = [video, test === null ? null : 100 - test].filter((v): v is number => v !== null)
            rows.push({ id: c.id, name: c.name, review: r, wrong: s?.wrongFirstTry ?? 0, answered: s?.answered ?? 0, video, test, gap: wrongs.reduce((a, b) => a + b, 0) / wrongs.length })
        }
    }
    return rows.sort((a, b) => b.gap - a.gap)
}

const mmss = (sec: number) => formatTime(sec)

/** /teacher/class – gộp thống kê lớp và kết quả kiểm tra cuối khóa theo môn: dải số liệu, khối cần chú ý nhất, bảng khái niệm, phân bố điểm. */
export function OrbitTeacherClassView() {
    const role = useOrbitStore((s) => s.role)
    const reviews = useLessonReviews()
    const { cls, stats, courseIds } = useTeacherClass()
    const [courseSel, setCourseSel] = useState<string>()
    const classCourses = staticCourses.filter((c) => courseIds.includes(c.id))
    // Số liệu theo cặp lớp + khóa; lớp chỉ có một khóa thì không cần ô chọn
    const course = classCourses.find((c) => c.id === courseSel) ?? classCourses[0]
    const rows = useMemo(() => (course ? buildRows(course, reviews, stats) : []), [course, reviews, stats])
    if (role !== 'teacher') return <Navigate to="/" replace />
    if (!course) return <p className="p-12 text-center text-muted-foreground">Lớp này chưa có học phần nào.</p>

    const test = courseTest(stats, course.id)
    const worst = rows[0]
    const worstQuestion = worst?.review.lesson.quiz.find((q) => q.conceptId === worst.id)
    const reviewTo = (r: ConceptRow) => {
        const q = r.review.lesson.quiz.find((x) => x.conceptId === r.id)
        return `/teacher/review/${r.review.lesson.id}${q ? `?item=q:${q.id}` : `?t=${getConcept(r.id)?.segment.start ?? 0}`}`
    }

    return (
        <div className="w-full">
            <div className="pb-8">
                <header className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">Lớp học</p>
                        <h1 className="mt-2 text-4xl font-black tracking-[-0.03em] text-strong">Kết quả theo lớp</h1>
                        <p className="mt-2 max-w-[70ch] text-[15px] text-muted-foreground">Chọn lớp giảng viên đang đứng để xem sinh viên hổng ở đâu. Số liệu là dữ liệu mẫu của {cls.subject}.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <ClassPicker />
                        {classCourses.length > 1 && (
                            <select aria-label="Chọn khóa" value={course.id} onChange={(e) => setCourseSel(e.target.value)} className="h-10 max-w-[260px] truncate rounded-full border border-border bg-card px-4 text-[13.5px] font-bold text-strong shadow-card">
                                {classCourses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.title}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </header>

                <div className="mt-7 flex flex-col gap-6">
                    {test ? (
                        <dl className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-border bg-card shadow-card sm:grid-cols-4">
                            <Stat label="Đã làm kiểm tra cuối khóa" value={`${test.attempted}/${cls.size}`} unit="sinh viên" note={`${course.title} · ${test.attempts} lượt, tính cả làm lại`} />
                            <Stat label="Điểm trung bình" value={(test.avgCorrectPct / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} unit="/10" note="lượt làm cao nhất của mỗi sinh viên" />
                            <Stat label="Đạt yêu cầu" value={`${test.passed}/${test.attempted}`} unit="sinh viên" note="từ 8/10 trở lên" />
                            <Stat label="Thời gian làm bài TB" value={mmss(test.avgDurationSec)} note={`trên ${mmss(FINAL_RULES.count * FINAL_RULES.secondsPerQuestion)} · ${test.timedOut} lượt hết giờ`} />
                        </dl>
                    ) : (
                        <p className="rounded-[20px] border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">Học phần này chưa có dữ liệu kiểm tra cuối khóa.</p>
                    )}

                    {worst && (
                        <div className="surface-red tier-1-bob flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[22px] px-7 py-6 text-ink-foreground shadow-brand">
                            <div className="min-w-0 flex-1 basis-[420px]">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-90">Cần chú ý nhất</p>
                                <p className="mt-1.5 text-2xl font-extrabold leading-snug">
                                    {worst.name}:{' '}
                                    {worst.video !== null ? `${worst.wrong}/${worst.answered} sinh viên sai ngay lần đầu` : `chỉ ${worst.test}% trả lời đúng trong bài kiểm tra cuối khóa`}
                                </p>
                                <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed opacity-90">
                                    {WHY_WRONG[worst.id] ?? 'Nên xem lại cách giảng hoặc câu hỏi ở khái niệm này trên lớp.'}
                                    {worst.test !== null && worst.video !== null && <> Trong bài kiểm tra cuối khóa: {worst.test}% trả lời đúng.</>}
                                </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-3">
                                <Link to={reviewTo(worst)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink-foreground/40 px-4 text-sm font-semibold transition hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground">
                                    <Play size={12} className="fill-current" aria-hidden /> Xem đoạn <span className="font-mono">{mmss(worstQuestion?.pauseAt ?? getConcept(worst.id)?.segment.start ?? 0)}</span>
                                </Link>
                                <Link to={reviewTo(worst)} className="inline-flex h-12 items-center rounded-full bg-ink-foreground px-6 text-base font-extrabold text-brand-ink shadow-card transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600">
                                    Sửa câu hỏi →
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="lesson-grid items-start">
                        <section aria-label="Khái niệm" className="rounded-[20px] border border-border bg-card shadow-card">
                            <div className="grid grid-cols-[minmax(0,1fr)_200px_20px] gap-4 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground max-md:hidden">
                                <span>Khái niệm · sắp theo mức hổng</span>
                                <span>
                                    Sai lần đầu trong video
                                    <small className="mt-0.5 block text-[10.5px] font-medium normal-case tracking-normal">đỏ: từ {HOT_RATE}% sai trở lên · xanh: dưới {HOT_RATE}%</small>
                                </span>
                                <span />
                            </div>
                            {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Chưa có dữ liệu trả lời của lớp cho học phần này.</p>}
                            {rows.map((r) => (
                                <ConceptLine key={r.id} row={r} to={reviewTo(r)} stats={stats} />
                            ))}
                        </section>

                        {test && <ScoreDistribution test={test} />}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Stat({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
    return (
        <div className="min-w-0 border-border px-6 py-5 [&:not(:first-child)]:border-l max-sm:[&:nth-child(n+3)]:border-t max-sm:[&:nth-child(odd)]:border-l-0">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
            <dd className="mt-1.5 font-mono text-[30px] font-extrabold leading-none text-strong">
                {value}
                {unit && <span className="ml-1.5 font-sans text-sm font-bold text-muted-foreground">{unit}</span>}
            </dd>
            <dd title={note} className="mt-1.5 truncate text-xs text-muted-foreground">{note}</dd>
        </div>
    )
}

// Khoảng điểm thang 10 (khớp 4 nhóm trong dữ liệu: 0–39%, 40–59%, 60–79%, 80–100%); đạt từ 8
const BANDS = [
    { label: 'Dưới 4', fill: 'rgb(var(--brand-600))' },
    { label: '4 – 5,9', fill: 'rgb(var(--brand-600) / 0.65)' },
    { label: '6 – 7,9', fill: 'rgb(var(--brand-600) / 0.35)' },
    { label: '8 – 10', fill: 'var(--success-bright)' },
]

function ScoreDistribution({ test }: { test: NonNullable<ReturnType<typeof courseTest>> }) {
    const counts = BANDS.map((_, i) => test.scoreBuckets[i]?.count ?? 0)
    const total = counts.reduce((a, b) => a + b, 0)
    const max = Math.max(...counts, 1)
    const passed = counts[3]
    const low = counts[0] + counts[1]
    return (
        <section aria-label="Điểm kiểm tra cuối khóa" className="rounded-[20px] border border-border bg-card p-5 shadow-card">
            <h2 className="text-base font-extrabold text-strong">Điểm kiểm tra cuối khóa</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{total} sinh viên · thang 10 · đạt từ 8</p>
            <ul className="mt-5 flex flex-col gap-3" aria-label="Số sinh viên theo khoảng điểm">
                {BANDS.map((b, i) => (
                    <li key={b.label} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                        <span className="text-[13px] font-semibold text-muted-foreground">{b.label}</span>
                        <span className="flex items-center gap-2">
                            <i className="block h-5 rounded-md" style={{ width: `calc(${(counts[i] / max) * 100}% - 48px)`, minWidth: counts[i] > 0 ? 6 : 0, background: b.fill }} />
                            <b className="shrink-0 font-mono text-[13px] font-bold text-strong">{counts[i]} SV</b>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="mt-5 border-t border-border pt-4 text-[13.5px] leading-snug text-muted-foreground">
                <b className="font-mono font-extrabold text-strong">
                    {passed}/{total}
                </b>{' '}
                sinh viên đạt · <b className="font-mono font-extrabold text-strong">{low}</b> bạn dưới 6 điểm nên ôn lại
            </p>
        </section>
    )
}

function ConceptLine({ row, to, stats }: { row: ConceptRow; to: string; stats: ClassStats }) {
    const [open, setOpen] = useState(false)
    const { review } = row
    const question = review.lesson.quiz.find((q) => q.conceptId === row.id)
    const hasPicks = !!question && !!questionPicks(stats, question.id)
    const hot = row.video !== null && row.video >= HOT_RATE
    return (
        <div className="border-b border-border last:border-b-0">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="grid w-full grid-cols-[minmax(0,1fr)_200px_20px] items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted max-md:grid-cols-[minmax(0,1fr)_auto_20px]"
            >
                <span className="min-w-0">
                    <b className="block text-sm font-bold leading-snug text-strong">{row.name}</b>
                    <small title={review.lesson.title} className="mt-0.5 block truncate text-xs text-muted-foreground">{review.lesson.shortTitle ?? review.lesson.title}</small>
                </span>
                <span className="font-mono text-sm font-extrabold">
                    {row.video === null ? (
                        <span className="text-muted-foreground">—</span>
                    ) : (
                        <>
                            <span className={hot ? 'text-brand-ink' : 'text-muted-foreground'}>
                                {row.wrong}/{row.answered} SV
                            </span>
                            <i className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-muted">
                                <u className={`block h-full no-underline ${hot ? 'bg-brand-600' : 'bg-success-bright'}`} style={{ width: `${row.video}%` }} />
                            </i>
                        </>
                    )}
                    {row.test !== null && <small className="mt-1 block font-sans text-[11px] font-medium text-muted-foreground">{row.test}% đúng trong bài kiểm tra cuối khóa</small>}
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && (
                <div className="border-t border-border bg-muted/50 px-5 pb-4 pt-3.5">
                    {question && hasPicks && (
                        <div className="max-w-[640px]">
                            <p className="mb-2 text-[13px] font-semibold leading-snug text-strong">{question.prompt}</p>
                            <AnswerBars stats={stats} question={question} />
                        </div>
                    )}
                    <div className={`flex flex-wrap gap-2 ${question && hasPicks ? 'mt-3.5' : ''}`}>
                        <Link to={to} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-ink transition hover:bg-brand-100">
                            <Play size={13} className="fill-current" aria-hidden /> Xem đoạn <span className="font-mono">{mmss(question?.pauseAt ?? getConcept(row.id)?.segment.start ?? 0)}</span>
                        </Link>
                        {question && (
                            <Link to={to} className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-bold text-strong transition hover:bg-muted">
                                Sửa câu hỏi
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
