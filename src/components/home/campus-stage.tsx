import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { KioskBridge } from './kiosk-screen'
import { CAMPUS } from './campus-palette'
import { useThemeStore } from '@/store/useThemeStore'
import type { DailyLit } from '@/lib/daily-lit'
import { introDone, introMark, introPlaying } from '@/lib/role-intro'
import { loadCampusStill } from '@/lib/campus-still'
import { getShot } from '@/lib/campus-shot'
import stillMetaJson from '@/data/campus-still-meta.json'

/** Hình chữ nhật bao của thân hero trong campus-still.webp (px ảnh), ghi bởi ?campussnap; null khi chưa chụp */
const stillMeta = stillMetaJson as { w: number; h: number; body: { x0: number; y0: number; x1: number; y1: number } } | null

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
    dailyLit: React.MutableRefObject<DailyLit>
    /** Màn kiosk (DOM) mà cảnh 3D định vị mỗi khung hình */
    kiosk: KioskBridge
}

/**
 * Sân khấu 3D dùng chung cho cả trang chủ: một Canvas cố định phía sau nội dung, đổi hoàng hôn ↔ buổi tối theo giao diện của web.
 * Màn hẹp: sân khấu nằm trên cùng (cao 44svh) và nội dung trượt bên dưới nó.
 * Nền (gradient trời từ token --sky-*, kem ấm ban ngày / xanh đêm buổi tối) luôn có sẵn bên dưới để lúc tải hoặc khi không có WebGL trang vẫn đúng tông.
 */
export function CampusStage({ stage, staticMode, reduce, flat, dailyLit, kiosk }: CampusStageProps) {
    const night = useThemeStore((s) => s.theme === 'dark')
    const [enabled] = useState(canRender3D)
    // Mở trang lúc intro đang chạy: chưa dựng Canvas R3F, hiện ảnh tĩnh chụp từ chính cảnh 3D; intro xong (lúc rảnh) mới dựng Canvas,
    // và chỉ crossfade 600ms sau khi R3F đã render khung đầu tiên
    const deferred = useRef(introPlaying())
    const [step, setStep] = useState<'wait' | 'mounted' | 'ready'>(() => (deferred.current ? 'wait' : 'ready'))
    const [stillGone, setStillGone] = useState(!deferred.current)
    // Nguồn ảnh thay cảnh 3D: ảnh chụp lúc chạy (khớp từng pixel) > ảnh tĩnh đặt theo phép căn của camera > SVG minh họa
    const [still, setStill] = useState<{ src: string; style: React.CSSProperties } | null>(null)
    // Đọc kiosk/staticMode qua ref: effect chỉ chạy một lần lúc mount (kiosk có thể đổi danh tính mỗi lần render)
    const live = useRef({ kiosk, staticMode })
    live.current = { kiosk, staticMode }
    useEffect(() => {
        if (!deferred.current) return
        let alive = true
        void (async () => {
            let place: { src: string; style: React.CSSProperties } | null = null
            try {
                // Chunk cảnh 3D đã được bindIntro tải sẵn; nếu vẫn chưa xong sau 800ms thì không chờ (trang đích không bị giữ lại vì ảnh)
                const [img, scene] = await Promise.all([Promise.race([loadCampusStill(), new Promise<null>((r) => setTimeout(() => r(null), 800))]), Promise.race([import('./campus-scene'), new Promise<null>((r) => setTimeout(() => r(null), 800))])])
                const { kiosk: kk, staticMode: sm } = live.current
                const stg = kk.stage.current
                const w = stg?.clientWidth ?? window.innerWidth
                const h = stg?.clientHeight ?? window.innerHeight
                // Đo cân bố cục như lúc 3D thật mount (không thì tỉ lệ khung thân đổi khi mount và mô hình dịch chỗ)
                if (scene && !sm) scene.primeHeroBalance(w, h)
                const shot = getShot()
                if (shot) {
                    place = { src: shot, style: { left: 0, top: 0, width: '100%', height: '100%', objectFit: 'fill' } }
                } else if (scene && img && !sm && stillMeta) {
                    const r = scene.heroStillRect(w, h)
                    if (r) {
                        const k = (r.y1 - r.y0) / (stillMeta.body.y1 - stillMeta.body.y0)
                        place = { src: img.src, style: { left: r.x0 - stillMeta.body.x0 * k, top: r.y0 - stillMeta.body.y0 * k, width: stillMeta.w * k, height: stillMeta.h * k } }
                    }
                }
                if (place) {
                    const probe = new Image()
                    probe.src = place.src
                    await Promise.race([probe.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 800))])
                }
            } catch {
                place = null
            }
            if (!alive) return
            setStill(place)
            // Báo trang đã sẵn sàng cho intro: ảnh thay thế đã decode và nội dung đã được vẽ ra (2 khung sau lần render này)
            requestAnimationFrame(() => requestAnimationFrame(() => alive && window.dispatchEvent(new Event('orbit:page-ready'))))
        })()
        return () => {
            alive = false
        }
    }, [])
    useEffect(() => {
        if (step !== 'wait') return
        let alive = true
        void introDone().then(() => {
            const go = () => {
                if (!alive) return
                introMark('mount canvas 3D')
                setStep('mounted')
            }
            const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
            if (ric) ric(go, { timeout: 500 })
            else window.setTimeout(go, 200)
        })
        return () => {
            alive = false
        }
    }, [step])
    // Chốt chặn: nếu cảnh 3D không báo khung đầu trong 2,5s thì vẫn crossfade (không để ảnh tĩnh che mãi)
    useEffect(() => {
        if (step !== 'mounted') return
        const t = window.setTimeout(() => setStep('ready'), 2500)
        return () => clearTimeout(t)
    }, [step])
    useEffect(() => {
        if (step !== 'ready' || !deferred.current) return
        const t = window.setTimeout(() => setStillGone(true), 640)
        return () => clearTimeout(t)
    }, [step])
    const onReady = useCallback(() => {
        introMark('khung 3D đầu tiên')
        setStep('ready')
    }, [])
    const fadeStyle = deferred.current ? { opacity: step === 'ready' ? 1 : 0, transition: 'opacity 600ms ease' } : undefined
    const stillFade: React.CSSProperties | undefined = deferred.current ? { opacity: step === 'ready' ? 0 : 1, transition: 'opacity 600ms ease' } : undefined
    const stillBlock = deferred.current && still ? (
        <img src={still.src} alt="" aria-hidden draggable={false} className="absolute select-none" style={{ ...still.style, ...stillFade }} />
    ) : (
        <div className={`absolute ${staticMode ? 'inset-x-4 bottom-4 top-[20%]' : 'inset-y-[20%] left-[40%] right-[4%]'}`} style={stillFade}>
            <StaticCampus />
        </div>
    )

    return (
        <div id="home-stage" ref={kiosk.stage} aria-hidden={!enabled} className={`stage-sky own-layer pointer-events-none fixed left-0 top-0 w-full ${staticMode ? 'z-20 h-[44svh] border-b border-border shadow-raised' : 'z-0 h-[100svh]'}`}>
            <div className="pointer-events-auto absolute inset-0">
                {enabled ? (
                    <>
                        {step !== 'wait' && (
                            <div className="absolute inset-0" style={fadeStyle}>
                                <Suspense fallback={null}>
                                    <CampusScene night={night} reduce={reduce} staticMode={staticMode} flat={flat} stage={stage} dailyLit={dailyLit} kiosk={kiosk} onReady={onReady} />
                                </Suspense>
                            </div>
                        )}
                        {!stillGone && stillBlock}
                    </>
                ) : (
                    stillBlock
                )}
            </div>
        </div>
    )
}
