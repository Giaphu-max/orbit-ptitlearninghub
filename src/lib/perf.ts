/**
 * Công cụ tìm thủ phạm hiệu năng trang chủ, chỉ bật bằng query (không ảnh hưởng người dùng thường).
 *   ?perf       HUD góc trái: fps, JS trung bình mỗi khung, khung chậm nhất trong 2 giây, dpr/calls/tris/đèn
 *   ?no3d       không dựng canvas 3D (frameloop dừng, không có nhãn/kiosk)
 *   ?nolabels   không dựng nhãn tòa nhà
 *   ?nokiosk    không dựng màn kiosk DOM và không vẽ ảnh tĩnh kiosk
 *   ?noreveal   chữ hiện ngay, không transition
 *   ?nolenis    cuộn gốc của trình duyệt (vẫn giữ bước chương)
 *   ?opaque     canvas alpha:false (mặc định bật trên Safari/WebKit)
 */
const q = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

export const FLAGS = {
    perf: q.has('perf'),
    no3d: q.has('no3d'),
    noLabels: q.has('nolabels'),
    noKiosk: q.has('nokiosk'),
    noReveal: q.has('noreveal'),
    noLenis: q.has('nolenis'),
    opaque: q.has('opaque'),
}

if (typeof document !== 'undefined' && FLAGS.noReveal) document.documentElement.classList.add('no-reveal')

const BUCKET_S = 0.5
const BUCKETS = 4 // 4 × 0,5s = cửa sổ 2 giây
interface Bucket {
    t: number
    n: number
    js: number
    worstJs: number
    worstGap: number
}
const fresh = (): Bucket => ({ t: 0, n: 0, js: 0, worstJs: 0, worstGap: 0 })
const ring: Bucket[] = [fresh()]
/** Thông số GL do canvas ghi (dpr, calls, tris, đèn) */
export const glStats = { text: '' }
/** JS chạy ngoài vòng khung hình (sự kiện cuộn) tích lại, cộng vào khung kế tiếp */
let pendingJs = 0

/** Gọi sau mỗi vòng rAF: gap = ms giữa hai khung, js = ms các callback chạy */
export function recordFrame(gap: number, js: number) {
    if (!FLAGS.perf) return
    js += pendingJs
    pendingJs = 0
    const b = ring[ring.length - 1]
    b.t += gap / 1000
    b.n++
    b.js += js
    b.worstJs = Math.max(b.worstJs, js)
    b.worstGap = Math.max(b.worstGap, gap)
    if (b.t >= BUCKET_S) {
        ring.push(fresh())
        if (ring.length > BUCKETS) ring.shift()
    }
}

/** Bọc một hàm xử lý sự kiện để tính thời gian của nó vào khung kế tiếp */
export function timed<A extends unknown[]>(fn: (...a: A) => void) {
    if (!FLAGS.perf) return fn
    return (...a: A) => {
        const t0 = performance.now()
        fn(...a)
        pendingJs += performance.now() - t0
    }
}

/** HUD thuần DOM: ghi textContent mỗi 0,5 giây */
export function mountPerfHud() {
    if (!FLAGS.perf) return () => {}
    const d = document.createElement('div')
    d.setAttribute('aria-hidden', 'true')
    d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;padding:6px 8px;border-radius:6px;background:rgba(0,0,0,.72);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre'
    document.body.appendChild(d)
    const off = Object.entries(FLAGS)
        .filter(([k, v]) => v && k !== 'perf')
        .map(([k]) => k)
    const id = window.setInterval(() => {
        let t = 0
        let n = 0
        let js = 0
        let wj = 0
        let wg = 0
        for (const b of ring) {
            t += b.t
            n += b.n
            js += b.js
            wj = Math.max(wj, b.worstJs)
            wg = Math.max(wg, b.worstGap)
        }
        if (!n) return
        d.textContent = `${Math.round(n / t)} fps\njs ${(js / n).toFixed(1)}ms/khung\nchậm nhất 2s: ${wg.toFixed(0)}ms (js ${wj.toFixed(1)}ms)\n${glStats.text}${off.length ? `\ncờ: ${off.join(' ')}` : ''}`
    }, 500)
    return () => {
        window.clearInterval(id)
        d.remove()
    }
}
