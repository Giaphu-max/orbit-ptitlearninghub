import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface LessonStepperProps {
    courseTitle: string
    lessonTitle: string
    lessonId: string
    currentStep: 'lesson' | 'checkpoint' | 'recap'
    courseId?: string
}

export function LessonBreadcrumbStepper({
    courseTitle,
    lessonTitle,
    lessonId,
    currentStep,
    courseId,
}: LessonStepperProps) {
    const steps = [
        {
            id: 'lesson',
            num: '①',
            label: 'Xem bài giảng & Quiz',
            to: `/lesson/${lessonId}`,
        },
        {
            id: 'checkpoint',
            num: '②',
            label: 'Kiểm tra nhanh (6 câu)',
            to: `/checkpoint/${lessonId}`,
        },
        {
            id: 'recap',
            num: '③',
            label: 'Tổng kết chặng',
            to: `/recap/${lessonId}`,
        },
    ] as const

    return (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:p-4">
            {/* Đường dẫn Breadcrumb */}
            <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Link to="/learning" className="transition hover:text-brand-ink">
                    Học phần
                </Link>
                <ChevronRight size={12} className="shrink-0 text-muted-foreground/60" />
                <Link
                    to={courseId ? `/learning?course=${encodeURIComponent(courseId)}` : '/learning'}
                    className="max-w-[220px] truncate transition hover:text-foreground sm:max-w-none"
                    title={courseTitle}
                >
                    {courseTitle}
                </Link>
                <ChevronRight size={12} className="shrink-0 text-muted-foreground/60" />
                <span className="max-w-[260px] truncate font-bold text-foreground sm:max-w-none" title={lessonTitle}>
                    {lessonTitle}
                </span>
            </nav>

            {/* Tiến trình 3 bước (Stepper) */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border/60 pt-2">
                {steps.map((st, i) => {
                    const isCurrent = currentStep === st.id
                    return (
                        <div key={st.id} className="flex shrink-0 items-center gap-1.5">
                            {i > 0 && <span className="px-0.5 text-xs text-muted-foreground/40">→</span>}
                            <Link
                                to={st.to}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                    isCurrent
                                        ? 'bg-brand-600 text-ink-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                <span className={`font-mono ${isCurrent ? 'opacity-90' : 'text-muted-foreground'}`}>{st.num}</span>
                                <span>{st.label}</span>
                            </Link>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
