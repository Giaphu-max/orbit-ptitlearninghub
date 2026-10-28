import type { ReactNode } from 'react'
import { BookOpen, CheckCircle2, Target } from 'lucide-react'
import type { CourseSummary } from '@/lib/course-map'

/**
 * Banner chào ở đầu /learning: phong cách LMS PTIT (lms.ptit.edu.vn/my-learning).
 * Lưới 12 cột (gap 24) theo tỷ lệ 6/6:
 * - Nền hồng rất nhạt (#FDF3F3) viền #F6DCDC bo 20px.
 * - Trái: lời chào (20px foreground, tên navy 800) + chip tiến độ xanh tươi (#EAF8EE, #22A05A/#1E8F50).
 * - Phải: khung trắng bo 14px viền #F6DCDC, đầu dải hồng #FBE6E6 cao 32px chữ đỏ #D41F16,
 *         thân 3 chỉ số ngang với ô icon 32px (#FFF1EF / #E2261C) và vạch ngăn #F1E4E4.
 */
export function LearningBanner({ name, summaries, behind }: { name: string; summaries: CourseSummary[]; behind: boolean }) {
    const doing = summaries.filter((c) => c.status === 'doing').length
    const lessonsDone = summaries.reduce((n, c) => n + c.doneCount, 0)
    const lessons = summaries.reduce((n, c) => n + c.lessons.length, 0)
    const strong = summaries.reduce((n, c) => n + c.strongCount, 0)
    const concepts = summaries.reduce((n, c) => n + c.conceptCount, 0)

    return (
        <section
            aria-label="Chào mừng"
            className="rounded-[20px] border border-welcome-border bg-welcome-bg px-5 py-3.5 shadow-card"
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
                {/* Trái 6 cột: Lời chào + chip cùng hàng */}
                <div className="col-span-1 lg:col-span-6 flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                    <h1 className="text-[20px] font-normal leading-snug text-foreground whitespace-nowrap">
                        Chào <b className="font-extrabold text-strong">{name}</b>, học tiếp nhé
                    </h1>
                    <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap ${
                            behind
                                ? 'border-warning/40 bg-warning/10 text-foreground'
                                : 'border-success-soft-border bg-success-soft text-success-bright'
                        }`}
                    >
                        {behind ? 'Bạn đang chậm 1 bài so với lộ trình' : 'Bạn đang học đúng tiến độ'}
                    </span>
                </div>

                {/* Phải 6 cột: Khung Tổng quan học kỳ hiện tại */}
                <div className="col-span-1 lg:col-span-6">
                    <div className="overflow-hidden rounded-[14px] border border-welcome-border bg-card">
                        <div className="flex h-8 items-center justify-center bg-welcome-header px-3">
                            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-welcome-header-text">
                                TỔNG QUAN HỌC KỲ HIỆN TẠI
                            </h2>
                        </div>
                        <ul className="grid grid-cols-3 divide-x divide-welcome-divider px-3 py-2.5">
                            <Metric icon={<BookOpen size={16} />} value={String(doing)} label="Học phần đang học" />
                            <Metric icon={<CheckCircle2 size={16} />} value={`${lessonsDone}/${lessons}`} label="Bài giảng đã xong" />
                            <Metric icon={<Target size={16} />} value={`${strong}/${concepts}`} label="Khái niệm vững" />
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    )
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
    return (
        <li className="flex items-center gap-2.5 px-3 first:pl-0 last:pr-0 min-w-0">
            <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-welcome-icon text-welcome-icon-text"
            >
                {icon}
            </span>
            <div className="min-w-0">
                <b className="block font-mono text-[16px] font-extrabold leading-tight text-strong">{value}</b>
                <span className="block text-[12.5px] leading-tight text-muted-foreground truncate">{label}</span>
            </div>
        </li>
    )
}
