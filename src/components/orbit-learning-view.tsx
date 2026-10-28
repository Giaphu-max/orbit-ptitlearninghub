import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { ContinueCard } from '@/components/courses/continue-card'
import { CourseLibrary } from '@/components/courses/course-library'
import { SiteFooter } from '@/components/site-footer'
import { defaultCourse, useCourseSummaries } from '@/lib/course-map'

/**
 * /learning – hai khối trong .container-wide (lưới 12 cột, stretch): trái 8 cột = "Học tiếp" (thẻ video + thông tin, lộ trình thu gọn ở chân thẻ),
 * phải 4 cột = thư viện học phần. Khóa đang xem lưu trong ?course=id; chọn khóa ở thư viện thì thẻ trái chuyển sang khóa đó và mở lộ trình.
 */
export function OrbitLearningView() {
    const summaries = useCourseSummaries()
    const [params, setParams] = useSearchParams()
    const { hash } = useLocation()
    const [expanded, setExpanded] = useState(false)

    // Vào từ mô hình khuôn viên (/learning#course-<id>) cũng chọn đúng khóa đó
    const wanted = params.get('course') ?? (hash.startsWith('#course-') ? decodeURIComponent(hash.slice(8)) : null)
    const featured = summaries.find((c) => c.course.id === wanted) ?? defaultCourse(summaries)

    const select = (id: string) => {
        setParams({ course: id }, { replace: true, preventScrollReset: true })
        setExpanded(true)
    }

    return (
        <div className="w-full">
            <div className="container-wide py-8 lg:py-10">
                {!featured ? (
                    <p className="rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khóa học nào được giảng viên xuất bản.</p>
                ) : (
                    <div className="page-grid items-stretch">
                        <section className="col-span-8 flex flex-col [&>article]:flex-1">
                            <h2 className="mb-3 text-[15px] font-extrabold text-strong">Học tiếp</h2>
                            <ContinueCard key={featured.course.id} summary={featured} expanded={expanded} onToggle={setExpanded} />
                        </section>
                        <CourseLibrary summaries={summaries} selectedId={featured.course.id} onSelect={select} />
                    </div>
                )}
            </div>
            <SiteFooter />
        </div>
    )
}
