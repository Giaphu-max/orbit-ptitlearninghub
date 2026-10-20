import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Award, Flame, TrendingUp } from 'lucide-react'
import { createConfetti } from '@/lib/confetti'
import { levelProgress, levelTitle } from '@/lib/gamification'
import { SFX } from '@/lib/sfx'
import { useRewardStore, type RewardEvent } from '@/store/useRewardStore'

/** Màn hình nhận thưởng phủ đỏ (theo docs/mockup/Reward.dc.html + hiệu ứng của orbit-focus-reward.html): hiện lần lượt từng sự kiện trong hàng đợi. */
export function RewardOverlay() {
    const event = useRewardStore((s) => s.queue[0])
    const dismiss = useRewardStore((s) => s.dismiss)
    // Sau khi trả lời, chờ một nhịp (phản hồi tại nút chạy trước) rồi mới mở màn
    const [shownId, setShownId] = useState(0)
    useEffect(() => {
        if (!event || !event.delayMs) return
        const t = window.setTimeout(() => setShownId(event.id), event.delayMs)
        return () => window.clearTimeout(t)
    }, [event])
    const ready = event && (!event.delayMs || shownId === event.id)

    // Portal ra <body>: nằm trên mọi lớp của layout, kể cả nút chuyển giao diện
    return createPortal(
        <AnimatePresence mode="wait">{ready && <RewardScreen key={event.id} event={event} onClose={dismiss} />}</AnimatePresence>,
        document.body,
    )
}

const E = { out: 'cubic-bezier(.16,1,.3,1)', back: 'cubic-bezier(.34,1.7,.5,1)', snap: 'cubic-bezier(.7,0,.2,1)' }
const vi = (n: number) => Math.round(n).toLocaleString('vi-VN')

function RewardScreen({ event, onClose }: { event: RewardEvent; onClose: () => void }) {
    const navigate = useNavigate()
    const lpBefore = levelProgress(event.xpBefore)
    const lp = levelProgress(event.xpAfter)
    const levelUp = lp.level > lpBefore.level
    const btnRef = useRef<HTMLButtonElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const cancelRef = useRef<() => void>(() => {})
    const soundPlayed = useRef(false)
    // Chống bấm nhầm: 500ms đầu vùng nút không nhận chuột/phím, sau đó mới focus nút chính
    const [armed, setArmed] = useState(false)
    useEffect(() => {
        const t = window.setTimeout(() => {
            setArmed(true)
            btnRef.current?.focus()
        }, 500)
        return () => window.clearTimeout(t)
    }, [])

    // Đóng: hủy mọi animation, bộ đếm và canvas ngay, rồi để AnimatePresence làm mờ phần còn lại
    const close = () => {
        cancelRef.current()
        onClose()
    }
    /** Nút chính chạy `next` (đóng màn rồi đi tiếp, hoặc chỉ chạy việc kế tiếp tại chỗ); nút phụ chỉ có `to`. */
    const go = (next: { to?: string; onClick?: () => void }) => {
        close()
        next.onClick?.()
        if (next.to) navigate(next.to)
    }
    const closeRef = useRef(close)
    closeRef.current = close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // Timeline vào màn: chỉ transform / opacity / filter / clip-path (WAAPI) và canvas; xong thì không để lại gì
    useLayoutEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const q = <T extends HTMLElement = HTMLElement>(k: string) => root.querySelector<T>(`[data-fx="${k}"]`)
        const qa = (k: string) => [...root.querySelectorAll<HTMLElement>(`[data-fx="${k}"]`)]
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        const anims: Animation[] = []
        const timers: number[] = []
        const rafs = new Set<number>()
        const confetti = createConfetti(canvas)
        const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms))
        const A = (el: HTMLElement | null, kf: Keyframe[], o: KeyframeAnimationOptions) => {
            if (el) anims.push(el.animate(kf, { fill: 'both', ...o }))
        }
        /** Đếm số từ `from` tới `to` trong `ms`; `tick` gọi mỗi lần giá trị đổi. */
        const count = (el: HTMLElement | null, from: number, to: number, ms: number, delay: number, fmt: (n: number) => string, tick?: (v: number) => void) =>
            later(() => {
                if (!el) return
                const t0 = performance.now()
                let last = NaN
                const step = (now: number) => {
                    const k = Math.min((now - t0) / ms, 1)
                    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))
                    el.textContent = fmt(v)
                    if (v !== last) {
                        last = v
                        tick?.(v)
                    }
                    if (k < 1) rafs.add(requestAnimationFrame(step))
                }
                rafs.add(requestAnimationFrame(step))
            }, delay)

        const numEl = q('num')
        const numVal = q('numval')
        const rowXp = qa('rowxp')
        const lvlNum = q('lvlnum')
        const lvlTitle = q('lvltitle')
        const lvlText = (l: number) => `Cấp ${l} · ${levelTitle(l)}`
        const total = event.xpAfter + lp.toNext
        const lvlNumText = (n: number) => `${vi(n)} / ${vi(total)}`

        // Trạng thái cuối (cũng là toàn bộ màn khi giảm chuyển động)
        if (numVal) numVal.textContent = `+${event.xp}`
        rowXp.forEach((el) => (el.textContent = el.dataset.xp === '0' ? '·' : `+${el.dataset.xp}`))
        if (lvlNum) lvlNum.textContent = lvlNumText(event.xpAfter)
        if (lvlTitle) lvlTitle.textContent = lvlText(lp.level)

        // Âm thanh: lên cấp thì chuỗi chuông chơi 2 lần, lần 2 cao hơn một quãng 4 (không phát lại khi StrictMode chạy effect hai lần)
        if (!soundPlayed.current) {
            soundPlayed.current = true
            SFX.reward()
            if (levelUp) later(() => SFX.reward({ ratio: 4 / 3, bare: true }), 720)
        }

        const cancel = () => {
            anims.forEach((a) => a.cancel())
            timers.forEach((t) => clearTimeout(t))
            rafs.forEach((r) => cancelAnimationFrame(r))
            confetti.stop()
        }
        cancelRef.current = cancel
        if (calm) return cancel

        const ox = event.origin?.x ?? innerWidth / 2
        const oy = event.origin?.y ?? innerHeight / 2
        const R = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy)) + 30
        // Tâm con số (đo trước khi số bị scale) cho sóng và pháo giấy
        const nr = numEl?.getBoundingClientRect()
        const nx = nr ? nr.left + nr.width / 2 : innerWidth / 2
        const ny = nr ? nr.top + nr.height / 2 : innerHeight * 0.4

        // 0–300ms: nền đỏ lan dạng clip-path từ nút vừa bấm
        A(root, [{ clipPath: `circle(0px at ${ox}px ${oy}px)` }, { clipPath: `circle(${R}px at ${ox}px ${oy}px)` }], { duration: 300, easing: E.snap })
        // 300ms: chớp trắng, rung nhẹ khối nội dung
        A(q('flash'), [{ opacity: 0 }, { opacity: 0.6, offset: 0.2 }, { opacity: 0 }], { duration: 260, delay: 290 })
        A(q('shake'), [{ transform: 'none' }, { transform: 'translate(-8px,4px)' }, { transform: 'translate(6px,-3px)' }, { transform: 'none' }], { duration: 240, delay: 320, fill: 'none' })
        // Số +XP: rơi từ scale 2.2 + blur 12px, overshoot về 1, rồi đếm 0→N
        A(numEl, [{ transform: 'scale(2.2)', opacity: 0, filter: 'blur(12px)' }, { transform: 'scale(.88)', opacity: 1, filter: 'blur(0)', offset: 0.55 }, { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }], { duration: 380, delay: 300, easing: E.out })
        if (numVal) numVal.textContent = '+0'
        count(numVal, 0, event.xp, 420, 320, (v) => `+${v}`, (v) => v % 2 === 0 && SFX.tick())
        // Hai vòng sóng mảnh từ tâm con số
        qa('ring').forEach((g, i) => {
            g.style.left = `${nx}px`
            g.style.top = `${ny}px`
            A(g, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.95 }, { transform: 'translate(-50%,-50%) scale(3.4)', opacity: 0 }], { duration: 700, delay: 330 + i * 120, easing: E.out })
        })
        // Pháo giấy: ~90 mảnh từ tâm con số, thêm hai đợt ~30 mảnh từ hai góc dưới
        later(() => confetti.burst(nx, ny, 90), 340)
        later(() => {
            confetti.burst(innerWidth * 0.15, innerHeight * 0.9, 30)
            confetti.burst(innerWidth * 0.85, innerHeight * 0.9, 30)
        }, 520)

        // Cột trái: chip → tiêu đề → từng dòng chi tiết, cách nhau 90ms
        const rise = (el: HTMLElement | null, delay: number, easing = E.out, y = 16) => A(el, [{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], { duration: 320, delay, easing })
        rise(q('chip'), 420)
        rise(q('title'), 510)
        qa('row').forEach((row, i) => {
            const d = 600 + i * 90
            rise(row, d)
            const xpEl = row.querySelector<HTMLElement>('[data-fx="rowxp"]')
            const n = Number(xpEl?.dataset.xp ?? 0)
            if (xpEl && n > 0) {
                xpEl.textContent = '+0'
                count(xpEl, 0, n, 350, d + 150, (v) => `+${v}`)
                later(() => SFX.tick(), d + 150)
            }
        })

        // Cột phải từ ~650ms: thẻ cấp độ, thẻ huy hiệu / mức nắm vững, dòng chuỗi ngày, hai nút
        A(q('lvlcard'), [{ opacity: 0, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 340, delay: 650, easing: E.back })
        rise(q('extra'), 780, E.back, 24)
        rise(q('note'), 880)
        A(q('flame'), [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 450, delay: 1050, easing: E.back, fill: 'none' })
        rise(q('actions'), 1000)

        // Thanh cấp độ: phần XP vừa cộng lóe vàng rồi gộp vào màu đỏ; số cộng dồn cùng lúc
        const base = lpBefore.ratio
        const gainFrom = base
        const gainTo = levelUp ? 1 : lp.ratio
        const gain = q('gain')
        if (gain) {
            gain.style.left = `${gainFrom * 100}%`
            gain.style.width = `${Math.max(0, gainTo - gainFrom) * 100}%`
        }
        A(gain, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.5 }, { transform: 'scaleX(1)', opacity: 0 }], { duration: 900, delay: 1000, easing: E.out })
        const fill = q('fill')
        if (levelUp) {
            if (lvlTitle) lvlTitle.textContent = lvlText(lpBefore.level)
            A(fill, [{ transform: `scaleX(${base})` }, { transform: 'scaleX(1)' }, { transform: 'scaleX(1)', offset: 1 }], { duration: 300, delay: 1250, easing: E.out, fill: 'backwards' })
            // Sang cấp mới: một nhịp nảy + viền vàng, thanh chạy lại từ 0
            later(() => {
                if (lvlTitle) lvlTitle.textContent = lvlText(lp.level)
                A(fill, [{ transform: 'scaleX(0)' }, { transform: `scaleX(${lp.ratio})` }], { duration: 400, easing: E.out })
                A(q('lvlcard'), [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 450, easing: E.back, fill: 'none' })
                A(q('lvlring'), [{ opacity: 0 }, { opacity: 1 }], { duration: 250 })
            }, 1550)
        } else {
            A(fill, [{ transform: `scaleX(${base})` }, { transform: `scaleX(${lp.ratio})` }], { duration: 500, delay: 1250, easing: E.out })
        }
        if (lvlNum) lvlNum.textContent = lvlNumText(event.xpBefore)
        count(lvlNum, event.xpBefore, event.xpAfter, 600, 1000, lvlNumText)

        return cancel
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <motion.div
            ref={rootRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${event.context}: ${event.headline}`}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
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
            {/* Lớp hiệu ứng: pháo giấy, hai vòng sóng, chớp trắng (không nhận chuột) */}
            <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />
            <span data-fx="ring" aria-hidden className="pointer-events-none fixed h-60 w-60 rounded-full border-2 border-ink-foreground/85 opacity-0" />
            <span data-fx="ring" aria-hidden className="pointer-events-none fixed h-60 w-60 rounded-full border-2 border-ink-foreground/85 opacity-0" />
            <div data-fx="flash" aria-hidden className="pointer-events-none fixed inset-0 bg-ink-foreground opacity-0" />

            <div data-fx="shake" className="relative mx-auto flex min-h-full w-full max-w-[1440px] flex-col items-stretch gap-10 px-6 py-10 lg:flex-row lg:items-center lg:gap-[72px] lg:px-24 lg:py-16">
                {/* ── Cột trái: ngữ cảnh, số XP, câu chốt, chi tiết ── */}
                <div className="flex min-w-0 flex-1 flex-col gap-6 lg:gap-7">
                    <span data-fx="chip" className="rw-chip self-start rounded-full px-3.5 py-2 text-sm font-bold">{event.context}</span>

                    {event.xp > 0 && (
                        <div data-fx="num" className="flex origin-bottom-left items-baseline gap-3 lg:gap-4">
                            <span data-fx="numval" className="font-mono text-[clamp(5rem,13vw,10.5rem)] font-bold leading-[0.9] tracking-[-0.06em]" />
                            <span className="text-[clamp(1.75rem,3.4vw,3rem)] font-extrabold">XP</span>
                        </div>
                    )}

                    <h2 data-fx="title" className="max-w-xl text-[clamp(1.75rem,3vw,2.5rem)] font-extrabold leading-[1.15] tracking-tight">{event.headline}</h2>

                    {event.rows.length > 0 && (
                        <ul className="flex max-w-lg flex-col gap-2.5">
                            {event.rows.map((r) => (
                                <li
                                    key={r.label}
                                    data-fx="row"
                                    className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-[15px] ${r.highlight ? 'rw-row-hl' : 'rw-row'}`}
                                >
                                    <span className={r.highlight ? 'font-bold' : ''}>{r.label}</span>
                                    <strong data-fx="rowxp" data-xp={r.xp} className="shrink-0 font-mono" />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ── Cột phải: cấp độ, huy hiệu / mức nắm vững, mở khóa, nút ── */}
                <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[480px]">
                    <div data-fx="lvlcard" className="rw-card relative rounded-3xl p-7">
                        <span data-fx="lvlring" aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl border-[3px] border-[hsl(var(--reward-gain))] opacity-0" />
                        <div className="flex items-baseline justify-between gap-3">
                            <strong data-fx="lvltitle" className="text-lg" />
                            <span data-fx="lvlnum" className="font-mono text-[13px] text-ink/70" />
                        </div>
                        <LevelBar className="mt-4 h-3" ratio={lp.ratio} />
                        <p className="mt-4 text-[13px] text-ink/70">
                            Còn {lp.toNext.toLocaleString('vi-VN')} XP để lên Cấp {lp.level + 1} · {levelTitle(lp.level + 1) ?? 'Cấp mới'}
                        </p>
                        {levelUp && (
                            <span className="absolute -right-2 -top-3 inline-flex animate-pop items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-extrabold text-ink-foreground shadow-brand [animation-delay:1.55s]">
                                <span aria-hidden className="absolute inset-0 animate-glow-ring rounded-full bg-brand-600" />
                                <TrendingUp size={14} className="relative" /> <span className="relative">Lên cấp {lp.level}!</span>
                            </span>
                        )}
                    </div>

                    {event.badge ? (
                        <div data-fx="extra" className="flex items-center gap-5 rw-dark rounded-3xl p-7">
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
                            <div data-fx="extra" className="rw-dark rounded-3xl p-7">
                                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-warning">Mức nắm vững</span>
                                <div className="mt-2 flex items-baseline justify-between gap-3">
                                    <strong className="text-[22px] leading-tight tracking-tight">{event.mastery.name}</strong>
                                    <span className="shrink-0 font-mono text-[15px] font-bold">
                                        {event.mastery.from === event.mastery.to
                                            ? `${Math.round(event.mastery.to * 100)}% · giữ nguyên`
                                            : `${Math.round(event.mastery.from * 100)}% → ${Math.round(event.mastery.to * 100)}%`}
                                    </span>
                                </div>
                                <Bar className="mt-4 h-2.5" trackClass="rw-track-dark" fillClass="rw-fill-pink" from={event.mastery.from} to={event.mastery.to} />
                            </div>
                        )
                    )}

                    <div data-fx="note" className="rw-note flex items-center gap-3.5 rounded-[20px] px-6 py-5">
                        <Flame data-fx="flame" size={22} className="shrink-0 fill-current" aria-hidden />
                        <span className="text-[15px] leading-snug">
                            {event.unlocked.length > 0 && (
                                <>
                                    Đã mở khóa <strong>{event.unlocked.join(', ')}</strong> trên cây kỹ năng ·{' '}
                                </>
                            )}
                            chuỗi học <strong>{event.streak} ngày</strong>
                        </span>
                    </div>

                    <div data-fx="actions" className={`flex gap-3 ${armed ? '' : 'pointer-events-none'}`}>
                        <button
                            ref={btnRef}
                            type="button"
                            tabIndex={armed ? 0 : -1}
                            onClick={() => go(event.next)}
                            className="rw-btn-solid flex-1 rounded-[14px] p-4 text-base font-extrabold transition duration-fast hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-foreground/50"
                        >
                            {event.next.label}
                        </button>
                        <button
                            type="button"
                            tabIndex={armed ? 0 : -1}
                            onClick={() => go({ to: '/' })}
                            className="rw-btn-ghost flex-1 rounded-[14px] p-4 text-base font-bold transition duration-fast focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink-foreground/50"
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
                style={{ animationDelay: '0.95s', transform: `scaleX(${clamp(to)})`, ['--fill-from' as string]: clamp(from), ['--fill-to' as string]: clamp(to) }}
            />
        </span>
    )
}

/** Thanh cấp độ: fill đỏ + lớp vàng cho phần XP vừa cộng (chạy bằng WAAPI trong RewardScreen). */
function LevelBar({ ratio, className }: { ratio: number; className: string }) {
    const r = Math.min(1, Math.max(0, ratio))
    return (
        <span className={`relative block overflow-hidden rounded-full rw-track-light ${className}`} role="progressbar" aria-valuenow={Math.round(r * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span data-fx="fill" className="rw-fill-red absolute inset-0 origin-left rounded-full" style={{ transform: `scaleX(${r})` }} />
            <span data-fx="gain" className="absolute inset-y-0 origin-left rounded-full bg-[hsl(var(--reward-gain))] opacity-0" />
        </span>
    )
}

function Drift({ className }: { className: string }) {
    return <span className={`absolute ${className}`} />
}
