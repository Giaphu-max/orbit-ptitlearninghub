import { Check, Moon, Sparkles } from 'lucide-react'
import { dailyArticles, getConcept } from '@/data'
import { MissionList } from '@/components/missions'
import { TodayCount, TodayHeroCard, TodayMiniCards } from '@/components/daily/today-board'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { DAILY_ARTICLE_XP, localDate } from '@/lib/gamification'
import { A2_TIERS } from '@/lib/daily-lit'

/** /today – bài đọc hôm nay (3 miễn phí + bài mở thêm bằng XP), nhiệm vụ hằng ngày, và tóm tắt "Hôm nay đủ rồi" khi đọc hết. Dùng chung khối với chương Hôm nay ở trang chủ. */
export function OrbitTodayView() {
    const today = useTodayDaily()
    const { articles, allDone, read } = today
    const doneCount = articles.filter((a) => read[a.id]).length
    const todayDate = localDate()
    const readToday = dailyArticles.filter((a) => read[a.id] === todayDate).length
    const darkTiers = Math.max(0, A2_TIERS - readToday)
    const darkSuffix = darkTiers > 0 ? ` · còn ${darkTiers} tầng tối` : ''

    return (
        <div className="w-full">
            <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 py-8 lg:px-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Ôn tập cá nhân hóa</p>
                    <h1 className="mt-3 text-headline text-foreground">Lấp lỗ hổng kiến thức chỉ với 3 phút mỗi ngày.</h1>
                    <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-muted-foreground">
                        AI xem lại những câu bạn từng làm sai, rồi tóm thành 3 bài đọc ngắn từ chính bài giảng của thầy cô. Nắm lại bản chất mà không phải xem lại cả video dài.
                    </p>
                    <TodayCount today={today} className="mt-4" />
                </header>

                {doneCount > 0 && !allDone && (
                    <div className="flex max-w-xl items-center gap-2 rounded-xl border border-brand-200 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-ink">
                        <Sparkles size={16} className="shrink-0" />
                        <span>Đã thắp sáng thêm {doneCount} tầng cửa sổ tòa A2 ở trang chủ{darkSuffix}</span>
                    </div>
                )}

                <section aria-label="Bài đọc hôm nay" className="flex max-w-xl flex-col gap-3">
                    <TodayHeroCard today={today} />
                    <TodayMiniCards today={today} />
                </section>
                {articles.length === 0 && <p className="rounded-card bg-muted p-5 text-muted-foreground">Chưa có bài đọc nào.</p>}

                {allDone && <DoneBlock />}

                <section>
                    <h2 className="text-title text-foreground">Nhiệm vụ hôm nay</h2>
                    <MissionList />
                </section>
            </div>
        </div>
    )
}

/** "Hôm nay đủ rồi": tóm tắt những gì đã học qua các bài vừa đọc (khái niệm, XP). */
function DoneBlock() {
    const { articles, read } = useTodayDaily()
    const done = articles.filter((a) => read[a.id])
    const conceptIds = [...new Set(done.flatMap((a) => a.conceptIds))]
    const todayDate = localDate()
    const readToday = dailyArticles.filter((a) => read[a.id] === todayDate).length
    const darkTiers = Math.max(0, A2_TIERS - readToday)
    const darkSuffix = darkTiers > 0 ? ` · còn ${darkTiers} tầng tối` : ''

    return (
        <section aria-label="Hôm nay đủ rồi" className="rounded-card bg-brand-soft p-7">
            <p className="flex items-center gap-2 text-eyebrow uppercase text-brand-ink">
                <Moon size={14} /> Đủ lượt hôm nay
            </p>
            <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-tight tracking-[-0.03em] text-foreground">Hôm nay đủ rồi. Hẹn bạn ngày mai.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                Bạn đã đọc {done.length} bài (+{done.length * DAILY_ARTICLE_XP} XP). Để kiến thức ngấm, hãy nghỉ.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-ink">
                <Sparkles size={16} className="shrink-0" />
                <span>Đã thắp sáng thêm {done.length} tầng cửa sổ tòa A2 ở trang chủ{darkSuffix}</span>
            </div>
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
