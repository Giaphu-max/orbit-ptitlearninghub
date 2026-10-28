import type { ReactNode } from 'react'
import { BookOpen, CheckCircle2, Target } from 'lucide-react'
import type { CourseSummary } from '@/lib/course-map'

/**
 * Banner chào ở đầu /learning: lưới 12 cột (gap 24) theo phong cách LMS PTIT.
 * Trái 6 cột = lời chào + chip tiến độ (căn giữa dọc); phải 6 cột = khung "Tổng quan học kỳ hiện tại" (3 chỉ số nằm ngang).
 */
export function LearningBanner({ name, summaries, behind }: { name: string; summaries: CourseSummary[]; behind: boolean }) {
    const doing = summaries.filter((c) => c.status === 'doing').length
    const lessonsDone = summaries.reduce((n, c) => n + c.doneCount, 0)
    const lessons = summaries.reduce((n, c) => n + c.lessons.length, 0)
    const strong = summaries.reduce((n, c) => n + c.strongCount, 0)
    const concepts = summaries.reduce((n, c) => n + c.conceptCount, 0)

    return (
        <section aria-label="Chào mừng" className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-[22px] overflow-hidden rounded-3xl border border-brand-100 bg-brand-50 items-center">
            <div className="col-span-1 lg:col-span-6 flex flex-col justify-center">
                <h1 className="text-[26px] font-medium leading-tight tracking-[-0.01em] text-foreground">
                    Chào <b className="font-black text-strong">{name}</b>, học tiếp nhé
                </h1>
                <p className={`mt-3 self-start rounded-full border px-3 py-1.5 text-[14px] font-semibold ${behind ? 'border-warning/50 bg-warning/15 text-foreground' : 'border-success/30 bg-success/10 text-success'}`}>
                    {behind ? 'Bạn đang chậm 1 bài so với lộ trình' : 'Bạn đang học đúng tiến độ'}
                </p>
            </div>
            <div className="col-span-1 lg:col-span-6">
                <div className="overflow-hidden rounded-2xl border border-brand-100 bg-card">
                    <h2 className="bg-brand-100 px-3 py-2 text-center text-[13px] font-extrabold uppercase tracking-[0.06em] text-brand-ink">
                        Tổng quan học kỳ hiện tại
                    </h2>
                    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-3.5">
                        <Metric icon={<BookOpen size={19} />} value={String(doing)} label="Học phần đang học" />
                        <Metric icon={<CheckCircle2 size={19} />} value={`${lessonsDone}/${lessons}`} label="Bài giảng đã xong" />
                        <Metric icon={<Target size={19} />} value={`${strong}/${concepts}`} label="Khái niệm vững" />
                    </ul>
                </div>
            </div>
        </section>
    )
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
    return (
        <li className="flex items-center gap-3 min-w-0">
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-border bg-card text-brand-ink">
                {icon}
            </span>
            <span className="min-w-0">
                <b className="block font-mono text-[18px] font-extrabold leading-tight text-strong">{value}</b>
                <small className="block text-[13px] text-muted-foreground leading-snug">{label}</small>
            </span>
        </li>
    )
}
