import { recordFrame } from '@/lib/perf'

/**
 * MỘT vòng requestAnimationFrame cho cả trang chủ: Lenis + máy quay (useScrollStage) chạy trước, rồi canvas R3F (frameloop="never", advance).
 * Không để hai ba vòng rAF song song; không còn ai đăng ký thì vòng tự dừng.
 */
type Frame = (t: number) => void
const subs: { fn: Frame; order: number }[] = []
let raf = 0
let last = 0

const loop = (t: number) => {
    raf = requestAnimationFrame(loop)
    const t0 = performance.now()
    const gap = last ? t0 - last : 16.7
    last = t0
    for (const s of subs.slice()) s.fn(t)
    recordFrame(gap, performance.now() - t0)
}

/** order nhỏ chạy trước. Trả hàm huỷ đăng ký. */
export function addFrame(fn: Frame, order = 0) {
    subs.push({ fn, order })
    subs.sort((a, b) => a.order - b.order)
    if (!raf) {
        last = 0
        raf = requestAnimationFrame(loop)
    }
    return () => {
        const i = subs.findIndex((s) => s.fn === fn)
        if (i >= 0) subs.splice(i, 1)
        if (!subs.length && raf) {
            cancelAnimationFrame(raf)
            raf = 0
        }
    }
}
