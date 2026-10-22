import { lazy, Suspense, useState } from 'react'
import type { KioskBridge } from './kiosk-screen'
import { CAMPUS } from './campus-palette'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/useThemeStore'

// Phần 3D tải riêng (three.js + R3F nặng), chỉ kéo về khi hero được dựng.
const CampusScene = lazy(() => import('./campus-scene'))

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

interface CampusStageProps {
    /** S liên tục 0..3 từ useScrollStage */
    stage: React.MutableRefObject<number>
    /** Màn hẹp / giảm chuyển động: không chuyển cảnh, canvas cao 44svh phía trên */
    staticMode: boolean
    reduce: boolean
    /** Không bay máy quay (giảm chuyển động): mọi chương dùng khung chính diện A2 */
    flat: boolean
    dailyLit: React.MutableRefObject<boolean[]>
    /** Màn kiosk (DOM) mà cảnh 3D định vị mỗi khung hình */
    kiosk: KioskBridge
    coursePct: Readonly<Record<string, number>>
}

/**
 * Sân khấu 3D dùng chung cho cả trang chủ: một Canvas cố định phía sau nội dung, đổi hoàng hôn ↔ buổi tối theo giao diện của web.
 * Màn hẹp: sân khấu nằm trên cùng (cao 44svh) và nội dung trượt bên dưới nó.
 * Nền (gradient trời từ token --sky-*, kem ấm ban ngày / xanh đêm buổi tối) luôn có sẵn bên dưới để lúc tải hoặc khi không có WebGL trang vẫn đúng tông.
 */
export function CampusStage({ stage, staticMode, reduce, flat, dailyLit, kiosk, coursePct }: CampusStageProps) {
    const navigate = useNavigate()
    const night = useThemeStore((s) => s.theme === 'dark')
    const [enabled] = useState(canRender3D)

    return (
        <div id="home-stage" ref={kiosk.stage} aria-hidden={!enabled} className={`stage-sky pointer-events-none fixed left-0 top-0 w-full ${staticMode ? 'z-20 h-[44svh] border-b border-border shadow-raised' : 'z-0 h-[100svh]'}`}>
            {/* Lớp màu nền mờ khi có chữ trên màn / chế độ làm mờ (thay filter trên canvas) */}
            <div ref={kiosk.dim} aria-hidden className="stage-dim pointer-events-none absolute inset-0 z-[1]" />
            <div className="pointer-events-auto absolute inset-0">
                {enabled ? (
                    <Suspense fallback={null}>
                        <CampusScene night={night} reduce={reduce} staticMode={staticMode} flat={flat} stage={stage} dailyLit={dailyLit} kiosk={kiosk} coursePct={coursePct} onOpenCourse={(id) => navigate(`/learning?course=${id}`)} />
                    </Suspense>
                ) : (
                    <div className={`absolute ${staticMode ? 'inset-x-4 bottom-4 top-[20%]' : 'inset-y-[20%] left-[40%] right-[4%]'}`}>
                        <StaticCampus />
                    </div>
                )}
            </div>
        </div>
    )
}
