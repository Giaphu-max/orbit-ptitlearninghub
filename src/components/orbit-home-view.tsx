import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

// Tạm thời: trang chủ 3 tầng (hero 3D → Orbit Daily → dải tiến độ) sẽ dựng lại theo mockup.
export function OrbitHomeView() {
    return (
        <div className="flex-1 overflow-y-auto px-6 py-16 lg:px-12">
            <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Orbit · PTIT Learning Hub</p>
                <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] tracking-tight text-gray-900">
                    Học tập trung, có điểm dừng.
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-gray-600">
                    Trang chủ đang được dựng lại. Trong lúc chờ, bạn có thể vào danh sách khóa học hoặc mở thử trang học bài.
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                    <Link
                        to="/learning"
                        className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                        Xem khóa học <ArrowRight size={16} />
                    </Link>
                    <Link
                        to="/lesson"
                        className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-6 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-200"
                    >
                        Mở trang học bài
                    </Link>
                </div>
            </div>
        </div>
    )
}
