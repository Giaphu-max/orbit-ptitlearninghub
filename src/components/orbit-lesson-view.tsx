import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, MessageSquare, PanelRightClose, RotateCcw, SkipForward, Zap } from 'lucide-react'
import { getCourse, getLesson, getLessonsOfCourse, lessons } from '@/data'
import type { Lesson } from '@/data/types'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'
import { useLessonQuiz } from '@/hooks/useLessonQuiz'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'
import { LessonPlayer } from '@/components/lesson/lesson-player'
import { ConceptTimeline } from '@/components/lesson/concept-timeline'
import { TranscriptPanel } from '@/components/lesson/transcript-panel'
import { TutorPanel } from '@/components/lesson/tutor-panel'
import { QuizCard } from '@/components/lesson/quiz-card'
import { QuizList } from '@/components/lesson/quiz-list'
import { QuizRewardToast } from '@/components/lesson/quiz-reward-toast'

/** /lesson/:lessonId – không có id thì mở bài đầu tiên. */
export function OrbitLessonView() {
    const { lessonId } = useParams()
    if (!lessonId) return lessons[0] ? <Navigate to={`/lesson/${lessons[0].id}`} replace /> : <Navigate to="/learning" replace />
    const lesson = getLesson(lessonId)
    if (!lesson) return <Navigate to="/learning" replace />
    // key: đổi bài thì dựng lại trình phát và khung chat từ đầu
    return <LessonPage key={lesson.id} lesson={lesson} />
}

// Chỉ tiếp tục từ vị trí cũ khi đã xem được một đoạn và chưa tới cuối
const RESUME_MIN_SEC = 10
const RESUME_TAIL_SEC = 20

function LessonPage({ lesson }: { lesson: Lesson }) {
    const course = getCourse(lesson.courseId)
    const courseLessons = getLessonsOfCourse(lesson.courseId)
    const saveLessonPosition = useOrbitStore((s) => s.saveLessonPosition)
    const xp = useOrbitStore((s) => s.xp)

    // Đọc vị trí cũ một lần lúc mở bài
    const [resumeFrom] = useState(() => {
        const saved = useOrbitStore.getState().lessonProgress[lesson.id]?.lastPositionSec ?? 0
        return saved >= RESUME_MIN_SEC && saved < lesson.durationSec - RESUME_TAIL_SEC ? Math.floor(saved) : 0
    })
    const [showResume, setShowResume] = useState(resumeFrom > 0)
    const [isTutorOpen, setIsTutorOpen] = useState(true)

    const player = useYouTubePlayer(lesson.youtubeId, { startAt: resumeFrom })
    const { currentTime, seekTo } = player
    const canPlay = player.status === 'ready'
    const quiz = useLessonQuiz(lesson, { currentTime, isPlaying: player.isPlaying, canPlay, seekTo, pause: player.pause })
    const { phase } = quiz
    const quizOpen = phase.kind === 'asking' || phase.kind === 'answered'

    // Mở quiz từ danh sách hay dải khái niệm ở dưới: cuộn lên để thấy thẻ câu hỏi
    const playerAreaRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (quizOpen) playerAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [quizOpen])

    // Bản sao thời điểm đang xem cho các handler (trợ giảng, lưu khi rời trang)
    const timeRef = useRef(currentTime)
    useEffect(() => {
        timeRef.current = currentTime
    }, [currentTime])

    // Lưu vị trí xem khoảng 5 giây một lần và khi rời trang
    const lastSavedRef = useRef(resumeFrom)
    useEffect(() => {
        if (Math.abs(currentTime - lastSavedRef.current) < 5) return
        lastSavedRef.current = currentTime
        saveLessonPosition(lesson.id, Math.floor(currentTime))
    }, [currentTime, lesson.id, saveLessonPosition])
    useEffect(() => {
        const save = () => saveLessonPosition(lesson.id, Math.floor(timeRef.current))
        // pagehide: đóng tab hoặc tải lại trang, khi đó React không kịp chạy cleanup
        window.addEventListener('pagehide', save)
        return () => {
            window.removeEventListener('pagehide', save)
            save()
        }
    }, [lesson.id, saveLessonPosition])

    const handleSeek = (sec: number) => {
        setShowResume(false)
        // Đang làm quiz thì chỉ tua, không phát video dưới thẻ câu hỏi
        seekTo(sec, { play: !quizOpen })
    }

    const lessonIndex = courseLessons.findIndex((l) => l.id === lesson.id)

    return (
        <div className="h-full w-full overflow-y-auto bg-surface">
            <div className={`mx-auto grid max-w-[1600px] gap-6 p-4 lg:p-6 ${isTutorOpen ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
                {/* ── Cột chính ── */}
                <div className="flex min-w-0 flex-col gap-5">
                    <div className="flex items-center justify-between gap-3">
                        <Link
                            to="/learning"
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-gray-600 transition hover:bg-white hover:text-gray-900"
                        >
                            <ChevronLeft size={16} /> {course?.title ?? 'Khóa học'}
                        </Link>
                        <span
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-card"
                            title="Tổng XP"
                        >
                            <Zap size={15} className="fill-brand-500 text-brand-500" />
                            <span className="font-mono">{xp}</span> XP
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsTutorOpen((v) => !v)}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-card transition hover:border-gray-300"
                        >
                            {isTutorOpen ? <PanelRightClose size={16} /> : <MessageSquare size={16} />}
                            {isTutorOpen ? 'Tập trung xem' : 'Mở trợ giảng AI'}
                        </button>
                    </div>

                    <div ref={playerAreaRef} className="relative scroll-mt-6">
                        <LessonPlayer
                            containerRef={player.containerRef}
                            status={player.status}
                            error={player.error}
                            youtubeId={lesson.youtubeId}
                        />

                        {/* Quiz: phủ lên video từ md trở lên, dưới video trên điện thoại */}
                        <AnimatePresence>
                            {quizOpen && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="mt-4 flex justify-center md:absolute md:inset-x-0 md:top-0 md:mt-0 md:aspect-video md:items-center md:rounded-panel md:bg-gray-950/75 md:p-3 lg:p-5 md:backdrop-blur-sm"
                                >
                                    <QuizCard
                                        lesson={lesson}
                                        phase={phase}
                                        canPlay={canPlay}
                                        isRepeat={!!quiz.results[phase.root.id] && !(phase.kind === 'answered')}
                                        onAnswer={quiz.answer}
                                        onReview={quiz.review}
                                        onNextVariant={quiz.nextVariant}
                                        onResume={quiz.resume}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {phase.kind === 'reviewing' && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card bg-gray-900 px-4 py-3 text-sm text-white md:absolute md:left-4 md:right-4 md:top-4 md:mt-0 md:bg-gray-900/85 md:backdrop-blur">
                                <span>
                                    Đang xem lại đoạn{' '}
                                    <span className="font-mono font-bold">
                                        {formatTime(phase.review.start)}–{formatTime(phase.review.end)}
                                    </span>
                                    , hết đoạn sẽ có câu tương tự.
                                </span>
                                <button
                                    type="button"
                                    onClick={quiz.nextVariant}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-semibold transition hover:bg-white/25"
                                >
                                    <SkipForward size={14} /> Hỏi luôn
                                </button>
                            </div>
                        )}
                    </div>

                    {showResume && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-3 text-sm">
                            <span className="text-brand-800">
                                Đang tiếp tục từ <span className="font-mono font-bold">{formatTime(resumeFrom)}</span>, chỗ bạn dừng lần trước.
                            </span>
                            <button
                                type="button"
                                onClick={() => handleSeek(0)}
                                className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
                            >
                                <RotateCcw size={14} /> Xem từ đầu
                            </button>
                        </div>
                    )}

                    <ConceptTimeline lesson={lesson} currentTime={currentTime} onSeek={handleSeek} onOpenQuiz={quiz.open} results={quiz.results} />

                    <header className="pt-2">
                        <p className="text-eyebrow uppercase text-brand-600">
                            {course?.subject ?? 'Bài giảng'}
                            {lessonIndex >= 0 && ` · Bài ${lessonIndex + 1}/${courseLessons.length}`}
                        </p>
                        <h1 className="mt-2 text-title text-gray-900 md:text-headline">{lesson.title}</h1>
                        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-gray-600">{lesson.summary}</p>
                        {lesson.origin === 'sample' && (
                            <p className="mt-3 inline-block rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-gray-700">
                                Dữ liệu mẫu để dựng giao diện
                            </p>
                        )}
                    </header>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <TranscriptPanel transcript={lesson.transcript} currentTime={currentTime} onSeek={handleSeek} />

                        <div className="flex flex-col gap-5">
                            <QuizList lesson={lesson} results={quiz.results} onOpen={quiz.open} />

                            <section className="rounded-card border border-border bg-card p-5 shadow-card">
                                <h2 className="font-bold text-gray-900">Khái niệm chính</h2>
                                <dl className="mt-3 space-y-4">
                                    {lesson.concepts.map((c) => (
                                        <div key={c.id}>
                                            <dt className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900">
                                                {c.name}
                                                <button
                                                    type="button"
                                                    onClick={() => handleSeek(c.segment.start)}
                                                    className="font-mono text-xs font-medium text-brand-600 hover:underline"
                                                >
                                                    {formatTime(c.segment.start)}
                                                </button>
                                            </dt>
                                            <dd className="mt-1 text-sm leading-relaxed text-gray-600">{c.definition}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>

                            {courseLessons.length > 1 && (
                                <section className="rounded-card border border-border bg-card p-5 shadow-card">
                                    <h2 className="font-bold text-gray-900">Bài trong khóa</h2>
                                    <ol className="mt-3 space-y-1">
                                        {courseLessons.map((l, i) => (
                                            <li key={l.id}>
                                                <Link
                                                    to={`/lesson/${l.id}`}
                                                    aria-current={l.id === lesson.id ? 'page' : undefined}
                                                    className={`flex gap-3 rounded-lg px-2 py-2 text-sm transition ${
                                                        l.id === lesson.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className="font-mono text-xs text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                                                    {l.title}
                                                </Link>
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Trợ giảng AI: ẩn bằng CSS để giữ lịch sử hỏi đáp khi bật/tắt ── */}
                <div className={`h-[70vh] min-h-[480px] xl:sticky xl:top-6 xl:self-start xl:h-[calc(100vh-48px)] ${isTutorOpen ? '' : 'hidden'}`}>
                    <TutorPanel lesson={lesson} getCurrentTime={() => timeRef.current} onSeek={handleSeek} />
                </div>
            </div>
            <QuizRewardToast reward={quiz.reward} />
        </div>
    )
}
