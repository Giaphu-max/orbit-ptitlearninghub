// Pháo giấy vẽ trên canvas, chép từ docs/mockup/orbit-focus-reward.html.
// Canvas không dùng được token CSS nên bảng màu giấy (trắng, vàng, hồng nhạt) nằm cố định ở đây.

const COLORS = ['#FFFFFF', '#FFD27A', '#FFB4A8', '#FF6B6B', '#FFF1C9']

interface Piece {
    x: number
    y: number
    vx: number
    vy: number
    r: number
    vr: number
    w: number
    h: number
    c: string
    life: number
}

export interface Confetti {
    burst: (x: number, y: number, n: number) => void
    /** Dừng vòng vẽ và xóa canvas */
    stop: () => void
}

export function createConfetti(canvas: HTMLCanvasElement): Confetti {
    const cx = canvas.getContext('2d')
    let parts: Piece[] = []
    let raf = 0

    const loop = () => {
        if (!cx) return
        cx.clearRect(0, 0, innerWidth, innerHeight)
        for (const p of parts) {
            p.vy += 0.32
            p.vx *= 0.985
            p.vy *= 0.985
            p.x += p.vx
            p.y += p.vy
            p.r += p.vr
            p.life -= 0.009
            cx.save()
            cx.globalAlpha = Math.max(p.life, 0)
            cx.translate(p.x, p.y)
            cx.rotate(p.r)
            cx.fillStyle = p.c
            cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
            cx.restore()
        }
        parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40)
        raf = parts.length ? requestAnimationFrame(loop) : 0
    }

    return {
        burst(x, y, n) {
            if (!cx) return
            const dpr = Math.min(devicePixelRatio || 1, 2)
            const w = Math.round(innerWidth * dpr)
            const h = Math.round(innerHeight * dpr)
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w
                canvas.height = h
            }
            cx.setTransform(dpr, 0, 0, dpr, 0, 0)
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2
                const s = 6 + Math.random() * 12
                parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, c: COLORS[i % COLORS.length], life: 1 })
            }
            if (!raf) loop()
        },
        stop() {
            cancelAnimationFrame(raf)
            raf = 0
            parts = []
            cx?.clearRect(0, 0, canvas.width, canvas.height)
        },
    }
}
