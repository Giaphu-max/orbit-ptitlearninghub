import { useCallback, useEffect, useRef, useState } from 'react'
import { loadYouTubeApi, youtubeErrorMessage, YT_STATE, type YTPlayer } from '@/lib/youtube'

export type PlayerStatus = 'loading' | 'ready' | 'error' | 'no-video'

interface Options {
    /** Giây bắt đầu phát (tiếp tục từ lần xem trước) */
    startAt?: number
}

/**
 * Bọc YouTube IFrame Player: theo dõi thời điểm đang xem, tua, phát/dừng.
 * Khi bài chưa có video (dữ liệu mẫu) hook chạy ở chế độ mô phỏng: seekTo chỉ đổi
 * currentTime, để transcript và chip mốc thời gian vẫn dùng được.
 * Component dùng hook nên được gắn key theo videoId để reset trạng thái khi đổi bài.
 */
export function useYouTubePlayer(videoId: string, { startAt = 0 }: Options = {}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YTPlayer | null>(null)
    const startAtRef = useRef(startAt)

    const [status, setStatus] = useState<PlayerStatus>(videoId ? 'loading' : 'no-video')
    const [error, setError] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState(startAt)
    const [duration, setDuration] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        const container = containerRef.current
        if (!videoId || !container) return
        let cancelled = false
        // YouTube thay thế phần tử được giao bằng iframe, nên tạo phần tử con riêng
        // để không đụng vào node do React quản lý.
        const mount = document.createElement('div')
        mount.className = 'h-full w-full'
        container.appendChild(mount)

        loadYouTubeApi()
            .then((YT) => {
                if (cancelled) return
                playerRef.current = new YT.Player(mount, {
                    videoId,
                    host: 'https://www.youtube-nocookie.com',
                    playerVars: {
                        start: Math.floor(startAtRef.current),
                        rel: 0,
                        playsinline: 1,
                        modestbranding: 1,
                        hl: 'vi',
                        cc_lang_pref: 'vi',
                        origin: window.location.origin,
                    },
                    events: {
                        onReady: (e) => {
                            if (cancelled) return
                            setDuration(e.target.getDuration())
                            setStatus('ready')
                        },
                        onStateChange: (e) => {
                            setIsPlaying(e.data === YT_STATE.PLAYING)
                            setCurrentTime(e.target.getCurrentTime())
                        },
                        onError: (e) => {
                            setError(youtubeErrorMessage(e.data))
                            setStatus('error')
                        },
                    },
                })
            })
            .catch((err: Error) => {
                if (cancelled) return
                setError(`${err.message}. Bạn kiểm tra kết nối mạng rồi tải lại trang nhé.`)
                setStatus('error')
            })

        return () => {
            cancelled = true
            playerRef.current?.destroy()
            playerRef.current = null
            mount.remove()
        }
    }, [videoId])

    // Cập nhật thời điểm đang xem trong lúc phát
    useEffect(() => {
        if (!isPlaying) return
        const timer = window.setInterval(() => {
            const t = playerRef.current?.getCurrentTime()
            if (typeof t === 'number') setCurrentTime(t)
        }, 250)
        return () => window.clearInterval(timer)
    }, [isPlaying])

    const seekTo = useCallback((sec: number, { play = true } = {}) => {
        const player = playerRef.current
        const target = Math.max(0, sec)
        if (player) {
            player.seekTo(target, true)
            if (play) player.playVideo()
        }
        setCurrentTime(target)
    }, [])

    const play = useCallback(() => playerRef.current?.playVideo(), [])
    const pause = useCallback(() => playerRef.current?.pauseVideo(), [])

    return { containerRef, status, error, currentTime, duration, isPlaying, seekTo, play, pause }
}
