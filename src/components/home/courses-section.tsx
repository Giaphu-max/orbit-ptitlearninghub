import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { CourseTile, COURSE_GRID } from '@/components/courses/course-tile'
import { FeaturedCourse } from '@/components/courses/featured-course'
import { SectionHeading } from '@/components/section-heading'
import { defaultCourse, STATUS_ORDER, useCourseSummaries } from '@/lib/course-map'

/** Trang chủ: khối nổi bật của khóa đang học + một hàng tối đa 3 khóa khác; xem đủ ở /learning. */
export function CoursesSection() {
    const summaries = useCourseSummaries()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const featured = summaries.find((c) => c.course.id === selectedId) ?? defaultCourse(summaries)
    const others = summaries
        .filter((c) => c !== featured)
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
        .slice(0, 3)

    return (
        <section id="courses" aria-labelledby="courses-title" className="section-anchor">
            <SectionHeading id="courses-title" eyebrow="Khóa học" title="Học theo chặng, có đích.">
                <Link to="/learning" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground shadow-card transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
                    Xem tất cả khóa học <ArrowRight size={15} />
                </Link>
            </SectionHeading>

            {!featured ? (
                <p className="mt-7 rounded-card border border-border bg-card p-6 text-muted-foreground">Chưa có khóa học nào được giảng viên xuất bản.</p>
            ) : (
                <>
                    <div className="mt-7">
                        <FeaturedCourse key={featured.course.id} summary={featured} />
                    </div>
                    {others.length > 0 && (
                        <div className={`${COURSE_GRID} mt-5`}>
                            {others.map((c) => (
                                <CourseTile key={c.course.id} summary={c} selected={false} onSelect={() => setSelectedId(c.course.id)} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
