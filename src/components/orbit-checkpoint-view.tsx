import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Play } from 'lucide-react'
import { testTimeLimit, TEST_PASS_BONUS_XP, TEST_XP_PER_CORRECT, type TestQuestion } from '@/lib/final-test'
import { passCount, prepareQuestions, quickSetFor, resolveSet, sourcedBank } from '@/lib/test-sets'
import { UNLOCK_THRESHOLD } from '@/lib/gamification'
import { useEffectiveLesson } from '@/lib/catalog'
import { useOrbitStore } from '@/store/useOrbitStore'
import { clock, Running } from '@/components/orbit-test-view'
import { LessonHeader } from '@/components/lesson/lesson-header'

type Phase = { kind: 'intro' } | { kind: 'running'; questions: TestQuestion[]; deadline: number }

/**
 * /checkpoint/:lessonId – kiểm tra cuối chặng 6 câu của một bài. Dùng lại phần làm bài của kiểm tra cuối khóa (đồng hồ 60s/câu, ngưỡng đạt 80%);
 * nộp bài xong ghi kết quả (mức nắm vững + XP) rồi chuyển sang màn tổng kết chặng.
 */
export function OrbitCheckpointView() {
    const { lessonId } = useParams()
    const lesson = useEffectiveLesson(lessonId)
    const navigate = useNavigate()
    const record = useOrbitStore((s) => (lessonId ? s.checkpoints[lessonId] : undefined))
    const recordCheckpointResult = useOrbitStore((s) => s.recordCheckpointResult)
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
    // Đề do thầy cô duyệt (hoặc đề AI soạn sẵn nếu chưa chỉnh) và luật làm bài đi kèm
    const set = useMemo(() => (lesson ? quickSetFor(lesson) : undefined), [lesson])
    const bank = useMemo(() => (lesson ? sourcedBank([lesson]) : []), [lesson])
    const fixed = useMemo(() => (set ? resolveSet(set, bank) : []), [set, bank])
    const rules = set?.rules
    // Bộ câu của lượt sắp làm: trộn sẵn để màn bắt đầu hiện đúng số câu theo từng khái niệm, bấm "Bắt đầu" dùng đúng bộ này
    const [planned, setPlanned] = useState<TestQuestion[]>(() => (rules ? prepareQuestions(fixed, rules) : []))
    if (!lesson || !lessonId || !set || !rules) return <Navigate to="/learning" replace />

    const count = fixed.length
    const enough = count >= 1
    const needed = passCount(rules, count)
    const outOfAttempts = rules.attempts !== null && (record?.attempts ?? 0) >= rules.attempts
    const perQ = rules.secondsPerQuestion

    if (!enough) {
        return <Unavailable lesson={lesson} lessonId={lessonId} message="Bài này chưa có câu hỏi để kiểm tra." />
    }

    const start = () => {
        const questions = planned
        setPhase({ kind: 'running', questions, deadline: Date.now() + testTimeLimit(questions.length, perQ) * 1000 })
        // Lượt sau (làm lại) sẽ bốc bộ câu mới
        setPlanned(prepareQuestions(fixed, rules))
        window.scrollTo(0, 0)
    }

    const submit = (questions: TestQuestion[], picks: Record<string, number>, deadline: number, timedOut: boolean) => {
        const limit = testTimeLimit(questions.length, perQ)
        const durationSec = Math.min(limit, Math.round(limit - (deadline - Date.now()) / 1000))
        const answers = questions.map((q) => ({ conceptId: q.conceptId, correct: picks[q.id] === q.correctIndex, blank: picks[q.id] === undefined }))
        recordCheckpointResult({ lessonId, answers, durationSec, timedOut, passRatio: rules.passRatio })
        navigate(`/recap/${lessonId}`, { replace: true })
    }

    if (phase.kind === 'running') {
        return (
            <div className="w-full">
                <div className="container-wide py-6">
                    <LessonHeader lesson={lesson} currentStep="checkpoint" />
                    <div className="mt-6">
                        <Running key={phase.deadline} split phase={{ ...phase }} onSubmit={submit} onQuit={() => setPhase({ kind: 'intro' })} />
                    </div>
                </div>
            </div>
        )
    }

    // Khái niệm sẽ được hỏi, theo số câu trong bộ đã chọn
    const asked = lesson.concepts
        .map((c) => ({ concept: c, questions: planned.filter((q) => q.conceptId === c.id).length, level: mastery[c.id] ?? 0 }))
        .filter((k) => k.questions > 0)
    const passPct = Math.round(rules.passRatio * 100)

    return (
        <div className="w-full">
            <div className="container-wide py-6">
                <LessonHeader lesson={lesson} currentStep="checkpoint" />

                {/* Thẻ lớn: cột trái rộng đúng bằng cột 8 + khoảng hở của header, nên vạch chia thẳng dưới mép trái stepper */}
                <section className="checkpoint-card mt-6 overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_30px_60px_-40px_hsl(var(--foreground-strong)/0.35)]">
                    <div className="flex flex-col px-11 py-10">
                        <Link to={`/lesson/${lessonId}`} className="inline-flex w-fit items-center gap-1 text-[13.5px] font-semibold text-muted-foreground transition hover:text-strong">
                            <ChevronLeft size={15} /> Quay lại bài giảng
                        </Link>
                        <p className="mt-7 text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">Kiểm tra nhanh · cuối chặng</p>
                        <h2 className="mt-3 text-[40px] font-black leading-[1.1] tracking-tight text-strong">{count} câu để chốt lại bài vừa học</h2>
                        <p className="mt-3.5 max-w-[46ch] text-base leading-relaxed text-muted-foreground">
                            Đề do thầy cô duyệt. Đúng từ {needed}/{count} câu là đạt; khái niệm sáng lên trong bản đồ kỹ năng khi mức nắm vững đạt 80%.
                        </p>

                        <dl className="mt-7 flex w-fit overflow-hidden rounded-2xl border border-border">
                            <Fact value={String(count)} unit="câu" note="đề do thầy cô duyệt" />
                            <Fact value={clock(testTimeLimit(count, perQ))} note={`${perQ}s/câu · hết giờ tự nộp`} divided />
                            <Fact value={`+${TEST_XP_PER_CORRECT}`} unit="XP/câu" note={`+${TEST_PASS_BONUS_XP} khi đạt từ ${needed}/${count}`} divided />
                        </dl>

                        <div className="mt-auto flex flex-wrap items-center gap-[18px] pt-8">
                            <button
                                type="button"
                                onClick={start}
                                disabled={outOfAttempts}
                                className="tier-1-bob surface-red inline-flex items-center gap-2.5 rounded-[14px] px-6 py-4 text-[17px] font-extrabold text-ink-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Play size={17} className="fill-current" /> {record ? 'Làm lại' : 'Bắt đầu làm bài'}{rules.attempts !== null && !outOfAttempts && <small className="ml-1 text-sm font-semibold opacity-80">· còn {rules.attempts - (record?.attempts ?? 0)} lượt</small>}
                            </button>
                            <Link to={`/recap/${lessonId}`} className="text-sm font-bold text-muted-foreground hover:text-strong hover:underline">
                                {record ? `Xem tổng kết (lần trước ${record.last.correct}/${record.last.total})` : 'Bỏ qua, xem tổng kết'}
                            </Link>
                        </div>
                        {outOfAttempts && <p className="mt-4 text-sm font-semibold text-brand-ink">Bạn đã dùng hết {rules.attempts} lượt làm bài này. Xem tổng kết để ôn lại phần còn yếu.</p>}
                    </div>

                    <aside className="flex flex-col border-l border-border bg-muted px-7 py-[34px]">
                        <h3 className="flex items-baseline justify-between text-sm font-extrabold text-strong">
                            Sẽ hỏi về <small className="font-mono text-xs font-semibold text-muted-foreground">{asked.length} khái niệm</small>
                        </h3>
                        <ul className="mt-3.5 flex flex-col gap-2.5">
                            {asked.map(({ concept, questions, level }) => {
                                const strong = level >= UNLOCK_THRESHOLD
                                const weak = level < 0.5
                                return (
                                    <li key={concept.id} className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-[14px] border px-4 py-3.5 ${weak ? 'border-brand-100 bg-brand-50' : 'border-border bg-card'}`}>
                                        <b className="text-[14.5px] font-bold text-strong">{concept.name}</b>
                                        <span className={`font-mono text-xs ${weak ? 'font-bold text-brand-ink' : 'font-semibold text-muted-foreground'}`}>
                                            {questions} câu · {strong ? 'đã vững' : weak ? 'còn yếu' : `${Math.round(level * 100)}%`}
                                        </span>
                                        <span className="relative col-span-full h-1.5 rounded-sm bg-muted">
                                            <i className={`absolute inset-y-0 left-0 rounded-sm ${strong ? 'bg-success' : 'bg-brand-600'}`} style={{ width: `${Math.round(level * 100)}%` }} />
                                            <u className="absolute -top-[3px] h-3 w-0.5 bg-strong/50 no-underline" style={{ left: `${passPct}%` }} />
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                        <p className="mt-auto pt-[18px] text-[13px] leading-normal text-muted-foreground">
                            Câu sai sẽ được AI giải thích và tua về <b className="text-strong">đúng đoạn video</b> chứa đáp án trong phần tổng kết.
                        </p>
                    </aside>
                </section>
            </div>
        </div>
    )
}

function Fact({ value, unit, note, divided }: { value: string; unit?: string; note: string; divided?: boolean }) {
    return (
        <div className={`px-[22px] py-3.5 text-[13px] text-muted-foreground ${divided ? 'border-l border-border' : ''}`}>
            <dt className="mb-0.5 font-mono text-[22px] font-extrabold text-strong">
                {value}
                {unit && <em className="ml-[3px] text-[13px] font-semibold not-italic text-muted-foreground">{unit}</em>}
            </dt>
            <dd>{note}</dd>
        </div>
    )
}

/** Đề chưa được thầy cô mở: báo thân thiện, không để stepper và tổng kết vỡ. */
function Unavailable({ lesson, lessonId, message }: { lesson: NonNullable<ReturnType<typeof useEffectiveLesson>>; lessonId: string; message: string }) {
    return (
        <div className="w-full">
            <div className="container-wide py-6">
                <LessonHeader lesson={lesson} currentStep="checkpoint" />
                <section className="mx-auto mt-10 max-w-xl rounded-[24px] border border-border bg-card px-10 py-12 text-center shadow-card">
                    <h2 className="text-2xl font-black text-strong">{message}</h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Khi thầy cô duyệt và mở đề, bài Kiểm tra nhanh sẽ xuất hiện ở đây. Bạn vẫn xem được tổng kết chặng.</p>
                    <div className="mt-7 flex flex-wrap justify-center gap-3">
                        <Link to={`/lesson/${lessonId}`} className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-bold text-strong transition hover:bg-muted">
                            Về bài giảng
                        </Link>
                        <Link to={`/recap/${lessonId}`} className="surface-red inline-flex h-11 items-center rounded-xl px-5 text-sm font-extrabold text-ink-foreground shadow-brand">
                            Xem tổng kết
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    )
}
