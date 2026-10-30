import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { GENERIC_TIPS, TEACHING_TIPS } from '@/data/class-teaching'
import { WHY_WRONG } from '@/data/teacher-notes'
import type { ClassStats } from '@/data/types'
import { AnswerBars } from '@/components/teacher/answer-bars'
import { ClassPicker } from '@/components/teacher/class-picker'
import { buildQuick, levelOf, type Level, type PickedQuestion, type QuickLesson } from '@/lib/class-report'
import { courseTest, pct, useLessonReviews, useTeacherClass, useTeacherCourses, type LessonReview } from '@/lib/teacher'
import { courseFullyPublished, finalKey, finalSetFor, FINAL_RULES, resolveSet, sourcedBank, useCourseLessons } from '@/lib/test-sets'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const vn = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
const BAR: Record<Level, string> = { hot: 'bg-brand-600', mid: 'bg-mm-orange/60', low: 'bg-muted-foreground/30' }
const INK: Record<Level, string> = { hot: 'text-brand-ink', mid: 'text-[hsl(var(--subject-photo-ink))]', low: 'text-muted-foreground' }
const h3 = 'text-[22px] font-black tracking-tight text-strong'
const QUICK_GRID = 'grid grid-cols-[minmax(0,2fr)_100px_100px_minmax(140px,1fr)_minmax(0,1.3fr)_20px] items-center gap-4'
const CONCEPT_GRID = 'grid grid-cols-[minmax(0,1.6fr)_minmax(180px,1fr)_110px_130px_20px] items-center gap-4'

interface ConceptRow {
    id: string
    name: string
    review: LessonReview
    wrong: number
    answered: number
    /** % sai lần đầu khi xem video (null = chưa có số liệu) */
    video: number | null
    /** % đúng ở kiểm tra nhanh / kiểm tra cuối khóa */
    quick: number | null
    final: number | null
}

function buildRows(reviews: LessonReview[], quick: QuickLesson[], stats: ClassStats, courseId: string): ConceptRow[] {
    const t = courseTest(stats, courseId)
    const quickBy = new Map<string, number[]>()
    for (const q of quick) for (const x of q.questions) quickBy.set(x.conceptId, [...(quickBy.get(x.conceptId) ?? []), x.correct])
    const rows: ConceptRow[] = []
    for (const r of reviews) {
        if (r.state !== 'published') continue
        for (const c of r.lesson.concepts) {
            const s = stats.concepts[c.id]
            const video = s && s.answered > 0 ? pct(s.wrongFirstTry, s.answered) : null
            const tc = t?.concepts[c.id]
            const final = tc && tc.asked > 0 ? pct(tc.correct, tc.asked) : null
            if (video === null && final === null) continue
            const qs = quickBy.get(c.id)
            rows.push({ id: c.id, name: c.name, review: r, wrong: s?.wrongFirstTry ?? 0, answered: s?.answered ?? 0, video, quick: qs?.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : null, final })
        }
    }
    return rows.sort((a, b) => (b.video ?? -1) - (a.video ?? -1))
}

/** /teacher/class – trang thống kê CHỈ ĐỂ XEM: lớp hổng ở đâu để giảng viên điều chỉnh việc dạy trên lớp. Không sửa nội dung ở đây. */
export function OrbitTeacherClassView() {
    const role = useOrbitStore((s) => s.role)
    const reviews = useLessonReviews()
    const courses = useTeacherCourses()
    const testSets = useOrbitStore((s) => s.testSets)
    const { cls, stats, courseIds } = useTeacherClass()
    const [courseSel, setCourseSel] = useState<string>()
    const classCourses = courses.filter((c) => courseIds.includes(c.id))
    const course = classCourses.find((c) => c.id === courseSel) ?? classCourses[0]
    const { published: pubLessons } = useCourseLessons(course?.id)
    const courseReviews = useMemo(() => reviews.filter((r) => r.lesson.courseId === course?.id), [reviews, course])
    const quick = useMemo(() => buildQuick(courseReviews, stats, testSets), [courseReviews, stats, testSets])
    const rows = useMemo(() => (course ? buildRows(courseReviews, quick, stats, course.id) : []), [course, courseReviews, quick, stats])
    const finalOpen = useOrbitStore((s) => (course ? (s.testSets[finalKey(course.id)]?.published ?? courseFullyPublished(course.id, s)) : false))
    if (role !== 'teacher') return <Navigate to="/" replace />
    if (!course) return <p className="p-12 text-center text-muted-foreground">Lớp này chưa có học phần nào.</p>

    const test = courseTest(stats, course.id)
    const learners = Math.min(cls.size, Math.max(0, ...courseReviews.flatMap((r) => r.lesson.concepts.map((c) => stats.concepts[c.id]?.answered ?? 0))))
    const withData = quick.filter((q) => q.hasData)
    const quickAvg = withData.length ? withData.reduce((s, q) => s + q.avgScore, 0) / withData.length : null
    const finalQs = resolveSet(finalSetFor(pubLessons, testSets[finalKey(course.id)]), sourcedBank(pubLessons))
    const worstFinal = finalQs
        .flatMap((q) => {
            const tc = test?.concepts[q.conceptId]
            return tc && tc.asked > 0 ? [{ q, correct: pct(tc.correct, tc.asked) }] : []
        })
        .sort((a, b) => a.correct - b.correct)
        .filter((x, i, a) => a.findIndex((y) => y.q.prompt === x.q.prompt) === i)
        .slice(0, 3)

    // Bài lớp hụt nhất = tỉ lệ đạt kiểm tra nhanh thấp nhất
    const worstLesson = [...withData].sort((a, b) => a.passed / a.attempted - b.passed / b.attempted)[0]
    const tips = [...new Set(rows.filter((r) => r.video !== null).slice(0, 6).flatMap((r) => TEACHING_TIPS[r.id]?.slice(0, 1) ?? []))].slice(0, 3)
    for (const g of GENERIC_TIPS) if (tips.length < 2 && !tips.includes(g)) tips.push(g)

    return (
        <div className="w-full pb-8">
            <header className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">Lớp học</p>
                    <h1 className="mt-2 text-4xl font-black tracking-[-0.03em] text-strong">Kết quả theo lớp</h1>
                    <p className="mt-2 text-xs text-muted-foreground">Dữ liệu mẫu</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <ClassPicker />
                    <select aria-label="Chọn khóa" value={course.id} onChange={(e) => setCourseSel(e.target.value)} disabled={classCourses.length < 2} className="h-10 max-w-[280px] truncate rounded-full border border-border bg-card px-4 text-[13.5px] font-bold text-strong shadow-card disabled:opacity-100">
                        {classCourses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.title}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="mt-8 flex flex-col gap-10">
                <section aria-label="Tóm tắt lớp">
                    <dl className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-border bg-card shadow-card lg:grid-cols-4">
                        <Stat label="Đã học" value={`${learners}/${cls.size}`} unit="sinh viên" note="xem hết ít nhất 1 bài" />
                        <Stat label="Kiểm tra nhanh" value={quickAvg === null ? '—' : vn(quickAvg)} unit={quickAvg === null ? undefined : '/10 điểm TB'} note="trung bình các bài, lượt cao nhất" />
                        {finalOpen && test ? (
                            <Stat label="Kiểm tra cuối khóa" value={vn(test.avgCorrectPct / 10)} unit="/10 điểm TB" note={`${test.attempted}/${cls.size} đã làm · ${test.passed} bạn đạt từ 8`} />
                        ) : (
                            <Stat label="Kiểm tra cuối khóa" value="Chưa mở" note="thầy cô chưa xuất bản đề" />
                        )}
                        <Stat label="Thời gian làm bài cuối khóa TB" value={finalOpen && test ? formatTime(test.avgDurationSec) : '—'} note={finalOpen && test ? `giới hạn ${formatTime(FINAL_RULES.count * FINAL_RULES.secondsPerQuestion)} · ${test.timedOut} lượt hết giờ` : 'chưa có lượt làm'} />
                    </dl>
                </section>

                {worstLesson && worstLesson.weakest && (
                    <section aria-label="Lớp hụt nhiều nhất ở" className="relative overflow-hidden rounded-[20px] border border-border bg-card py-6 pl-9 pr-8 shadow-card">
                        <i aria-hidden className="absolute inset-y-0 left-0 w-[5px] bg-brand-600" />
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">Lớp hụt nhiều nhất ở</h3>
                        <p className="mt-2 max-w-[90ch] text-[17px] font-semibold leading-snug text-strong">
                            Bài {worstLesson.index + 1} · {worstLesson.review.lesson.shortTitle ?? worstLesson.review.lesson.title}: chỉ {worstLesson.passed}/{worstLesson.attempted} bạn đạt kiểm tra nhanh. Khái niệm yếu nhất là {worstLesson.weakest.name} ({worstLesson.weakest.wrongPct}% sai lần đầu).{' '}
                            <span className="font-normal text-foreground">{WHY_WRONG[worstLesson.weakest.conceptId] ?? ''}</span>
                        </p>
                        {tips.length > 0 && (
                            <>
                                <p className="mt-4 text-[13px] font-bold text-muted-foreground">Gợi ý khi lên lớp</p>
                                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px] leading-snug text-foreground marker:text-brand-600">
                                    {tips.map((t) => (
                                        <li key={t}>{t}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </section>
                )}

                <section aria-label="Kiểm tra nhanh theo bài">
                    <h3 className={h3}>Kiểm tra nhanh theo bài</h3>
                    <div className="mt-4 rounded-[20px] border border-border bg-card shadow-card">
                        <div className={`${QUICK_GRID} border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground max-lg:hidden`}>
                            <span>Bài</span>
                            <span>Đã làm</span>
                            <span>Điểm TB</span>
                            <span>Đạt</span>
                            <span>Khái niệm yếu nhất</span>
                            <span />
                        </div>
                        {quick.length === 0 && <p className="p-6 text-sm text-muted-foreground">Khóa này chưa có bài nào.</p>}
                        {quick.map((q) => (
                            <QuickRow key={q.review.lesson.id} q={q} />
                        ))}
                    </div>
                </section>

                <section aria-label="Kiểm tra cuối khóa">
                    <h3 className={h3}>Kiểm tra cuối khóa</h3>
                    {finalOpen && test ? (
                        <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
                            <Distribution test={test} />
                            <div className="rounded-[20px] border border-border bg-card p-5 shadow-card">
                                <h4 className="text-base font-extrabold text-strong">Câu sai nhiều nhất</h4>
                                <ol className="mt-3 flex flex-col gap-3">
                                    {worstFinal.length === 0 && <li className="text-sm text-muted-foreground">Chưa có số liệu theo câu.</li>}
                                    {worstFinal.map(({ q, correct }) => (
                                        <li key={q.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                                            <span title={q.prompt} className="line-clamp-2 text-[14.5px] leading-snug text-strong">
                                                {q.prompt}
                                            </span>
                                            <b className={`shrink-0 font-mono text-[13px] ${correct >= 80 ? 'text-success' : INK[levelOf(100 - correct)]}`}>{correct}% đúng</b>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 rounded-[20px] border border-border bg-card px-6 py-5 text-[15px] text-muted-foreground shadow-card">Chưa mở kiểm tra cuối khóa</p>
                    )}
                </section>

                <ConceptSection rows={rows} stats={stats} />
            </div>
        </div>
    )
}

function Stat({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
    return (
        <div className="min-w-0 border-border px-6 py-5 lg:[&:not(:first-child)]:border-l max-lg:[&:nth-child(n+3)]:border-t max-lg:[&:nth-child(even)]:border-l">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
            <dd className="mt-1.5 whitespace-nowrap leading-none">
                <span className="font-mono text-[30px] font-extrabold text-strong">{value}</span>
                {unit && <span className="ml-1.5 text-sm font-bold text-muted-foreground">{unit}</span>}
            </dd>
            <dd className="mt-1.5 text-xs text-muted-foreground">{note}</dd>
        </div>
    )
}

function QuickRow({ q }: { q: QuickLesson }) {
    const [open, setOpen] = useState(false)
    const { review: r } = q
    const title = r.lesson.title
    if (!q.hasData) {
        return (
            <div className={`${QUICK_GRID} border-b border-border px-5 py-3.5 opacity-60 last:border-b-0`}>
                <span title={title} className="min-w-0 truncate text-sm font-bold text-strong">
                    <span className="mr-2 font-mono text-muted-foreground">{String(q.index + 1).padStart(2, '0')}</span>
                    {title}
                </span>
                <span className="col-span-4 text-sm text-muted-foreground">Chưa có lượt làm</span>
                <span />
            </div>
        )
    }
    const passRate = pct(q.passed, q.attempted)
    return (
        <div className="border-b border-border last:border-b-0">
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${QUICK_GRID} w-full px-5 py-3.5 text-left transition hover:bg-muted max-lg:grid-cols-[minmax(0,1fr)_auto_20px]`}>
                <span title={title} className="flex min-w-0 items-center gap-2 text-sm font-bold text-strong">
                    {passRate < 60 && <i aria-label="Tỉ lệ đạt dưới 60%" className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    <span className="shrink-0 font-mono text-muted-foreground">{String(q.index + 1).padStart(2, '0')}</span>
                    <span className="truncate">{title}</span>
                </span>
                <span className="font-mono text-sm text-strong max-lg:hidden">{q.attempted} SV</span>
                <span className="font-mono text-sm font-bold text-strong max-lg:hidden">
                    {vn(q.avgScore)}
                    <span className="font-sans text-xs font-medium text-muted-foreground">/10</span>
                </span>
                <span className="max-lg:hidden">
                    <span className="font-mono text-sm font-bold text-strong">
                        {q.passed}/{q.attempted} SV
                    </span>
                    <i aria-hidden className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-muted">
                        <u className="block h-full bg-success-bright no-underline" style={{ width: `${passRate}%` }} />
                    </i>
                </span>
                <span title={q.weakest?.name} className="min-w-0 truncate text-sm">
                    {q.weakest && (
                        <>
                            <span className="text-strong">{q.weakest.name}</span> <b className={`font-mono text-[13px] ${INK[levelOf(q.weakest.wrongPct)]}`}>{q.weakest.wrongPct}% sai</b>
                        </>
                    )}
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && (
                <div className="flex flex-col gap-5 border-t border-border bg-muted/50 px-5 pb-5 pt-4">
                    {q.questions.length === 0 && <p className="text-sm text-muted-foreground">Đề kiểm tra nhanh của bài này chưa có câu nào.</p>}
                    {q.questions.map((x, i) => (
                        <PickBars key={x.id} q={x} no={i + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

/** Một câu: nội dung + % đúng + phân bố đáp án (số SV · %). Đáp án đúng xanh, đáp án nhiễu nhiều nhất đỏ nhạt. Chỉ để xem. */
function PickBars({ q, no }: { q: PickedQuestion; no: number }) {
    let trap = -1
    q.picks.forEach((n, i) => {
        if (i !== q.correctIndex && (trap < 0 || n > q.picks[trap])) trap = i
    })
    return (
        <div className="max-w-[720px]">
            <p className="mb-2 flex items-baseline justify-between gap-4 text-[13.5px] font-semibold leading-snug text-strong">
                <span>
                    <span className="mr-2 font-mono text-muted-foreground">Câu {no}</span>
                    {q.prompt}
                </span>
                <b className={`shrink-0 font-mono text-[12.5px] ${q.correct >= 80 ? 'text-success' : 'text-muted-foreground'}`}>{q.correct}% đúng</b>
            </p>
            <ul className="flex flex-col gap-1.5">
                {q.options.map((opt, i) => {
                    const n = q.picks[i] ?? 0
                    const share = pct(n, q.total)
                    const right = i === q.correctIndex
                    const hot = i === trap && share >= 20
                    return (
                        <li key={i} className={`flex items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px] leading-snug ${right ? 'bg-success-soft text-success' : hot ? 'bg-brand-50 text-brand-ink' : 'bg-muted text-foreground'}`}>
                            <span className={right || hot ? 'font-semibold' : ''}>
                                <span className="mr-1.5 font-mono font-bold">{String.fromCharCode(65 + i)}</span>
                                {opt}
                            </span>
                            <span className="shrink-0 whitespace-nowrap font-mono text-[12.5px] font-bold">
                                {n} SV <span className="font-medium opacity-70">· {share}%</span>
                            </span>
                        </li>
                    )
                })}
            </ul>
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

function Distribution({ test }: { test: NonNullable<ReturnType<typeof courseTest>> }) {
    const counts = BANDS.map((_, i) => test.scoreBuckets[i]?.count ?? 0)
    const total = counts.reduce((a, b) => a + b, 0)
    const max = Math.max(...counts, 1)
    return (
        <div className="rounded-[20px] border border-border bg-card p-5 shadow-card">
            <h4 className="text-base font-extrabold text-strong">Phân bố điểm</h4>
            <p className="mt-1 text-[13px] text-muted-foreground">{total} sinh viên · thang 10 · đạt từ 8</p>
            <ul className="mt-5 flex flex-col gap-3" aria-label="Số sinh viên theo khoảng điểm">
                {BANDS.map((b, i) => (
                    <li key={b.label} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                        <span className="text-[13px] font-semibold text-muted-foreground">{b.label}</span>
                        <span className="flex items-center gap-2">
                            <i className="block h-5 rounded-md" style={{ width: `calc(${(counts[i] / max) * 100}% - 52px)`, minWidth: counts[i] > 0 ? 6 : 0, background: b.fill }} />
                            <b className="shrink-0 font-mono text-[13px] font-bold text-strong">{counts[i]} SV</b>
                        </span>
                    </li>
                ))}
            </ul>
            <p className="mt-5 border-t border-border pt-4 text-[13.5px] leading-snug text-muted-foreground">
                <b className="font-mono font-extrabold text-strong">
                    {counts[3]}/{total}
                </b>{' '}
                bạn đạt · <b className="font-mono font-extrabold text-strong">{counts[0] + counts[1]}</b> bạn dưới 6 điểm
            </p>
        </div>
    )
}

function ConceptSection({ rows, stats }: { rows: ConceptRow[]; stats: ClassStats }) {
    const [all, setAll] = useState(false)
    const main = rows.filter((r) => r.video !== null && r.video >= 20)
    const rest = rows.filter((r) => !(r.video !== null && r.video >= 20))
    return (
        <section aria-label="Theo khái niệm">
            <h3 className={h3}>Theo khái niệm</h3>
            <div className="mt-4 rounded-[20px] border border-border bg-card shadow-card">
                <div className={`${CONCEPT_GRID} border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground max-md:hidden`}>
                    <span>Khái niệm · sắp theo mức hổng</span>
                    <span>Sai lần đầu trong video</span>
                    <span>Kiểm tra nhanh</span>
                    <span>Kiểm tra cuối khóa</span>
                    <span />
                </div>
                {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Chưa có dữ liệu trả lời của lớp cho học phần này.</p>}
                {main.map((r) => (
                    <ConceptLine key={r.id} row={r} stats={stats} />
                ))}
                {rest.length > 0 && (
                    <>
                        {all && rest.map((r) => <ConceptLine key={r.id} row={r} stats={stats} />)}
                        <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)} className="w-full px-5 py-3.5 text-left text-[13.5px] font-bold text-brand-ink transition hover:bg-muted">
                            {all ? 'Thu gọn ▴' : `Xem thêm ${rest.length} khái niệm lớp đã nắm tốt ▾`}
                        </button>
                    </>
                )}
            </div>
        </section>
    )
}

const okInk = (v: number | null) => (v === null ? 'text-muted-foreground' : v >= 80 ? 'text-success' : 'text-foreground')

function ConceptLine({ row, stats }: { row: ConceptRow; stats: ClassStats }) {
    const [open, setOpen] = useState(false)
    const question = row.review.lesson.quiz.find((q) => q.conceptId === row.id)
    const level = row.video === null ? 'low' : levelOf(row.video)
    return (
        <div className="border-b border-border last:border-b-0">
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${CONCEPT_GRID} w-full px-5 py-3.5 text-left transition hover:bg-muted max-md:grid-cols-[minmax(0,1fr)_auto_20px]`}>
                <span className="min-w-0">
                    <b title={row.name} className="block truncate text-sm font-bold leading-snug text-strong">
                        {row.name}
                    </b>
                    <small title={row.review.lesson.title} className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {row.review.lesson.shortTitle ?? row.review.lesson.title}
                    </small>
                </span>
                <span>
                    {row.video === null ? (
                        <span className="font-mono text-sm text-muted-foreground">—</span>
                    ) : (
                        <>
                            <span className="flex items-baseline gap-2">
                                <b className={`font-mono text-[15px] font-extrabold ${INK[level]}`}>{row.video}%</b>
                                <small className="font-mono text-xs text-muted-foreground">
                                    {row.wrong}/{row.answered} SV
                                </small>
                            </span>
                            <i aria-hidden className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-muted">
                                <u className={`block h-full no-underline ${BAR[level]}`} style={{ width: `${row.video}%` }} />
                            </i>
                        </>
                    )}
                </span>
                <span className={`font-mono text-[13px] font-bold max-md:hidden ${okInk(row.quick)}`}>{row.quick === null ? '—' : `${row.quick}% đúng`}</span>
                <span className={`font-mono text-[13px] font-bold max-md:hidden ${okInk(row.final)}`}>{row.final === null ? '—' : `${row.final}% đúng`}</span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && (
                <div className="border-t border-border bg-muted/50 px-5 pb-4 pt-3.5">
                    {question ? (
                        <div className="max-w-[640px]">
                            <p className="mb-2 text-[13px] font-semibold leading-snug text-strong">{question.prompt}</p>
                            <AnswerBars stats={stats} question={question} />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Khái niệm này chưa có câu hỏi trong video.</p>
                    )}
                </div>
            )}
        </div>
    )
}
