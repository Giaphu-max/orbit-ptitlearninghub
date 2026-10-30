import { Link } from 'react-router-dom'
import { Check, Moon } from 'lucide-react'
import { getConcept } from '@/data'
import { TodayMissionsList } from '@/components/missions'
import { TodayHeroCard, TodayRows } from '@/components/daily/today-board'
import { useTodayDaily } from '@/hooks/useTodayDaily'
import { EXTRA_READ_COST } from '@/lib/gamification'
import { A2_TIERS } from '@/lib/daily-lit'
import { DAILY_LIMIT } from '@/lib/next-step'
import { CAMPUS } from '@/components/home/campus-palette'

/** /today – bài đọc hôm nay (miễn phí theo lượt ngày + bài mở thêm bằng XP), nhiệm vụ ôn tập, và tóm tắt "Hôm nay đủ rồi" khi đọc hết. Dùng chung khối với chương Hôm nay ở trang chủ.
 *  Lưới 7/5 cùng chiều cao (stretch): trái là bài đọc (thẻ đỏ bài ưu tiên giãn flex-1, còn lại là hàng gọn), phải là MỘT thẻ "Hôm nay của bạn" gộp tòa A2 và nhiệm vụ. */
export function OrbitTodayView() {
    const today = useTodayDaily()
    const { articles, readCount, limit, priority, poolSize } = today
    // Đọc xong các bài đang mở: khối "Hôm nay đủ rồi" thay thẻ đỏ (còn bài khóa thì khối có nút mở thêm bằng XP)
    const doneOnly = articles.length > 0 && !priority

    return (
        <div className="w-full">
            <div className="container-wide flex flex-col gap-7 py-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-ink">Ôn tập cá nhân hóa</p>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 2.55vw, 2.75rem)' }} className="mt-3 whitespace-nowrap text-headline text-foreground">Lấp lỗ hổng kiến thức chỉ với 3 phút mỗi ngày.</h1>
                    <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
                        AI gom những câu bạn từng làm sai thành các bài đọc ngắn từ chính bài giảng của thầy cô. Nắm lại bản chất mà không phải xem lại cả video dài.
                    </p>
                </header>

                <div className="page-grid items-stretch gap-y-8">
                    <section aria-label="Bài đọc hôm nay" className="col-span-7 flex flex-col">
                        <h2 className="mb-3 text-[15px] font-extrabold tracking-tight text-strong">
                            Bài hôm nay<em className="ml-1.5 font-mono text-[13px] font-bold not-italic text-muted-foreground">{Math.min(readCount, limit)}/{limit}</em>
                            {poolSize > DAILY_LIMIT && <span className="ml-3 text-[12.5px] font-medium text-muted-foreground">Hôm nay mở miễn phí {DAILY_LIMIT} bài · bài thứ {DAILY_LIMIT + 1} trở đi dùng XP</span>}
                        </h2>
                        {doneOnly ? <DoneBlock className="flex-1" /> : <TodayHeroCard today={today} className="flex-1" />}
                        <TodayRows today={today} className="mt-3.5" />
                        {articles.length === 0 && <p className="rounded-card bg-muted p-5 text-muted-foreground">Chưa có bài đọc nào.</p>}
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

/**
 * Phần trên của thẻ "Hôm nay của bạn": tòa A2 SVG 10 tầng ứng với tối đa 10 bài. Tầng đã đọc sáng đèn (màu đèn tầng của mô hình 3D),
 * tầng đang mở miễn phí/đã mở để tối, tầng cần XP có ổ khóa + giá, tầng không có bài (kho ít hơn 10) mờ.
 */
function A2Tower() {
    const { articles, read, poolSize } = useTodayDaily()
    const lit = Math.min(A2_TIERS, articles.filter((a) => read[a.id]).length)
    const dark = Math.max(0, Math.min(A2_TIERS, poolSize) - lit)
    const tierState = (f: number) => (f < lit ? 'lit' : f < articles.length ? 'open' : f < poolSize ? 'locked' : 'none')
    const H = 18
    return (
        <div className="grid grid-cols-[104px_1fr] items-center gap-5 border-b border-border px-6 py-[22px]">
            <svg width="104" height="206" viewBox="0 0 104 206" aria-hidden className="block">
                <rect x="4" y="14" width="96" height="190" rx="4" style={{ fill: 'hsl(var(--card))', stroke: 'hsl(var(--border))' }} />
                <rect x="44" y="2" width="16" height="10" rx="2" style={{ fill: 'hsl(var(--border))' }} />
                {Array.from({ length: A2_TIERS }, (_, f) => {
                    const y = 192 - f * H
                    const st = tierState(f)
                    if (st === 'locked') {
                        return (
                            <g key={f} style={{ fill: 'none', stroke: 'hsl(var(--muted-foreground))' }}>
                                <rect x="14" y={y + 1} width="76" height="12" rx="3" style={{ fill: 'hsl(var(--muted))', stroke: 'none' }} />
                                <rect x="20" y={y + 6} width="7" height="5" rx="1" strokeWidth="1.2" />
                                <path d={`M21.5 ${y + 6}v-1.5a2 2 0 0 1 4 0V${y + 6}`} strokeWidth="1.2" />
                                <text x="32" y={y + 11} style={{ fill: 'hsl(var(--muted-foreground))', stroke: 'none', font: '600 8.5px ui-monospace, monospace' }}>{EXTRA_READ_COST} XP</text>
                            </g>
                        )
                    }
                    return [14, 31, 62, 79].map((x) => (
                        <rect
                            key={`${f}-${x}`}
                            x={x}
                            y={y + 2}
                            width="11"
                            height="10"
                            rx="1.5"
                            style={st === 'lit' ? { fill: CAMPUS.windowTier, filter: `drop-shadow(0 0 3px ${CAMPUS.windowTier})` } : { fill: 'hsl(var(--muted))', opacity: st === 'none' ? 0.35 : 1 }}
                        />
                    ))
                })}
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
    const { articles, read, locked, remaining, canAfford, unlockExtra } = useTodayDaily()
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
            {locked && (
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-5">
                    <button
                        type="button"
                        onClick={() => unlockExtra()}
                        disabled={!canAfford}
                        className="rounded-[14px] surface-red px-5 py-3 text-[15px] font-extrabold text-ink-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-50"
                    >
                        {canAfford ? 'Mở thêm 1 bài' : 'Chưa đủ XP để mở thêm'} · <span className="font-mono">{EXTRA_READ_COST} XP</span>
                    </button>
                    <span className="text-sm text-muted-foreground">Còn {remaining} bài có thể mở thêm hôm nay.</span>
                </div>
            )}
            {conceptIds.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Khái niệm đã ôn hôm nay: {conceptIds.length}</p>}
        </section>
    )
}
