import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { PanelRight, RotateCcw, SkipForward } from 'lucide-react'
import { getCourse, getLessonsOfCourse, lessons } from '@/data'
import type { Lesson } from '@/data/types'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'
import { useLessonQuiz } from '@/hooks/useLessonQuiz'
import { useStoredFlag } from '@/hooks/useStoredFlag'
import { getStudioBrief } from '@/lib/studio-briefs'
import { formatTime } from '@/lib/youtube'
import { useEffectiveLesson, useReviewStatus } from '@/lib/lesson-edits'
import { useOrbitStore } from '@/store/useOrbitStore'
import { LessonCompactSteps } from '@/components/lesson/lesson-stepper'
import { LessonTitleBlock } from '@/components/lesson/lesson-header'
import { LessonFootLeft, LessonNextLink } from '@/components/lesson/lesson-foot'
import { LessonSidePanel } from '@/components/lesson/lesson-side-panel'
import { LessonPlayer } from '@/components/lesson/lesson-player'
import { PlayerControls } from '@/components/lesson/player-controls'
import { QuizCard } from '@/components/lesson/quiz-card'
import { QuizRewardToast } from '@/components/lesson/quiz-reward-toast'

/** /lesson/:lessonId – không có id thì mở bài đầu tiên. */
export function OrbitLessonView() {
    const { lessonId } = useParams()
    const role = useOrbitStore((s) => s.role)
    const lesson = useEffectiveLesson(lessonId)
    const status = useReviewStatus(lesson)
    if (!lessonId) return lessons[0] ? <Navigate to={`/lesson/${lessons[0].id}`} replace /> : <Navigate to="/learning" replace />
    if (!lesson) return <Navigate to="/learning" replace />
    // Sinh viên chỉ học bài giảng viên đã xuất bản; giảng viên xem trước được cả bản nháp
    if (status !== 'published' && role !== 'teacher') return <UnpublishedNotice />
    // key: đổi bài thì dựng lại trình phát và khung chat từ đầu
    return <LessonPage key={lesson.id} lesson={lesson} />
}

function UnpublishedNotice() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
            <p className="text-eyebrow uppercase text-brand-ink">Chưa xuất bản</p>
            <h1 className="text-headline text-foreground">Bài này đang chờ giảng viên duyệt</h1>
            <p className="max-w-md text-muted-foreground">Nội dung do AI tạo cần được giảng viên xem lại trước khi đến tay sinh viên.</p>
            <Link to="/learning" className="rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700">
                Về danh sách khóa học
            </Link>
        </div>
    )
}

// Chỉ tiếp tục từ vị trí cũ khi đã xem được một đoạn và chưa tới cuối
const RESUME_MIN_SEC = 10
const RESUME_TAIL_SEC = 20

function LessonPage({ lesson }: { lesson: Lesson }) {
    const course = getCourse(lesson.courseId)
    const courseLessons = getLessonsOfCourse(lesson.courseId)
    const saveLessonPosition = useOrbitStore((s) => s.saveLessonPosition)
    const lessonDone = useOrbitStore((s) => s.lessonProgress[lesson.id]?.completed ?? false)

    // Đọc vị trí cũ một lần lúc mở bài
    // ?t=giây: mở thẳng tại mốc đó (link nguồn của Orbit Daily, lộ trình ôn tập sau test)
    const [searchParams] = useSearchParams()
    const [{ resumeFrom, fromSavedPosition }] = useState(() => {
        const t = Number(searchParams.get('t'))
        if (Number.isFinite(t) && t > 0) return { resumeFrom: Math.min(Math.floor(t), Math.max(0, lesson.durationSec - 1)), fromSavedPosition: false }
        const saved = useOrbitStore.getState().lessonProgress[lesson.id]?.lastPositionSec ?? 0
        const ok = saved >= RESUME_MIN_SEC && saved < lesson.durationSec - RESUME_TAIL_SEC
        return { resumeFrom: ok ? Math.floor(saved) : 0, fromSavedPosition: ok }
    })
    // Banner chỉ cho vị trí đã lưu; vào từ link nguồn Daily hay lộ trình ôn (?t=) thì không phải "chỗ dừng lần trước"
    const [showResume, setShowResume] = useState(fromSavedPosition)
    // Ẩn bảng bên và bật phụ đề: nhớ qua các lần mở bài
    const [panelHidden, setPanelHidden] = useStoredFlag('orbit-lesson-panel-hidden', false)
    const [captionsOn, setCaptionsOn] = useStoredFlag('orbit-lesson-captions', true)

    const player = useYouTubePlayer(lesson.youtubeId, { startAt: resumeFrom, hideControls: true })
    const { currentTime, seekTo } = player
    const canPlay = player.status === 'ready'
    const quiz = useLessonQuiz(lesson, { currentTime, isPlaying: player.isPlaying, canPlay, seekTo, pause: player.pause })
    const { phase } = quiz
    // Khái niệm có đề bài Studio: ưu tiên khái niệm đang giảng, không thì khái niệm đầu tiên có đề bài
    const practiceConcept =
        lesson.concepts.find((c) => currentTime >= c.segment.start && currentTime < c.segment.end && getStudioBrief(c.id)) ?? lesson.concepts.find((c) => getStudioBrief(c.id))
    const quizOpen = phase.kind === 'asking' || phase.kind === 'answered'
    const showStudioLink = lesson.courseId === 'nhiep-anh-va-anh-sang' || course?.subject === 'Nhiếp ảnh' || !!practiceConcept

    // Mở quiz từ danh sách câu hỏi: cuộn lên để thấy thẻ câu hỏi
    const playerAreaRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (quizOpen) playerAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [quizOpen])

    // Phím B ẩn/hiện bảng bên (không kích hoạt khi đang gõ hoặc bấm kèm phím bổ trợ)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== 'b' || e.metaKey || e.ctrlKey || e.altKey) return
            const el = e.target as HTMLElement | null
            if (el?.closest('input, textarea, select, [contenteditable="true"]')) return
            setPanelHidden((v) => !v)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [setPanelHidden])

    // Bản sao thời điểm đang xem cho các handler (trợ giảng, lưu khi rời trang)
    const timeRef = useRef(currentTime)
    useEffect(() => {
        timeRef.current = currentTime
    }, [currentTime])
    const getCurrentTime = useCallback(() => timeRef.current, [])

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

    const handleSeek = useCallback(
        (sec: number) => {
            setShowResume(false)
            // Đang làm quiz thì chỉ tua, không phát video dưới thẻ câu hỏi
            seekTo(sec, { play: !quizOpen })
        },
        [seekTo, quizOpen],
    )

    const toggleFullscreen = () => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void playerAreaRef.current?.requestFullscreen?.()
    }

    const lessonIndex = courseLessons.findIndex((l) => l.id === lesson.id)
    // Đã xem xong bài này thì không dẫn sang bài kế nữa mà dẫn tới kiểm tra nhanh
    const nextLesson = lessonDone ? undefined : courseLessons[lessonIndex + 1]
    const fromDaily = searchParams.get('fromDaily')

    return (
        <div className="w-full">
            <div className="container-wide py-4 lg:py-6">
                {/* ── Hàng đầu: tên học phần + tiêu đề | 3 bước ── */}
                <header className="lesson-grid items-end">
                    <LessonTitleBlock course={course} lesson={lesson} courseLessons={courseLessons} />
                    <LessonCompactSteps lessonId={lesson.id} currentStep="lesson" />
                </header>

                {(fromDaily || showResume) && (
                    <div className="lesson-grid mt-4">
                        <div className="flex flex-col gap-2">
                            {fromDaily && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-300 bg-brand-50/90 p-3.5 text-sm text-brand-ink shadow-sm">
                                    <span className="flex items-center gap-2 font-medium text-foreground">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-xs font-bold text-ink-foreground">
                                            i
                                        </span>
                                        Bạn đang xem đoạn trích dẫn từ bài đọc ôn tập
                                    </span>
                                    <Link
                                        to={`/daily/${fromDaily}`}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-ink-foreground shadow-sm transition hover:bg-brand-700"
                                    >
                                        ← Quay lại hoàn thành bài đọc
                                    </Link>
                                </div>
                            )}
                            {showResume && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm">
                                    <span className="text-brand-ink">
                                        Đang tiếp tục từ <span className="font-mono font-bold">{formatTime(resumeFrom)}</span>, chỗ bạn dừng lần trước.
                                    </span>
                                    <button type="button" onClick={() => handleSeek(0)} className="inline-flex items-center gap-1.5 font-semibold text-brand-ink hover:underline">
                                        <RotateCcw size={14} /> Xem từ đầu
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Hàng video: player 8 | bảng bên 4 (cao đúng bằng player) ── */}
                <section className="lesson-grid lesson-theater mt-6" data-wide={panelHidden}>
                    <div ref={playerAreaRef} style={{ viewTransitionName: `vt-lesson-${lesson.id}` }} className="lesson-player-area relative scroll-mt-6 [&:fullscreen]:flex [&:fullscreen]:bg-ink [&:fullscreen]:items-center">
                        <LessonPlayer containerRef={player.containerRef} status={player.status} error={player.error} youtubeId={lesson.youtubeId}>
                            <PlayerControls
                                lesson={lesson}
                                currentTime={currentTime}
                                duration={player.duration}
                                isPlaying={player.isPlaying}
                                rate={player.rate}
                                results={quiz.results}
                                captionsOn={captionsOn}
                                panelHidden={panelHidden}
                                onToggle={() => (player.isPlaying ? player.pause() : player.play())}
                                onSeek={handleSeek}
                                onToggleCaptions={() => setCaptionsOn((v) => !v)}
                                onRate={player.setRate}
                                onFullscreen={toggleFullscreen}
                                onTogglePanel={() => setPanelHidden((v) => !v)}
                            />
                        </LessonPlayer>

                        {/* Vòng củng cố: thanh báo đang phát lại đoạn chứa đáp án, đè lên mép trên video */}
                        {phase.kind === 'reviewing' && (
                            <div className="absolute inset-x-4 top-4 z-30 flex flex-col gap-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-soft p-3 text-sm text-foreground shadow-card">
                                    <span className="flex items-center gap-2 font-medium">
                                        <RotateCcw size={15} className="shrink-0 text-brand-ink" aria-hidden />
                                        <span>Đang phát lại đoạn chứa đáp án · câu hỏi gỡ điểm (x2 XP) sẽ tự mở ngay sau đoạn này</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={quiz.nextVariant}
                                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-ink-foreground shadow-sm transition hover:bg-brand-700"
                                    >
                                        Trả lời câu gỡ điểm ngay
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-ink/85 px-4 py-2.5 text-sm text-ink-foreground">
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
                                        className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/15 px-3 py-1.5 font-semibold transition hover:bg-ink-foreground/25"
                                    >
                                        <SkipForward size={14} /> Hỏi luôn
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Quiz: phủ lên video; vẫn hiện khi bảng bên đang ẩn */}
                        <AnimatePresence>
                            {quizOpen && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="z-40 mt-4 flex justify-center md:absolute md:inset-x-0 md:top-0 md:mt-0 md:aspect-video md:items-center md:rounded-[20px] md:bg-ink/75 md:p-3 md:backdrop-blur-sm lg:p-5"
                                >
                                    <QuizCard
                                        lesson={lesson}
                                        phase={phase}
                                        canPlay={canPlay}
                                        isRepeat={!!quiz.results[phase.root.id] && !(phase.kind === 'answered')}
                                        reward={quiz.reward}
                                        onAnswer={quiz.answer}
                                        onReview={quiz.review}
                                        onNextVariant={quiz.nextVariant}
                                        onResume={quiz.resume}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <aside aria-label="Công cụ học bài" inert={panelHidden} className="lesson-side flex flex-col rounded-[20px] border border-border bg-card shadow-card">
                        <LessonSidePanel
                            lesson={lesson}
                            currentTime={currentTime}
                            results={quiz.results}
                            getCurrentTime={getCurrentTime}
                            onSeek={handleSeek}
                            onOpenQuiz={quiz.open}
                            onHide={() => setPanelHidden(true)}
                            studio={
                                showStudioLink
                                    ? { to: practiceConcept ? `/studio?concept=${practiceConcept.id}` : '/studio', label: 'Thực hành bài này trong Studio 3D' }
                                    : undefined
                            }
                        />
                    </aside>
                </section>

                {/* ── Hàng dưới: giới thiệu bài | bài tiếp ── */}
                <div className="lesson-grid mt-6 items-start">
                    <LessonFootLeft lesson={lesson} onSeek={handleSeek} />
                    <div className="justify-self-end">
                        <LessonNextLink lesson={lesson} nextLesson={nextLesson} />
                    </div>
                </div>
            </div>

            {/* Tab dọc ở mép phải để mở lại bảng bên */}
            <button
                type="button"
                onClick={() => setPanelHidden(false)}
                data-show={panelHidden}
                inert={!panelHidden}
                className="lesson-reopen z-30 flex items-center gap-2 rounded-l-[14px] bg-ink px-2.5 py-3.5 text-[12.5px] font-bold text-ink-foreground shadow-raised"
            >
                <PanelRight size={15} aria-hidden /> Trợ giảng AI · Transcript · Câu hỏi
            </button>
            <QuizRewardToast reward={quiz.reward} />
        </div>
    )
}
