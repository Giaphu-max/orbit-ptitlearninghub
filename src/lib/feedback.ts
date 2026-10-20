import { haptic, SFX } from '@/lib/sfx'

// Phản hồi ngay khi trả lời (theo docs/mockup/orbit-focus-reward.html):
//  đúng → SFX.correct (cao dần theo combo) + tia sáng nhỏ tại nút + rung 30ms + chip "+XP" bay vào ô XP trên nav, ô XP nảy;
//  sai  → SFX.wrong + nút lắc nhẹ.
// Chỉ animate transform/opacity bằng WAAPI, không chặn thao tác. Giảm chuyển động: bỏ tia, bay và lắc, vẫn có âm thanh.

const FLY_MS = 650

let combo = 0
/** Thời điểm nhãn XP chạm chip; chip bắt đầu đếm số từ lúc đó. */
let landAt = 0

export const xpLandAt = () => landAt

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Vị trí thao tác gần nhất, để màn nhận XP lan ra từ đúng nút vừa bấm (null: thao tác bằng bàn phím)
let lastInput: { x: number; y: number } | null = null

export const inputOrigin = () => lastInput ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }

export function armFeedback() {
    if (typeof window === 'undefined') return
    window.addEventListener('pointerdown', (e) => (lastInput = { x: e.clientX, y: e.clientY }), true)
    window.addEventListener('keydown', () => (lastInput = null), true)
}

const visibleChip = () => [...document.querySelectorAll<HTMLElement>('[data-xp-chip]')].find((e) => e.getBoundingClientRect().width > 0)

function dot(css: Partial<CSSStyleDeclaration>) {
    const el = document.createElement('div')
    Object.assign(el.style, { position: 'fixed', pointerEvents: 'none', zIndex: '90', ...css })
    document.body.appendChild(el)
    return el
}

export interface CelebrateOptions {
    /** Nút đáp án vừa chọn đúng */
    anchor: HTMLElement | null
    /** correct: đúng ngay lần đầu; corrected: sửa đúng sau khi sai */
    kind: 'correct' | 'corrected'
    /** XP vừa nhận; 0 hoặc bỏ trống thì không có chip bay (ví dụ câu kiểm tra Daily, XP tính khi hoàn thành bài) */
    xp?: number
}

export function celebrate({ anchor, kind, xp = 0 }: CelebrateOptions) {
    combo = kind === 'correct' ? combo + 1 : 0
    if (kind === 'correct') SFX.correct(combo)
    else SFX.fixed()
    if (!anchor || calm()) return
    haptic(30)

    const r = anchor.getBoundingClientRect()

    // Nảy nhẹ của nút đúng
    anchor.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 350, easing: 'cubic-bezier(.34,1.8,.5,1)' })

    // Tia sáng nhỏ tại nút
    for (let i = 0; i < 10; i++) {
        const s = dot({ width: '6px', height: '6px', borderRadius: '50%', left: `${r.left + r.width * 0.5}px`, top: `${r.top + r.height / 2}px`, background: i % 2 ? 'hsl(var(--success))' : 'hsl(var(--warning))' })
        const a = (i / 10) * Math.PI * 2
        const d = 50 + Math.random() * 40
        s.animate(
            [
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${Math.cos(a) * d * 2.2}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 },
            ],
            { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' },
        ).onfinish = () => s.remove()
    }

    // Nhãn Combo ở trên nút
    if (combo >= 2) {
        const tag = dot({ left: `${r.left + r.width / 2}px`, top: `${r.top - 6}px`, padding: '3px 10px', borderRadius: '999px', background: 'hsl(var(--ink))', color: 'hsl(var(--ink-foreground))', font: '700 12px/1.2 "JetBrains Mono Variable", ui-monospace, monospace', whiteSpace: 'nowrap' })
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

    // Chip "+N XP" bay vào ô XP trên nav
    if (xp > 0) {
        const to = visibleChip()?.getBoundingClientRect()
        const sx = r.left + r.width - 90
        const sy = r.top + r.height / 2 - 12
        const ex = to ? to.left + 10 : sx
        const ey = to ? to.top + 4 : -sy
        const label = dot({ left: `${sx}px`, top: `${sy}px`, color: 'hsl(var(--success))', font: '700 20px/1.2 "JetBrains Mono Variable", ui-monospace, monospace', textShadow: '0 2px 10px hsl(0 0% 0% / 0.15)', whiteSpace: 'nowrap' })
        label.textContent = `+${xp} XP`
        landAt = performance.now() + FLY_MS
        label.animate(
            [
                { transform: 'translate(0,0) scale(.6)', opacity: 0 },
                { transform: 'translate(0,-26px) scale(1.25)', opacity: 1, offset: 0.25 },
                { transform: `translate(${ex - sx}px,${ey - sy}px) scale(.7)`, opacity: 0.9 },
            ],
            { duration: FLY_MS, easing: 'cubic-bezier(.5,0,.3,1)' },
        ).onfinish = () => label.remove()
    }
}

/** Trả lời sai: ngắt chuỗi combo, âm thanh trầm, nút lắc nhẹ. */
export function reactWrong(anchor: HTMLElement | null) {
    combo = 0
    SFX.wrong()
    if (!anchor || calm()) return
    anchor.animate([{ transform: 'none' }, { transform: 'translateX(-6px)', offset: 0.25 }, { transform: 'translateX(6px)', offset: 0.75 }, { transform: 'none' }], { duration: 350 })
}
