import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Award, Lock, TrendingUp } from 'lucide-react'
import { levelProgress, levelTitle } from '@/lib/gamification'
import { useRewardStore, type RewardEvent } from '@/store/useRewardStore'

/** Màn hình nhận thưởng phủ đỏ (theo docs/mockup/Reward.dc.html): hiện lần lượt từng sự kiện trong hàng đợi. */
export function RewardOverlay() {
    const event = useRewardStore((s) => s.queue[0])
    const dismiss = useRewardStore((s) => s.dismiss)

    useEffect(() => {
        if (!event) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') dismiss()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [event, dismiss])

    // Portal ra <body>: nằm trên mọi lớp của layout, kể cả nút chuyển giao diện
    return createPortal(
        <AnimatePresence mode="wait">{event && <RewardScreen key={event.id} event={event} onClose={dismiss} />}</AnimatePresence>,
        document.body,
    )
}

/** Độ trễ từng dòng trồi lên (giây) */
const stagger = (i: number) => ({ animationDelay: `${0.3 + i * 0.12}s` })

function RewardScreen({ event, onClose }: { event: RewardEvent; onClose: () => void }) {
    const navigate = useNavigate()
    const lpBefore = levelProgress(event.xpBefore)
    const lp = levelProgress(event.xpAfter)
    const levelUp = lp.level > lpBefore.level
    const btnRef = useRef<HTMLButtonElement>(null)
    useEffect(() => btnRef.current?.focus(), [])

    const go = (to: string) => {
        onClose()
        navigate(to)
    }

    return (
        <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${event.context}: ${event.headline}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden bg-reward text-ink-foreground"
        >
            {/* Hình trang trí trôi (chỉ transform) + hai vòng tròn mờ */}
            <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
                <Drift className="left-[8%] top-[10%] h-[18px] w-[18px] rotate-45 bg-ink-foreground opacity-90 animate-drift-30" />
                <Drift className="left-[18%] top-[71%] h-3 w-3 rounded-full bg-ink animate-drift-40" />
                <Drift className="left-[82%] top-[13%] h-[22px] w-[22px] rotate-[20deg] border-[3px] border-ink-foreground animate-drift-36" />
                <Drift className="left-[90%] top-[62%] h-3.5 w-3.5 rotate-45 bg-warning animate-drift-28" />
                <Drift className="left-[68%] top-[86%] h-2.5 w-2.5 rounded-full bg-ink-foreground animate-drift-32" />
                <Drift className="left-[29%] top-[7%] h-2.5 w-2.5 bg-warning animate-drift-34" />
                <span className="absolute -left-40 top-[58%] h-[560px] w-[560px] rounded-full border-[1.5px] border-ink-foreground/20" />
                <span className="absolute -top-64 left-[74%] h-[620px] w-[620px] rounded-full border-[1.5px] border-ink-foreground/20" />
            </div>

            <div className="relative mx-auto flex min-h-full w-full max-w-[1440px] flex-col items-stretch gap-10 px-6 py-10 lg:flex-row lg:items-center lg:gap-[72px] lg:px-24 lg:py-16">
                {/* ── Cột trái: ngữ cảnh, số XP, câu chốt, chi tiết ── */}
                <div className="flex min-w-0 flex-1 flex-col gap-6 lg:gap-7">
                    <span className="self-start rounded-full bg-ink-foreground/15 px-3.5 py-2 text-sm font-bold">{event.context}</span>

                    {event.xp > 0 && (
                        <div className="flex animate-pop items-baseline gap-3 lg:gap-4">
                            <span className="font-mono text-[clamp(5rem,13vw,10.5rem)] font-bold leading-[0.9] tracking-[-0.06em]">+{event.xp}</span>
                            <span className="text-[clamp(1.75rem,3.4vw,3rem)] font-extrabold">XP</span>
                        </div>
                    )}

                    <h2 className="max-w-xl text-[clamp(1.75rem,3vw,2.5rem)] font-extrabold leading-[1.15] tracking-tight">{event.headline}</h2>

                    {event.rows.length > 0 && (
                        <ul className="flex max-w-lg flex-col gap-2.5">
                            {event.rows.map((r, i) => (
                                <li
                                    key={r.label}
                                    style={stagger(i)}
                                    className={`flex animate-rise-quiz items-center justify-between gap-4 rounded-xl px-4 py-3 text-[15px] ${r.highlight ? 'bg-ink-foreground text-brand-700' : 'bg-ink-foreground/15'}`}
                                >
                                    <span className={r.highlight ? 'font-bold' : ''}>{r.label}</span>
                                    <strong className="shrink-0 font-mono">{r.xp > 0 ? `+${r.xp}` : '·'}</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ── Cột phải: cấp độ, huy hiệu / mức nắm vững, mở khóa, nút ── */}
                <div className="flex w-full shrink-0 animate-rise-r2 flex-col gap-5 lg:w-[480px]">
                    <div className="relative rounded-3xl bg-ink-foreground p-7 text-ink">
                        <div className="flex items-baseline justify-between gap-3">
                            <strong className="text-lg">
                                Cấp {lp.level} · {levelTitle(lp.level)}
                            </strong>
                            <span className="font-mono text-[13px] text-ink/70">
                                {event.xpAfter.toLocaleString('vi-VN')} / {(event.xpAfter + lp.toNext).toLocaleString('vi-VN')}
                            </span>
                        </div>
                        <Bar className="mt-4 h-3" trackClass="bg-ink/10" fillClass="bg-brand-600" from={levelUp ? 0 : lpBefore.ratio} to={lp.ratio} />
                        <p className="mt-4 text-[13px] text-ink/70">
                            Còn {lp.toNext.toLocaleString('vi-VN')} XP để lên Cấp {lp.level + 1} · {levelTitle(lp.level + 1) ?? 'Cấp mới'}
                        </p>
                        {levelUp && (
                            <span className="absolute -right-2 -top-3 inline-flex animate-pop items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-extrabold text-ink-foreground shadow-brand [animation-delay:0.5s]">
                                <span aria-hidden className="absolute inset-0 animate-glow-ring rounded-full bg-brand-600" />
                                <TrendingUp size={14} className="relative" /> <span className="relative">Lên cấp {lp.level}!</span>
                            </span>
                        )}
                    </div>

                    {event.badge ? (
                        <div className="flex items-center gap-5 rounded-3xl bg-ink p-7 text-ink-foreground">
                            <span className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center">
                                <span aria-hidden className="absolute inset-0 animate-glow-ring rounded-[22px] bg-brand-600" />
                                <span className="relative flex h-full w-full items-center justify-center rounded-[22px] bg-brand-600 text-ink-foreground">
                                    <Award size={44} strokeWidth={1.6} />
                                </span>
                            </span>
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-warning">Huy hiệu mới</span>
                                <strong className="text-[22px] leading-tight tracking-tight">{event.badge.name}</strong>
                                <span className="text-sm text-ink-foreground/80">{event.badge.description}</span>
                            </div>
                        </div>
                    ) : (
                        event.mastery && (
                            <div className="rounded-3xl bg-ink p-7 text-ink-foreground">
                                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-warning">Mức nắm vững</span>
                                <div className="mt-2 flex items-baseline justify-between gap-3">
                                    <strong className="text-[22px] leading-tight tracking-tight">{event.mastery.name}</strong>
                                    <span className="shrink-0 font-mono text-[15px] font-bold">
                                        {Math.round(event.mastery.from * 100)}% → {Math.round(event.mastery.to * 100)}%
                                    </span>
                                </div>
                                <Bar className="mt-4 h-2.5" trackClass="bg-ink-foreground/20" fillClass="bg-brand-light" from={event.mastery.from} to={event.mastery.to} />
                            </div>
                        )
                    )}

                    <div className="flex items-center gap-3.5 rounded-[20px] bg-ink-foreground/15 px-6 py-5">
                        <Lock size={22} className="shrink-0" aria-hidden />
                        <span className="text-[15px] leading-snug">
                            {event.unlocked.length > 0 && (
                                <>
                                    Đã mở khóa <strong>{event.unlocked.join(', ')}</strong> trên cây kỹ năng ·{' '}
                                </>
                            )}
                            chuỗi học <strong>{event.streak} ngày</strong>
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <button
                            ref={btnRef}
                            type="button"
                            onClick={() => go(event.next.to)}
                            className="flex-1 rounded-[14px] bg-ink-foreground p-4 text-base font-extrabold text-brand-700 transition duration-fast hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-foreground/50"
                        >
                            {event.next.label}
                        </button>
                        <button
                            type="button"
                            onClick={() => go('/')}
                            className="flex-1 rounded-[14px] border-[1.5px] border-ink-foreground p-4 text-base font-bold text-ink-foreground transition duration-fast hover:bg-ink-foreground/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-foreground/50"
                        >
                            Về trang chủ
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

/**
 * Thanh tiến độ chạy bằng scaleX từ gốc trái (chỉ transform). Giá trị cuối đặt sẵn trong style,
 * nên khi tắt animation (giảm chuyển động) thanh vẫn hiện đúng.
 */
function Bar({ from, to, className, trackClass, fillClass }: { from: number; to: number; className: string; trackClass: string; fillClass: string }) {
    const clamp = (n: number) => Math.min(1, Math.max(0, n))
    return (
        <span className={`block overflow-hidden rounded-full ${trackClass} ${className}`} role="progressbar" aria-valuenow={Math.round(clamp(to) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span
                className={`block h-full w-full origin-left animate-fill-bar rounded-full ${fillClass}`}
                style={{ transform: `scaleX(${clamp(to)})`, ['--fill-from' as string]: clamp(from), ['--fill-to' as string]: clamp(to) }}
            />
        </span>
    )
}

function Drift({ className }: { className: string }) {
    return <span className={`absolute ${className}`} />
}
