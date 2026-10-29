// Nạp YouTube IFrame Player API một lần cho cả app.
// Chỉ khai báo phần API mà Orbit dùng tới, không kéo thêm thư viện type.

export interface YTPlayer {
    playVideo(): void
    pauseVideo(): void
    seekTo(seconds: number, allowSeekAhead: boolean): void
    getCurrentTime(): number
    getDuration(): number
    getPlayerState(): number
    setPlaybackRate(rate: number): void
    destroy(): void
}

export interface YTPlayerOptions {
    videoId: string
    host?: string
    playerVars?: Record<string, string | number>
    events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
        onError?: (e: { data: number }) => void
    }
}

interface YTNamespace {
    Player: new (el: HTMLElement, options: YTPlayerOptions) => YTPlayer
}

declare global {
    interface Window {
        YT?: YTNamespace
        onYouTubeIframeAPIReady?: () => void
    }
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

let apiPromise: Promise<YTNamespace> | null = null

export function loadYouTubeApi(): Promise<YTNamespace> {
    if (window.YT?.Player) return Promise.resolve(window.YT)
    if (apiPromise) return apiPromise

    apiPromise = new Promise<YTNamespace>((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => {
            previous?.()
            if (window.YT) resolve(window.YT)
        }
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.async = true
        script.onerror = () => {
            apiPromise = null
            script.remove()
            reject(new Error('Không tải được trình phát YouTube'))
        }
        document.head.appendChild(script)
    })
    return apiPromise
}

/** Thông báo tiếng Việt cho mã lỗi của trình phát YouTube. */
export function youtubeErrorMessage(code: number): string {
    switch (code) {
        case 2:
            return 'Mã video không hợp lệ.'
        case 5:
            return 'Trình duyệt không phát được video này.'
        case 100:
            return 'Video không tồn tại hoặc đã bị đặt ở chế độ riêng tư.'
        case 101:
        case 150:
            return 'Chủ kênh không cho phép nhúng video này vào trang khác.'
        default:
            return 'Không phát được video. Bạn thử tải lại trang nhé.'
    }
}

export function formatTime(sec: number): string {
    const total = Math.max(0, Math.floor(sec))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
