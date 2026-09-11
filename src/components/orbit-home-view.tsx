'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Heart, MessageCircle, Share2, ChevronUp, ChevronDown, Play, Loader2, Volume2, VolumeX } from 'lucide-react'
import { getPosts, type Post } from '../services/api'
import { useAuth } from '@/contexts/AuthContext'

export function OrbitHomeView() {
    const [posts, setPosts] = useState<Post[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isGlobalMuted, setIsGlobalMuted] = useState(true)

    const location = useLocation()
    const { user } = useAuth()
    const isScrolling = useRef(false)

    // Fetch posts data on mount
    useEffect(() => {
        let cancelled = false
        getPosts(user)
            .then(data => {
                if (!cancelled && data && data.length > 0) {
                    setPosts(data)
                    // Check URL parameter right after posts are loaded
                    const searchParams = new URLSearchParams(location.search)
                    const videoId = searchParams.get('videoId')
                    if (videoId) {
                        const startIdx = data.findIndex(p => String(p.id) === String(videoId))
                        if (startIdx !== -1) {
                            setCurrentIndex(startIdx)
                        }
                    }
                }
            })
            .catch(() => { /* silently degrade */ })
            .finally(() => { if (!cancelled) setIsLoading(false) })
        return () => { cancelled = true }
    }, [user, location.search])

    // Robust wheel handler to navigate 1-by-1 via translateY
    const handleWheel = (e: React.WheelEvent) => {
        if (Math.abs(e.deltaY) < 15) return
        if (isScrolling.current) return

        isScrolling.current = true

        if (e.deltaY > 0) {
            setCurrentIndex(prev => Math.min(prev + 1, posts.length - 1))
        } else {
            setCurrentIndex(prev => Math.max(prev - 1, 0))
        }

        // Lock out trackpad inertia for 700ms
        setTimeout(() => { isScrolling.current = false }, 400)
    }

    const goNext = useCallback(() => {
        setCurrentIndex(prev => Math.min(prev + 1, posts.length - 1))
    }, [posts.length])

    const goPrev = useCallback(() => {
        setCurrentIndex(prev => Math.max(prev - 1, 0))
    }, [])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                goNext()
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                goPrev()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goNext, goPrev])

    return (
        <main
            className="relative flex-1 overflow-hidden h-[calc(100vh-80px)] w-full bg-transparent m-0 p-0 hide-scrollbar"
            onWheel={handleWheel}
        >
            {/* Navigation Pill */}
            <div className="fixed right-8 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 z-50">
                <button
                    type="button"
                    onClick={goPrev}
                    disabled={currentIndex === 0 || isLoading}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 backdrop-blur text-gray-800 shadow-lg transition hover:bg-white hover:scale-105 disabled:opacity-0 disabled:scale-90"
                    aria-label="Bài trước"
                >
                    <ChevronUp size={32} strokeWidth={2.5} />
                </button>
                <button
                    type="button"
                    onClick={goNext}
                    disabled={currentIndex >= posts.length - 1 || isLoading}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 backdrop-blur text-gray-800 shadow-lg transition hover:bg-white hover:scale-105 disabled:opacity-0 disabled:scale-90"
                    aria-label="Bài tiếp theo"
                >
                    <ChevronDown size={32} strokeWidth={2.5} />
                </button>
            </div>

            {isLoading ? (
                <div className="flex h-full items-center justify-center">
                    <Loader2 size={48} className="text-gray-400 animate-spin" />
                </div>
            ) : posts.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-500">
                    Chưa có bài viết nào
                </div>
            ) : (
                <div
                    className="w-full h-full transition-transform duration-300 ease-in-out flex flex-col"
                    style={{ transform: `translateY(-${currentIndex * 100}%)` }}
                >
                    {posts.map((post, idx) => (
                        <div
                            key={post.id}
                            id={`post-${idx}`}
                            className="h-full w-full shrink-0 relative flex items-center justify-center overflow-hidden"
                        >
                            <VideoPostItem
                                post={post}
                                isActive={currentIndex === idx}
                                isMuted={isGlobalMuted}
                                onMuteChange={setIsGlobalMuted}
                                onInView={() => { }}
                            />
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </main>
    )
}

function VideoPostItem({
    post,
    isActive,
    isMuted,
    onMuteChange
}: {
    post: Post;
    isActive: boolean;
    isMuted: boolean;
    onMuteChange: (muted: boolean) => void;
    onInView: () => void;
}) {
    const [liked, setLiked] = useState(false)
    const [isPlaying, setIsPlaying] = useState(isActive)
    const [isVideoLoading, setIsVideoLoading] = useState(true)
    const [progress, setProgress] = useState(0)
    const [volume, setVolume] = useState(isMuted ? 0 : 1)

    const videoRef = useRef<HTMLVideoElement>(null)
    const isDragging = useRef(false)
    const hasPlayedOnce = useRef(false)

    // Play/Pause based on active state — muted autoplay, TikTok-style
    useEffect(() => {
        if (!videoRef.current) return;

        if (isActive) {
            videoRef.current.muted = isMuted; // Respect global mute preference (defaults to true)
            videoRef.current.play().then(() => {
                setIsPlaying(true);
                hasPlayedOnce.current = true;
            }).catch(err => {
                console.warn("Autoplay prevented:", err);
                setIsPlaying(false);
            });
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
            videoRef.current.currentTime = 0;
        }
    }, [isActive, isMuted])

    // Sync global mute state
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted
            if (isMuted) setVolume(0)
            else setVolume(1)
        }
    }, [isMuted])

    // Reset play state when video source changes
    useEffect(() => {
        setIsPlaying(false)
        setProgress(0)
        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.currentTime = 0
        }
    }, [post.videoUrl])

    const handleLike = () => setLiked(!liked)

    const togglePlay = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        if (isDragging.current) return
        if (!videoRef.current) return

        if (videoRef.current.paused) {
            videoRef.current.play().catch(err => console.warn('Play promise interrupted:', err))
        } else {
            videoRef.current.pause()
        }
    }

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation()
        onMuteChange(!isMuted)
    }

    const handleTimeUpdate = () => {
        if (!videoRef.current || !videoRef.current.duration) return
        setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)
    }

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation()
        if (!videoRef.current || !videoRef.current.duration) return

        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, clickX / rect.width))

        videoRef.current.currentTime = percentage * videoRef.current.duration
        setProgress(percentage * 100)
    }

    return (
        <div className="relative w-full h-[calc(100vh-80px)] flex justify-center items-center py-4">
            {/* Floating Left Metadata (Absolute) */}
            <div className="absolute left-[max(1rem,calc(50%-(425px+2rem+280px)))] bottom-12 w-[280px] text-left z-20 flex flex-col gap-1 text-gray-900 pointer-events-auto">
                <section className="flex flex-col w-full shrink-0">
                    <div className="mb-2 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-900 overflow-hidden shadow-sm border border-gray-200">
                            {post.author?.avatarUrl
                                ? <img src={post.author.avatarUrl} alt={post.author.name} className="h-full w-full object-cover" />
                                : <span>{(post.author?.name ?? 'U').charAt(0).toUpperCase()}</span>
                            }
                        </div>
                        <div>
                            <p className="font-semibold">{post.author?.name ?? '—'}</p>
                            <p className="text-xs text-gray-500">
                                {post.createdAt ? new Date(post.createdAt).toLocaleDateString('vi-VN') : '—'}
                            </p>
                        </div>
                    </div>

                    <h1 className="text-lg font-bold tracking-tight leading-tight mt-1">
                        {post.title}
                    </h1>

                    {post.description && (
                        <p className="mt-1 text-sm leading-relaxed text-gray-600 line-clamp-2">
                            {post.description}
                        </p>
                    )}

                    {post.tags && post.tags.length > 0 && (
                        <p className="mt-2 flex items-center gap-2 text-xs font-bold tracking-widest text-gray-500 uppercase">
                            ♪ {post.tags.slice(0, 2).join(' • ')}
                        </p>
                    )}
                </section>
            </div>

            {/* True Center Video Box */}
            <div className="relative h-[calc(100vh-120px)] w-fit max-w-[900px] rounded-[24px] overflow-hidden bg-black flex justify-center items-center shadow-2xl z-10 group">

                {post.thumbnailUrl && (
                    <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover scale-[1.2] blur-[40px] opacity-50 z-0 pointer-events-none"
                    />
                )}

                <video
                    ref={videoRef}
                    src={post.videoUrl}
                    className="relative z-10 h-full w-auto max-w-full object-contain drop-shadow-2xl"
                    muted={isMuted}
                    autoPlay
                    loop
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedData={() => {
                        if (isActive && videoRef.current) {
                            videoRef.current.play().then(() => {
                                setIsPlaying(true);
                            }).catch(err => {
                                console.warn("LoadedData autoplay blocked:", err);
                                setIsPlaying(false);
                            });
                        }
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setIsVideoLoading(true)}
                    onLoadStart={() => setIsVideoLoading(true)}
                    onCanPlay={() => setIsVideoLoading(false)}
                    onPlaying={() => setIsVideoLoading(false)}
                />

                {/* Show spinner whenever active video hasn't confirmed playing yet */}
                {(isActive && !isPlaying) || isVideoLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                        <Loader2 className="animate-spin text-white w-12 h-12 drop-shadow-md" />
                    </div>
                ) : null}

                <div
                    className="absolute inset-0 z-20 cursor-pointer"
                    onClick={togglePlay}
                    onMouseUp={() => { setTimeout(() => { isDragging.current = false }, 50) }}
                />

                {/* Only show Play icon if user explicitly paused (not during initial loading) */}
                {!isPlaying && hasPlayedOnce.current && !isVideoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 z-30">
                        <Play className="w-16 h-16 text-white/80 fill-white/80 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none" />
                    </div>
                )}

                <div className="absolute top-6 left-6 z-30 group/volume flex items-center pointer-events-none">
                    <div className="flex items-center bg-black/40 backdrop-blur-md rounded-full p-1.5 transition-all shadow-lg border border-white/10 pointer-events-auto">
                        <button
                            onClick={toggleMute}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                            aria-label={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onMouseDown={() => { isDragging.current = true }}
                            onChange={(e) => {
                                if (!videoRef.current) return;
                                const val = parseFloat(e.target.value);
                                setVolume(val);
                                videoRef.current.volume = val;

                                if (val === 0) {
                                    onMuteChange(true);
                                } else if (isMuted) {
                                    onMuteChange(false);
                                }
                            }}
                            className="accent-white cursor-pointer w-0 opacity-0 overflow-hidden transition-all duration-300 group-hover/volume:w-20 group-hover/volume:opacity-100 mr-2"
                        />
                    </div>
                </div>

                <div className="absolute bottom-0 inset-x-0 z-30 pointer-events-none">
                    <div
                        className="group/progress mx-4 h-6 cursor-pointer flex items-end pb-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-auto"
                        onClick={handleSeek}
                        onMouseDown={() => { isDragging.current = true }}
                    >
                        <div className="w-full h-[4px] rounded-full bg-white/30 transition-all duration-200 group-hover/progress:h-[6px] relative overflow-hidden backdrop-blur-sm">
                            <div
                                className="h-full rounded-full bg-white transition-all duration-75 absolute left-0 top-0 shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Right Action Buttons (Absolute) */}
            <aside className="absolute right-[max(1rem,calc(50%-(425px+2rem+48px)))] bottom-12 flex flex-col gap-4 items-center z-20 pointer-events-auto">
                <Action
                    icon={<Heart size={28} strokeWidth={2.5} className="shrink-0" />}
                    label={formatCount(post.likesCount)}
                    onClick={handleLike}
                    active={liked}
                    activeColor="#e72c38"
                    textColor="text-gray-500 hover:text-gray-900"
                />
                <Action
                    icon={<MessageCircle size={28} strokeWidth={2.5} className="shrink-0" />}
                    label={formatCount(post.commentsCount)}
                    textColor="text-gray-500 hover:text-gray-900"
                />
                <Action
                    icon={<Share2 size={28} strokeWidth={2.5} className="shrink-0" />}
                    label="Share"
                    textColor="text-gray-500 hover:text-gray-900"
                />

                <div className="mt-2 h-12 w-12 overflow-hidden rounded-full border-[3px] border-gray-200 shadow-md cursor-pointer transition-transform hover:scale-105">
                    {post.author?.avatarUrl
                        ? <img src={post.author.avatarUrl} alt={post.author.name} className="h-full w-full object-cover" />
                        : <div className="h-full w-full flex items-center justify-center bg-[#1e2329] text-white text-sm font-bold">
                            {(post.author?.name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                    }
                </div>
            </aside>
        </div>
    )
}

function formatCount(count: number | undefined): string {
    if (count === undefined || count === null) return '0'
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return String(count)
}

function Action({
    icon,
    label,
    onClick,
    active,
    activeColor,
    textColor = 'text-[#70747c]'
}: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    active?: boolean;
    activeColor?: string;
    textColor?: string;
}) {
    return (
        <button type="button" onClick={onClick} className={`group flex flex-col items-center gap-1.5 text-[12px] font-bold transition hover:opacity-80 ${textColor}`}>
            <span
                className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-gray-100 shadow-sm transition-transform duration-200 group-hover:scale-110 active:scale-95 border border-gray-200"
                style={{ color: active && activeColor ? activeColor : '#1f232b' }}
            >
                {icon}
            </span>
            {label}
        </button>
    )
}