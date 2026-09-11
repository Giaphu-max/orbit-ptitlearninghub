'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Play, Heart, MessageCircle, Share2, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getPosts, type Post } from '../services/api'
import { useAuth } from '@/contexts/AuthContext'

interface Short {
    id: string | number
    title: string
    instructor: string
    category: string
    thumbnail: string
    videoUrl?: string
}

const mockShorts: Short[] = [
    { id: 'm1', title: 'Tips thiết kế UI/UX cho người mới bắt đầu', instructor: 'Nguyễn Văn An', category: 'UI/UX Design', thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=400&q=80' },
    { id: 'm2', title: '3D Modeling cơ bản với Blender', instructor: 'Lê Phúc', category: '3D Modeling', thumbnail: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80' },
    { id: 'm3', title: 'Kỹ xảo After Effects cực mượt', instructor: 'Thu Hà', category: 'VFX', thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80' },
    { id: 'm4', title: 'Học ReactJS trong 60 giây', instructor: 'Đức Mạnh', category: 'Code', thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80' },
    { id: 'm5', title: 'Tối ưu trải nghiệm người dùng (UX)', instructor: 'Trần Khoa', category: 'UI/UX Design', thumbnail: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=400&q=80' },
    { id: 'm6', title: 'Dựng hình ZBrush siêu tốc', instructor: 'Quốc Bảo', category: '3D Modeling', thumbnail: 'https://images.unsplash.com/photo-1615822368305-6f17e0828551?auto=format&fit=crop&w=400&q=80' },
    { id: 'm7', title: 'Phân tích Layout website hiện đại', instructor: 'Phạm Hương', category: 'UI/UX Design', thumbnail: 'https://images.unsplash.com/photo-1507238692062-5a0423c8a306?auto=format&fit=crop&w=400&q=80' },
    { id: 'm8', title: 'Node.js Backend cấu trúc chuẩn', instructor: 'Vũ Dũng', category: 'Code', thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80' },
    { id: 'm9', title: 'Wireframe to UI - Quick Workflow', instructor: 'Thanh Hằng', category: 'UI/UX Design', thumbnail: 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?auto=format&fit=crop&w=400&q=80' },
    { id: 'm10', title: 'Lighting in Unreal Engine 5', instructor: 'Hải Nam', category: '3D Modeling', thumbnail: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?auto=format&fit=crop&w=400&q=80' },
    { id: 'm11', title: 'Motion Tracking in Premiere', instructor: 'Minh Khang', category: 'VFX', thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=400&q=80' },
    { id: 'm12', title: 'CSS Animations Masterclass', instructor: 'Quỳnh Nhi', category: 'Code', thumbnail: 'https://images.unsplash.com/photo-1627398225258-14f043d65b16?auto=format&fit=crop&w=400&q=80' },
    { id: 'm13', title: 'Color Theory for Designers', instructor: 'Hoàng Long', category: 'UI/UX Design', thumbnail: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=400&q=80' },
    { id: 'm14', title: 'Low Poly Art in Cinema 4D', instructor: 'Tuấn Kiệt', category: '3D Modeling', thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=400&q=80' },
    { id: 'm15', title: 'Chroma Key (Green Screen) Pro', instructor: 'Diệu Linh', category: 'VFX', thumbnail: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?auto=format&fit=crop&w=400&q=80' },
    { id: 'm16', title: 'TypeScript Advanced Types', instructor: 'Quang Đại', category: 'Code', thumbnail: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&w=400&q=80' },
]

function ShortCard({ course, onClick }: { course: Short; onClick: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleMouseEnter = () => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => {});
        }
    };

    const handleMouseLeave = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div 
            className="group relative w-full aspect-[9/16] rounded-[20px] overflow-hidden bg-black shadow-lg cursor-pointer flex flex-col justify-end transition-transform duration-300 hover:scale-[1.02]"
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {course.videoUrl ? (
                <>
                    <video 
                        ref={videoRef}
                        src={`${course.videoUrl}#t=0.5`} 
                        className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" 
                        muted 
                        loop
                        playsInline 
                    />
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-opacity duration-300 opacity-100 group-hover:opacity-0">
                        <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Play size={24} className="text-white fill-white ml-1" />
                        </div>
                    </div>
                </>
            ) : (
                <img 
                    src={course.thumbnail} 
                    alt={course.title} 
                    className="absolute inset-0 w-full h-full object-cover opacity-80" 
                />
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
            
            {/* Quick Actions */}
            <div className="absolute right-3 bottom-24 flex flex-col gap-4 z-10 pointer-events-auto">
                <button className="flex flex-col items-center gap-1 text-white hover:text-red-500 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                        <Heart size={20} />
                    </div>
                    <span className="text-[10px] font-bold shadow-black drop-shadow-md">12K</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-white hover:text-blue-400 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                        <MessageCircle size={20} />
                    </div>
                    <span className="text-[10px] font-bold shadow-black drop-shadow-md">245</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-white hover:text-green-400 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                        <Share2 size={20} />
                    </div>
                    <span className="text-[10px] font-bold shadow-black drop-shadow-md">Share</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="relative p-4 z-10 pointer-events-none pr-14">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-red-500 to-rose-400 flex items-center justify-center text-[10px] font-bold text-white border border-white/20 shadow-md">
                        {course.instructor.charAt(0)}
                    </div>
                    <span className="text-xs font-semibold text-white drop-shadow-md">@{course.instructor.replace(/\s+/g, '').toLowerCase()}</span>
                </div>
                <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 mb-4 drop-shadow-md">{course.title}</h3>
                
                {/* Related Course CTA */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                    className="w-full py-2.5 px-3 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold flex items-center justify-between hover:bg-white hover:text-black transition-colors pointer-events-auto shadow-lg"
                >
                    <span className="flex items-center gap-2"><Play size={14} className="fill-current" /> Xem khóa học liên quan</span>
                </button>
            </div>
        </div>
    )
}

const TAGS = ['Tất cả', 'UI/UX Design', '3D Modeling', 'VFX', 'Code']

export function OrbitDiscoverView() {
    const [activeTag, setActiveTag] = useState('Tất cả')
    const [searchQuery, setSearchQuery] = useState('')
    const [shorts, setShorts] = useState<Short[]>(mockShorts)
    const [isLoading, setIsLoading] = useState(true)
    const navigate = useNavigate()
    const { user } = useAuth()

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);

        getPosts(user)
            .then(data => {
                if (!cancelled) {
                    const mappedUserPosts: Short[] = data.map(post => ({
                        id: post.id,
                        title: post.title,
                        instructor: post.author.name,
                        category: post.tags[0] || 'VFX',
                        thumbnail: post.thumbnailUrl || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=400&q=80',
                        videoUrl: post.videoUrl
                    }))
                    
                    // Prepend user uploaded posts to the mock shorts
                    setShorts([...mappedUserPosts, ...mockShorts]);
                }
            })
            .catch(() => {
                // Silently fallback to just mocks if network fails
                if (!cancelled) setShorts(mockShorts);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            })

        return () => { cancelled = true; }
    }, [user])

    const displayedShorts = shorts.filter(short => {
        const matchesTag = activeTag === 'Tất cả' || short.category === activeTag;
        const matchesSearch = short.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTag && matchesSearch;
    })

    return (
        <main className="relative flex-1 h-full w-full overflow-y-auto bg-transparent px-6 py-10 lg:px-10">
            <div className="max-w-[1400px] mx-auto flex flex-col">
                
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-[#1a1d23] tracking-tight">Khám phá Shorts</h1>
                    <p className="mt-2 text-gray-500">Xem nhanh các tips và thủ thuật từ chuyên gia.</p>
                </div>

                {/* Top Section: Search & Filter */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    {/* Search Bar */}
                    <div className="relative w-full md:max-w-md z-10">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input 
                            type="text" 
                            className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 shadow-sm transition-all"
                            placeholder="Tìm kiếm nội dung..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filter Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide z-10">
                        {TAGS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setActiveTag(tag)}
                                className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-all shadow-sm ${
                                    activeTag === tag 
                                    ? 'bg-red-600 text-white scale-[1.02]' 
                                    : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="w-full py-12 flex justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                )}

                {/* Shorts Grid */}
                {!isLoading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6 pb-24 relative z-0">
                        {displayedShorts.length > 0 ? displayedShorts.map(short => (
                            <ShortCard 
                                key={short.id} 
                                course={short} 
                                onClick={() => short.videoUrl ? navigate(`/?videoId=${short.id}`) : navigate('/learning')} 
                            />
                        )) : (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500">
                                <Search size={48} className="text-gray-300 mb-4" />
                                <p className="text-lg font-medium">Không tìm thấy video nào phù hợp.</p>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </main>
    )
}
