import { useState } from 'react'
import { MessageSquare, PanelRightClose } from 'lucide-react'
import type { Lesson, LessonQuizQuestion } from '@/data/types'
import type { QuizResult } from '@/store/useOrbitStore'
import { TutorPanel } from '@/components/lesson/tutor-panel'
import { TranscriptPanel } from '@/components/lesson/transcript-panel'
import { QuizList } from '@/components/lesson/quiz-list'
import { CourseDocs, useCourseDocs } from '@/components/kb/course-docs'

type TabId = 'ai' | 'transcript' | 'quiz' | 'docs'

interface LessonSidePanelProps {
    lesson: Lesson
    currentTime: number
    results: Record<string, QuizResult>
    getCurrentTime: () => number
    onSeek: (sec: number) => void
    onOpenQuiz: (q: LessonQuizQuestion) => void
    onHide: () => void
    studio?: { to: string; label: string }
}

/** Bảng công cụ bên phải video: Trợ giảng AI | Transcript | Câu hỏi. Mọi tab luôn được dựng để giữ lịch sử chat và vị trí cuộn. */
export function LessonSidePanel({ lesson, currentTime, results, getCurrentTime, onSeek, onOpenQuiz, onHide, studio }: LessonSidePanelProps) {
    const [tab, setTab] = useState<TabId>('ai')
    const docCount = useCourseDocs(lesson.courseId).length
    const done = lesson.quiz.filter((q) => results[q.id]).length
    const tabs: { id: TabId; label: string; extra?: string }[] = [
        { id: 'ai', label: 'Trợ giảng AI' },
        { id: 'transcript', label: 'Transcript' },
        { id: 'quiz', label: 'Câu hỏi', extra: `${done}/${lesson.quiz.length}` },
        ...(docCount > 0 ? [{ id: 'docs' as const, label: 'Tài liệu', extra: String(docCount) }] : []),
    ]

    return (
        <>
            <div role="tablist" aria-label="Công cụ học bài" className="m-4 mb-0 flex shrink-0 gap-1 rounded-[14px] bg-muted p-1.5">
                <button
                    type="button"
                    onClick={onHide}
                    title="Ẩn bảng bên (phím B)"
                    aria-label="Ẩn bảng bên"
                    className="flex w-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-card hover:text-strong"
                >
                    <PanelRightClose size={16} />
                </button>
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-1.5 py-[9px] text-[13.5px] font-bold transition duration-fast ${
                            tab === t.id ? 'bg-card text-strong shadow-card' : 'text-muted-foreground hover:text-strong'
                        }`}
                    >
                        {t.id === 'ai' && <MessageSquare size={14} aria-hidden />}
                        {t.label}
                        {t.extra && <em className="font-mono text-[11.5px] font-semibold not-italic opacity-75">{t.extra}</em>}
                    </button>
                ))}
            </div>
            <div role="tabpanel" className={`min-h-0 flex-1 ${tab === 'ai' ? 'flex flex-col' : 'hidden'}`}>
                <TutorPanel lesson={lesson} getCurrentTime={getCurrentTime} onSeek={onSeek} currentSec={Math.floor(currentTime)} studio={studio} />
            </div>
            <div role="tabpanel" className={`min-h-0 flex-1 ${tab === 'transcript' ? 'flex flex-col' : 'hidden'}`}>
                <TranscriptPanel transcript={lesson.transcript} currentTime={currentTime} onSeek={onSeek} />
            </div>
            <div role="tabpanel" className={`min-h-0 flex-1 ${tab === 'quiz' ? 'flex flex-col' : 'hidden'}`}>
                <QuizList lesson={lesson} results={results} onOpen={onOpenQuiz} onSeek={onSeek} />
            </div>
            <div role="tabpanel" className={`min-h-0 flex-1 overflow-y-auto p-4 ${tab === 'docs' ? 'block' : 'hidden'}`}>
                <CourseDocs courseId={lesson.courseId} />
            </div>
        </>
    )
}
