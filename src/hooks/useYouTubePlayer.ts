import { useCallback, useEffect, useRef, useState } from 'react'
import { loadYouTubeApi, youtubeErrorMessage, YT_STATE, type YTPlayer } from '@/lib/youtube'

export type PlayerStatus = 'loading' | 'ready' | 'error' | 'no-video'

interface Options {
    /** Giây bắt đầu phát (tiếp tục từ lần xem trước) */
    startAt?: number
    /** Ẩn thanh điều khiển của YouTube để trang tự dựng thanh tua riêng */
    hideControls?: boolean
}

/**
 * Bọc YouTube IFrame Player: theo dõi thời điểm đang xem, tua, phát/dừng.
 * Khi bài chưa có video (dữ liệu mẫu) hook chạy ở chế độ mô phỏng: seekTo chỉ đổi
 * currentTime, để transcript và chip mốc thời gian vẫn dùng được.
 * Component dùng hook nên được gắn key theo videoId để reset trạng thái khi đổi bài.
 */
export function useYouTubePlayer(videoId: string, { startAt = 0, hideControls = false }: Options = {}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YTPlayer | null>(null)
    const startAtRef = useRef(startAt)
    const hideControlsRef = useRef(hideControls)

    const [status, setStatus] = useState<PlayerStatus>(videoId ? 'loading' : 'no-video')
    const [error, setError] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState(startAt)
    const [duration, setDuration] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [rate, setRateState] = useState(1)
    const [isBuffering, setIsBuffering] = useState(false)
    // Đã từng phát: trước đó pause screen dùng thumbnail để không lộ màn YouTube
    const [started, setStarted] = useState(false)

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
                        ...(hideControlsRef.current ? { controls: 0, fs: 0, disablekb: 1, iv_load_policy: 3 } : {}),
                    },
                    events: {
                        onReady: (e) => {
                            if (cancelled) return
                            setDuration(e.target.getDuration())
                            setStatus('ready')
                        },
                        onStateChange: (e) => {
                            setIsPlaying(e.data === YT_STATE.PLAYING)
                            setIsBuffering(e.data === YT_STATE.BUFFERING)
                            if (e.data === YT_STATE.PLAYING) setStarted(true)
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

    const setRate = useCallback((r: number) => {
        playerRef.current?.setPlaybackRate(r)
        setRateState(r)
    }, [])

    /** Đổi âm lượng theo bước (±10); trả về mức mới 0–100 */
    const changeVolume = useCallback((delta: number) => {
        const player = playerRef.current
        if (!player) return 0
        const next = Math.min(100, Math.max(0, Math.round((player.getVolume() + delta) / 10) * 10))
        player.setVolume(next)
        return next
    }, [])

    return { containerRef, status, error, currentTime, duration, isPlaying, isBuffering, started, rate, seekTo, play, pause, setRate, changeVolume }
}
