/** WebKit (Safari macOS/iOS) nhưng không phải Chromium: có hồ sơ chất lượng riêng cho cảnh 3D trang chủ vì Safari xử lý chậm filter, matrix3d DOM và shadow map lớn. */
export const isWebKit = (() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
    // ?webkit ép bật hồ sơ Safari trên trình duyệt khác (để thử trên Chrome)
    if (new URLSearchParams(window.location.search).has('webkit')) return true
    const ua = navigator.userAgent
    return (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg/.test(ua)) || ('GestureEvent' in window && !/Chrom/.test(ua))
})()

if (isWebKit) document.documentElement.classList.add('is-webkit')
