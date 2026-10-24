import { useEffect, useRef } from 'react'
import { LOGO_URL } from '@/lib/brand'

/**
 * Logo "ma" ở góc dưới trái của cả trang: vẽ logo thật vào canvas một lần, xóa ngẫu nhiên pixel với xác suất tăng dần
 * về phía dưới trái (rã hạt ở mép ngoài); blur và trôi chậm do CSS (role-select.css, .rs-ghost).
 */
export function GhostLogo() {
    const ref = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        const c = ref.current
        if (!c || !LOGO_URL) return
        let cancelled = false
        const img = new Image()
        img.onload = () => {
            if (cancelled) return
            const w = 360
            const h = Math.round((360 * img.naturalHeight) / img.naturalWidth)
            c.width = w
            c.height = h
            const g = c.getContext('2d')
            if (!g) return
            g.drawImage(img, 0, 0, w, h)
            const d = g.getImageData(0, 0, w, h)
            const a = d.data
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4
                    if (!a[i + 3]) continue
                    // 0 ở góc trên phải, > 1 ở góc dưới trái
                    const t = (1 - x / w) * 0.55 + (y / h) * 0.75 - 0.25
                    const n = Math.random()
                    if (n < t) a[i + 3] = 0
                    else if (n < t + 0.12) a[i + 3] *= 0.35
                }
            }
            g.putImageData(d, 0, 0)
            c.classList.add('on')
        }
        img.src = LOGO_URL
        return () => {
            cancelled = true
        }
    }, [])
    return <canvas ref={ref} className="rs-ghost" aria-hidden="true" />
}
