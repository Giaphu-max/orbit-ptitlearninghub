import { recordFrame } from '@/lib/perf'
import { introPlaying } from '@/lib/role-intro'

/**
 * MỘT vòng requestAnimationFrame cho cả trang chủ: Lenis + máy quay (useScrollStage) chạy trước, rồi canvas R3F (frameloop="never", advance).
 * Không để hai ba vòng rAF song song; không còn ai đăng ký thì vòng tự dừng.
 */
type Frame = (t: number) => void
const subs: { fn: Frame; order: number }[] = []
let raf = 0
let last = 0
let observer: ((gap: number, js: number) => void) | null = null

/** Bên ngoài (bench) nhận thời lượng từng khung (ms) và thời gian JS của khung đó */
export const setFrameObserver = (fn: ((gap: number, js: number) => void) | null) => {
    observer = fn
}

const loop = (t: number) => {
    raf = requestAnimationFrame(loop)
    // Intro đang chạy: giữ vòng rAF nhưng không gọi subscriber nào (Lenis, máy quay, advance R3F) để nhường toàn bộ khung cho intro
    if (introPlaying()) {
        last = 0
        return
    }
    const t0 = performance.now()
    const first = !last
    const gap = first ? 16.7 : t0 - last
    last = t0
    for (const s of subs.slice()) s.fn(t)
    const js = performance.now() - t0
    recordFrame(gap, js)
    if (!first) observer?.(gap, js)
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
