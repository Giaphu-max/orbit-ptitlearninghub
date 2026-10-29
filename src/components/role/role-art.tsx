import { useEffect, useRef } from 'react'
import { LOGO_URL } from '@/lib/brand'
import colorUrl from '@/assets/role/big-color2.webp?url'

const CH = '01<>/\\{}[]#=+*?:;ACGTXZ%&$'.split('')
const MONO = '600 11px "JetBrains Mono Variable", "JetBrains Mono", monospace'

interface Col {
    x: number
    y0: number
    len: number
    ch: string[]
    a: number
    d: number
}

/**
 * Mảng nghệ thuật bên phải màn chọn vai trò: lưới chấm + cột ký tự (canvas), logo PTIT, chân dung màu tĩnh ThS. Nguyễn Cảnh Châu.
 * Timeline: live (0s, ảnh hiện fade + trượt) → logo chui ra + gõ ký tự (850ms).
 */
export function RoleArt() {
    const art = useRef<HTMLDivElement>(null)
    const cv = useRef<HTMLCanvasElement>(null)
    const started = useRef(false)
    const logo = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = art.current
        const canvas = cv.current
        const g = canvas?.getContext('2d')
        if (!el || !canvas || !g) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        let cols: Col[] = []
        let dots: HTMLCanvasElement | null = null
        let W = 0
        let H = 0
        let t0 = 0
        let typing = false
        let raf = 0
        let last = 0
        let cancelled = false
        const timers: number[] = []
        // Logo thở bằng WAAPI (rotate/scale riêng, không đè transform lúc chui ra)
        let breathe: Animation | null = null
        const startLogo = (delay = 2200) => {
            el.classList.add('split')
            const lg = logo.current
            if (!lg || reduce) return
            breathe?.cancel()
            breathe = lg.animate(
                [
                    { rotate: '0deg', scale: 1 },
                    { rotate: '-2.2deg', scale: 1.025, offset: 0.5 },
                    { rotate: '1.6deg', scale: 1.01 },
                ],
                { duration: 9000, delay, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
            )
        }

        const build = () => {
            const rect = el.getBoundingClientRect()
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            W = rect.width
            H = rect.height
            canvas.width = Math.round(W * dpr)
            canvas.height = Math.round(H * dpr)
            g.setTransform(dpr, 0, 0, dpr, 0, 0)
            // Lưới chấm 15px vẽ một lần ra canvas phụ
            dots = document.createElement('canvas')
            dots.width = canvas.width
            dots.height = canvas.height
            const d = dots.getContext('2d')
            if (d) {
                d.setTransform(dpr, 0, 0, dpr, 0, 0)
                d.fillStyle = 'rgba(55,61,78,.22)'
                for (let y = 8; y < H; y += 15) for (let x = 8; x < W; x += 15) d.fillRect(x, y, 1.2, 1.2)
            }
            // Cột ký tự: dày ở phía trên và bên phải đầu
            cols = []
            const step = 12
            let s = 11
            const r = () => (s = (s * 16807) % 2147483647) / 2147483647
            const mk = (x: number, y0: number, len: number, a: number): Col => ({ x, y0, len, ch: Array.from({ length: len }, () => CH[(r() * CH.length) | 0]), a, d: r() * 0.5 })
            for (let x = W * 0.46; x < W * 0.99; x += step) {
                if (r() < 0.45) continue
                const y0 = H * (0.02 + r() * 0.14)
                const len = Math.floor(8 + r() * 34)
                cols.push(mk(x, y0, len, 0.35 + r() * 0.3))
            }
            for (let x = W * 0.06; x < W * 0.3; x += step) {
                if (r() < 0.8) continue
                const y0 = H * (0.3 + r() * 0.3)
                cols.push(mk(x, y0, Math.floor(4 + r() * 14), 0.25))
            }
        }
        const draw = (k: number) => {
            g.clearRect(0, 0, W, H)
            if (dots) g.drawImage(dots, 0, 0, W, H)
            g.font = MONO
            g.textAlign = 'center'
            for (const c of cols) {
                const n = Math.floor(c.len * Math.max(0, Math.min(1, (k - c.d) / 0.5)))
                g.fillStyle = `rgba(55,61,78,${c.a})`
                for (let i = 0; i < n; i++) g.fillText(c.ch[i], c.x, c.y0 + i * 13)
            }
        }
        const tick = (now: number) => {
            const k = typing ? Math.min(1.01, (now - t0) / 1500) : 1.01
            if (k < 1.01) draw(k)
            else if (now - last > 140 && !document.hidden) {
                // Khoảng 140ms đổi ngẫu nhiên vài ký tự
                last = now
                for (let i = 0; i < 7; i++) {
                    const c = cols[(Math.random() * cols.length) | 0]
                    if (c) c.ch[(Math.random() * c.len) | 0] = CH[(Math.random() * CH.length) | 0]
                }
                draw(1.01)
            }
            raf = requestAnimationFrame(tick)
        }
        const run = () => {
            if (cancelled) return
            started.current = true
            build()
            draw(0)
            el.classList.add('live')
            if (reduce) {
                el.classList.add('split')
                draw(1.01)
                return
            }
            timers.push(
                window.setTimeout(() => {
                    startLogo(2200)
                    typing = true
                    t0 = performance.now()
                }, 850),
            )
            raf = requestAnimationFrame(tick)
        }
        // Logo trôi ngược chiều chuột, tối đa ±16px
        let move = 0
        let mx = 0
        let my = 0
        const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            mx = (e.clientX - r.left) / r.width - 0.5
            my = (e.clientY - r.top) / r.height - 0.5
            if (!move)
                move = requestAnimationFrame(() => {
                    move = 0
                    if (logo.current) logo.current.style.translate = `${mx * -32}px ${my * -24}px`
                })
        }
        if (!reduce) el.addEventListener('pointermove', onMove, { passive: true })
        const ro = new ResizeObserver(() => {
            if (!started.current) return
            build()
            draw(typing && performance.now() - t0 < 1500 ? Math.min(1.01, (performance.now() - t0) / 1500) : 1.01)
        })
        ro.observe(el)

        // Chỉ chạy timeline khi ảnh và font đã sẵn sàng
        const imgReady = new Promise<void>((res) => {
            const i = new Image()
            i.onload = i.onerror = () => res()
            i.src = colorUrl
        })
        void Promise.all([imgReady, document.fonts.load(MONO).catch(() => undefined)])
            .then(() => document.fonts.ready)
            .then(run)

        return () => {
            cancelled = true
            cancelAnimationFrame(raf)
            timers.forEach(clearTimeout)
            breathe?.cancel()
            ro.disconnect()
            el.removeEventListener('pointermove', onMove)
            cancelAnimationFrame(move)
        }
    }, [])

    return (
        <div ref={art} className="rs-art">
            <canvas ref={cv} aria-hidden="true" />
            {LOGO_URL && (
                <div ref={logo} className="rs-art-logo" aria-hidden="true">
                    <img src={LOGO_URL} alt="" width={600} height={763} />
                    <span className="rs-glint" />
                </div>
            )}
            <img
                src={colorUrl}
                alt="ThS. Nguyễn Cảnh Châu"
                className="rs-portrait"
                width={700}
                height={880}
            />
        </div>
    )
}
