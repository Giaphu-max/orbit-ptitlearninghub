import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { xpLandAt } from '@/lib/feedback'
import { levelFromXp } from '@/lib/gamification'
import { useOrbitStore, xpBalance } from '@/store/useOrbitStore'

const COUNT_MS = 700
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
interface FlyChip {
    id: number
    text: string
    kind: 'earn' | 'spend'
}
let chipId = 0

/**
 * Chip cấp + XP trên nav. Số hiển thị là XP tiêu được (nhận − đã tiêu); cấp độ tính từ tổng đã kiếm nên tiêu XP không làm tụt cấp.
 * Số luôn đếm dần tới giá trị mới (ease-out ~700ms).
 * Nhận XP: bắt đầu khi nhãn "+N XP" bay tới; chip "+n" xanh bay lên rồi mờ, viền nháy xanh.
 * Trả XP: chip "−n" đỏ nhạt rơi xuống rồi mờ, chip co nhẹ và tối đi. Đặt lại demo (XP giảm không do trả XP) hoặc giảm chuyển động: đổi số ngay.
 */
export function XpChip({ className }: { className: string }) {
    const xp = useOrbitStore((s) => xpBalance(s))
    const total = useOrbitStore((s) => s.xp)
    const [shown, setShown] = useState(xp)
    const [flies, setFlies] = useState<FlyChip[]>([])
    const shownRef = useRef(xp)
    const spendRef = useRef(false)
    const chipRef = useRef<HTMLAnchorElement>(null)

    useEffect(() => {
        const onSpend = () => {
            spendRef.current = true
            window.setTimeout(() => (spendRef.current = false), 500)
        }
        window.addEventListener('orbit:xp-spend', onSpend)
        return () => window.removeEventListener('orbit:xp-spend', onSpend)
    }, [])

    useEffect(() => {
        const from = shownRef.current
        const set = (n: number) => {
            shownRef.current = n
            setShown(n)
        }
        const fly = (kind: FlyChip['kind'], n: number) => {
            const id = ++chipId
            setFlies((l) => [...l, { id, text: `${kind === 'earn' ? '+' : '−'}${n}`, kind }])
            window.setTimeout(() => setFlies((l) => l.filter((c) => c.id !== id)), 1150)
        }
        const spending = xp < from && spendRef.current
        if (xp === from || (xp < from && !spending) || calm()) {
            set(xp)
            return
        }
        let raf = 0
        const count = () => {
            const t0 = performance.now()
            const tick = (now: number) => {
                const k = Math.min(1, (now - t0) / COUNT_MS)
                set(Math.round(from + (xp - from) * (1 - (1 - k) ** 3)))
                if (k < 1) raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }
        let timer = 0
        if (spending) {
            spendRef.current = false
            chipRef.current?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.95)', opacity: 0.75, offset: 0.3 }, { transform: 'scale(1)', opacity: 1 }], { duration: 700, easing: 'ease-out' })
            fly('spend', from - xp)
            count()
        } else {
            const delay = Math.max(0, xpLandAt() - performance.now())
            timer = window.setTimeout(() => {
                chipRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.34,1.8,.5,1)' })
                chipRef.current?.animate([{ borderColor: 'hsl(var(--success))', boxShadow: '0 0 0 2px hsl(var(--success) / 0.35)', offset: 0.3 }], { duration: 700 })
                fly('earn', xp - from)
                count()
            }, delay)
        }
        return () => {
            window.clearTimeout(timer)
            cancelAnimationFrame(raf)
            shownRef.current = xp
            setShown(xp)
        }
    }, [xp])

    // Màn tổng kết chặng phát lại phần XP của chặng vào chip (nảy rồi đếm từ `from` lên `to`)
    useEffect(() => {
        let raf = 0
        const onCount = (e: Event) => {
            const detail = (e as CustomEvent<{ from: number; to: number }>).detail
            // Màn tổng kết đếm theo tổng XP; chip hiện XP tiêu được
            const spent = useOrbitStore.getState().xpSpent
            const from = detail.from - spent
            const to = detail.to - spent
            cancelAnimationFrame(raf)
            if (calm() || to <= from) return
            chipRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.34,1.8,.5,1)' })
            const t0 = performance.now()
            const tick = (now: number) => {
                const k = Math.min(1, (now - t0) / 900)
                const n = Math.round(from + (to - from) * (1 - (1 - k) ** 3))
                shownRef.current = n
                setShown(n)
                if (k < 1) raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }
        window.addEventListener('orbit:xp-count', onCount)
        return () => {
            window.removeEventListener('orbit:xp-count', onCount)
            cancelAnimationFrame(raf)
        }
    }, [])

    return (
        <Link ref={chipRef} to="/journey" data-xp-chip className={`${className} relative`}>
            <Zap size={14} className="fill-current" />
            Cấp {levelFromXp(total)} · <span className="font-mono">{shown.toLocaleString('vi-VN')}</span> XP
            {flies.map((c) => (
                <span key={c.id} aria-hidden data-kind={c.kind} className={`xp-chip-fly ${c.kind === 'earn' ? 'text-success' : 'text-brand-ink'}`}>
                    {c.text}
                </span>
            ))}
        </Link>
    )
}
