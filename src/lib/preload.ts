// Tải sẵn trang chủ và cảnh 3D ngay khi chọn vai trò, song song với màn intro,
// để lúc màn đỏ mở ra là đã có hình (không trắng, không giật do tải chunk).
let started = false
export function preloadHome() {
    if (started) return
    started = true
    void import('@/components/orbit-home-view').catch(() => undefined)
    void import('@/components/home/tower-scene').catch(() => undefined)
}
