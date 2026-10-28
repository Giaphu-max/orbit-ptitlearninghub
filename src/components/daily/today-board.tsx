import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import type { DailyArticle } from '@/data/types'
import { EXTRA_READ_COST } from '@/lib/gamification'
import { useUnlockAnimation, type useTodayDaily } from '@/hooks/useTodayDaily'

// Các khối dùng chung của chương Hôm nay (trang chủ) và trang /today: dòng đếm, thẻ lớn "việc tiếp theo", thẻ nhỏ, dòng nhiệm vụ.
// Không giải thích cơ chế bằng chữ: thẻ khóa chỉ có lý do, tiêu đề, nút mở bằng XP.

export type Today = ReturnType<typeof useTodayDaily>

function LockIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path className="lock-shackle" d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
    )
}

/** Dòng mô tả ngắn lấy từ đoạn mở đầu của bài (khối hook, rồi đoạn văn đầu). */
function articleBlurb(a: DailyArticle) {
    const b = a.blocks.find((x) => x.type === 'hook' || x.type === 'paragraph')
    return b && 'text' in b ? b.text : ''
}
const checkCount = (a: DailyArticle) => a.blocks.filter((b) => b.type === 'check').length

/** Thẻ lớn: luôn là việc cần làm tiếp theo (bài ưu tiên / bài khóa mở bằng XP / đã hết bài). */
export function TodayHeroCard({ today, className = '', compact = false }: { today: Today; className?: string; compact?: boolean }) {
    const { priority, locked, allDone, canAfford, reasonFor, unlockExtra, isReview, reviewLabel, xpFor } = today
    const { opening, run } = useUnlockAnimation(locked, unlockExtra)
    const lockedArticle = opening ?? locked

    if (lockedArticle) {
        return <LockedCard article={lockedArticle} reason={isReview(lockedArticle) ? reviewLabel(lockedArticle) : reasonFor(lockedArticle, 'Bài mở thêm')} canAfford={canAfford} opening={Boolean(opening)} onUnlock={run} className={className} />
    }
    if (priority) {
        return (
            <Link
                to={`/daily/${priority.id}`}
                data-vt={`daily-${priority.id}`}
                className={`tier-1-bob group relative flex flex-col overflow-hidden rounded-[22px] surface-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${compact ? 'p-6' : 'min-h-[300px] px-9 pb-[30px] pt-[34px]'} ${className}`}
            >
                <span aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-[radial-gradient(circle,hsl(var(--ink-foreground)/0.18),transparent_70%)]" />
                <span className="relative inline-flex self-start rounded-full bg-ink-foreground/20 px-3 py-1.5 text-xs font-bold">{isReview(priority) ? reviewLabel(priority) : reasonFor(priority, 'Nên đọc trước')}</span>
                <b className={`relative block max-w-[22ch] text-balance font-black tracking-[-0.025em] ${compact ? 'mt-3.5 text-[24px] font-extrabold leading-[1.22]' : 'mt-[22px] text-[34px] leading-[1.15]'}`}>{priority.title}</b>
                {!compact && <span className="relative mt-3 line-clamp-2 max-w-[52ch] text-[15px] leading-[1.55] text-ink-foreground/85">{articleBlurb(priority)}</span>}
                <span className={`relative mt-auto flex items-center justify-between gap-3 ${compact ? 'pt-5' : 'pt-[26px]'}`}>
                    <span className="font-mono text-[13px] font-semibold opacity-90">
                        {priority.readingMinutes} phút · +{xpFor(priority)} XP{!compact && ` · ${checkCount(priority)} câu kiểm tra`}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-[14px] bg-ink-foreground px-[22px] py-3.5 text-base font-extrabold text-brand-ink">
                        Đọc ngay <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
                    </span>
                </span>
            </Link>
        )
    }
    if (allDone) {
        return (
            <div className={`card-done relative overflow-hidden rounded-[22px] p-6 text-ink-foreground ${className}`}>
                <span className="inline-flex rounded-full bg-ink-foreground/10 px-3 py-1.5 text-xs font-bold text-[hsl(var(--success-light))]">✓ Đã đọc hết bài hôm nay</span>
                <b className="mt-3.5 block text-[24px] font-extrabold leading-[1.22] tracking-[-0.02em]">Hẹn bạn ngày mai.</b>
            </div>
        )
    }
    return null
}

function LockedCard({ article, reason, canAfford, opening, onUnlock, className }: { article: DailyArticle; reason: string; canAfford: boolean; opening: boolean; onUnlock: () => void; className: string }) {
    return (
        <div data-opening={opening} className={`card-locked relative overflow-hidden rounded-[22px] p-7 text-ink-foreground shadow-raised ${className}`}>
            <span aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-[radial-gradient(circle,hsl(var(--brand)/0.28),transparent_70%)]" />
            <span className="relative inline-flex items-center gap-2 self-start rounded-full bg-ink-foreground/10 px-3 py-1.5 text-xs font-bold text-ink-foreground/75">
                <LockIcon /> {reason}
            </span>
            <b className="relative mt-3.5 block max-w-[20ch] text-balance text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em]">{article.title}</b>
            <span aria-hidden className="relative mt-[18px] flex flex-col gap-2">
                <i className="block h-[9px] rounded-[5px] bg-ink-foreground/10" />
                <i className="block h-[9px] rounded-[5px] bg-ink-foreground/10" />
                <i className="block h-[9px] w-[58%] rounded-[5px] bg-ink-foreground/10" />
            </span>
            <span className="relative mt-5 flex items-center justify-between gap-3">
                <span className="font-mono text-[13px] text-ink-foreground/75">{article.readingMinutes} phút đọc</span>
                <button
                    type="button"
                    disabled={!canAfford || opening}
                    onClick={onUnlock}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-[18px] py-[13px] text-[15px] font-extrabold text-ink-foreground transition-colors duration-fast hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground disabled:cursor-not-allowed disabled:bg-ink-foreground/10 disabled:text-ink-foreground/60 disabled:hover:bg-ink-foreground/10"
                >
                    <LockIcon />
                    {canAfford ? 'Mở bằng' : 'Cần'} <span className="font-mono">{EXTRA_READ_COST} XP</span>
                </button>
            </span>
        </div>
    )
}

/** Các bài còn lại: hàng gọn (tầng 2). Bài chưa đọc trước, bài đã đọc nhạt đi với dấu tích. */
export function TodayRows({ today, max, className = '' }: { today: Today; max?: number; className?: string }) {
    const { articles, read, priority, isReview, reviewLabel, xpFor } = today
    const others = articles.filter((a) => a.id !== priority?.id)
    const list = [...others.filter((a) => !read[a.id]), ...others.filter((a) => read[a.id]).reverse()].slice(0, max)
    if (list.length === 0) return null
    const start = priority ? 2 : 1
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {list.map((a, i) => {
                const done = Boolean(read[a.id])
                return (
                    <Link
                        key={a.id}
                        to={`/daily/${a.id}`}
                        data-vt={`daily-${a.id}`}
                        className={`flex items-center gap-3.5 rounded-[14px] border border-border px-[18px] py-3.5 transition duration-base ease-out hover:translate-x-0.5 hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${done ? 'bg-transparent' : 'bg-card'}`}
                    >
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold ${done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                            {done ? <Check size={14} strokeWidth={3} /> : start + i}
                        </span>
                        <span className="min-w-0 flex-1">
                            <b className={`block truncate text-[15px] ${done ? 'font-semibold text-muted-foreground' : 'font-bold text-strong'}`}>{a.title}</b>
                            {!done && isReview(a) && <span className="block text-xs text-muted-foreground">{reviewLabel(a)}</span>}
                        </span>
                        {!done && (
                            <span className="shrink-0 font-mono text-[12.5px] text-muted-foreground">
                                {a.readingMinutes} phút · +{xpFor(a)} XP
                            </span>
                        )}
                        <span className={`shrink-0 text-[13.5px] ${done ? 'font-bold text-success' : 'font-extrabold text-brand-ink'}`}>{done ? 'Đã đọc' : 'Đọc →'}</span>
                    </Link>
                )
            })}
        </div>
    )
}

/** Một hàng: "Nhiệm vụ hôm nay · a/b · Xem →" */
export function TodayMissionLine({ today, className = '' }: { today: Today; className?: string }) {
    return (
        <div className={`flex items-center justify-between border-t border-border pt-3.5 text-[13px] text-muted-foreground ${className}`}>
            <span>
                Nhiệm vụ hôm nay · <b className="font-mono text-foreground">{today.missionsDone}/{today.missionsTotal}</b>
            </span>
            <Link to="/journey" className="inline-flex items-center gap-1 font-bold text-brand-ink hover:underline">
                Xem <ArrowRight size={13} />
            </Link>
        </div>
    )
}
