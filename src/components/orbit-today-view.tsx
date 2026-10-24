import { Check, Moon } from 'lucide-react'
import { getConcept } from '@/data'
import { MissionList } from '@/components/missions'
import { TodayCount, TodayHeroCard, TodayMiniCards } from '@/components/daily/today-board'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { DAILY_ARTICLE_XP } from '@/lib/gamification'

/** /today – bài đọc hôm nay (3 miễn phí + bài mở thêm bằng XP), nhiệm vụ hằng ngày, và tóm tắt "Hôm nay đủ rồi" khi đọc hết. Dùng chung khối với chương Hôm nay ở trang chủ. */
export function OrbitTodayView() {
    const today = useTodayDaily()
    const { articles, allDone } = today

    return (
        <div className="w-full">
            <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 py-8 lg:px-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">01 · Hôm nay</p>
                    <h1 className="mt-3 text-headline text-foreground">3 bài đọc ngắn cho hôm nay</h1>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">Mỗi bài khoảng 1 phút. AI chọn theo chỗ bạn còn hổng.</p>
                    <TodayCount today={today} className="mt-4" />
                </header>

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
