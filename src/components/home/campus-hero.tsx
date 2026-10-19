import { lazy, Suspense, useState } from 'react'
import { CAMPUS } from './campus-palette'
import { useThemeStore } from '@/store/useThemeStore'

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
            <rect x="30" y="220" width="420" height="30" rx="6" fill={CAMPUS.plateEdge} />
            <rect x="30" y="212" width="420" height="14" rx="4" fill={CAMPUS.plate} />
            <rect x="60" y="150" width="80" height="62" fill={CAMPUS.white} />
            <path d="M52 150l48-30 48 30z" fill={CAMPUS.roofRed} />
            <rect x="150" y="40" width="70" height="172" fill={CAMPUS.cream} />
            <rect x="178" y="60" width="14" height="150" fill={CAMPUS.glass} />
            <path d="M158 40l27-22 27 22z" fill={CAMPUS.roofRed} />
            <circle cx="185" cy="46" r="7" fill={CAMPUS.white} />
            <rect x="240" y="152" width="170" height="60" fill={CAMPUS.yellow} />
            <path d="M232 152l93-34 93 34z" fill={CAMPUS.roofRed} />
            <rect x="420" y="190" width="6" height="22" fill={CAMPUS.trunk} />
            <circle cx="423" cy="184" r="14" fill={CAMPUS.tree} />
        </svg>
    )
}

/** Sân khấu 3D của hero: cảnh khuôn viên đổi hoàng hôn ↔ buổi tối theo giao diện của cả web. */
export function CampusHero() {
    const night = useThemeStore((s) => s.theme === 'dark')
    const [enabled] = useState(canRender3D)
    const [reduce] = useState(prefersReducedMotion)

    return (
        <div className="relative h-full w-full">
            <div className="absolute inset-0">
                {enabled ? (
                    <Suspense fallback={<div className="h-full w-full animate-pulse rounded-panel bg-ink-foreground/5" aria-hidden />}>
                        <CampusScene night={night} reduce={reduce} />
                    </Suspense>
                ) : (
                    <div className="absolute inset-x-4 bottom-4 top-[45%] lg:left-[40%] lg:top-8">
                        <StaticCampus />
                    </div>
                )}
            </div>
        </div>
    )
}
