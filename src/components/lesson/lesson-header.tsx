import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Star } from 'lucide-react'
import { getCourse, getLessonsOfCourse } from '@/data'
import type { Course, Lesson } from '@/data/types'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

export type LessonStep = 'lesson' | 'checkpoint' | 'recap'

export interface PickerItem {
    key: string
    to: string
    n: string
    title: string
    meta: string
    current?: boolean
}

export interface PickerFooter {
    title: string
    meta: string
    icon: ReactNode
    to?: string
    onClick?: () => void
}

interface TitleBlockProps {
    /** Chữ của nút xổ: tên học phần */
    label: string
    /** Chip "Bài n/N" cạnh nhãn */
    badge?: string
    items: PickerItem[]
    footer?: PickerFooter
    title: string
    /** Link nhỏ "‹ ..." đứng trước nút xổ */
    back?: { to: string; label: string }
    /** Tiêu đề 28px được xuống dòng (trang duyệt của giảng viên) */
    wrapTitle?: boolean
}

/** Dòng nhỏ "<học phần> [Bài n/N] ▾" mở menu danh sách, dưới là tiêu đề một dòng. Dùng chung trang học bài và các trang giảng viên. */
export function TitleBlock({ label, badge, items, footer, title, back, wrapTitle }: TitleBlockProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

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

    const footerCls = 'mt-1 grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-[10px] border-t border-border p-2.5 text-left text-sm transition hover:bg-muted'
    return (
        <div className="min-w-0">
            <div ref={rootRef} className="relative inline-flex items-center gap-2.5">
                {back && (
                    <Link to={back.to} className="py-1 text-[13px] font-bold text-muted-foreground transition hover:text-strong">
                        ‹ {back.label}
                    </Link>
                )}
                <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="menu"
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-lg py-1 pr-2.5 text-[13px] font-bold text-muted-foreground transition hover:text-strong"
                >
                    <span>{label}</span>
                    {badge && <em className="rounded-md bg-brand-50 px-2 py-[3px] font-mono text-[11.5px] font-bold not-italic text-brand-ink">{badge}</em>}
                    <ChevronDown size={13} className={`transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {open && (
                    <div role="menu" className="absolute right-auto top-[calc(100%+6px)] z-30 w-[360px] rounded-[14px] border border-border bg-card p-1.5 shadow-raised">
                        {items.map((it) => (
                            <Link
                                key={it.key}
                                to={it.to}
                                role="menuitem"
                                aria-current={it.current ? 'page' : undefined}
                                onClick={() => setOpen(false)}
                                className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] p-2.5 text-sm transition ${it.current ? 'bg-brand-50' : 'hover:bg-muted'}`}
                            >
                                <span className="font-mono text-xs font-bold text-muted-foreground">{it.n}</span>
                                <b title={it.title} className={`truncate font-bold ${it.current ? 'text-brand-ink' : 'text-strong'}`}>{it.title}</b>
                                <small className="font-mono text-xs text-muted-foreground">{it.meta}</small>
                            </Link>
                        ))}
                        {footer &&
                            (footer.to ? (
                                <Link to={footer.to} role="menuitem" onClick={() => setOpen(false)} className={footerCls}>
                                    {footer.icon}
                                    <b className="font-bold text-strong">{footer.title}</b>
                                    <small className="font-mono text-xs text-muted-foreground">{footer.meta}</small>
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setOpen(false)
                                        footer.onClick?.()
                                    }}
                                    className={footerCls}
                                >
                                    {footer.icon}
                                    <b className="font-bold text-strong">{footer.title}</b>
                                    <small className="font-mono text-xs text-muted-foreground">{footer.meta}</small>
                                </button>
                            ))}
                    </div>
                )}
            </div>
            <h1 title={title} className={`mt-1 font-black leading-tight tracking-tight text-strong ${wrapTitle ? 'text-[28px]' : 'truncate text-2xl'}`}>
                {title}
            </h1>
        </div>
    )
}

interface LessonTitleBlockProps {
    course?: Course
    lesson: Lesson
    courseLessons: Lesson[]
}

function LessonTitleBlock({ course, lesson, courseLessons }: LessonTitleBlockProps) {
    const progress = useOrbitStore((s) => s.lessonProgress)
    const index = courseLessons.findIndex((l) => l.id === lesson.id)
    const doneCount = courseLessons.filter((l) => progress[l.id]?.completed).length
    return (
        <TitleBlock
            label={course?.title ?? 'Học phần'}
            badge={index >= 0 ? `Bài ${index + 1}/${courseLessons.length}` : undefined}
            items={courseLessons.map((l, i) => ({
                key: l.id,
                to: `/lesson/${l.id}`,
                n: String(i + 1).padStart(2, '0'),
                title: l.shortTitle ?? l.title,
                meta: l.id === lesson.id ? 'đang học' : formatTime(l.durationSec),
                current: l.id === lesson.id,
            }))}
            footer={{
                to: `/test/${lesson.courseId}`,
                icon: <Star size={14} className="text-brand-ink" aria-hidden />,
                title: 'Kiểm tra cuối khóa',
                meta: doneCount >= courseLessons.length ? 'sẵn sàng' : `xong ${doneCount}/${courseLessons.length} bài`,
            }}
            title={lesson.title}
        />
    )
}

const STEPS: { id: LessonStep; label: string; to: (lessonId: string) => string }[] = [
    { id: 'lesson', label: 'Xem bài & quiz', to: (id) => `/lesson/${id}` },
    { id: 'checkpoint', label: 'Kiểm tra nhanh', to: (id) => `/checkpoint/${id}` },
    { id: 'recap', label: 'Tổng kết', to: (id) => `/recap/${id}` },
]

export interface StepPill {
    id: string
    label: string
    to?: string
    done?: boolean
    current?: boolean
}

/** Các viên bước chia đều theo bề ngang cột 4; bước xong hiện ✓ chữ success, bước hiện tại nền đỏ. */
export function StepPills({ steps, label }: { steps: StepPill[]; label: string }) {
    return (
        <nav aria-label={label} className="flex w-full items-center justify-between gap-1.5">
            {steps.map((st, i) => {
                const cls = `flex flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-full border px-2 py-[7px] text-[13px] font-bold transition duration-fast ${
                    st.current
                        ? 'border-brand-600 bg-brand-600 text-ink-foreground'
                        : st.done
                          ? 'border-border bg-card text-success'
                          : 'border-border bg-card text-muted-foreground' + (st.to ? ' hover:text-strong' : '')
                }`
                const inner = (
                    <>
                        <em
                            className={`flex h-[18px] w-[18px] items-center justify-center rounded-full font-mono text-[10.5px] font-bold not-italic ${
                                st.current ? 'bg-ink-foreground/25' : st.done ? 'bg-success/15' : 'bg-muted'
                            }`}
                        >
                            {st.done ? <Check size={11} strokeWidth={3} aria-label="đã xong" /> : i + 1}
                        </em>
                        {st.label}
                    </>
                )
                return (
                    <span key={st.id} className="contents">
                        {i > 0 && (
                            <span aria-hidden className="flex-none text-muted-foreground/50">
                                →
                            </span>
                        )}
                        {st.to ? (
                            <Link to={st.to} aria-current={st.current ? 'step' : undefined} className={cls}>
                                {inner}
                            </Link>
                        ) : (
                            <span aria-current={st.current ? 'step' : undefined} className={cls}>
                                {inner}
                            </span>
                        )}
                    </span>
                )
            })}
        </nav>
    )
}

function LessonSteps({ lessonId, current, doneSteps }: { lessonId: string; current: LessonStep; doneSteps?: LessonStep[] }) {
    const currentIndex = STEPS.findIndex((st) => st.id === current)
    return (
        <StepPills
            label="Các bước của chặng"
            steps={STEPS.map((st, i) => ({
                id: st.id,
                label: st.label,
                to: st.to(lessonId),
                current: i === currentIndex,
                done: doneSteps ? doneSteps.includes(st.id) && i !== currentIndex : i < currentIndex,
            }))}
        />
    )
}

/** Hàng đầu dùng chung /lesson, /checkpoint, /recap: lưới 8/4 gồm nút xổ học phần + tiêu đề bài | stepper 3 bước. */
/** `doneSteps`: ghi đè các bước hiện ✓ (mặc định mọi bước trước bước hiện tại). */
export function LessonHeader({ lesson, currentStep, doneSteps }: { lesson: Lesson; currentStep: LessonStep; doneSteps?: LessonStep[] }) {
    return (
        <header className="lesson-grid items-end">
            <LessonTitleBlock course={getCourse(lesson.courseId)} lesson={lesson} courseLessons={getLessonsOfCourse(lesson.courseId)} />
            <LessonSteps lessonId={lesson.id} current={currentStep} doneSteps={doneSteps} />
        </header>
    )
}
