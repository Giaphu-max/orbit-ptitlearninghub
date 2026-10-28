import { Link } from 'react-router-dom'
import { Check, Moon } from 'lucide-react'
import { dailyArticles, getConcept } from '@/data'
import { ReviewMissions } from '@/components/missions'
import { TodayHeroCard, TodayRows } from '@/components/daily/today-board'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { localDate } from '@/lib/gamification'
import { A2_TIERS } from '@/lib/daily-lit'
import { CAMPUS } from '@/components/home/campus-palette'
import { useOrbitStore } from '@/store/useOrbitStore'

/** /today – bài đọc hôm nay (3 miễn phí + bài mở thêm bằng XP), nhiệm vụ ôn tập, và tóm tắt "Hôm nay đủ rồi" khi đọc hết. Dùng chung khối với chương Hôm nay ở trang chủ.
 *  Lưới 7/5: trái là bài đọc (tầng 1 = thẻ đỏ bài ưu tiên, còn lại là hàng gọn), phải (sticky) là tòa A2 và nhiệm vụ ôn tập. */
export function OrbitTodayView() {
    const today = useTodayDaily()
    const { articles, allDone, readCount, limit } = today

    return (
        <div className="w-full">
            <div className="container-wide flex flex-col gap-7 py-8 lg:py-12">
                <header className="max-w-[62ch]">
                    <p className="text-eyebrow uppercase text-brand-ink">Ôn tập cá nhân hóa</p>
                    <h1 className="mt-3 text-headline text-foreground">Lấp lỗ hổng kiến thức chỉ với 3 phút mỗi ngày.</h1>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                        AI xem lại những câu bạn từng làm sai, rồi tóm thành 3 bài đọc ngắn từ chính bài giảng của thầy cô. Nắm lại bản chất mà không phải xem lại cả video dài.
                    </p>
                </header>

                <div className="page-grid items-start gap-y-8">
                    <section aria-label="Bài đọc hôm nay" className="col-span-7">
                        <h2 className="mb-3 text-[15px] font-extrabold tracking-tight text-strong">
                            Bài hôm nay<em className="ml-1.5 font-mono text-[13px] font-bold not-italic text-muted-foreground">{Math.min(readCount, limit)}/{limit}</em>
                        </h2>
                        <TodayHeroCard today={today} />
                        <TodayRows today={today} className="mt-3.5" />
                        {articles.length === 0 && <p className="rounded-card bg-muted p-5 text-muted-foreground">Chưa có bài đọc nào.</p>}
                        {allDone && <DoneBlock />}
                    </section>

                    <aside className="col-span-5 flex flex-col gap-[22px] lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
                        <A2TowerCard />
                        <section aria-labelledby="today-missions">
                            <div className="mb-3 flex items-baseline justify-between">
                                <h2 id="today-missions" className="text-[15px] font-extrabold tracking-tight text-strong">Nhiệm vụ ôn tập</h2>
                                <Link to="/journey" className="text-[13.5px] font-bold text-brand-ink hover:underline">Tất cả nhiệm vụ →</Link>
                            </div>
                            <ReviewMissions ids={['daily', 'fix']} />
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    )
}

/** Tòa A2 ở trang chủ: SVG 10 tầng × 4 ô cửa sổ, tầng sáng từ dưới lên theo số bài Daily đã đọc hôm nay (màu đèn tầng của mô hình 3D). */
function A2TowerCard() {
    const read = useOrbitStore((s) => s.dailyRead)
    const todayDate = localDate()
    const lit = Math.min(A2_TIERS, dailyArticles.filter((a) => read[a.id] === todayDate).length)
    const dark = A2_TIERS - lit
    return (
        <section aria-label="Tòa A2">
            <h2 className="mb-3 text-[15px] font-extrabold tracking-tight text-strong">Tòa A2 ở trang chủ</h2>
            <div className="grid grid-cols-[96px_1fr] items-center gap-5 rounded-card border border-border bg-card px-[22px] py-5 shadow-card">
                <svg width="96" height="140" viewBox="0 0 96 140" aria-hidden className="block">
                    <rect x="10" y="10" width="76" height="126" rx="4" style={{ fill: 'hsl(var(--card))', stroke: 'hsl(var(--border))' }} />
                    <rect x="40" y="2" width="16" height="10" rx="2" style={{ fill: 'hsl(var(--border))' }} />
                    <rect x="44" y="14" width="8" height="120" style={{ fill: 'var(--mm-teal)', fillOpacity: 0.3 }} />
                    {Array.from({ length: A2_TIERS }, (_, f) =>
                        [16, 27, 58, 69].map((x) => (
                            <rect
                                key={`${f}-${x}`}
                                x={x}
                                y={122 - f * 11.4}
                                width="8"
                                height="7"
                                rx="1.5"
                                style={f < lit ? { fill: CAMPUS.windowTier, filter: `drop-shadow(0 0 3px ${CAMPUS.windowTier})` } : { fill: 'hsl(var(--muted))' }}
                            />
                        )),
                    )}
                </svg>
                <div>
                    <h3 className="text-[15px] font-extrabold text-strong">{lit} tầng đã sáng</h3>
                    {dark > 0 && (
                        <p className="mt-1.5 text-sm leading-normal text-foreground">
                            Mỗi bài đọc xong thắp thêm một tầng cửa sổ. <b className="text-brand-ink">Còn {dark} tầng tối.</b>
                        </p>
                    )}
                    <p className="mt-2 text-[12.5px] text-muted-foreground">Đèn tắt khi sang ngày mới.</p>
                </div>
            </div>
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
                Bạn đã đọc {done.length} bài. Để kiến thức ngấm, hãy nghỉ.
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
