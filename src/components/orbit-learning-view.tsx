import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ClassGrid } from '@/components/courses/class-grid'
import { ContinueCard } from '@/components/courses/continue-card'
import { LearningBanner } from '@/components/courses/learning-banner'
import { WeekCard } from '@/components/courses/week-card'
import { defaultCourse, useCourseSummaries } from '@/lib/course-map'
import { buildPlan, buildWeek, isBehind } from '@/lib/week-plan'
import { useOrbitStore } from '@/store/useOrbitStore'

/**
 * /learning (mockup ptit-learning-v2) – mọi khối nằm trên lưới 12 cột gap 24 trong .container-wide, các khối cùng hàng stretch:
 * banner chào (6/6) → hàng 2: "Học tiếp" (8) + "Tuần này" (4) → "Lớp học phần" (lưới 4 thẻ × 3 cột).
 * Khóa đang xem ở thẻ "Học tiếp" lưu trong ?course=id; bấm một thẻ lớp học phần thì chọn khóa đó và cuộn lên.
 */
export function OrbitLearningView() {
    const summaries = useCourseSummaries()
    const [params, setParams] = useSearchParams()
    const { hash } = useLocation()
    const [expanded, setExpanded] = useState(false)
    const [toast, setToast] = useState(false)
    const topRef = useRef<HTMLDivElement>(null)
    const name = useOrbitStore((s) => s.learnerName)
    const streak = useOrbitStore((s) => s.streak)
    const progress = useOrbitStore((s) => s.lessonProgress)

    // Vào từ mô hình khuôn viên (/learning#course-<id>) cũng chọn đúng khóa đó
    const wanted = params.get('course') ?? (hash.startsWith('#course-') ? decodeURIComponent(hash.slice(8)) : null)
    const featured = summaries.find((c) => c.course.id === wanted) ?? defaultCourse(summaries)

    const plan = buildPlan(summaries, progress)
    const week = buildWeek(plan, streak)
    const behind = isBehind(streak)

    useEffect(() => {
        if (!toast) return
        const id = window.setTimeout(() => setToast(false), 2600)
        return () => window.clearTimeout(id)
    }, [toast])

    const select = (id: string) => {
        setParams({ course: id }, { replace: true, preventScrollReset: true })
        setExpanded(true)
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        topRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
    }

    return (
        <div className="w-full">
            <div className="container-wide py-8 lg:py-10">
                <div ref={topRef} className="section-anchor">
                    <LearningBanner name={name} summaries={summaries} behind={behind} />
                </div>
                {!featured ? (
                    <p className="mt-6 rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khóa học nào được giảng viên xuất bản.</p>
                ) : (
                    <div className="page-grid mt-6 items-stretch">
                        <section className="col-span-8 flex flex-col [&>article]:flex-1">
                            <h2 className="mb-3 text-[15px] font-extrabold text-strong">Học tiếp</h2>
                            <ContinueCard key={featured.course.id} summary={featured} expanded={expanded} onToggle={setExpanded} />
                        </section>
                        <WeekCard week={week} plan={plan} />
                    </div>
                )}
                <ClassGrid summaries={summaries} selectedId={featured?.course.id} onSelect={select} onUpcoming={() => setToast(true)} />
            </div>
            {toast && (
                <p role="status" className="fixed bottom-8 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-ink-foreground shadow-raised">
                    Giảng viên đang chuẩn bị nội dung
                </p>
            )}
        </div>
    )
}
