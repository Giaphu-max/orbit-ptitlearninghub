import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, Clock, PlayCircle, Target } from 'lucide-react'
import { getCourse } from '@/data'
import { buildQuestionBank, CHECKPOINT_QUESTION_COUNT, pickCheckpointQuestions, seenQuestionIds, testTimeLimit, TEST_PASS_BONUS_XP, TEST_PASS_RATIO, TEST_XP_PER_CORRECT, type TestQuestion } from '@/lib/final-test'
import { useEffectiveLesson } from '@/lib/lesson-edits'
import { useOrbitStore } from '@/store/useOrbitStore'
import { clock, Fact, Running } from '@/components/orbit-test-view'
import { LessonBreadcrumbStepper } from '@/components/lesson/lesson-stepper'

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
    const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
    if (!lesson || !lessonId) return <Navigate to="/learning" replace />

    const course = getCourse(lesson.courseId)
    const count = Math.min(CHECKPOINT_QUESTION_COUNT, bank.length)
    const enough = bank.length >= 3

    const start = () => {
        const seen = seenQuestionIds(lesson, useOrbitStore.getState().quizResults)
        const questions = pickCheckpointQuestions(bank, seen)
        setPhase({ kind: 'running', questions, deadline: Date.now() + testTimeLimit(questions.length) * 1000 })
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
                <div className="mx-auto max-w-3xl px-5 py-8 lg:py-12">
                    <LessonBreadcrumbStepper
                        courseTitle={course?.title ?? 'Học phần'}
                        lessonTitle={lesson.title}
                        lessonId={lessonId}
                        currentStep="checkpoint"
                        courseId={lesson.courseId}
                    />
                    <div className="mt-6">
                        <Running key={phase.deadline} phase={{ ...phase }} onSubmit={submit} onQuit={() => setPhase({ kind: 'intro' })} />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">
            <div className="mx-auto max-w-3xl px-5 py-8 lg:py-12">
                <LessonBreadcrumbStepper
                    courseTitle={course?.title ?? 'Học phần'}
                    lessonTitle={lesson.title}
                    lessonId={lessonId}
                    currentStep="checkpoint"
                    courseId={lesson.courseId}
                />
                <div className="mt-6">
                    <Link to={`/lesson/${lessonId}`} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
                        <ChevronLeft size={16} /> Quay lại bài giảng
                    </Link>
                </div>
                <p className="mt-6 text-eyebrow uppercase text-brand-ink">Test cuối chặng</p>
                <h1 className="mt-3 text-headline text-foreground">{lesson.title}</h1>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">Sáu câu ngắn về đúng bài vừa học, ưu tiên những câu bạn chưa gặp trong video. Xong là có bản tổng kết chặng.</p>

                <dl className="mt-8 grid gap-4 sm:grid-cols-3">
                    <Fact icon={<Target size={18} />} label="Số câu" value={`${count} câu`} note={`Mỗi khái niệm của bài ít nhất một câu, từ ngân hàng ${bank.length} câu`} />
                    <Fact icon={<Clock size={18} />} label="Thời gian" value={clock(testTimeLimit(count))} note="Hết giờ bài tự nộp" />
                    <Fact icon={<BookOpen size={18} />} label="Phần thưởng" value={`+${TEST_XP_PER_CORRECT} XP/câu`} note={`Mỗi câu đúng vượt kỷ lục. Thêm ${TEST_PASS_BONUS_XP} XP khi đạt ${Math.round(TEST_PASS_RATIO * 100)}%`} />
                </dl>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={start} disabled={!enough} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <PlayCircle size={18} /> {record ? 'Làm lại' : 'Bắt đầu làm bài'}
                    </button>
                    <Link to={`/recap/${lessonId}`} className="rounded-full border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition hover:bg-muted">
                        {record ? `Xem tổng kết (lần trước ${record.last.correct}/${record.last.total})` : 'Bỏ qua, xem tổng kết'}
                    </Link>
                </div>
                {!enough && <p className="mt-4 text-sm text-muted-foreground">Bài này chưa đủ câu hỏi để làm test cuối chặng.</p>}
            </div>
        </div>
    )
}
