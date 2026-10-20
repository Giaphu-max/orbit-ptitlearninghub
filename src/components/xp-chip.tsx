import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { xpLandAt } from '@/lib/feedback'
import { levelFromXp } from '@/lib/gamification'
import { useOrbitStore } from '@/store/useOrbitStore'

const COUNT_MS = 400

/**
 * Chip cấp + XP trên nav: khi XP tăng thì chip nảy và số đếm tăng dần (bắt đầu khi nhãn "+N XP" bay tới).
 * Giảm chuyển động hoặc XP giảm (đặt lại demo): đổi số ngay, không nảy.
 */
export function XpChip({ className }: { className: string }) {
    const xp = useOrbitStore((s) => s.xp)
    const [shown, setShown] = useState(xp)
    const shownRef = useRef(xp)
    const chipRef = useRef<HTMLAnchorElement>(null)

    useEffect(() => {
        const from = shownRef.current
        const set = (n: number) => {
            shownRef.current = n
            setShown(n)
        }
        if (xp <= from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            set(xp)
            return
        }
        let raf = 0
        const delay = Math.max(0, xpLandAt() - performance.now())
        const timer = window.setTimeout(() => {
            chipRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.34,1.8,.5,1)' })
            const t0 = performance.now()
            const tick = (now: number) => {
                const k = Math.min(1, (now - t0) / COUNT_MS)
                set(Math.round(from + (xp - from) * (1 - (1 - k) ** 3)))
                if (k < 1) raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }, delay)
        return () => {
            window.clearTimeout(timer)
            cancelAnimationFrame(raf)
            shownRef.current = xp
            setShown(xp)
        }
    }, [xp])

    return (
        <Link ref={chipRef} to="/journey" data-xp-chip className={className}>
            <Zap size={14} className="fill-current" />
            Cấp {levelFromXp(xp)} · <span className="font-mono">{shown.toLocaleString('vi-VN')}</span> XP
        </Link>
    )
}
