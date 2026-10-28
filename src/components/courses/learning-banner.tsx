import type { ReactNode } from 'react'
import { BookOpen, CheckCircle2, Target } from 'lucide-react'
import type { CourseSummary } from '@/lib/course-map'

/**
 * Banner chào ở đầu /learning: chính nó là lưới 12 cột (gap 24) nên đường chia 8/4 trùng với hàng bên dưới.
 * Trái 8 cột = lời chào + chip tiến độ; phải 4 cột = khung "Tổng quan học kỳ hiện tại" (chỉ tính học phần có bài giảng thật).
 */
export function LearningBanner({ name, summaries, behind }: { name: string; summaries: CourseSummary[]; behind: boolean }) {
    const doing = summaries.filter((c) => c.status === 'doing').length
    const lessonsDone = summaries.reduce((n, c) => n + c.doneCount, 0)
    const lessons = summaries.reduce((n, c) => n + c.lessons.length, 0)
    const strong = summaries.reduce((n, c) => n + c.strongCount, 0)
    const concepts = summaries.reduce((n, c) => n + c.conceptCount, 0)
    return (
        <section aria-label="Chào mừng" className="grid grid-cols-12 gap-x-6 overflow-hidden rounded-3xl border border-brand-100 bg-brand-50">
            <div className="col-span-8 flex flex-col justify-center px-9 py-8">
                <h1 className="text-[26px] font-medium leading-tight tracking-[-0.01em] text-foreground">
                    Chào <b className="font-black text-strong">{name}</b>, học tiếp nhé
                </h1>
                <p className={`mt-3.5 self-start rounded-full border px-3 py-1.5 text-[13.5px] font-semibold ${behind ? 'border-warning/50 bg-warning/15 text-foreground' : 'border-success/30 bg-success/10 text-success'}`}>
                    {behind ? 'Bạn đang chậm 1 bài so với lộ trình' : 'Bạn đang học đúng tiến độ'}
                </p>
            </div>
            <div className="col-span-4 py-6 pr-6">
                <div className="overflow-hidden rounded-2xl border border-brand-100 bg-card">
                    <h2 className="bg-brand-100 px-3 py-2.5 text-center text-[13px] font-extrabold uppercase tracking-[0.06em] text-brand-ink">Tổng quan học kỳ hiện tại</h2>
                    <ul className="grid gap-3.5 px-5 py-4">
                        <Metric icon={<BookOpen size={18} />} value={String(doing)} label="học phần đang học" />
                        <Metric icon={<CheckCircle2 size={18} />} value={`${lessonsDone}/${lessons}`} label="bài giảng đã xong" />
                        <Metric icon={<Target size={18} />} value={`${strong}/${concepts}`} label="khái niệm vững" />
                    </ul>
                </div>
            </div>
        </section>
    )
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
    return (
        <li className="grid grid-cols-[36px_1fr] items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand-50 text-brand-ink">{icon}</span>
            <span>
                <b className="block font-mono text-lg font-extrabold leading-tight text-strong">{value}</b>
                <small className="text-[12.5px] text-muted-foreground">{label}</small>
            </span>
        </li>
    )
}
