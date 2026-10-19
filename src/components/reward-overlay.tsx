import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion } from 'motion/react'
import { Award, Sparkles, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { levelProgress, levelTitle } from '@/lib/gamification'
import { useOrbitStore } from '@/store/useOrbitStore'
import { useRewardStore, type RewardEvent } from '@/store/useRewardStore'

/** Màn hình nhận thưởng phủ đỏ: xong bài, lên cấp, huy hiệu mới. Hiện lần lượt từng sự kiện trong hàng đợi. */
export function RewardOverlay() {
    const event = useRewardStore((s) => s.queue[0])
    const dismiss = useRewardStore((s) => s.dismiss)

    useEffect(() => {
        if (!event) return
        const onKey = (e: KeyboardEvent) => {
            // Enter đã có nút "Tiếp tục" đang focus xử lý, thêm ở đây sẽ bỏ qua luôn màn kế tiếp
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

function describe(event: RewardEvent): { icon: LucideIcon; eyebrow: string; title: string; subtitle: string } {
    switch (event.kind) {
        case 'xp':
            return { icon: Zap, eyebrow: 'Nhận XP', title: event.title, subtitle: event.subtitle }
        case 'level-up':
            return { icon: TrendingUp, eyebrow: 'Lên cấp', title: `Cấp ${event.level} · ${levelTitle(event.level)}`, subtitle: 'Bạn đã nắm bài đủ chắc để lên cấp mới.' }
        case 'badge':
            return { icon: Award, eyebrow: 'Huy hiệu mới', title: event.badge.name, subtitle: event.badge.description }
    }
}

function RewardScreen({ event, onClose }: { event: RewardEvent; onClose: () => void }) {
    const { icon: Icon, eyebrow, title, subtitle } = describe(event)
    const xp = useOrbitStore((s) => s.xp)
    const lp = levelProgress(xp)

    // Số XP đếm lên từ 0
    const [shown, setShown] = useState(0)
    const target = event.kind === 'xp' ? event.xp : 0
    useEffect(() => {
        if (!target) return
        const controls = animate(0, target, { duration: 0.9, ease: 'easeOut', onUpdate: (v) => setShown(Math.round(v)) })
        return () => controls.stop()
    }, [target])

    const btnRef = useRef<HTMLButtonElement>(null)
    useEffect(() => btnRef.current?.focus(), [])

    return (
        <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${eyebrow}: ${title}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-reward px-6 text-ink-foreground"
        >
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70 bg-dots mask-fade-r" />
            {/* Hình trang trí trôi (mockup Reward) */}
            <Drift className="left-[8%] top-[10%] h-[18px] w-[18px] rotate-45 bg-ink-foreground opacity-90 animate-drift-30" />
            <Drift className="left-[18%] top-[71%] h-3 w-3 rounded-full bg-ink animate-drift-40" />
            <Drift className="left-[82%] top-[13%] h-[22px] w-[22px] rotate-[20deg] border-[3px] border-ink-foreground animate-drift-36" />
            <Drift className="left-[90%] top-[62%] h-3.5 w-3.5 rotate-45 bg-warning animate-drift-28" />
            <Drift className="left-[68%] top-[86%] h-2.5 w-2.5 rounded-full bg-ink-foreground animate-drift-32" />
            <Drift className="left-[29%] top-[7%] h-2.5 w-2.5 bg-warning animate-drift-34" />
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    aria-hidden
                    initial={{ scale: 0.3, opacity: 0.5 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{ duration: 2.4, delay: i * 0.55, repeat: Infinity, ease: 'easeOut' }}
                    className="pointer-events-none absolute h-[420px] w-[420px] rounded-full border border-ink-foreground/40"
                />
            ))}

            <div className="relative flex max-w-xl flex-col items-center text-center">
                <span className="relative animate-pop">
                    {/* Huy hiệu phát sáng: vòng mở rộng và mờ dần */}
                    <span aria-hidden className="absolute inset-0 animate-glow-ring rounded-full bg-ink-foreground" />
                    <span className="relative flex h-24 w-24 items-center justify-center on-red-btn rounded-full shadow-raised">
                        <Icon size={44} className={event.kind === 'xp' ? 'fill-current' : ''} />
                    </span>
                </span>

                <motion.p initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="mt-8 text-eyebrow uppercase text-brand-light">
                    {eyebrow}
                </motion.p>

                {event.kind === 'xp' && (
                    <p className="mt-2 animate-pop font-mono text-[clamp(4rem,12vw,7rem)] font-bold leading-none">
                        +{shown}
                        <span className="ml-2 text-3xl">XP</span>
                    </p>
                )}

                <motion.h2 initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight tracking-tight">
                    {title}
                </motion.h2>
                <motion.p initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="mt-3 max-w-md text-base leading-relaxed text-ink-foreground/80">
                    {subtitle}
                </motion.p>

                {event.kind !== 'badge' && (
                    <div className="mt-8 w-full max-w-sm animate-rise-r2">
                        <div className="flex justify-between font-mono text-xs text-ink-foreground/80">
                            <span>Cấp {lp.level}</span>
                            <span>{lp.toNext} XP nữa lên cấp {lp.level + 1}</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink/25">
                            {/* Thanh cấp chạy bằng scaleX từ gốc trái (chỉ transform) */}
                            <div
                                className="h-full origin-left animate-fill-bar rounded-full bg-ink-foreground"
                                style={{ width: `${Math.round(lp.ratio * 100)}%`, ['--fill-from' as string]: 0 }}
                            />
                        </div>
                    </div>
                )}

                <motion.button
                    ref={btnRef}
                    type="button"
                    onClick={onClose}
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-10 inline-flex items-center gap-2 on-red-btn rounded-full px-8 py-3.5 text-sm font-bold shadow-raised transition duration-fast hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-foreground/40"
                >
                    <Sparkles size={16} /> Tiếp tục
                </motion.button>
            </div>
        </motion.div>
    )
}

/** Hình trang trí trôi lên xuống chậm ở nền màn thưởng (chỉ transform). */
function Drift({ className }: { className: string }) {
    return <span aria-hidden className={`pointer-events-none absolute ${className}`} />
}
