import type { ReactNode } from 'react'
import { BookOpen, CheckCircle2, Target } from 'lucide-react'
import type { CourseSummary } from '@/lib/course-map'

/**
 * Banner chào ở đầu /learning: thiết kế nhẹ, tươi và gọn (thông tin phụ).
 * Lưới 12 cột (gap 24) theo tỷ lệ 6/6:
 * - Trái: lời chào (20px ink, tên navy) + chip tiến độ (12.5px) cùng 1 hàng.
 * - Phải: nhãn eyebrow 11.5px + 3 chỉ số nằm ngang ngăn cách bằng vạch dọc mảnh.
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
            className="rounded-[20px] border border-border bg-card px-5 py-4 shadow-card"
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
                {/* Trái 6 cột: Lời chào + chip cùng hàng */}
                <div className="col-span-1 lg:col-span-6 flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                    <h1 className="text-[20px] font-normal leading-snug text-brand-ink">
                        Chào <b className="font-extrabold text-strong">{name}</b>, học tiếp nhé
                    </h1>
                    <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap ${
                            behind
                                ? 'border-warning/40 bg-warning/10 text-foreground'
                                : 'border-success/25 bg-success/10 text-success'
                        }`}
                    >
                        {behind ? 'Bạn đang chậm 1 bài so với lộ trình' : 'Bạn đang học đúng tiến độ'}
                    </span>
                </div>

                {/* Phải 6 cột: Tổng quan học kỳ & 3 chỉ số */}
                <div className="col-span-1 lg:col-span-6 flex flex-col justify-center gap-1.5 lg:pl-2">
                    <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        Tổng quan học kỳ hiện tại
                    </span>
                    <ul className="grid grid-cols-3 divide-x divide-border">
                        <Metric icon={<BookOpen size={16} />} value={String(doing)} label="Học phần đang học" />
                        <Metric icon={<CheckCircle2 size={16} />} value={`${lessonsDone}/${lessons}`} label="Bài giảng đã xong" />
                        <Metric icon={<Target size={16} />} value={`${strong}/${concepts}`} label="Khái niệm vững" />
                    </ul>
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
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
