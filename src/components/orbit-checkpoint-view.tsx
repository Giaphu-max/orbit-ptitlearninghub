import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Play } from 'lucide-react'
import { buildQuestionBank, CHECKPOINT_QUESTION_COUNT, pickCheckpointQuestions, seenQuestionIds, testTimeLimit, TEST_PASS_BONUS_XP, TEST_PASS_RATIO, TEST_XP_PER_CORRECT, type TestQuestion } from '@/lib/final-test'
import { UNLOCK_THRESHOLD } from '@/lib/gamification'
import { useEffectiveLesson } from '@/lib/lesson-edits'
import { useOrbitStore } from '@/store/useOrbitStore'
import { clock, Running } from '@/components/orbit-test-view'
import { LessonHeader } from '@/components/lesson/lesson-header'

type Phase = { kind: 'intro' } | { kind: 'running'; questions: TestQuestion[]; deadline: number }

/**
 * /checkpoint/:lessonId – test cuối chặng 6 câu của một bài. Dùng lại phần làm bài của test cuối chương (đồng hồ 60s/câu, ngưỡng đạt 80%);
 * nộp bài xong ghi kết quả (mức nắm vững + XP) rồi chuyển sang màn tổng kết chặng.
 */
export function OrbitCheckpointView() {
    const { lessonId } = useParams()
    const lesson = useEffectiveLesson(lessonId)
    const navigate = useNavigate()
    const record = useOrbitStore((s) => (lessonId ? s.checkpoints[lessonId] : undefined))
    const recordCheckpointResult = useOrbitStore((s) => s.recordCheckpointResult)
    const bank = useMemo(() => (lesson ? buildQuestionBank([lesson]) : []), [lesson])
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
    // Bộ câu của lượt sắp làm: chọn sẵn để màn bắt đầu hiện đúng số câu theo từng khái niệm, bấm "Bắt đầu" dùng đúng bộ này
    const [planned, setPlanned] = useState<TestQuestion[]>(() =>
        lesson ? pickCheckpointQuestions(bank, seenQuestionIds(lesson, useOrbitStore.getState().quizResults)) : [],
    )
    if (!lesson || !lessonId) return <Navigate to="/learning" replace />

    const count = Math.min(CHECKPOINT_QUESTION_COUNT, bank.length)
    const enough = bank.length >= 3

    const start = () => {
        const questions = planned
        setPhase({ kind: 'running', questions, deadline: Date.now() + testTimeLimit(questions.length) * 1000 })
        // Lượt sau (làm lại) sẽ bốc bộ câu mới
        setPlanned(pickCheckpointQuestions(bank, seenQuestionIds(lesson, useOrbitStore.getState().quizResults)))
        window.scrollTo(0, 0)
    }

    const submit = (questions: TestQuestion[], picks: Record<string, number>, deadline: number, timedOut: boolean) => {
        const limit = testTimeLimit(questions.length)
        const durationSec = Math.min(limit, Math.round(limit - (deadline - Date.now()) / 1000))
        const answers = questions.map((q) => ({ conceptId: q.conceptId, correct: picks[q.id] === q.correctIndex, blank: picks[q.id] === undefined }))
        recordCheckpointResult({ lessonId, answers, durationSec, timedOut })
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
    const passPct = Math.round(TEST_PASS_RATIO * 100)

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
                            Ưu tiên những câu bạn chưa gặp trong video. Đạt từ {passPct}% là khái niệm sáng lên trong bản đồ kỹ năng.
                        </p>

                        <dl className="mt-7 flex w-fit overflow-hidden rounded-2xl border border-border">
                            <Fact value={String(count)} unit="câu" note={`từ ngân hàng ${bank.length} câu`} />
                            <Fact value={clock(testTimeLimit(count))} note="hết giờ tự nộp" divided />
                            <Fact value={`+${TEST_XP_PER_CORRECT}`} unit="XP/câu" note={`+${TEST_PASS_BONUS_XP} khi đạt ${passPct}%`} divided />
                        </dl>

                        <div className="mt-auto flex flex-wrap items-center gap-[18px] pt-8">
                            <button
                                type="button"
                                onClick={start}
                                disabled={!enough}
                                className="tier-1-bob surface-red inline-flex items-center gap-2.5 rounded-[14px] px-6 py-4 text-[17px] font-extrabold text-ink-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Play size={17} className="fill-current" /> {record ? 'Làm lại' : 'Bắt đầu làm bài'}
                            </button>
                            <Link to={`/recap/${lessonId}`} className="text-sm font-bold text-muted-foreground hover:text-strong hover:underline">
                                {record ? `Xem tổng kết (lần trước ${record.last.correct}/${record.last.total})` : 'Bỏ qua, xem tổng kết'}
                            </Link>
                        </div>
                        {!enough && <p className="mt-4 text-sm text-muted-foreground">Bài này chưa đủ câu hỏi để làm test cuối chặng.</p>}
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
