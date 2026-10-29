import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Star } from 'lucide-react'
import { getCourse, getLessonsOfCourse } from '@/data'
import type { Course, Lesson } from '@/data/types'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

export type LessonStep = 'lesson' | 'checkpoint' | 'recap'

interface LessonTitleBlockProps {
    course?: Course
    lesson: Lesson
    courseLessons: Lesson[]
}

/** Dòng nhỏ "<học phần> [Bài n/N] ▾" mở menu danh sách bài + test cuối chương, dưới là tiêu đề bài một dòng. */
function LessonTitleBlock({ course, lesson, courseLessons }: LessonTitleBlockProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const progress = useOrbitStore((s) => s.lessonProgress)
    const index = courseLessons.findIndex((l) => l.id === lesson.id)
    const doneCount = courseLessons.filter((l) => progress[l.id]?.completed).length

    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div className="min-w-0">
            <div ref={rootRef} className="relative inline-block">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="menu"
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-lg py-1 pr-2.5 text-[13px] font-bold text-muted-foreground transition hover:text-strong"
                >
                    <span>{course?.title ?? 'Học phần'}</span>
                    {index >= 0 && (
                        <em className="rounded-md bg-brand-50 px-2 py-[3px] font-mono text-[11.5px] font-bold not-italic text-brand-ink">
                            Bài {index + 1}/{courseLessons.length}
                        </em>
                    )}
                    <ChevronDown size={13} className={`transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {open && (
                    <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-30 w-[360px] rounded-[14px] border border-border bg-card p-1.5 shadow-raised">
                        {courseLessons.map((l, i) => {
                            const cur = l.id === lesson.id
                            return (
                                <Link
                                    key={l.id}
                                    to={`/lesson/${l.id}`}
                                    role="menuitem"
                                    aria-current={cur ? 'page' : undefined}
                                    onClick={() => setOpen(false)}
                                    className={`grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-[10px] p-2.5 text-sm transition ${cur ? 'bg-brand-50' : 'hover:bg-muted'}`}
                                >
                                    <span className="font-mono text-xs font-bold text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                                    <b className={`font-bold ${cur ? 'text-brand-ink' : 'text-strong'}`}>{l.shortTitle ?? l.title}</b>
                                    <small className="font-mono text-xs text-muted-foreground">{cur ? 'đang học' : formatTime(l.durationSec)}</small>
                                </Link>
                            )
                        })}
                        <Link
                            to={`/test/${lesson.courseId}`}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="mt-1 grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-[10px] border-t border-border p-2.5 text-sm transition hover:bg-muted"
                        >
                            <Star size={14} className="text-brand-ink" aria-hidden />
                            <b className="font-bold text-strong">Test cuối chương</b>
                            <small className="font-mono text-xs text-muted-foreground">
                                {doneCount >= courseLessons.length ? 'sẵn sàng' : `xong ${doneCount}/${courseLessons.length} bài`}
                            </small>
                        </Link>
                    </div>
                )}
            </div>
            <h1 title={lesson.title} className="mt-1 truncate text-2xl font-black leading-tight tracking-tight text-strong">
                {lesson.title}
            </h1>
        </div>
    )
}

const STEPS: { id: LessonStep; label: string; to: (lessonId: string) => string }[] = [
    { id: 'lesson', label: 'Xem bài & quiz', to: (id) => `/lesson/${id}` },
    { id: 'checkpoint', label: 'Kiểm tra nhanh', to: (id) => `/checkpoint/${id}` },
    { id: 'recap', label: 'Tổng kết', to: (id) => `/recap/${id}` },
]

/** 3 viên chia đều theo bề ngang cột 4; bước trước bước hiện tại là "đã xong" (✓, chữ success). */
function LessonSteps({ lessonId, current }: { lessonId: string; current: LessonStep }) {
    const currentIndex = STEPS.findIndex((st) => st.id === current)
    return (
        <nav aria-label="Các bước của chặng" className="flex w-full items-center justify-between gap-1.5">
            {STEPS.map((st, i) => {
                const on = i === currentIndex
                const done = i < currentIndex
                return (
                    <span key={st.id} className="contents">
                        {i > 0 && (
                            <span aria-hidden className="flex-none text-muted-foreground/50">
                                →
                            </span>
                        )}
                        <Link
                            to={st.to(lessonId)}
                            aria-current={on ? 'step' : undefined}
                            className={`flex flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-full border px-2 py-[7px] text-[13px] font-bold transition duration-fast ${
                                on
                                    ? 'border-brand-600 bg-brand-600 text-ink-foreground'
                                    : done
                                      ? 'border-border bg-card text-success'
                                      : 'border-border bg-card text-muted-foreground hover:text-strong'
                            }`}
                        >
                            <em
                                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full font-mono text-[10.5px] font-bold not-italic ${
                                    on ? 'bg-ink-foreground/25' : done ? 'bg-success/15' : 'bg-muted'
                                }`}
                            >
                                {done ? <Check size={11} strokeWidth={3} aria-label="đã xong" /> : i + 1}
                            </em>
                            {st.label}
                        </Link>
                    </span>
                )
            })}
        </nav>
    )
}

/** Hàng đầu dùng chung /lesson, /checkpoint, /recap: lưới 8/4 gồm nút xổ học phần + tiêu đề bài | stepper 3 bước. */
export function LessonHeader({ lesson, currentStep }: { lesson: Lesson; currentStep: LessonStep }) {
    return (
        <header className="lesson-grid items-end">
            <LessonTitleBlock course={getCourse(lesson.courseId)} lesson={lesson} courseLessons={getLessonsOfCourse(lesson.courseId)} />
            <LessonSteps lessonId={lesson.id} current={currentStep} />
        </header>
    )
}
