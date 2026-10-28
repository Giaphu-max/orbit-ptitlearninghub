import { Check, Moon } from 'lucide-react'
import { dailyArticles, getConcept } from '@/data'
import { MissionList } from '@/components/missions'
import { TodayCount, TodayHeroCard, TodayMiniCards } from '@/components/daily/today-board'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { DAILY_ARTICLE_XP, localDate } from '@/lib/gamification'
import { A2_TIERS } from '@/lib/daily-lit'
import { useOrbitStore } from '@/store/useOrbitStore'

/** /today – bài đọc hôm nay (3 miễn phí + bài mở thêm bằng XP), nhiệm vụ hằng ngày, và tóm tắt "Hôm nay đủ rồi" khi đọc hết. Dùng chung khối với chương Hôm nay ở trang chủ.
 *  Lưới 7/5: cột trái là bài đọc, cột phải (sticky) là thẻ tòa A2 và nhiệm vụ. */
export function OrbitTodayView() {
    const today = useTodayDaily()
    const { articles, allDone } = today

    return (
        <div className="w-full">
            <div className="container-page flex flex-col gap-8 py-8 lg:py-12">
                <header className="page-grid items-end">
                    <div className="col-span-7">
                        <p className="text-eyebrow uppercase text-brand-ink">Ôn tập cá nhân hóa</p>
                        <h1 className="mt-3 text-headline text-foreground">Lấp lỗ hổng kiến thức chỉ với 3 phút mỗi ngày.</h1>
                        <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">
                            AI xem lại những câu bạn từng làm sai, rồi tóm thành 3 bài đọc ngắn từ chính bài giảng của thầy cô. Nắm lại bản chất mà không phải xem lại cả video dài.
                        </p>
                    </div>
                    <div className="col-span-5 flex justify-end">
                        <TodayCount today={today} />
                    </div>
                </header>

                <div className="page-grid items-start gap-y-8">
                    <section aria-label="Bài đọc hôm nay" className="col-span-7 flex flex-col gap-3">
                        <TodayHeroCard today={today} />
                        <TodayMiniCards today={today} />
                        {articles.length === 0 && <p className="rounded-card bg-muted p-5 text-muted-foreground">Chưa có bài đọc nào.</p>}
                        {allDone && <DoneBlock />}
                    </section>

                    <aside className="col-span-5 flex flex-col gap-5 lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
                        <A2TowerCard />
                        <section aria-labelledby="today-missions" className="rounded-card border border-border bg-card p-5 shadow-card">
                            <h2 id="today-missions" className="mb-4 text-lg font-extrabold tracking-tight text-foreground">Nhiệm vụ hôm nay</h2>
                            <MissionList compact />
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    )
}

/** Tòa A2 ở trang chủ: 10 tầng xếp dọc, tầng sáng từ dưới lên theo số bài Daily đã đọc hôm nay. Không nhắc phần thưởng khi thắp đủ. */
function A2TowerCard() {
    const read = useOrbitStore((s) => s.dailyRead)
    const todayDate = localDate()
    const lit = Math.min(A2_TIERS, dailyArticles.filter((a) => read[a.id] === todayDate).length)
    const dark = A2_TIERS - lit
    return (
        <section aria-label="Tòa A2" className="rounded-card border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-bold text-muted-foreground">Tòa A2 ở trang chủ</h2>
            <ol className="mt-4 flex flex-col gap-1.5" aria-hidden>
                {Array.from({ length: A2_TIERS }, (_, i) => (
                    <li key={i} className="h-2.5 rounded-sm transition-colors duration-slow" style={{ background: A2_TIERS - 1 - i < lit ? 'hsl(var(--gold))' : 'hsl(var(--muted))' }} />
                ))}
            </ol>
            <p className="mt-4 text-sm font-semibold text-foreground">
                Đã thắp sáng {lit} tầng{dark > 0 && <span className="text-muted-foreground"> · còn {dark} tầng tối</span>}
            </p>
        </section>
    )
}

/** "Hôm nay đủ rồi": tóm tắt những gì đã học qua các bài vừa đọc (khái niệm, XP). */
function DoneBlock() {
    const { articles, read } = useTodayDaily()
    const done = articles.filter((a) => read[a.id])
    const conceptIds = [...new Set(done.flatMap((a) => a.conceptIds))]

    return (
        <section aria-label="Hôm nay đủ rồi" className="rounded-card bg-brand-soft p-7">
            <p className="flex items-center gap-2 text-eyebrow uppercase text-brand-ink">
                <Moon size={14} /> Đủ lượt hôm nay
            </p>
            <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-tight tracking-[-0.03em] text-foreground">Hôm nay đủ rồi. Hẹn bạn ngày mai.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                Bạn đã đọc {done.length} bài (+{done.length * DAILY_ARTICLE_XP} XP). Để kiến thức ngấm, hãy nghỉ.
            </p>
            <ul className="mt-5 flex flex-col gap-2">
                {done.map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5 text-sm text-foreground">
                        <Check size={16} className="mt-0.5 shrink-0 text-brand-ink" />
                        <span>
                            <b>{a.title}</b>
                            <span className="text-muted-foreground"> · {a.conceptIds.map((id) => getConcept(id)?.name ?? id).join(', ')}</span>
                        </span>
                    </li>
                ))}
            </ul>
            {conceptIds.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Khái niệm đã ôn hôm nay: {conceptIds.length}</p>}
        </section>
    )
}
