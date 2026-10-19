'use client'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, ChevronRight, TrendingUp, X, CheckCircle2, Lock, Bookmark } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Course {
    id: number
    title: string
    instructor: string
    category: string // internal category ID
    thumbnail: string
    badge?: { label: string }
    socialProof: string
    duration: string
    exercises: number
    hasCertificate: boolean
    rating: number
    isFree: boolean
}

interface EnrolledCourse {
    id: number
    title: string
    category: string
    progress: number
    totalLessons: number
    completedLessons: number
    currentLesson: string
    thumbnail: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const enrolledCourses: EnrolledCourse[] = [
    {
        id: 1,
        title: 'UI/UX Design từ Cơ bản đến Nâng cao',
        category: 'UI/UX Design',
        progress: 50,
        totalLessons: 24,
        completedLessons: 12,
        currentLesson: 'Thiết kế giao diện trong Figma',
        thumbnail: 'https://picsum.photos/seed/enrolled1/600/400',
    },
    {
        id: 2,
        title: '3D Modeling với Blender — Ngành Game & Phim',
        category: '3D Modeling',
        progress: 40,
        totalLessons: 20,
        completedLessons: 8,
        currentLesson: 'Texturing & Material cơ bản',
        thumbnail: 'https://picsum.photos/seed/enrolled2/600/400',
    },
]

// Extended Mock Data for Rich UI (25+ items)
const mockCourses: Course[] = [
    // 🎨 UI/UX Design
    {
        id: 1, title: 'Figma Masterclass — Thiết kế UI Chuyên nghiệp', instructor: 'Nguyễn Văn An', category: 'UI/UX Design',
        thumbnail: 'https://picsum.photos/seed/course1/600/400', badge: { label: 'Đề xuất' },
        socialProof: '🔥 85% sinh viên PTIT hoàn thành', duration: '24h', exercises: 12, hasCertificate: true, rating: 4.8, isFree: true,
    },
    {
        id: 2, title: 'User Research & UX Psychology', instructor: 'Trần Minh Khoa', category: 'UI/UX Design',
        thumbnail: 'https://picsum.photos/seed/course2/600/400',
        socialProof: '⭐ 4.9 (1.8k đánh giá)', duration: '18h', exercises: 8, hasCertificate: true, rating: 4.9, isFree: false,
    },
    {
        id: 3, title: 'Design System & Token Architecture', instructor: 'Lê Hoàng Phúc', category: 'UI/UX Design',
        thumbnail: 'https://picsum.photos/seed/course3/600/400',
        socialProof: '🔥 70% sinh viên PTIT hoàn thành', duration: '15h', exercises: 6, hasCertificate: true, rating: 4.7, isFree: false,
    },
    {
        id: 4, title: 'Web Design Principles', instructor: 'Phạm Hương', category: 'UI/UX Design',
        thumbnail: 'https://picsum.photos/seed/course4/600/400', badge: { label: 'Hot' },
        socialProof: '🔥 92% sinh viên PTIT hoàn thành', duration: '12h', exercises: 5, hasCertificate: false, rating: 4.6, isFree: true,
    },
    {
        id: 5, title: 'Mobile App UX/UI (iOS & Android)', instructor: 'Hoàng Minh', category: 'UI/UX Design',
        thumbnail: 'https://picsum.photos/seed/course5/600/400',
        socialProof: '⭐ 4.8 (950 đánh giá)', duration: '20h', exercises: 10, hasCertificate: true, rating: 4.8, isFree: false,
    },

    // 🧊 3D Modeling
    {
        id: 6, title: 'Blender 4.0 — 3D Modeling từ Zero', instructor: 'Lê Hoàng Phúc', category: '3D Modeling',
        thumbnail: 'https://picsum.photos/seed/course6/600/400', badge: { label: 'Đề xuất' },
        socialProof: '🔥 72% sinh viên PTIT hoàn thành', duration: '36h', exercises: 20, hasCertificate: true, rating: 4.7, isFree: true,
    },
    {
        id: 7, title: 'Character Animation — Cinema 4D', instructor: 'Phạm Thu Hà', category: '3D Modeling',
        thumbnail: 'https://picsum.photos/seed/course7/600/400',
        socialProof: '⭐ 4.6 (980 đánh giá)', duration: '28h', exercises: 15, hasCertificate: true, rating: 4.6, isFree: false,
    },
    {
        id: 8, title: 'ZBrush Sculpting cho Game Asset', instructor: 'Đặng Quốc Bảo', category: '3D Modeling',
        thumbnail: 'https://picsum.photos/seed/course8/600/400',
        socialProof: '⭐ 4.8 (1.2k đánh giá)', duration: '40h', exercises: 18, hasCertificate: true, rating: 4.8, isFree: false,
    },
    {
        id: 9, title: 'Unreal Engine 5 Environments', instructor: 'Nguyễn Tùng', category: '3D Modeling',
        thumbnail: 'https://picsum.photos/seed/course9/600/400', badge: { label: 'Mới' },
        socialProof: '🔥 500+ sinh viên đăng ký', duration: '45h', exercises: 25, hasCertificate: true, rating: 4.9, isFree: false,
    },
    {
        id: 10, title: '3D Product Animation (Blender)', instructor: 'Vũ Lan', category: '3D Modeling',
        thumbnail: 'https://picsum.photos/seed/course10/600/400',
        socialProof: '⭐ 4.7 (600 đánh giá)', duration: '22h', exercises: 10, hasCertificate: false, rating: 4.7, isFree: true,
    },

    // 🎬 Video Editing (Premiere/AE)
    {
        id: 11, title: 'Premiere Pro — Dựng Video Cinematic', instructor: 'Hoàng Đức Mạnh', category: 'Video Editing',
        thumbnail: 'https://picsum.photos/seed/course11/600/400', badge: { label: 'Đề xuất' },
        socialProof: '🔥 95% sinh viên PTIT hoàn thành', duration: '32h', exercises: 15, hasCertificate: true, rating: 4.9, isFree: true,
    },
    {
        id: 12, title: 'Kỹ xảo chuyển cảnh mượt mà trong Premiere', instructor: 'Phạm Thu Hà', category: 'Video Editing',
        thumbnail: 'https://picsum.photos/seed/course12/600/400',
        socialProof: '⭐ 4.8 (800 đánh giá)', duration: '14h', exercises: 6, hasCertificate: false, rating: 4.8, isFree: false,
    },
    {
        id: 13, title: 'After Effects — Motion Graphics Căn bản', instructor: 'Lê Hoàng Phúc', category: 'Video Editing',
        thumbnail: 'https://picsum.photos/seed/course13/600/400', badge: { label: 'Đề xuất' },
        socialProof: '🔥 80% sinh viên PTIT hoàn thành', duration: '22h', exercises: 12, hasCertificate: true, rating: 4.8, isFree: true,
    },
    {
        id: 14, title: 'VFX Cơ bản với After Effects', instructor: 'Nguyễn Văn An', category: 'Video Editing',
        thumbnail: 'https://picsum.photos/seed/course14/600/400',
        socialProof: '⭐ 4.7 (1.5k đánh giá)', duration: '26h', exercises: 14, hasCertificate: true, rating: 4.7, isFree: false,
    },
    {
        id: 15, title: 'Color Grading Nâng Cao (DaVinci Resolve)', instructor: 'Minh Tuấn', category: 'Video Editing',
        thumbnail: 'https://picsum.photos/seed/course15/600/400', badge: { label: 'Hot' },
        socialProof: '🔥 85% sinh viên hoàn thành', duration: '18h', exercises: 8, hasCertificate: true, rating: 4.9, isFree: false,
    },
    {
        id: 16, title: 'Short-form Video Edit (TikTok/Reels)', instructor: 'Linh Chi', category: 'Video Editing',
        thumbnail: 'https://picsum.photos/seed/course16/600/400',
        socialProof: '⭐ 4.9 (3.2k đánh giá)', duration: '8h', exercises: 4, hasCertificate: false, rating: 4.9, isFree: true,
    },

    // 🖌️ Graphic Design (PTS/AI)
    {
        id: 17, title: 'Photoshop Manipulation Nâng cao', instructor: 'Vũ Thị Lan', category: 'Graphic Design',
        thumbnail: 'https://picsum.photos/seed/course17/600/400', badge: { label: 'Hot' },
        socialProof: '🔥 88% sinh viên PTIT hoàn thành', duration: '20h', exercises: 10, hasCertificate: true, rating: 4.9, isFree: false,
    },
    {
        id: 18, title: 'Digital Painting cơ bản với Photoshop', instructor: 'Nguyễn Thanh Tùng', category: 'Graphic Design',
        thumbnail: 'https://picsum.photos/seed/course18/600/400',
        socialProof: '⭐ 4.7 (2.1k đánh giá)', duration: '16h', exercises: 8, hasCertificate: true, rating: 4.7, isFree: true,
    },
    {
        id: 19, title: 'Illustrator: Logo & Branding Design', instructor: 'Trần Khoa', category: 'Graphic Design',
        thumbnail: 'https://picsum.photos/seed/course19/600/400',
        socialProof: '🔥 75% sinh viên PTIT hoàn thành', duration: '24h', exercises: 12, hasCertificate: true, rating: 4.8, isFree: false,
    },
    {
        id: 20, title: 'Typography Layout Thực Chiến', instructor: 'Lê Phúc', category: 'Graphic Design',
        thumbnail: 'https://picsum.photos/seed/course20/600/400',
        socialProof: '⭐ 4.6 (500 đánh giá)', duration: '10h', exercises: 5, hasCertificate: false, rating: 4.6, isFree: true,
    },
    {
        id: 21, title: 'Bao bì Sản phẩm (Packaging Design)', instructor: 'Ngọc Hân', category: 'Graphic Design',
        thumbnail: 'https://picsum.photos/seed/course21/600/400', badge: { label: 'Mới' },
        socialProof: '🔥 300+ sinh viên đăng ký', duration: '18h', exercises: 9, hasCertificate: true, rating: 4.8, isFree: false,
    },

    // 💻 Programming & Development
    {
        id: 22, title: 'React & TypeScript — Fullstack PTIT 2025', instructor: 'Hoàng Đức Mạnh', category: 'Programming',
        thumbnail: 'https://picsum.photos/seed/course22/600/400', badge: { label: 'Đề xuất' },
        socialProof: '🔥 98% sinh viên PTIT hoàn thành', duration: '48h', exercises: 30, hasCertificate: true, rating: 4.9, isFree: false,
    },
    {
        id: 23, title: 'Python cho Data Science & AI', instructor: 'Nguyễn Thanh Tùng', category: 'Programming',
        thumbnail: 'https://picsum.photos/seed/course23/600/400',
        socialProof: '⭐ 4.8 (3.7k đánh giá)', duration: '40h', exercises: 25, hasCertificate: true, rating: 4.8, isFree: true,
    },
    {
        id: 24, title: 'Node.js Backend Architecture', instructor: 'Vũ Dũng', category: 'Programming',
        thumbnail: 'https://picsum.photos/seed/course24/600/400',
        socialProof: '🔥 82% sinh viên hoàn thành', duration: '35h', exercises: 20, hasCertificate: true, rating: 4.7, isFree: false,
    },
    {
        id: 25, title: 'Giải thuật & Cấu trúc dữ liệu (C++)', instructor: 'Lê Tuấn', category: 'Programming',
        thumbnail: 'https://picsum.photos/seed/course25/600/400', badge: { label: 'Cơ bản' },
        socialProof: '⭐ 4.9 (5k+ đánh giá)', duration: '60h', exercises: 50, hasCertificate: true, rating: 4.9, isFree: true,
    },
    {
        id: 26, title: 'Next.js 14 App Router Thực chiến', instructor: 'Mạnh Cường', category: 'Programming',
        thumbnail: 'https://picsum.photos/seed/course26/600/400', badge: { label: 'Hot' },
        socialProof: '🔥 90% sinh viên hoàn thành', duration: '28h', exercises: 14, hasCertificate: true, rating: 4.9, isFree: false,
    },
]

// Category Layout Definition
const categoryGroups = [
    { id: 'UI/UX Design', title: '🎨 UI/UX Design' },
    { id: 'Video Editing', title: '🎬 Video Editing (Premiere/AE)' },
    { id: '3D Modeling', title: '🧊 3D Modeling' },
    { id: 'Graphic Design', title: '🖌️ Graphic Design (PTS/AI)' },
    { id: 'Programming', title: '💻 Programming & Development' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function CourseModal({ course, onClose }: { course: Course; onClose: () => void }) {
    const navigate = useNavigate()
    
    // Premium lessons mock
    const premiumLessons = [
        { id: 1, title: 'Bí mật thiết kế chuyên sâu & Tối ưu luồng', price: 199000 },
        { id: 2, title: 'Phân tích dự án thực tế doanh nghiệp', price: 299000 },
        { id: 3, title: 'Quyền lợi Support 1-1 với Mentor', price: 500000 },
    ]
    const [selectedPremiums, setSelectedPremiums] = useState<number[]>([])
    const [isSaved, setIsSaved] = useState(false)

    const togglePremium = (id: number) => {
        setSelectedPremiums(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
    }

    const totalPrice = selectedPremiums.reduce((sum, id) => {
        const lesson = premiumLessons.find(l => l.id === id)
        return sum + (lesson ? lesson.price : 0)
    }, 0)

    const hasPremium = selectedPremiums.length > 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-5xl bg-card rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-2 flex-1 overflow-hidden">
                    
                    {/* Left Column: Detailed Course Info */}
                    <div className="flex flex-col border-r border-border bg-muted overflow-y-auto">
                        <div className="h-72 relative shrink-0">
                            <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent" />
                            
                            <button 
                                onClick={() => setIsSaved(!isSaved)}
                                className={`absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-md transition-all ${isSaved ? 'bg-brand-500/90 text-ink-foreground shadow-lg' : 'bg-ink/30 border border-ink-foreground/20 text-ink-foreground hover:bg-ink/50'}`}
                                title={isSaved ? "Bỏ lưu khóa học" : "Lưu khóa học"}
                            >
                                <Bookmark size={18} className={isSaved ? "fill-ink-foreground" : ""} />
                            </button>

                            <div className="absolute bottom-8 left-8 right-8">
                                <span className="inline-block px-3 py-1 mb-3 bg-ink-foreground/20 backdrop-blur border border-ink-foreground/20 text-ink-foreground text-[11px] font-bold uppercase tracking-widest rounded-full">
                                    {course.category}
                                </span>
                                <h2 className="text-2xl font-bold text-ink-foreground leading-tight mb-2">{course.title}</h2>
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    Giảng viên: <span className="text-ink-foreground font-semibold">{course.instructor}</span>
                                    <span className="w-1 h-1 bg-muted-foreground/50 rounded-full"></span>
                                    <span className="text-warning font-bold">{course.socialProof}</span>
                                </p>
                            </div>
                        </div>
                        
                        <div className="p-8">
                            <h3 className="text-base font-bold text-foreground mb-3">Về khóa học này</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                                Khóa học được thiết kế chuyên sâu giúp bạn nắm vững toàn bộ kiến thức từ cơ bản đến nâng cao. 
                                Hoàn thành khóa học, bạn sẽ có khả năng làm việc độc lập và xử lý các dự án thực tế với sự tự tin tuyệt đối.
                            </p>
                            
                            <h3 className="text-base font-bold text-foreground mb-4">Bạn sẽ học được gì?</h3>
                            <div className="space-y-4">
                                {[
                                    'Nắm vững nền tảng và nguyên lý cốt lõi',
                                    'Thực hành trực tiếp trên các Case Study thực tế',
                                    'Kỹ năng tối ưu hóa quy trình làm việc (Workflow)',
                                    'Xây dựng Portfolio chuyên nghiệp'
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
                                        <span className="text-sm text-muted-foreground font-medium">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Interactive Learning Path & Upsell */}
                    <div className="flex flex-col relative bg-card">
                        <button 
                            onClick={onClose} 
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-muted hover:bg-muted-foreground/20 rounded-full text-muted-foreground transition-colors z-10"
                        >
                            <X size={18} />
                        </button>
                        
                        <div className="p-8 flex-1 overflow-y-auto">
                            <h3 className="text-xl font-bold text-foreground tracking-tight mb-8">Lộ trình học tập</h3>
                            
                            <div className="space-y-6">
                                {/* Free Lessons */}
                                <div className="space-y-3">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Nội dung cơ bản (Miễn phí)</h4>
                                    {[
                                        'Giới thiệu tổng quan & Cài đặt môi trường',
                                        'Nguyên lý cơ bản cần nắm vững',
                                        'Thực hành dự án nhỏ đầu tay'
                                    ].map((title, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-4 rounded-xl border border-brand-100 bg-brand-50/40">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 rounded border-brand-200 text-brand-500 focus:ring-brand-500 bg-card" 
                                                checked={true}
                                                readOnly 
                                            />
                                            <span className="text-sm font-bold text-foreground flex-1">{title}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Premium Lessons */}
                                <div className="space-y-3 pt-2">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Nội dung chuyên sâu (Nâng cao)</h4>
                                    {premiumLessons.map((lesson) => (
                                        <div 
                                            key={lesson.id} 
                                            className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                                                selectedPremiums.includes(lesson.id) 
                                                ? 'border-brand-400 bg-brand-50' 
                                                : 'border-border bg-card hover:border-muted-foreground/40 shadow-sm hover:shadow-md'
                                            }`}
                                            onClick={() => togglePremium(lesson.id)}
                                        >
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 rounded border-border text-brand-500 focus:ring-brand-500 pointer-events-none" 
                                                checked={selectedPremiums.includes(lesson.id)}
                                                readOnly
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-sm font-semibold block ${selectedPremiums.includes(lesson.id) ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {lesson.title}
                                                </span>
                                            </div>
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md shrink-0 transition-colors ${selectedPremiums.includes(lesson.id) ? 'bg-brand-100 text-brand-ink' : 'bg-muted text-muted-foreground'}`}>
                                                <Lock size={12} className="opacity-70" />
                                                <span className="text-xs font-bold">{lesson.price.toLocaleString()}đ</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* CTA Footer */}
                        <div className="p-6 border-t border-border bg-card shrink-0">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={onClose}
                                    className="px-6 py-4 rounded-xl font-bold text-sm text-muted-foreground bg-muted hover:bg-muted-foreground/20 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={() => setIsSaved(!isSaved)}
                                    className={`flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-sm transition-colors ${isSaved ? 'text-brand-ink bg-brand-100' : 'text-muted-foreground bg-muted hover:bg-muted-foreground/20'}`}
                                >
                                    <Bookmark size={18} className={isSaved ? "fill-current" : ""} />
                                    <span className="hidden sm:inline">{isSaved ? 'Đã lưu' : 'Lưu để sau'}</span>
                                </button>
                                <button 
                                    className={`flex-1 py-4 rounded-xl font-bold text-sm text-ink-foreground shadow-lg transition-all duration-300 flex justify-center items-center gap-2 ${
                                        hasPremium 
                                        ? 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/30 scale-[1.02]' 
                                        : 'bg-ink hover:bg-ink/90 shadow-ink/20 hover:-translate-y-0.5'
                                    }`}
                                    onClick={() => {
                                        onClose();
                                        navigate('/lesson');
                                    }}
                                >
                                    {hasPremium ? (
                                        <>Đến trang thanh toán - {totalPrice.toLocaleString()}đ <ChevronRight size={16} /></>
                                    ) : (
                                        <>Xác nhận & Bắt đầu học (Free) <ChevronRight size={16} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

function CourseCard3D({ course, onClick }: { course: Course; onClick: () => void }) {
    return (
        <div 
            className="group relative w-full aspect-[3/4] min-h-[260px] perspective-[1500px] cursor-pointer"
            onClick={onClick}
        >
            <div className="relative w-full h-full transition-transform duration-base ease-out [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                
                {/* ── Front Face ── */}
                <div className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden shadow-sm border border-border/50 [backface-visibility:hidden]">
                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent" />
                    
                    {/* Salience Badge (Brand Red) */}
                    {course.badge && (
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-brand-500 to-brand-500 text-ink-foreground text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
                            {course.badge.label}
                        </div>
                    )}
                    
                    <div className="absolute bottom-4 left-4 right-4">
                        <span className="text-[9px] font-bold text-brand-ink uppercase tracking-widest mb-1.5 block">{course.category}</span>
                        <h3 className="text-[15px] font-bold text-ink-foreground leading-snug line-clamp-2">{course.title}</h3>
                    </div>
                </div>

                {/* ── Back Face ── */}
                <div className="absolute inset-0 w-full h-full rounded-2xl bg-card border border-border shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)] p-4 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-foreground text-[13px] leading-snug line-clamp-2">{course.title}</h3>
                        <p className="text-[10px] text-muted-foreground mt-1">bởi {course.instructor}</p>
                        
                        <div className="mt-3 p-2 bg-brand-50/80 rounded-lg border border-brand-100/50">
                            <p className="text-[10px] font-semibold text-brand-ink text-center">{course.socialProof}</p>
                        </div>
                    </div>

                    <div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="flex flex-col items-center justify-center py-2 bg-muted rounded-lg">
                                <Clock size={12} className="text-muted-foreground mb-1" />
                                <span className="text-[9px] font-bold text-muted-foreground">{course.duration}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center py-2 bg-muted rounded-lg">
                                <BookOpen size={12} className="text-muted-foreground mb-1" />
                                <span className="text-[9px] font-bold text-muted-foreground">{course.exercises} bài</span>
                            </div>
                        </div>

                        <button className="w-full py-2 bg-brand-600 text-ink-foreground text-[11px] font-bold rounded-lg hover:bg-brand-700 transition-colors">
                            Xem chi tiết
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function EnrolledSidebar() {
    const navigate = useNavigate()
    
    return (
        // Seamless Blended Sidebar
        <aside className="group/sidebar relative w-20 hover:w-[380px] transition-all duration-300 ease-in-out bg-transparent border-r-0 sticky top-4 self-start max-h-[calc(100svh-2rem)] overflow-hidden shrink-0 hidden md:flex flex-col z-20">
            <div className="p-6 flex items-center gap-4 w-[380px]">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <TrendingUp size={16} className="text-brand-ink" />
                </div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-widest whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 delay-100">
                    Lộ trình đang học
                </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 w-[380px] scrollbar-hide">
                {enrolledCourses.map(course => (
                    <div 
                        key={course.id} 
                        className="hover:bg-muted rounded-lg p-2 transition-colors flex gap-4 items-center cursor-pointer group/item"
                        onClick={() => navigate('/lesson')}
                    >
                        {/* Sleek Minimalist Dot */}
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            <div className="w-2 h-2 rounded-full bg-brand-500 shadow-sm"></div>
                        </div>

                        {/* Expanded Content (Only visible on sidebar hover) */}
                        <div className="flex-1 min-w-0 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 delay-100 py-1">
                            <h3 className="text-sm font-semibold text-foreground line-clamp-1">{course.title}</h3>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 bg-brand-500"
                                        style={{ width: `${course.progress}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0 font-medium">{course.progress}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function OrbitLearningView() {
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
    
    // Split courses for visual hierarchy
    const recommendedCourses = mockCourses.filter(c => c.badge?.label === 'Đề xuất')

    return (
        <div className="relative z-0 flex w-full bg-transparent">
            
            {/* ── Collapsible Hover Sidebar (My Learning) ── */}
            <EnrolledSidebar />
            
            {/* ── Main Content Area (Explore) ── */}
            <main className="relative z-10 min-w-0 flex-1 px-6 py-10 lg:px-[var(--gutter)]">
                <div className="max-w-[1440px] mx-auto">
                    
                    {/* Header */}
                    <div className="mb-10">
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">Khám phá khóa học</h1>
                        <p className="mt-2 text-muted-foreground">Nâng cao kỹ năng với các lộ trình chuyên sâu được thiết kế bài bản.</p>
                    </div>

                    {/* Section: Personalized Recommendations */}
                    {recommendedCourses.length > 0 && (
                        <section className="mb-14">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-2xl drop-shadow-md">🔥</span>
                                <h2 className="text-xl font-bold text-foreground tracking-tight">Đề xuất riêng cho bạn</h2>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                                {recommendedCourses.map(course => (
                                    <CourseCard3D key={course.id} course={course} onClick={() => setSelectedCourse(course)} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Section: Distinct Categories */}
                    <div className="flex flex-col pb-24">
                        {categoryGroups.map(group => {
                            const coursesInCategory = mockCourses.filter(c => c.category === group.id && c.badge?.label !== 'Đề xuất')
                            if (coursesInCategory.length === 0) return null
                            
                            return (
                                <div key={group.id} className="w-full flex flex-col mb-14">
                                    {/* Prominent Category Header */}
                                    <h2 className="text-xl font-bold text-foreground mb-6 block relative z-10">
                                        {group.title}
                                    </h2>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-8 relative z-0">
                                        {coursesInCategory.map(course => (
                                            <CourseCard3D key={course.id} course={course} onClick={() => setSelectedCourse(course)} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                </div>
            </main>

            {/* ── Commitment Modal ── */}
            {selectedCourse && (
                <CourseModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
            )}
        </div>
    )
}
