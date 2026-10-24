// Vân giấy: canvas 256px vẽ MỘT lần, đưa vào CSS variable --paper-grain (ảnh nền lặp). Là chấm đen alpha thấp nên tương đương multiply ~30%,
// không cần mix-blend-mode (tránh blend đè lên cảnh 3D). Hỏng thì bỏ qua, trang vẫn là nền phẳng.
function drawPaperGrain() {
    try {
        const N = 256
        const cv = document.createElement('canvas')
        cv.width = cv.height = N
        const ctx = cv.getContext('2d')
        if (!ctx) return
        const img = ctx.createImageData(N, N)
        // Hạt: alpha ngẫu nhiên 0..0.085 (tối đa ~30% của độ đậm 0.28)
        let seed = 20261024
        const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
        for (let i = 0; i < N * N; i++) {
            const a = rnd() ** 2 * 0.085
            img.data[i * 4 + 3] = Math.round(a * 255)
        }
        ctx.putImageData(img, 0, 0)
        // Vài sợi giấy mảnh
        ctx.strokeStyle = 'rgba(60,50,30,0.035)'
        ctx.lineWidth = 1
        for (let i = 0; i < 26; i++) {
            const x = rnd() * N
            const y = rnd() * N
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x + (rnd() - 0.5) * 36, y + (rnd() - 0.5) * 36)
            ctx.stroke()
        }
        document.documentElement.style.setProperty('--paper-grain', `url(${cv.toDataURL('image/png')})`)
    } catch {
        /* không vẽ được thì thôi */
    }
}

if (typeof document !== 'undefined') drawPaperGrain()
