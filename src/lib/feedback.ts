import { animate } from 'motion/react'
import { haptic, playCorrect, playCorrected } from '@/lib/sound'

// Phản hồi khi trả lời đúng: nút lóe xanh + nảy (spring), chùm hạt, nhãn "+N XP" bay lên chip XP,
// âm thanh và rung. Chỉ animate transform/opacity, không chặn thao tác; toàn bộ dưới 0,8 giây.
// Giảm chuyển động: bỏ nảy, hạt và nhãn bay; giữ đổi màu và âm thanh.

const FLY_MS = 450
const PARTICLE_MS = 560

let combo = 0
/** Thời điểm nhãn XP chạm chip; chip bắt đầu đếm số từ lúc đó. */
let landAt = 0

export const xpLandAt = () => landAt

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Trả lời sai thì chuỗi đúng liên tiếp về 0. */
export const breakCombo = () => {
    combo = 0
}

export interface CelebrateOptions {
    /** Nút đáp án vừa chọn đúng */
    anchor: HTMLElement | null
    /** correct: đúng ngay lần đầu; corrected: sửa đúng sau khi sai */
    kind: 'correct' | 'corrected'
    /** XP vừa nhận; 0 hoặc bỏ trống thì không có nhãn bay (ví dụ câu kiểm tra Daily) */
    xp?: number
}

const COLORS = ['--success', '--brand', '--warning'] as const

function overlay(css: Partial<CSSStyleDeclaration>) {
    const el = document.createElement('div')
    Object.assign(el.style, { position: 'fixed', pointerEvents: 'none', zIndex: '110', ...css })
    document.body.appendChild(el)
    return el
}

const visibleChip = () => [...document.querySelectorAll<HTMLElement>('[data-xp-chip]')].find((e) => e.getBoundingClientRect().width > 0)

export function celebrate({ anchor, kind, xp = 0 }: CelebrateOptions) {
    combo = kind === 'correct' ? combo + 1 : 0
    if (kind === 'correct') playCorrect(combo)
    else playCorrected()
    haptic(kind === 'correct' ? 12 : [10, 45, 14])

    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const still = calm()

    // Lóe xanh gần như tức thì (một lớp phủ chỉ đổi opacity)
    const flash = overlay({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: getComputedStyle(anchor).borderRadius, background: 'hsl(var(--success) / 0.35)', opacity: '0' })
    flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: still ? 240 : 320, easing: 'ease-out' }).onfinish = () => flash.remove()
    if (still) return

    // Nảy kiểu spring
    animate(anchor, { scale: [0.93, 1] }, { type: 'spring', stiffness: 700, damping: 9, mass: 0.7 })

    // Chùm hạt quanh nút
    const count = kind === 'corrected' ? 16 : 12
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
        const dist = 38 + Math.random() * 46
        const size = 5 + Math.random() * 5
        const p = overlay({ left: `${cx - size / 2}px`, top: `${cy - size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: i % 3 ? '50%' : '2px', background: `hsl(var(${COLORS[i % COLORS.length]}))` })
        p.animate(
            [
                { transform: 'translate(0,0) scale(0.4)', opacity: 1 },
                { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 10}px) scale(1)`, opacity: 1, offset: 0.55 },
                { transform: `translate(${Math.cos(angle) * dist * 1.15}px, ${Math.sin(angle) * dist * 1.15 + 14}px) scale(0.3)`, opacity: 0 },
            ],
            { duration: PARTICLE_MS, easing: 'cubic-bezier(.2,.8,.3,1)' },
        ).onfinish = () => p.remove()
    }

    // Nhãn Combo ở trên nút
    if (combo >= 2) {
        const tag = overlay({ left: `${cx}px`, top: `${r.top - 6}px`, padding: '3px 10px', borderRadius: '999px', background: 'hsl(var(--ink))', color: 'hsl(var(--ink-foreground))', font: '700 12px/1.2 "JetBrains Mono Variable", ui-monospace, monospace', whiteSpace: 'nowrap' })
        tag.textContent = `Combo x${combo}`
        tag.animate(
            [
                { transform: 'translate(-50%, 4px) scale(0.7)', opacity: 0 },
                { transform: 'translate(-50%, -14px) scale(1.1)', opacity: 1, offset: 0.25 },
                { transform: 'translate(-50%, -30px) scale(1)', opacity: 0 },
            ],
            { duration: 650, easing: 'ease-out' },
        ).onfinish = () => tag.remove()
    }

    // Nhãn "+N XP" bay lên chip XP trên nav
    if (xp > 0) {
        const chip = visibleChip()
        const to = chip?.getBoundingClientRect()
        const dx = to ? to.left + to.width / 2 - cx : 0
        const dy = to ? to.top + to.height / 2 - cy : -cy
        const label = overlay({ left: `${cx}px`, top: `${cy}px`, padding: '5px 12px', borderRadius: '999px', background: 'hsl(var(--brand))', color: 'hsl(var(--brand-foreground))', font: '700 15px/1.2 "JetBrains Mono Variable", ui-monospace, monospace', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-brand)' })
        label.textContent = `+${xp} XP`
        landAt = performance.now() + FLY_MS
        label.animate(
            [
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
                { transform: 'translate(-50%, calc(-50% - 22px)) scale(1.15)', opacity: 1, offset: 0.22 },
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`, opacity: 0.85 },
            ],
            { duration: FLY_MS, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' },
        ).onfinish = () => label.remove()
    }
}
