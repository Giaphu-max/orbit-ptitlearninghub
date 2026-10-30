import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, Clock, PlayCircle, RotateCcw, Target, TriangleAlert, X } from 'lucide-react'
import { getConcept, getCourse } from '@/data'
import { announceRewards } from '@/lib/gamification'
import {
    reviewStepFor,
    testTimeLimit,
    testXp,
    MASTERED_RATIO,
    TEST_MIN_XP_RATIO,
    TEST_PASS_BONUS_XP,
    TEST_XP_PER_CORRECT,
    type TestQuestion,
} from '@/lib/final-test'
import { useCourseLessons } from '@/lib/lesson-edits'
import { courseFullyPublished, finalKey, finalSetFor, passCount, prepareQuestions, resolveSet, sourcedBank, useCourseAllLessons } from '@/lib/test-sets'
import { useTeacherCourses } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import type { TestRules } from '@/lib/test-sets'
import { useOrbitStore, type ActiveTestSession, type TestAttempt } from '@/store/useOrbitStore'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`

function isSessionValid(session?: ActiveTestSession): session is ActiveTestSession {
    if (!session) return false
    if (!Array.isArray(session.questions) || session.questions.length === 0) return false
    if (typeof session.remainingSec !== 'number' || session.remainingSec <= 0) return false
    const MAX_AGE_MS = 24 * 60 * 60 * 1000
    if (Date.now() - session.updatedAt > MAX_AGE_MS) return false
    return true
}

type Phase =
    | { kind: 'intro' }
    | {
        kind: 'running'
        questions: TestQuestion[]
        deadline: number
        initialIndex?: number
        initialPicks?: Record<string, number>
      }
    | { kind: 'result'; attempt: TestAttempt; questions?: TestQuestion[]; picks?: Record<string, number>; xp?: number }

/** /test/:courseId – test tổng hợp cuối chương: câu từ ngân hàng của khóa, trộn thứ tự, có giờ. Kết quả cập nhật bản đồ kỹ năng và XP. */
export function OrbitTestView({ preview = false }: { preview?: boolean } = {}) {
    const { courseId } = useParams()
    const teacherCourses = useTeacherCourses()
    const course = courseId ? (getCourse(courseId) ?? (preview ? teacherCourses.find((c) => c.id === courseId) : undefined)) : undefined
    const visibleLessons = useCourseLessons(courseId)
    const allLessons = useCourseAllLessons(courseId)
    // Xem thử của giảng viên: dùng cả bài chưa xuất bản; sinh viên chỉ thấy câu của bài đã xuất bản
    const lessons = preview ? allLessons : visibleLessons
    const stored = useOrbitStore((s) => (courseId ? s.testSets[finalKey(courseId)] : undefined))
    const fullyPublished = useOrbitStore((s) => (courseId ? courseFullyPublished(courseId, s) : false))
    const progress = useOrbitStore((s) => s.lessonProgress)
    // Đề và luật do thầy cô duyệt (chưa chỉnh thì đề AI soạn sẵn); không bốc ngẫu nhiên từ kho nữa
    const set = useMemo(() => finalSetFor(allLessons, stored), [allLessons, stored])
    const bank = useMemo(() => sourcedBank(lessons), [lessons])
    const fixed = useMemo(() => resolveSet(set, bank), [set, bank])
    const rules = set.rules
    const published = preview || (stored?.published ?? fullyPublished)
    const record = useOrbitStore((s) => (courseId ? s.testRecords[courseId] : undefined))
    const recordTestResult = useOrbitStore((s) => s.recordTestResult)
    const activeSession = useOrbitStore((s) => (courseId && !preview ? s.activeTestSessions?.[courseId] : undefined))
    const saveTestSession = useOrbitStore((s) => s.saveTestSession)
    const clearTestSession = useOrbitStore((s) => s.clearTestSession)
    const [phase, setPhase] = useState<Phase>({ kind: 'intro' })

    const handleAutoSave = useCallback(
        (data: { currentIndex: number; answers: Record<string, number>; remainingSec: number }) => {
            if (!courseId || phase.kind !== 'running' || preview) return
            saveTestSession(courseId, {
                courseId,
                questionIds: phase.questions.map((q) => q.id),
                questions: phase.questions,
                currentIndex: data.currentIndex,
                answers: data.answers,
                remainingSec: data.remainingSec,
                updatedAt: Date.now(),
            })
        },
        [courseId, phase, saveTestSession, preview],
    )

    if (!course || !courseId) return <Navigate to="/" replace />

    const back = preview ? { to: `/teacher/test/${courseId}`, label: 'Quay lại soạn đề' } : { to: '/learning', label: 'Khóa học' }
    const doneLessons = visibleLessons.filter((l) => progress[l.id]?.completed).length
    const missing = rules.opens === 'all' ? visibleLessons.length - doneLessons : rules.opens === 'almost' ? visibleLessons.length - 1 - doneLessons : 0
    const outOfAttempts = !preview && rules.attempts !== null && (record?.attempts ?? 0) >= rules.attempts
    if (!published || fixed.length === 0) return <Locked back={back} title="Thầy cô chưa mở bài kiểm tra này." note="Khi thầy cô duyệt và xuất bản đề, Test cuối chương sẽ mở ở đây." />
    if (!preview && missing > 0) return <Locked back={back} title={`Hoàn thành thêm ${missing} bài để mở Test cuối chương.`} note={`Thầy cô đặt điều kiện mở: ${rules.opens === 'all' ? 'xong cả' : 'xong gần hết'} ${visibleLessons.length} bài của khóa. Bạn đã xong ${doneLessons}/${visibleLessons.length} bài.`} />

    const validSession = isSessionValid(activeSession) ? activeSession : undefined

    const resume = (session: ActiveTestSession) => {
        const deadline = Date.now() + Math.max(1, session.remainingSec) * 1000
        setPhase({
            kind: 'running',
            questions: session.questions,
            deadline,
            initialIndex: Math.min(Math.max(0, session.currentIndex), session.questions.length - 1),
            initialPicks: session.answers,
        })
        window.scrollTo(0, 0)
    }

    const start = () => {
        if (courseId && !preview) clearTestSession(courseId)
        const questions = prepareQuestions(fixed, rules)
        const timeLimit = testTimeLimit(questions.length, rules.secondsPerQuestion)
        const deadline = Date.now() + timeLimit * 1000
        if (courseId && !preview) {
            saveTestSession(courseId, {
                courseId,
                questionIds: questions.map((q) => q.id),
                questions,
                currentIndex: 0,
                answers: {},
                remainingSec: timeLimit,
                updatedAt: Date.now(),
            })
        }
        setPhase({ kind: 'running', questions, deadline, initialIndex: 0, initialPicks: {} })
        window.scrollTo(0, 0)
    }

    const submit = (questions: TestQuestion[], picks: Record<string, number>, deadline: number, timedOut: boolean) => {
        if (courseId && !preview) clearTestSession(courseId)
        const limit = testTimeLimit(questions.length, rules.secondsPerQuestion)
        const durationSec = Math.min(limit, Math.round(limit - (deadline - Date.now()) / 1000))
        const answers = questions.map((q) => ({ conceptId: q.conceptId, correct: picks[q.id] === q.correctIndex, blank: picks[q.id] === undefined }))
        if (preview) {
            // Xem thử: không ghi điểm, không cộng XP
            const correct = answers.filter((a) => a.correct).length
            const attempt: TestAttempt = { at: new Date().toISOString(), correct, total: answers.length, durationSec, timedOut, concepts: answers.map((a) => ({ conceptId: a.conceptId, correct: a.correct, blank: a.blank, before: null, after: a.correct ? 1 : 0 })) }
            setPhase({ kind: 'result', attempt, questions, picks })
            window.scrollTo(0, 0)
            return
        }
        const before = useOrbitStore.getState()
        const prev = before.testRecords[courseId]
        const xp = recordTestResult({ courseId, answers, durationSec, timedOut, passRatio: rules.passRatio })
        const after = useOrbitStore.getState()
        const attempt = after.testRecords[courseId].last
        const correct = attempt.correct
        const rows = [{ label: `Đúng ${correct}/${attempt.total} câu`, xp: testXp(correct, attempt.total, prev && { correct: prev.bestCorrect, total: prev.bestTotal }, rules.passRatio).base }]
        const bonus = testXp(correct, attempt.total, prev && { correct: prev.bestCorrect, total: prev.bestTotal }, rules.passRatio).bonus
        if (bonus) rows.push({ label: `Đạt từ ${passCount(rules, attempt.total)}/${attempt.total} · thưởng một lần`, xp: bonus })
        // Một hành động chính: ôn khái niệm yếu nhất trong lộ trình (xem lại đúng đoạn giảng)
        const weakest = attempt.concepts.filter((c) => !c.correct && c.after < MASTERED_RATIO).sort((a, b) => a.after - b.after)[0]
        const step = weakest ? reviewStepFor(weakest.conceptId) : undefined
        const weakestStep = step ? { label: `Ôn: ${step.conceptName}`, to: `/lesson/${step.lessonId}?t=${step.start}` } : undefined
        announceRewards(before, after, {
            context: `Test cuối chương · ${course.title}`,
            headline: correct / attempt.total >= rules.passRatio ? 'Nắm chắc cả chương.' : 'Biết chỗ hổng là đã đi được nửa đường.',
            rows: rows.filter((r) => r.xp > 0 || rows.length === 1),
            next: weakestStep ?? { label: 'Xem bản đồ kỹ năng', to: '/journey' },
        }, { source: 'test', next: weakestStep ?? { label: 'Xem bản đồ kỹ năng', to: '/journey' } })
        setPhase({ kind: 'result', attempt, questions, picks, xp })
        window.scrollTo(0, 0)
    }

    return (
        <div className="w-full">
            <div className="container-wide py-8 lg:py-12"><div className="mx-auto max-w-3xl">
                {preview && <p className="mb-4 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-ink">Xem thử như sinh viên: kết quả không được ghi và không cộng XP.</p>}
                {phase.kind === 'intro' && (
                    <Intro
                        courseTitle={course.title}
                        rules={rules}
                        count={fixed.length}
                        conceptCount={new Set(fixed.map((q) => q.conceptId)).size}
                        back={back}
                        outOfAttempts={outOfAttempts}
                        attemptsLeft={rules.attempts === null || preview ? null : rules.attempts - (record?.attempts ?? 0)}
                        last={record?.last}
                        activeSession={validSession}
                        onResume={resume}
                        onDiscard={() => courseId && clearTestSession(courseId)}
                        onStart={start}
                        onShowLast={() => record && setPhase({ kind: 'result', attempt: record.last })}
                    />
                )}
                {phase.kind === 'running' && (
                    <Running
                        key={phase.deadline}
                        phase={phase}
                        onAutoSave={handleAutoSave}
                        onSubmit={submit}
                        onQuit={() => {
                            if (courseId) clearTestSession(courseId)
                            setPhase({ kind: 'intro' })
                        }}
                    />
                )}
                {phase.kind === 'result' && <Result courseTitle={course.title} phase={phase} onRetry={start} passRatio={rules.passRatio} back={back} canRetry={!outOfAttempts} />}
            </div>
            </div>
        </div>
    )
}

// ─── Giới thiệu ────────────────────────────────────────────────────────────

function Intro({
    courseTitle,
    rules,
    count,
    conceptCount,
    back,
    outOfAttempts,
    attemptsLeft,
    last,
    activeSession,
    onResume,
    onDiscard,
    onStart,
    onShowLast,
}: {
    courseTitle: string
    rules: TestRules
    count: number
    conceptCount: number
    back: { to: string; label: string }
    outOfAttempts: boolean
    attemptsLeft: number | null
    last?: TestAttempt
    activeSession?: ActiveTestSession
    onResume: (session: ActiveTestSession) => void
    onDiscard: () => void
    onStart: () => void
    onShowLast: () => void
}) {
    const enough = count >= 1 && !outOfAttempts
    const needed = passCount(rules, count)
    return (
        <>
            <Link to={back.to} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                <ChevronLeft size={16} /> {back.label}
            </Link>
            <p className="mt-6 text-eyebrow uppercase text-brand-ink">Test cuối chương</p>
            <h1 className="mt-3 text-headline text-foreground">{courseTitle}</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Một bài test ngắn gom kiến thức của cả khóa. Kết quả cho biết bạn nắm vững từng khái niệm đến đâu và chỉ đúng đoạn video cần xem lại.
            </p>

            {activeSession && (
                <div className="mt-6 rounded-card border border-brand-200 bg-brand-50/70 p-5 shadow-card dark:border-brand-900/40 dark:bg-brand-950/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <p className="flex items-center gap-1.5 text-eyebrow uppercase text-brand-ink">
                                <Clock size={13} className="shrink-0" /> Tự động lưu nháp
                            </p>
                            <h2 className="text-base font-bold text-foreground">
                                Phát hiện bài làm dở (Câu <span className="font-mono">{activeSession.currentIndex + 1}</span>/{activeSession.questions.length} • Đã chọn <span className="font-mono">{Object.keys(activeSession.answers).length}</span> câu)
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Thời gian còn lại: <span className="font-mono font-semibold text-foreground">{clock(activeSession.remainingSec)}</span>. Bạn có thể khôi phục tiến độ hoặc làm lại bài mới.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                            <button
                                type="button"
                                onClick={() => onResume(activeSession)}
                                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700"
                            >
                                <PlayCircle size={16} /> Làm tiếp từ câu {activeSession.currentIndex + 1}
                            </button>
                            <button
                                type="button"
                                onClick={onDiscard}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-muted-foreground/40 hover:text-foreground"
                            >
                                <RotateCcw size={14} /> Làm lại bài mới
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
                <Fact icon={<Target size={18} />} label="Số câu" value={`${count} câu`} note={`Đề do thầy cô duyệt, ${conceptCount} khái niệm`} />
                <Fact icon={<Clock size={18} />} label="Thời gian" value={clock(testTimeLimit(count, rules.secondsPerQuestion))} note={`${rules.secondsPerQuestion}s/câu · hết giờ bài tự nộp`} />
                <Fact icon={<BookOpen size={18} />} label="Phần thưởng" value={`+${TEST_XP_PER_CORRECT} XP/câu`} note={`Mỗi câu đúng vượt kỷ lục. Thêm ${TEST_PASS_BONUS_XP} XP khi đạt từ ${needed}/${count}`} />
            </dl>

            <ul className="mt-6 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Không hiện đáp án trong lúc làm. Bạn có thể quay lại sửa câu trước khi nộp.</li>
                <li>Đúng từ {needed}/{count} câu là đạt. {rules.shuffleQuestions || rules.shuffleOptions ? 'Thứ tự câu và đáp án được trộn mỗi lần làm.' : 'Câu hỏi giữ nguyên thứ tự thầy cô sắp.'}</li>
                <li>XP chỉ cộng khi đúng từ {TEST_MIN_XP_RATIO * 100}% số câu và vượt kết quả tốt nhất trước đó, nên làm lại để ôn chứ không để cày điểm.</li>
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
            {outOfAttempts && <p className="mt-4 text-sm font-semibold text-brand-ink">Bạn đã dùng hết lượt làm bài này. Xem kết quả lần trước để ôn phần còn yếu.</p>}
            {attemptsLeft !== null && !outOfAttempts && <p className="mt-4 text-sm text-muted-foreground">Còn {attemptsLeft} lượt làm bài.</p>}
        </>
    )
}

export function Fact({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
    return (
        <div className="flex flex-col rounded-card border border-border bg-card p-5 shadow-card">
            <dt className="flex items-center gap-2 text-eyebrow uppercase text-muted-foreground">
                {icon}
                {label}
            </dt>
            <dd className="mt-3 whitespace-nowrap font-mono text-xl font-bold text-foreground">{value}</dd>
            <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</dd>
        </div>
    )
}

// ─── Làm bài ───────────────────────────────────────────────────────────────

export function Running({
    phase,
    onSubmit,
    onQuit,
    onAutoSave,
    split = false,
}: {
    /** Bố cục lưới 8/4 (checkpoint): câu hỏi cột 8, đồng hồ + danh sách câu + nút nộp cột 4. Mặc định: một cột cũ của test cuối chương */
    split?: boolean
    phase: Extract<Phase, { kind: 'running' }>
    onSubmit: (questions: TestQuestion[], picks: Record<string, number>, deadline: number, timedOut: boolean) => void
    onQuit: () => void
    onAutoSave?: (session: { currentIndex: number; answers: Record<string, number>; remainingSec: number }) => void
}) {
    const { questions, deadline } = phase
    const initialIndex = 'initialIndex' in phase && typeof phase.initialIndex === 'number' ? phase.initialIndex : 0
    const initialPicks = 'initialPicks' in phase && phase.initialPicks ? phase.initialPicks : {}
    const [index, setIndex] = useState(initialIndex)
    const [picks, setPicks] = useState<Record<string, number>>(initialPicks)
    const [left, setLeft] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))

    const isSubmittedRef = useRef(false)
    const picksRef = useRef(picks)
    const indexRef = useRef(index)
    const leftRef = useRef(left)
    const onAutoSaveRef = useRef(onAutoSave)

    useEffect(() => {
        picksRef.current = picks
    }, [picks])

    useEffect(() => {
        indexRef.current = index
    }, [index])

    useEffect(() => {
        leftRef.current = left
    }, [left])

    useEffect(() => {
        onAutoSaveRef.current = onAutoSave
    })

    const saveNow = useCallback((newIndex = indexRef.current, newPicks = picksRef.current, newLeft = leftRef.current) => {
        if (isSubmittedRef.current) return
        onAutoSaveRef.current?.({
            currentIndex: newIndex,
            answers: newPicks,
            remainingSec: newLeft,
        })
    }, [])

    // Đóng tab hoặc tải lại giữa chừng: lưu trạng thái và hỏi lại trước khi rời trang
    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            saveNow(indexRef.current, picksRef.current, leftRef.current)
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [saveNow])

    // Khi chọn đáp án: tự động lưu
    const isFirstPicks = useRef(true)
    useEffect(() => {
        if (isFirstPicks.current) {
            isFirstPicks.current = false
            return
        }
        saveNow(indexRef.current, picks, leftRef.current)
    }, [picks, saveNow])

    // Khi chuyển câu: tự động lưu
    const isFirstIndex = useRef(true)
    useEffect(() => {
        if (isFirstIndex.current) {
            isFirstIndex.current = false
            return
        }
        saveNow(index, picksRef.current, leftRef.current)
    }, [index, saveNow])

    // Đếm ngược theo mốc giờ tuyệt đối, mỗi 3 giây tự động lưu thời gian còn lại
    useEffect(() => {
        let tickCount = 0
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
            setLeft(remaining)
            leftRef.current = remaining
            if (remaining === 0) {
                isSubmittedRef.current = true
                onSubmit(questions, picksRef.current, deadline, true)
                return
            }
            tickCount++
            if (tickCount % 6 === 0) {
                saveNow(indexRef.current, picksRef.current, remaining)
            }
        }
        const id = window.setInterval(tick, 500)
        return () => window.clearInterval(id)
    }, [deadline, questions, onSubmit, saveNow])

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

    const timer = (
        <p role="timer" aria-label={`Còn lại ${clock(left)}`} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-lg font-bold ${low ? 'bg-brand-600 text-ink-foreground' : 'bg-muted text-foreground'}`}>
            <Clock size={16} /> {clock(left)}
        </p>
    )
    const progress = (
        <p className="text-sm font-semibold text-muted-foreground">
            Câu <span className="font-mono font-bold text-foreground">{index + 1}</span>/{questions.length} · đã trả lời <span className="font-mono font-bold text-foreground">{answered}</span>
        </p>
    )
    const question = (
        <div key={q.id}>
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
    )
    const prevButton = (
        <button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-40">
            <ArrowLeft size={15} /> Câu trước
        </button>
    )
    const nextButton =
        index < questions.length - 1 ? (
            <button type="button" onClick={() => setIndex((i) => i + 1)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90">
                Câu sau <ArrowRight size={15} />
            </button>
        ) : (
            <span className="w-[116px]" />
        )
    const numbers = (
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
    )
    const submitButton = (
        <button
            type="button"
            onClick={() => {
                isSubmittedRef.current = true
                onSubmit(questions, picks, deadline, false)
            }}
            className="rounded-full bg-brand-600 px-7 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700"
        >
            Nộp bài{unanswered > 0 ? ` (còn ${unanswered} câu chưa trả lời)` : ''}
        </button>
    )
    const quitButton = (
        <button
            type="button"
            onClick={() => {
                if (answered === 0 || window.confirm('Thoát giữa chừng sẽ mất bài đang làm và không tính kết quả. Bạn chắc chứ?')) {
                    isSubmittedRef.current = true
                    onQuit()
                }
            }}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
            Thoát, không tính kết quả
        </button>
    )

    if (split) {
        return (
            <div className="lesson-grid items-start">
                <section className="rounded-[24px] border border-border bg-card p-8 shadow-card">
                    {question}
                    <div className="mt-8 flex items-center justify-between gap-3">
                        {prevButton}
                        {nextButton}
                    </div>
                </section>
                <aside className="flex flex-col gap-5 rounded-[24px] border border-border bg-card p-6 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                        {progress}
                        {timer}
                    </div>
                    {numbers}
                    <div className="flex flex-col items-start gap-4 border-t border-border pt-5">
                        {submitButton}
                        {quitButton}
                    </div>
                </aside>
            </div>
        )
    }

    return (
        <>
            <div className="sticky top-[var(--nav-h)] z-10 -mx-5 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
                {progress}
                {timer}
            </div>

            <div className="mt-8">{question}</div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                {prevButton}
                {numbers}
                {nextButton}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-border pt-6">
                {submitButton}
                {quitButton}
            </div>
        </>
    )
}

// ─── Kết quả + lộ trình ôn tập ────────────────────────────────────────────

function Result({ courseTitle, phase, onRetry, passRatio, back, canRetry }: { courseTitle: string; phase: Extract<Phase, { kind: 'result' }>; onRetry: () => void; passRatio: number; back: { to: string; label: string }; canRetry: boolean }) {
    const { attempt, questions, picks, xp } = phase
    const pctScore = Math.round((attempt.correct / attempt.total) * 100)
    const passed = attempt.correct / attempt.total >= passRatio
    // Đã nắm chắc = mức sau test từ 80%, kể cả khi câu test vừa rồi sai; còn lại hiện đầy đủ, chỉ khái niệm trả lời sai/bỏ trống mới vào lộ trình ôn
    const passedConcepts = attempt.concepts.filter((c) => c.after >= MASTERED_RATIO)
    const openConcepts = attempt.concepts.filter((c) => c.after < MASTERED_RATIO)
    const gaps = openConcepts.filter((c) => !c.correct)
    const wrong = questions?.filter((q) => picks?.[q.id] !== q.correctIndex) ?? []

    return (
        <>
            <Link to={back.to} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                <ChevronLeft size={16} /> {back.label}
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
                        <p className="ml-auto inline-flex items-center rounded-full bg-ink-foreground/15 px-4 py-2 font-mono text-sm font-bold">{xp > 0 ? `+${xp} XP` : pctScore < TEST_MIN_XP_RATIO * 100 ? `Dưới ${TEST_MIN_XP_RATIO * 100}% số câu đúng, chưa cộng XP` : 'Chưa vượt kỷ lục, không cộng XP'}</p>
                    )}
                </div>
            </section>

            <section className="mt-10" aria-labelledby="mastery-title">
                <h2 id="mastery-title" className="text-title text-foreground">Mức nắm vững từng khái niệm</h2>
                <p className="mt-1 text-sm text-muted-foreground">Thanh là mức sau test, đã gộp với kết quả học trước đó. Bản đồ kỹ năng được cập nhật theo đây.</p>
                <ul className="mt-5 flex flex-col gap-3">
                    {openConcepts.map((c) => {
                        const after = Math.round(c.after * 100)
                        return (
                            <li key={c.conceptId} className={`rounded-card border bg-card p-5 shadow-card ${c.correct ? 'border-border' : 'border-brand-200'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-foreground">{getConcept(c.conceptId)?.name ?? c.conceptId}</span>
                                    <span className="flex items-center gap-3">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${c.correct ? 'bg-muted text-muted-foreground' : 'bg-brand-soft text-brand-ink'}`}>
                                            {c.correct ? <Check size={12} /> : <TriangleAlert size={12} />}
                                            {c.correct ? 'Đúng, cần củng cố' : c.blank ? 'Chưa trả lời' : 'Còn hổng'}
                                        </span>
                                        <span className="font-mono text-xl font-bold text-foreground">{after}%</span>
                                    </span>
                                </div>
                                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Nắm vững ${after}%`}>
                                    <div className={`h-full rounded-full ${c.correct ? 'bg-foreground/40' : 'bg-brand-600'}`} style={{ width: `${after}%` }} />
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
                {passedConcepts.length > 0 && (
                    <details className="group mt-4 rounded-card border border-border bg-card shadow-card" open={openConcepts.length === 0}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-foreground">
                            <span className="inline-flex items-center gap-2">
                                <Check size={16} className="text-success" />
                                Đã nắm chắc {passedConcepts.length} khái niệm
                            </span>
                            <ChevronDown size={16} className="text-muted-foreground transition group-open:rotate-180" aria-hidden />
                        </summary>
                        <ul className="divide-y divide-border border-t border-border">
                            {passedConcepts.map((c) => (
                                <li key={c.conceptId} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                                    <span className="min-w-0 flex-1 truncate text-foreground">{getConcept(c.conceptId)?.name ?? c.conceptId}</span>
                                    <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden>
                                        <span className="block h-full rounded-full bg-success" style={{ width: `${Math.round(c.after * 100)}%` }} />
                                    </span>
                                    <span className="w-10 shrink-0 text-right font-mono font-bold text-foreground">{Math.round(c.after * 100)}%</span>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </section>

            <section className="mt-10" aria-labelledby="plan-title">
                <h2 id="plan-title" className="text-title text-foreground">Lộ trình ôn tập</h2>
                {gaps.length === 0 ? (
                    <p className="mt-3 rounded-card border border-border bg-card p-5 text-[15px] text-muted-foreground shadow-card">Không còn khái niệm nào hổng trong lượt này. Bạn có thể sang phần Ôn tập hoặc làm lại để kiểm tra bộ câu khác.</p>
                ) : (
                    <>
                        <p className="mt-1 text-sm text-muted-foreground">Với mỗi khái niệm còn hổng: xem lại đúng đoạn giảng, rồi đọc bài đọc liên quan.</p>
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
                                                    Bài đọc hôm nay: <span className="font-normal text-muted-foreground">{a.title}</span>
                                                </Link>
                                            ))}
                                            {step.daily.length === 0 && <p className="px-1 text-muted-foreground">Chưa có bài đọc về khái niệm này.</p>}
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
                {canRetry ? (
                    <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                        <RotateCcw size={16} /> Làm lại
                    </button>
                ) : (
                    <p className="self-center text-sm font-semibold text-muted-foreground">Bạn đã dùng hết lượt làm bài.</p>
                )}
                <Link to="/journey" className="rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition hover:bg-muted">
                    Xem bản đồ kỹ năng
                </Link>
            </div>
        </>
    )
}

/** Đề chưa mở hoặc chưa đủ điều kiện mở: báo thân thiện, có đường về. */
function Locked({ back, title, note }: { back: { to: string; label: string }; title: string; note: string }) {
    return (
        <div className="w-full">
            <div className="container-wide py-12">
                <section className="mx-auto max-w-xl rounded-[24px] border border-border bg-card px-10 py-12 text-center shadow-card">
                    <h1 className="text-2xl font-black text-strong">{title}</h1>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{note}</p>
                    <Link to={back.to} className="surface-red mt-7 inline-flex h-11 items-center rounded-xl px-5 text-sm font-extrabold text-ink-foreground shadow-brand">
                        {back.label}
                    </Link>
                </section>
            </div>
        </div>
    )
}

/** Giảng viên làm thử đề đang soạn trong khung giảng viên (đúng giao diện của sinh viên, không ghi điểm). */
export function OrbitTestPreview() {
    return <OrbitTestView preview />
}
