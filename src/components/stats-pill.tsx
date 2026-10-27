import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { StreakFlame } from '@/components/streak-flame'
import { xpLandAt } from '@/lib/feedback'
import { daysBetween, freezeAvailable, levelProgress, localDate, visibleStreak } from '@/lib/gamification'
import { useOrbitStore, xpBalance } from '@/store/useOrbitStore'

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const easeOut = (k: number) => 1 - (1 - k) ** 3
const RING_R = 11
const RING_LEN = 2 * Math.PI * RING_R
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

interface FlyChip {
    id: number
    text: string
    kind: 'earn' | 'spend'
}
let flyId = 0

/** Số đếm dần (ease-out): `run(from, to, ms, delay)`; khởi đầu ở 0 (giảm chuyển động thì ở đúng `target`). */
function useCountTo(target: number) {
    const [shown, setShown] = useState(() => (calm() ? target : 0))
    const cur = useRef(calm() ? target : 0)
    const raf = useRef(0)
    const run = (from: number, to: number, ms: number, delay = 0) => {
        cancelAnimationFrame(raf.current)
        if (calm()) {
            cur.current = to
            setShown(to)
            return
        }
        const t0 = performance.now() + delay
        const tick = (now: number) => {
            const k = Math.min(1, Math.max(0, (now - t0) / ms))
            cur.current = Math.round(from + (to - from) * easeOut(k))
            setShown(cur.current)
            if (k < 1) raf.current = requestAnimationFrame(tick)
        }
        raf.current = requestAnimationFrame(tick)
    }
    useEffect(() => () => cancelAnimationFrame(raf.current), [])
    return { shown, cur, run }
}

/** Ngày nào trong tuần này (T2..CN) nằm trong chuỗi đang chạy. */
function weekStudied(count: number, last: string | null) {
    const now = new Date()
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
    return DAY_LABELS.map((_, i) => {
        if (!last || count <= 0) return false
        const gap = daysBetween(localDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)), last)
        return gap >= 0 && gap < count
    })
}

/**
 * Một viên thống kê trên nav: [lửa + chuỗi ngày] | [vòng tiến độ cấp + XP]. Hover/focus mở tooltip (tiến độ cấp, chuỗi tuần).
 * Vào trang: chuỗi và XP đếm từ 0 (~1,1s), vòng cấp chạy đầy (1,4s). XP đổi sau đó: đếm dần, chip ±n bay lên/rơi xuống.
 * Hiển thị XP tiêu được (nhận − đã tiêu); cấp tính từ tổng đã kiếm nên tiêu XP không làm tụt cấp.
 */
export function StatsPill({ tooltip = true, compact = false }: { tooltip?: boolean; compact?: boolean }) {
    const streakState = useOrbitStore((s) => s.streak)
    const total = useOrbitStore((s) => s.xp)
    const balance = useOrbitStore((s) => xpBalance(s))
    const streak = visibleStreak(streakState).count
    const lv = levelProgress(total)
    const tipId = useId()

    const xpCount = useCountTo(balance)
    const skCount = useCountTo(streak)
    const [ringReady, setRingReady] = useState(calm())
    const [flies, setFlies] = useState<FlyChip[]>([])
    const pillRef = useRef<HTMLAnchorElement>(null)
    const spendRef = useRef(false)
    const mounted = useRef(false)

    // Vào trang (và khi intro vừa đáp xuống): đếm từ 0 lên, vòng cấp chạy đầy
    useEffect(() => {
        const start = () => {
            xpCount.cur.current = 0
            skCount.cur.current = 0
            xpCount.run(0, xpBalance(useOrbitStore.getState()), 1100, 450)
            skCount.run(0, visibleStreak(useOrbitStore.getState().streak).count, 1100, 450)
            setRingReady(false)
            requestAnimationFrame(() => requestAnimationFrame(() => setRingReady(true)))
        }
        start()
        window.addEventListener('orbit:intro-landed', start)
        const onSpend = () => {
            spendRef.current = true
            window.setTimeout(() => (spendRef.current = false), 500)
        }
        window.addEventListener('orbit:xp-spend', onSpend)
        return () => {
            window.removeEventListener('orbit:intro-landed', start)
            window.removeEventListener('orbit:xp-spend', onSpend)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // XP đổi sau khi đã vào trang
    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true
            return
        }
        const from = xpCount.cur.current
        const fly = (kind: FlyChip['kind'], n: number) => {
            const id = ++flyId
            setFlies((l) => [...l, { id, text: `${kind === 'earn' ? '+' : '−'}${n}`, kind }])
            window.setTimeout(() => setFlies((l) => l.filter((c) => c.id !== id)), 1150)
        }
        if (balance === from || calm() || (balance < from && !spendRef.current)) {
            xpCount.run(from, balance, 0)
            return
        }
        if (balance < from) {
            spendRef.current = false
            pillRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 700, easing: 'ease-out' })
            fly('spend', from - balance)
            xpCount.run(from, balance, 700)
            return
        }
        const timer = window.setTimeout(() => {
            pillRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.34,1.8,.5,1)' })
            fly('earn', balance - from)
            xpCount.run(from, balance, 700)
        }, Math.max(0, xpLandAt() - performance.now()))
        return () => window.clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [balance])

    const week = weekStudied(streak, streakState.lastStudyDate)
    const frozen = freezeAvailable(streakState)

    return (
        <Link
            ref={pillRef}
            to="/journey"
            data-xp-chip
            aria-label={`Chuỗi ${streak} ngày, cấp ${lv.level}, ${balance.toLocaleString('vi-VN')} XP`}
            aria-describedby={tooltip ? tipId : undefined}
            className={`stats-pill group relative flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-card font-mono font-bold text-strong shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${
                compact ? 'h-8 gap-1.5 pl-2.5 pr-2 text-xs' : 'h-10 gap-2.5 pl-3 pr-2 text-sm'
            }`}
        >
            <span className="flex items-center gap-1.5">
                <StreakFlame lit={streak > 0} />
                <span className="tabular-nums">{skCount.shown}</span>
            </span>
            <span aria-hidden className={`${compact ? 'h-3.5' : 'h-[18px]'} w-px bg-border`} />
            <span className="flex items-center gap-1.5">
                <span className={`relative shrink-0 ${compact ? 'h-5 w-5' : 'h-7 w-7'}`}>
                    <svg width={compact ? 20 : 28} height={compact ? 20 : 28} viewBox="0 0 28 28" aria-hidden className="-rotate-90">
                        <defs>
                            <linearGradient id={`${tipId}-lv`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" stopColor="var(--mm-blue)" />
                                <stop offset="1" stopColor="var(--mm-teal)" />
                            </linearGradient>
                        </defs>
                        <circle cx="14" cy="14" r={RING_R} fill="none" strokeWidth="3" className="stroke-muted" />
                        <circle
                            cx="14"
                            cy="14"
                            r={RING_R}
                            fill="none"
                            strokeWidth="3"
                            strokeLinecap="round"
                            stroke={`url(#${tipId}-lv)`}
                            strokeDasharray={RING_LEN}
                            style={{ strokeDashoffset: RING_LEN * (1 - (ringReady ? lv.ratio : 0)), transition: calm() ? 'none' : 'stroke-dashoffset 1.4s var(--ease-out, cubic-bezier(.22,1,.36,1)) 0.4s' }}
                        />
                    </svg>
                    <b className={`absolute inset-0 grid place-items-center ${compact ? 'text-[9px]' : 'text-[11px]'}`}>{lv.level}</b>
                </span>
                <span className={`${compact ? 'pr-0.5' : 'pr-1.5'} tabular-nums`}>
                    {xpCount.shown.toLocaleString('vi-VN')}
                    <em className={`ml-[2px] font-medium not-italic text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>XP</em>
                </span>
            </span>
            {flies.map((c) => (
                <span key={c.id} aria-hidden data-kind={c.kind} className={`xp-chip-fly ${c.kind === 'earn' ? 'text-success' : 'text-brand-ink'}`}>
                    {c.text}
                </span>
            ))}
            {tooltip && (
                <span
                    id={tipId}
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-[calc(100%+10px)] z-10 w-[250px] translate-y-[-4px] rounded-[14px] border border-border bg-card p-3.5 font-sans text-[13px] font-medium leading-normal text-foreground opacity-0 shadow-raised transition duration-base ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                >
                    <b className="text-strong">Cấp {lv.level}</b> · còn <b className="text-strong">{lv.toNext.toLocaleString('vi-VN')} XP</b> lên cấp {lv.level + 1}
                    <span className="my-2 mb-1 block h-1.5 overflow-hidden rounded-[3px] bg-muted">
                        <span className="block h-full origin-left rounded-[3px]" style={{ transform: `scaleX(${lv.ratio})`, backgroundImage: 'linear-gradient(90deg, var(--mm-blue), var(--mm-teal))' }} />
                    </span>
                    <b className="text-strong">Chuỗi {streak} ngày</b> · {frozen ? 'còn 1 lần đóng băng tuần này' : 'đã dùng đóng băng tuần này'}
                    <span className="mt-2.5 flex gap-[5px]">
                        {DAY_LABELS.map((d, i) => (
                            <span key={d} className={`grid h-[22px] flex-1 place-items-center rounded-md font-mono text-[10px] font-bold ${week[i] ? 'bg-brand-600 text-ink-foreground' : 'bg-brand-50 text-brand-ink'}`}>
                                {d}
                            </span>
                        ))}
                    </span>
                </span>
            )}
        </Link>
    )
}
