'use client'

import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Heart, MessageCircle, Share2, ChevronUp, ChevronDown, Play, Loader2, Volume2, VolumeX } from 'lucide-react'
import { getPosts, type Post } from '../services/api'

export function OrbitHomeView() {
    const [posts, setPosts] = useState<Post[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({})
    const [volume, setVolume] = useState(1)
    
    // Video playback state
    const videoRef = useRef<HTMLVideoElement>(null)
    const isDragging = useRef(false)
    const [isPlaying, setIsPlaying] = useState(true)
    const [progress, setProgress] = useState(0)
    const [isMuted, setIsMuted] = useState(true)

    const location = useLocation()

    useEffect(() => {
        let cancelled = false
        getPosts()
            .then(data => { 
                if (!cancelled) {
                    setPosts(data)
                    const searchParams = new URLSearchParams(location.search)
                    const videoId = searchParams.get('videoId')
                    if (videoId) {
                        const idx = data.findIndex(p => p.id === videoId)
                        if (idx !== -1) setCurrentIndex(idx)
                    }
                } 
            })
            .catch(() => { /* silently degrade */ })
            .finally(() => { if (!cancelled) setIsLoading(false) })
        return () => { cancelled = true }
    }, [location.search])

    // Reset playback state when video changes
    useEffect(() => {
        setIsPlaying(true)
        setProgress(0)
    }, [currentIndex])

    const currentPost: Post | undefined = posts[currentIndex]

    const goNext = () => setCurrentIndex(i => Math.min(i + 1, posts.length - 1))
    const goPrev = () => setCurrentIndex(i => Math.max(i - 1, 0))

    const handleLike = () => {
        if (!currentPost) return
        setLikedPosts(prev => ({ ...prev, [currentPost.id]: !prev[currentPost.id] }))
    }

    const togglePlay = () => {
        if (isDragging.current) return
        if (!videoRef.current) return
        if (videoRef.current.paused) {
            videoRef.current.play()
        } else {
            videoRef.current.pause()
        }
    }

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent toggling play/pause
        if (!videoRef.current) return
        videoRef.current.muted = !videoRef.current.muted
        setIsMuted(videoRef.current.muted)
    }

    const handleTimeUpdate = () => {
        if (!videoRef.current || !videoRef.current.duration) return
        setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)
    }

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation() // Prevent toggling play/pause
        if (!videoRef.current || !videoRef.current.duration) return
        
        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, clickX / rect.width))
        
        videoRef.current.currentTime = percentage * videoRef.current.duration
        setProgress(percentage * 100)
    }

    return (
        <main className="relative flex-1 h-full w-full flex items-center justify-center bg-[#f8f9fa] overflow-hidden m-0 p-0">
            {/* Decorative Background */}
            <div className="absolute -left-[100px] top-[20%] h-[400px] w-[400px] rounded-full bg-[#fdf0f2]" />
            <div className="absolute -bottom-[200px] -right-[100px] h-[700px] w-[700px] rounded-full bg-[#fdf0f2]" />

            {/* Main Layout Cluster */}
            <div className="z-10 flex flex-nowrap items-end justify-center gap-10 -translate-x-24">

                {/* Left Column (Text) */}
                <section className="flex flex-col justify-end w-[320px] shrink-0 self-end">
                    {isLoading ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 w-32 rounded bg-gray-200" />
                            <div className="h-8 w-full rounded bg-gray-200" />
                            <div className="h-4 w-3/4 rounded bg-gray-200" />
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e2329] text-sm font-bold text-white overflow-hidden">
                                    {currentPost?.author?.avatarUrl
                                        ? <img src={currentPost.author.avatarUrl} alt={currentPost?.author?.name ?? 'Author'} className="h-full w-full object-cover" />
                                        : <span>{(currentPost?.author?.name ?? 'U').charAt(0).toUpperCase()}</span>
                                    }
                                </div>
                                <div>
                                    <p className="font-bold text-[#20242c]">{currentPost?.author?.name ?? '—'}</p>
                                    <p className="text-xs font-medium text-[#777c86]">
                                        {currentPost?.createdAt
                                            ? new Date(currentPost.createdAt).toLocaleDateString('vi-VN')
                                            : '—'}
                                    </p>
                                </div>
                            </div>

                            <h1 className="text-3xl font-bold tracking-tight text-[#20242c] leading-tight">
                                {currentPost?.title ?? 'Chưa có bài viết'}
                            </h1>

                            {currentPost?.description && (
                                <p className="mt-4 text-sm leading-relaxed text-[#656a74] line-clamp-3">
                                    {currentPost.description}
                                </p>
                            )}

                            {currentPost?.tags && currentPost.tags.length > 0 && (
                                <p className="mt-8 flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#858a94] uppercase">
                                    ♪ {currentPost.tags.slice(0, 2).join(' • ')}
                                </p>
                            )}
                        </>
                    )}
                </section>

                {/* Center Column (Video) */}
                <div className="relative aspect-[9/16] h-[97vh] max-h-[1100px] shrink-0 overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] group">
                    {/* Abstract Glow */}
                    <div className="absolute -top-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-[100px]" />
                    <div className="absolute -bottom-1/4 -left-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/20 blur-[80px]" />

                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 size={48} className="text-white/40 animate-spin" />
                        </div>
                    ) : currentPost?.videoUrl ? (
                        <div 
                            className="absolute inset-0 cursor-pointer" 
                            onClick={togglePlay}
                            onMouseUp={() => { setTimeout(() => { isDragging.current = false }, 50) }}
                        >
                            <video
                                ref={videoRef}
                                key={currentPost.id}
                                src={currentPost.videoUrl}
                                className="absolute inset-0 h-full w-full object-cover"
                                autoPlay
                                muted={isMuted}
                                loop
                                playsInline
                                onTimeUpdate={handleTimeUpdate}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                            />
                            
                            {/* Centered Pause Indicator */}
                            {!isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 z-10">
                                    <Play className="w-16 h-16 text-white/80 fill-white/80 drop-shadow-lg" />
                                </div>
                            )}

                            {/* Mute/Unmute Toggle & Volume Slider */}
                            <div 
                                className="absolute top-6 left-6 z-20 group/volume flex items-center bg-black/40 backdrop-blur-md rounded-full p-1.5 transition-all"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button 
                                    onClick={toggleMute}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-black/20"
                                    aria-label={isMuted ? "Unmute" : "Mute"}
                                >
                                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                </button>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01" 
                                    value={volume}
                                    onMouseDown={() => { isDragging.current = true }} 
                                    onChange={(e) => { 
                                        const val = parseFloat(e.target.value); 
                                        if (videoRef.current) videoRef.current.volume = val; 
                                        setVolume(val); 
                                        if (val > 0) setIsMuted(false); 
                                        else setIsMuted(true);
                                    }} 
                                    className="accent-white cursor-pointer w-0 opacity-0 overflow-hidden transition-all duration-300 group-hover/volume:w-20 group-hover/volume:opacity-100 mr-2" 
                                />
                            </div>

                            {/* Gradient Overlay for bottom text/progress visibility */}
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />

                            {/* Custom Progress Bar with Expandable Hit Area */}
                            <div 
                                className="group/progress absolute bottom-0 inset-x-0 mx-4 h-10 cursor-pointer flex items-end pb-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                onClick={handleSeek}
                                onMouseDown={() => { isDragging.current = true }}
                            >
                                <div className="w-full h-[3px] rounded-full bg-white/30 transition-all duration-200 group-hover/progress:h-[8px] relative overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[#e72c38] transition-all duration-75 absolute left-0 top-0"
                                        style={{ width: `${progress}%` }}
                                    >
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-2xl backdrop-blur-md transition hover:scale-105 cursor-pointer">
                                <Play size={36} fill="white" className="text-white ml-2" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column (Actions) */}
                <aside className="flex w-[60px] shrink-0 flex-col items-center justify-end gap-6 self-end">
                    <div className="mb-2 flex flex-col gap-4">
                        <div className="h-14 w-14 rounded-xl bg-[#c7ad83] p-1.5 shadow-sm">
                            <div className="flex h-full items-center justify-center rounded-lg bg-[#152439] text-[10px] font-bold text-white">Ps</div>
                        </div>
                        <div className="h-14 w-14 rounded-xl bg-[#171e2b] p-1 shadow-sm">
                            <div className="flex h-full items-center justify-center rounded-lg bg-[#362b26] text-[10px] font-bold text-white">Pr</div>
                        </div>
                    </div>

                    <Action 
                        icon={<Heart size={32} strokeWidth={2.5} />} 
                        label={formatCount(currentPost?.likesCount)} 
                        onClick={handleLike}
                        active={currentPost ? !!likedPosts[currentPost.id] : false}
                        activeColor="#e72c38"
                    />
                    <Action icon={<MessageCircle size={32} strokeWidth={2.5} />} label={formatCount(currentPost?.commentsCount)} />
                    <Action icon={<Share2 size={32} strokeWidth={2.5} />} label="Share" />

                    <div className="mt-2 h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-md">
                        {currentPost?.author?.avatarUrl
                            ? <img src={currentPost.author.avatarUrl} alt={currentPost.author.name} className="h-full w-full object-cover" />
                            : <div className="h-full w-full flex items-center justify-center bg-[#1e2329] text-white text-sm font-bold">
                                {(currentPost?.author?.name ?? 'U').charAt(0).toUpperCase()}
                              </div>
                        }
                    </div>
                </aside>
            </div>

            {/* Navigation Pill */}
            <div className="absolute right-8 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 z-20">
                <button
                    type="button"
                    onClick={goPrev}
                    disabled={currentIndex === 0 || isLoading}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#70747c] shadow-sm transition hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Bài trước"
                >
                    <ChevronUp size={32} strokeWidth={2.5} />
                </button>
                <button
                    type="button"
                    onClick={goNext}
                    disabled={currentIndex >= posts.length - 1 || isLoading}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#70747c] shadow-sm transition hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Bài tiếp theo"
                >
                    <ChevronDown size={32} strokeWidth={2.5} />
                </button>
            </div>
        </main>
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
    activeColor 
}: { 
    icon: React.ReactNode; 
    label: string; 
    onClick?: () => void;
    active?: boolean;
    activeColor?: string;
}) {
    return (
        <button type="button" onClick={onClick} className="group flex flex-col items-center gap-2 text-[13px] font-semibold text-[#70747c] transition hover:text-[#20242c]">
            <span 
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm transition group-hover:scale-105"
                style={{ color: active && activeColor ? activeColor : '#252932' }}
            >
                {icon}
            </span>
            {label}
        </button>
    )
}
