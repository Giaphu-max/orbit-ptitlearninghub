// Ảnh chụp chính canvas 3D trang chủ lúc chạy (khung đầu tiên đã khớp camera, chương đầu), giữ trong bộ nhớ + sessionStorage theo
// kích thước cửa sổ. Lần intro sau, nếu khóa khớp thì ảnh này được đặt đúng rect của canvas và khớp từng pixel với cảnh 3D thật.

const STORE = 'orbit-campus-shot'

interface Shot {
    key: string
    url: string
}
let mem: Shot | null = null

/** Khóa theo kích thước cửa sổ, tỉ lệ điểm ảnh và giao diện sáng/tối */
export const shotKey = () => `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}${document.documentElement.classList.contains('dark') ? 'd' : ''}`

/** Ảnh đã chụp cho đúng cửa sổ hiện tại (URL dùng được trong <img>), hoặc null */
export function getShot(): string | null {
    const key = shotKey()
    if (mem?.key === key) return mem.url
    try {
        const raw = sessionStorage.getItem(STORE)
        if (raw) {
            const s = JSON.parse(raw) as Shot
            if (s.key === key && typeof s.url === 'string') {
                mem = s
                return s.url
            }
        }
    } catch {
        /* storage bị chặn: dùng ảnh trong bộ nhớ */
    }
    return null
}

/** Chụp canvas NGAY trong khung vừa render (toBlob gọi đồng bộ, drawing buffer còn nguyên). Đã có ảnh đúng khóa thì bỏ qua. */
export function captureShot(canvas: HTMLCanvasElement) {
    if (getShot()) return
    const key = shotKey()
    try {
        canvas.toBlob(
            (blob) => {
                if (!blob) return
                const fr = new FileReader()
                fr.onload = () => {
                    const url = String(fr.result)
                    mem = { key, url }
                    try {
                        sessionStorage.setItem(STORE, JSON.stringify(mem))
                    } catch {
                        /* vượt quota: chỉ giữ trong bộ nhớ */
                    }
                }
                fr.readAsDataURL(blob)
            },
            'image/webp',
            0.85,
        )
    } catch {
        /* bỏ qua */
    }
}
