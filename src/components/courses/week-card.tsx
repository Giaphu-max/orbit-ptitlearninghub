import { Link } from 'react-router-dom'
import type { DayDot, PlanTask, WeekDay } from '@/lib/week-plan'
import { planDateLabel, weekRange } from '@/lib/week-plan'

const DOT: Record<Exclude<DayDot, null>, string> = { done: 'bg-success', soon: 'bg-warning', late: 'bg-destructive' }

/** Khối phải hàng 2 của /learning: "Tuần này" = dải 7 ngày (chấm trạng thái) + tối đa 3 việc trong lộ trình đề xuất + chú thích. */
export function WeekCard({ week, plan }: { week: WeekDay[]; plan: PlanTask[] }) {
    return (
        <aside className="col-span-4 flex flex-col" aria-labelledby="week-title">
            <h2 id="week-title" className="mb-3 flex items-baseline justify-between text-[15px] font-extrabold text-strong">
                Tuần này<em className="font-mono text-[13px] font-semibold not-italic text-muted-foreground">{weekRange(week)}</em>
            </h2>
            <div className="flex flex-1 flex-col rounded-[22px] border border-border bg-card p-[18px] shadow-card">
                <ol className="grid grid-cols-7 gap-1 border-b border-border pb-3.5 text-center" aria-label="Bảy ngày trong tuần">
                    {week.map((d) => (
                        <li key={d.date} className="flex flex-col items-center gap-1" aria-current={d.today ? 'date' : undefined}>
                            <small className="text-[11.5px] text-muted-foreground">{d.label}</small>
                            <b className={`grid h-[34px] w-[34px] place-items-center rounded-full font-mono text-base font-semibold ${d.today ? 'bg-brand-600 text-ink-foreground' : 'text-strong'}`}>{d.day}</b>
                            <i className={`h-1.5 w-1.5 rounded-full ${d.dot ? DOT[d.dot] : ''}`} aria-label={d.dot === 'done' ? 'Đã học' : d.dot === 'soon' ? 'Sắp tới' : d.dot === 'late' ? 'Quá hạn' : undefined} />
                        </li>
                    ))}
                </ol>
                <ul className="flex flex-1 flex-col justify-evenly gap-1 py-2.5">
                    {plan.map((t) => {
                        const label = planDateLabel(t.date)
                        return (
                            <li key={t.id}>
                                <Link to={t.href} className={`grid grid-cols-[72px_1fr] items-center gap-3.5 rounded-[14px] px-3 py-3 transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${label === 'Hôm nay' ? 'bg-brand-50' : 'hover:bg-muted'}`}>
                                    <span className={`font-mono text-[12.5px] font-bold ${label === 'Hôm nay' ? 'text-brand-ink' : 'text-muted-foreground'}`}>{label}</span>
                                    <span className="min-w-0">
                                        <b className="block text-sm font-extrabold leading-snug text-strong">{t.title}</b>
                                        <small className="mt-0.5 block text-[12.5px] text-muted-foreground">{t.sub}</small>
                                    </span>
                                </Link>
                            </li>
                        )
                    })}
                    {plan.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Chưa có việc nào trong tuần này.</li>}
                </ul>
                <p className="flex justify-center gap-4 border-t border-border pt-3 text-xs font-semibold text-muted-foreground" aria-hidden>
                    <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-success" />Đã học</span>
                    <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-warning" />Sắp tới</span>
                    <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-destructive" />Quá hạn</span>
                </p>
            </div>
        </aside>
    )
}
