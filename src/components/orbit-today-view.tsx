import { Link } from 'react-router-dom'
import { Check, Moon } from 'lucide-react'
import { dailyArticles, getConcept } from '@/data'
import { TodayMissionsList } from '@/components/missions'
import { TodayHeroCard, TodayRows } from '@/components/daily/today-board'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { localDate } from '@/lib/gamification'
import { A2_TIERS } from '@/lib/daily-lit'
import { CAMPUS } from '@/components/home/campus-palette'
import { useOrbitStore } from '@/store/useOrbitStore'

/** /today – bài đọc hôm nay (3 miễn phí + bài mở thêm bằng XP), nhiệm vụ ôn tập, và tóm tắt "Hôm nay đủ rồi" khi đọc hết. Dùng chung khối với chương Hôm nay ở trang chủ.
 *  Lưới 7/5 cùng chiều cao (stretch): trái là bài đọc (thẻ đỏ bài ưu tiên giãn flex-1, còn lại là hàng gọn), phải là MỘT thẻ "Hôm nay của bạn" gộp tòa A2 và nhiệm vụ. */
export function OrbitTodayView() {
    const today = useTodayDaily()
    const { articles, allDone, readCount, limit, locked, priority } = today
    // Hết lượt hẳn (không còn bài khóa để mở): khối "Hôm nay đủ rồi" thay thẻ đỏ
    const doneOnly = allDone && !locked && !priority

    return (
        <div className="w-full">
            <div className="container-wide flex flex-col gap-7 py-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Ôn tập cá nhân hóa</p>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 2.55vw, 2.75rem)' }} className="mt-3 whitespace-nowrap text-headline text-foreground">Lấp lỗ hổng kiến thức chỉ với 3 phút mỗi ngày.</h1>
                    <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
                        AI xem lại những câu bạn từng làm sai, rồi tóm thành 3 bài đọc ngắn từ chính bài giảng của thầy cô. Nắm lại bản chất mà không phải xem lại cả video dài.
                    </p>
                </header>

                <div className="page-grid items-stretch gap-y-8">
                    <section aria-label="Bài đọc hôm nay" className="col-span-7 flex flex-col">
                        <h2 className="mb-3 text-[15px] font-extrabold tracking-tight text-strong">
                            Bài hôm nay<em className="ml-1.5 font-mono text-[13px] font-bold not-italic text-muted-foreground">{Math.min(readCount, limit)}/{limit}</em>
                        </h2>
                        {doneOnly ? <DoneBlock className="flex-1" /> : <TodayHeroCard today={today} className="flex-1" />}
                        <TodayRows today={today} className="mt-3.5" />
                        {articles.length === 0 && <p className="rounded-card bg-muted p-5 text-muted-foreground">Chưa có bài đọc nào.</p>}
                        {allDone && !doneOnly && <DoneBlock className="mt-3.5" />}
                    </section>

                    <aside aria-labelledby="today-mine" className="col-span-5 flex flex-col">
                        <div className="mb-3 flex items-baseline justify-between">
                            <h2 id="today-mine" className="text-[15px] font-extrabold tracking-tight text-strong">Hôm nay của bạn</h2>
                            <Link to="/journey" className="text-[13.5px] font-bold text-brand-ink hover:underline">Tất cả nhiệm vụ →</Link>
                        </div>
                        <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-border bg-card shadow-card">
                            <A2Tower />
                            <TodayMissionsList reviewIds={['daily', 'fix']} />
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}

/** Phần trên của thẻ "Hôm nay của bạn": tòa A2 SVG 80×118 (10 tầng × 4 ô, tầng sáng từ dưới lên theo số bài Daily đọc hôm nay, màu đèn tầng của mô hình 3D) + chữ. */
function A2Tower() {
    const read = useOrbitStore((s) => s.dailyRead)
    const todayDate = localDate()
    const lit = Math.min(A2_TIERS, dailyArticles.filter((a) => read[a.id] === todayDate).length)
    const dark = A2_TIERS - lit
    return (
        <div className="grid grid-cols-[80px_1fr] items-center gap-5 border-b border-border px-6 py-[22px]">
            <svg width="80" height="118" viewBox="0 0 96 140" aria-hidden className="block">
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
                <h3 className="text-[15px] font-extrabold text-strong">Tòa A2 · {lit} tầng đã sáng</h3>
                <p className="mt-1.5 text-sm leading-normal text-foreground">
                    Mỗi bài đọc xong thắp thêm một tầng cửa sổ ở trang chủ.{dark > 0 && <> <b className="text-brand-ink">Còn {dark} tầng tối.</b></>}
                </p>
            </div>
        </div>
    )
}

/** "Hôm nay đủ rồi": tóm tắt những gì đã học qua các bài vừa đọc (khái niệm, XP). */
function DoneBlock({ className = '' }: { className?: string }) {
    const { articles, read } = useTodayDaily()
    const done = articles.filter((a) => read[a.id])
    const conceptIds = [...new Set(done.flatMap((a) => a.conceptIds))]

    return (
        <section aria-label="Hôm nay đủ rồi" className={`rounded-card bg-brand-soft p-7 ${className}`}>
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
