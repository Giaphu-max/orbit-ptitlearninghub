import { lazy, Suspense, useState } from 'react'
import { Moon, Sunset } from 'lucide-react'

// Phần 3D tải riêng (three.js + R3F nặng), chỉ kéo về khi hero được dựng.
const CampusScene = lazy(() => import('./campus-scene'))

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Máy yếu hoặc không có WebGL thì dùng ảnh tĩnh thay cho cảnh 3D. */
function canRender3D() {
    try {
        const nav = navigator as Navigator & { deviceMemory?: number }
        if ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2) return false
        const cv = document.createElement('canvas')
        return Boolean(cv.getContext('webgl2') || cv.getContext('webgl'))
    } catch {
        return false
    }
}

/** Ảnh tĩnh khuôn viên (SVG nhẹ) khi không chạy được 3D. */
function StaticCampus() {
    return (
        <svg viewBox="0 0 480 300" role="img" aria-label="Khuôn viên PTIT" className="h-full w-full">
            <rect x="30" y="220" width="420" height="30" rx="6" fill="#8E0E13" />
            <rect x="30" y="212" width="420" height="14" rx="4" fill="#EFE7E1" />
            <rect x="60" y="150" width="80" height="62" fill="#F7F4EF" />
            <path d="M52 150l48-30 48 30z" fill="#C23A2C" />
            <rect x="150" y="40" width="70" height="172" fill="#F4EEE4" />
            <rect x="178" y="60" width="14" height="150" fill="#2E8C70" />
            <path d="M158 40l27-22 27 22z" fill="#C23A2C" />
            <circle cx="185" cy="46" r="7" fill="#fff" />
            <rect x="240" y="152" width="170" height="60" fill="#EFC86E" />
            <path d="M232 152l93-34 93 34z" fill="#C23A2C" />
            <rect x="420" y="190" width="6" height="22" fill="#7A5544" />
            <circle cx="423" cy="184" r="14" fill="#5E9E6A" />
        </svg>
    )
}

/** Sân khấu 3D của hero: cảnh khuôn viên + nút đổi hoàng hôn/buổi tối. */
export function CampusHero() {
    const [night, setNight] = useState(false)
    const [enabled] = useState(canRender3D)
    const [reduce] = useState(prefersReducedMotion)

    return (
        <div className="relative h-full w-full">
            <div className="absolute inset-0">
                {enabled ? (
                    <Suspense fallback={<div className="h-full w-full animate-pulse rounded-panel bg-white/5" aria-hidden />}>
                        <CampusScene night={night} reduce={reduce} />
                    </Suspense>
                ) : (
                    <StaticCampus />
                )}
            </div>
            {enabled && (
                <div className="absolute bottom-3 right-3 z-30 flex gap-2" role="group" aria-label="Thời điểm trong ngày">
                    <TimeButton pressed={!night} onClick={() => setNight(false)} icon={<Sunset size={15} />}>Hoàng hôn</TimeButton>
                    <TimeButton pressed={night} onClick={() => setNight(true)} icon={<Moon size={15} />}>Buổi tối</TimeButton>
                </div>
            )}
        </div>
    )
}

function TimeButton({ pressed, onClick, icon, children }: { pressed: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                pressed ? 'border-white bg-white text-brand-600' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
            }`}
        >
            {icon}
            {children}
        </button>
    )
}
