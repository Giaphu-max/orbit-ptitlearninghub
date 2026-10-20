import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, Clock, PlayCircle, RotateCcw, Target, TriangleAlert, X } from 'lucide-react'
import { getConcept, getCourse } from '@/data'
import { announceRewards } from '@/lib/gamification'
import {
    buildQuestionBank,
    pickTestQuestions,
    reviewStepFor,
    testTimeLimit,
    testXp,
    TEST_PASS_BONUS_XP,
    TEST_PASS_RATIO,
    TEST_XP_PER_CORRECT,
    type TestQuestion,
} from '@/lib/final-test'
import { useCourseLessons } from '@/lib/lesson-edits'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore, type TestAttempt } from '@/store/useOrbitStore'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`

type Phase =
    | { kind: 'intro' }
    | { kind: 'running'; questions: TestQuestion[]; deadline: number }
    | { kind: 'result'; attempt: TestAttempt; questions?: TestQuestion[]; picks?: Record<string, number>; xp?: number }

/** /test/:courseId – test tổng hợp cuối chương: câu từ ngân hàng của khóa, trộn thứ tự, có giờ. Kết quả cập nhật cây kỹ năng và XP. */
export function OrbitTestView() {
    const { courseId } = useParams()
    const course = courseId ? getCourse(courseId) : undefined
    const lessons = useCourseLessons(courseId)
    const bank = useMemo(() => buildQuestionBank(lessons), [lessons])
    const record = useOrbitStore((s) => (courseId ? s.testRecords[courseId] : undefined))
    const recordTestResult = useOrbitStore((s) => s.recordTestResult)
    const [phase, setPhase] = useState<Phase>({ kind: 'intro' })

    if (!course || !courseId) return <Navigate to="/" replace />

    const start = () => {
        const questions = pickTestQuestions(bank)
        setPhase({ kind: 'running', questions, deadline: Date.now() + testTimeLimit(questions.length) * 1000 })
        window.scrollTo(0, 0)
    }

    const submit = (questions: TestQuestion[], picks: Record<string, number>, deadline: number, timedOut: boolean) => {
        const limit = testTimeLimit(questions.length)
        const durationSec = Math.min(limit, Math.round(limit - (deadline - Date.now()) / 1000))
        const answers = questions.map((q) => ({ conceptId: q.conceptId, correct: picks[q.id] === q.correctIndex }))
        const before = useOrbitStore.getState()
        const prev = before.testRecords[courseId]
        const xp = recordTestResult({ courseId, answers, durationSec, timedOut })
        const after = useOrbitStore.getState()
        const attempt = after.testRecords[courseId].last
        const correct = attempt.correct
        const rows = [{ label: `Đúng ${correct}/${attempt.total} câu`, xp: testXp(correct, attempt.total, prev && { correct: prev.bestCorrect, total: prev.bestTotal }).base }]
        const bonus = testXp(correct, attempt.total, prev && { correct: prev.bestCorrect, total: prev.bestTotal }).bonus
        if (bonus) rows.push({ label: `Đạt từ ${Math.round(TEST_PASS_RATIO * 100)}% · thưởng một lần`, xp: bonus })
        announceRewards(before, after, {
            context: `Test cuối chương · ${course.title}`,
            headline: correct / attempt.total >= TEST_PASS_RATIO ? 'Nắm chắc cả chương.' : 'Biết chỗ hổng là đã đi được nửa đường.',
            rows: rows.filter((r) => r.xp > 0 || rows.length === 1),
            next: { label: 'Xem cây kỹ năng', to: '/journey' },
        })
        setPhase({ kind: 'result', attempt, questions, picks, xp })
        window.scrollTo(0, 0)
    }

    return (
        <div className="w-full">
            <div className="mx-auto max-w-3xl px-5 py-8 lg:py-12">
                {phase.kind === 'intro' && (
                    <Intro
                        courseTitle={course.title}
                        bankSize={bank.length}
                        conceptCount={new Set(bank.map((q) => q.conceptId)).size}
                        last={record?.last}
                        onStart={start}
                        onShowLast={() => record && setPhase({ kind: 'result', attempt: record.last })}
                    />
                )}
                {phase.kind === 'running' && <Running key={phase.deadline} phase={phase} onSubmit={submit} onQuit={() => setPhase({ kind: 'intro' })} />}
                {phase.kind === 'result' && <Result courseTitle={course.title} phase={phase} onRetry={start} />}
            </div>
        </div>
    )
}

// ─── Giới thiệu ────────────────────────────────────────────────────────────

function Intro({ courseTitle, bankSize, conceptCount, last, onStart, onShowLast }: { courseTitle: string; bankSize: number; conceptCount: number; last?: TestAttempt; onStart: () => void; onShowLast: () => void }) {
    const count = Math.min(10, bankSize)
    const enough = bankSize >= 4
    return (
        <>
            <Link to="/learning" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                <ChevronLeft size={16} /> Khóa học
            </Link>
            <p className="mt-6 text-eyebrow uppercase text-brand-ink">Test cuối chương</p>
            <h1 className="mt-3 text-headline text-foreground">{courseTitle}</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Một bài test ngắn gom kiến thức của cả khóa. Kết quả cho biết bạn nắm vững từng khái niệm đến đâu và chỉ đúng đoạn video cần xem lại.
            </p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
                <Fact icon={<Target size={18} />} label="Số câu" value={`${count} câu`} note={`Chọn ngẫu nhiên từ ngân hàng ${bankSize} câu, ${conceptCount} khái niệm`} />
                <Fact icon={<Clock size={18} />} label="Thời gian" value={clock(testTimeLimit(count))} note="Hết giờ bài tự nộp" />
                <Fact icon={<BookOpen size={18} />} label="Phần thưởng" value={`+${TEST_XP_PER_CORRECT} XP / câu đúng`} note={`Thêm ${TEST_PASS_BONUS_XP} XP khi đạt ${Math.round(TEST_PASS_RATIO * 100)}%`} />
            </dl>

            <ul className="mt-6 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Không hiện đáp án trong lúc làm. Bạn có thể quay lại sửa câu trước khi nộp.</li>
                <li>Mỗi khái niệm tối đa một câu; thứ tự câu và đáp án được trộn, mỗi lần làm là một bộ khác.</li>
                <li>XP chỉ cộng khi bạn vượt kết quả tốt nhất trước đó, nên làm lại để ôn chứ không để cày điểm.</li>
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={onStart}
                    disabled={!enough}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <PlayCircle size={18} /> {last ? 'Làm lại' : 'Bắt đầu làm bài'}
                </button>
                {last && (
                    <button type="button" onClick={onShowLast} className="rounded-full border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition hover:bg-muted">
                        Xem kết quả lần trước ({last.correct}/{last.total})
                    </button>
                )}
            </div>
            {!enough && <p className="mt-4 text-sm text-muted-foreground">Khóa này chưa đủ câu hỏi đã xuất bản để làm test.</p>}
        </>
    )
}

function Fact({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
    return (
        <div className="rounded-card border border-border bg-card p-5 shadow-card">
            <dt className="flex items-center gap-2 text-eyebrow uppercase text-muted-foreground">
                {icon}
                {label}
            </dt>
            <dd className="mt-3 font-mono text-xl font-bold text-foreground">{value}</dd>
            <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</dd>
        </div>
    )
}

// ─── Làm bài ───────────────────────────────────────────────────────────────

function Running({
    phase,
    onSubmit,
    onQuit,
}: {
    phase: Extract<Phase, { kind: 'running' }>
    onSubmit: (questions: TestQuestion[], picks: Record<string, number>, deadline: number, timedOut: boolean) => void
    onQuit: () => void
}) {
    const { questions, deadline } = phase
    const [index, setIndex] = useState(0)
    const [picks, setPicks] = useState<Record<string, number>>({})
    const [left, setLeft] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    const picksRef = useRef(picks)
    useEffect(() => {
        picksRef.current = picks
    }, [picks])

    // Đếm ngược theo mốc giờ tuyệt đối, nên tab bị treo hay chạy nền vẫn không lệch giờ
    useEffect(() => {
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
            setLeft(remaining)
            if (remaining === 0) onSubmit(questions, picksRef.current, deadline, true)
        }
        const id = window.setInterval(tick, 500)
        return () => window.clearInterval(id)
    }, [deadline, questions, onSubmit])

    const q = questions[index]
    const answered = questions.filter((x) => picks[x.id] !== undefined).length
    const unanswered = questions.length - answered
    const low = left <= 60

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const n = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : 'abcd'.indexOf(e.key.toLowerCase())
            if (n >= 0 && n < q.options.length) setPicks((p) => ({ ...p, [q.id]: n }))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [q])

    return (
        <>
            <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
                <p className="text-sm font-semibold text-muted-foreground">
                    Câu <span className="font-mono font-bold text-foreground">{index + 1}</span>/{questions.length} · đã trả lời <span className="font-mono font-bold text-foreground">{answered}</span>
                </p>
                <p role="timer" aria-label={`Còn lại ${clock(left)}`} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-lg font-bold ${low ? 'bg-brand-600 text-ink-foreground' : 'bg-muted text-foreground'}`}>
                    <Clock size={16} /> {clock(left)}
                </p>
            </div>

            <div className="mt-8" key={q.id}>
                <p className="text-eyebrow uppercase text-brand-ink">{getConcept(q.conceptId)?.name ?? 'Câu hỏi'}</p>
                <h2 className="mt-3 text-title text-foreground">{q.prompt}</h2>
                <ul className="mt-6 flex flex-col gap-3">
                    {q.options.map((opt, i) => {
                        const on = picks[q.id] === i
                        return (
                            <li key={i}>
                                <button
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => setPicks((p) => ({ ...p, [q.id]: i }))}
                                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition duration-fast ${
                                        on ? 'border-brand-600 bg-brand-50 text-foreground' : 'border-border bg-card text-foreground hover:border-brand-300'
                                    }`}
                                >
                                    <span className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${on ? 'bg-brand-600 text-ink-foreground' : 'bg-muted text-muted-foreground'}`}>{LETTERS[i]}</span>
                                    {opt}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-40">
                    <ArrowLeft size={15} /> Câu trước
                </button>
                <nav aria-label="Chọn câu" className="flex flex-wrap justify-center gap-1.5">
                    {questions.map((x, i) => (
                        <button
                            key={x.id}
                            type="button"
                            aria-label={`Câu ${i + 1}${picks[x.id] !== undefined ? ', đã trả lời' : ', chưa trả lời'}`}
                            aria-current={i === index ? 'step' : undefined}
                            onClick={() => setIndex(i)}
                            className={`h-8 w-8 rounded-full font-mono text-xs font-bold transition ${
                                i === index ? 'bg-brand-600 text-ink-foreground' : picks[x.id] !== undefined ? 'bg-brand-100 text-brand-ink' : 'bg-muted text-muted-foreground hover:bg-border'
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </nav>
                {index < questions.length - 1 ? (
                    <button type="button" onClick={() => setIndex((i) => i + 1)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90">
                        Câu sau <ArrowRight size={15} />
                    </button>
                ) : (
                    <span className="w-[116px]" />
                )}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-border pt-6">
                <button
                    type="button"
                    onClick={() => onSubmit(questions, picks, deadline, false)}
                    className="rounded-full bg-brand-600 px-7 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700"
                >
                    Nộp bài{unanswered > 0 ? ` (còn ${unanswered} câu chưa trả lời)` : ''}
                </button>
                <button type="button" onClick={onQuit} className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline">
                    Thoát, không tính kết quả
                </button>
            </div>
        </>
    )
}

// ─── Kết quả + lộ trình ôn tập ────────────────────────────────────────────

function Result({ courseTitle, phase, onRetry }: { courseTitle: string; phase: Extract<Phase, { kind: 'result' }>; onRetry: () => void }) {
    const { attempt, questions, picks, xp } = phase
    const pctScore = Math.round((attempt.correct / attempt.total) * 100)
    const passed = attempt.correct / attempt.total >= TEST_PASS_RATIO
    const gaps = attempt.concepts.filter((c) => !c.correct)
    const wrong = questions?.filter((q) => picks?.[q.id] !== q.correctIndex) ?? []

    return (
        <>
            <Link to="/learning" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                <ChevronLeft size={16} /> Khóa học
            </Link>
            <section aria-label="Kết quả test" className="mt-6 rounded-panel surface-red-deep p-7 shadow-brand">
                <p className="text-eyebrow uppercase text-ink-foreground/70">Kết quả · {courseTitle}</p>
                <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-3">
                    <p className="font-mono text-7xl font-bold leading-none">
                        {attempt.correct}
                        <span className="text-4xl text-ink-foreground/70">/{attempt.total}</span>
                    </p>
                    <div>
                        <p className="text-2xl font-bold">{pctScore}%</p>
                        <p className="text-sm text-ink-foreground/80">
                            {passed ? 'Đạt mức nắm chắc' : 'Còn vài khái niệm cần ôn'} · {attempt.timedOut ? 'hết giờ' : `làm trong ${clock(attempt.durationSec)}`}
                        </p>
                    </div>
                    {xp !== undefined && (
                        <p className="ml-auto inline-flex items-center rounded-full bg-ink-foreground/15 px-4 py-2 font-mono text-sm font-bold">{xp > 0 ? `+${xp} XP` : 'Chưa vượt kỷ lục, không cộng XP'}</p>
                    )}
                </div>
            </section>

            <section className="mt-10" aria-labelledby="mastery-title">
                <h2 id="mastery-title" className="text-title text-foreground">Mức nắm vững từng khái niệm</h2>
                <p className="mt-1 text-sm text-muted-foreground">Thanh là mức sau test, đã gộp với kết quả học trước đó. Cây kỹ năng được cập nhật theo đây.</p>
                <ul className="mt-5 flex flex-col gap-3">
                    {attempt.concepts.map((c) => {
                        const after = Math.round(c.after * 100)
                        return (
                            <li key={c.conceptId} className="rounded-card border border-border bg-card p-5 shadow-card">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-foreground">{getConcept(c.conceptId)?.name ?? c.conceptId}</span>
                                    <span className="flex items-center gap-3">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${c.correct ? 'bg-success/15 text-success' : 'bg-brand-soft text-brand-ink'}`}>
                                            {c.correct ? <Check size={12} /> : <TriangleAlert size={12} />}
                                            {c.correct ? 'Trả lời đúng' : 'Còn hổng'}
                                        </span>
                                        <span className="font-mono text-xl font-bold text-foreground">{after}%</span>
                                    </span>
                                </div>
                                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Nắm vững ${after}%`}>
                                    <div className={`h-full rounded-full ${c.correct ? 'bg-success' : 'bg-brand-600'}`} style={{ width: `${after}%` }} />
                                </div>
                                {c.before !== null && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Trước test: <span className="font-mono">{Math.round(c.before * 100)}%</span>
                                    </p>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </section>

            <section className="mt-10" aria-labelledby="plan-title">
                <h2 id="plan-title" className="text-title text-foreground">Lộ trình ôn tập</h2>
                {gaps.length === 0 ? (
                    <p className="mt-3 rounded-card border border-border bg-card p-5 text-[15px] text-muted-foreground shadow-card">Không còn khái niệm nào hổng trong lượt này. Bạn có thể sang bài Orbit Daily hoặc làm lại để kiểm tra bộ câu khác.</p>
                ) : (
                    <>
                        <p className="mt-1 text-sm text-muted-foreground">Với mỗi khái niệm còn hổng: xem lại đúng đoạn giảng, rồi đọc bài Daily liên quan.</p>
                        <ol className="mt-5 flex flex-col gap-4">
                            {gaps.map((g, i) => {
                                const step = reviewStepFor(g.conceptId)
                                if (!step) return null
                                return (
                                    <li key={g.conceptId} className="rounded-card border border-border bg-card p-5 shadow-card">
                                        <p className="flex items-center gap-3 font-bold text-foreground">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 font-mono text-xs text-ink-foreground">{i + 1}</span>
                                            {step.conceptName}
                                        </p>
                                        <div className="mt-4 flex flex-col gap-2.5 text-sm">
                                            <Link to={`/lesson/${step.lessonId}?t=${step.start}`} className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted px-4 py-3 font-semibold text-foreground transition hover:bg-border">
                                                <PlayCircle size={16} className="text-brand-ink" />
                                                Xem lại <span className="font-mono text-brand-ink">{formatTime(step.start)}–{formatTime(step.end)}</span>
                                                <span className="font-normal text-muted-foreground">· {step.lessonTitle}</span>
                                            </Link>
                                            {step.daily.map((a) => (
                                                <Link key={a.id} to={`/daily/${a.id}`} className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-3 font-semibold text-foreground transition hover:bg-border">
                                                    <BookOpen size={16} className="text-brand-ink" />
                                                    Orbit Daily: <span className="font-normal text-muted-foreground">{a.title}</span>
                                                </Link>
                                            ))}
                                            {step.daily.length === 0 && <p className="px-1 text-muted-foreground">Chưa có bài Daily về khái niệm này.</p>}
                                        </div>
                                    </li>
                                )
                            })}
                        </ol>
                    </>
                )}
            </section>

            {wrong.length > 0 && questions && picks && (
                <section className="mt-10" aria-labelledby="wrong-title">
                    <h2 id="wrong-title" className="text-title text-foreground">Các câu chưa đúng</h2>
                    <ul className="mt-5 flex flex-col gap-4">
                        {wrong.map((q) => {
                            const pick = picks[q.id]
                            return (
                                <li key={q.id} className="rounded-card border border-border bg-card p-5 shadow-card">
                                    <p className="font-bold text-foreground">{q.prompt}</p>
                                    <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                                        <X size={15} className="mt-0.5 shrink-0 text-brand-ink" />
                                        {pick === undefined ? 'Bạn chưa trả lời câu này.' : <>Bạn chọn: {q.options[pick]}</>}
                                    </p>
                                    <p className="mt-1.5 flex items-start gap-2 text-sm text-foreground">
                                        <Check size={15} className="mt-0.5 shrink-0 text-success" />
                                        Đáp án đúng: {q.options[q.correctIndex]}
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{q.explanation}</p>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}

            <div className="mt-10 flex flex-wrap gap-3 border-t border-border pt-6">
                <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                    <RotateCcw size={16} /> Làm lại với bộ câu khác
                </button>
                <Link to="/journey" className="rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted">
                    Xem cây kỹ năng
                </Link>
            </div>
        </>
    )
}
