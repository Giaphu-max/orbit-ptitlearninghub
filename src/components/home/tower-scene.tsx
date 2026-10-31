import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { applyGlassEnv, Campus, DPR_MAX } from './campus-scene'
import { a2Point } from './campus-a2'
import { CAMPUS } from './campus-palette'
import { PERF_ON, PerfHud } from './campus-perf'
import { FLAGS } from '@/lib/perf'
import { addFrame } from '@/lib/frame-loop'
import { tower } from '@/lib/tower'
import { useThemeStore } from '@/store/useThemeStore'
import type { DailyLit } from '@/lib/daily-lit'

/**
 * Cảnh trang chủ 5 trang: DÙNG LẠI khuôn viên (Campus) và chỉ đổi kịch bản camera. Camera nội suy giữa 5 khung theo tower.p
 * (easeInOutCubic trên phần lẻ của p, p đã được làm mượt ở useTowerScroll), chuột nghiêng nhẹ. Canvas trong suốt: trời là lớp DOM phía sau,
 * chữ khổng lồ nằm giữa trời và canvas (trừ trang Ôn tập và Studio: chữ nằm trước canvas).
 * Số liệu máy quay đo theo bản mẫu docs/mockup/home/ptit-home-tower.html (tòa 27 đơn vị) rồi nhân K cho vừa tòa A2 thật (~17 đơn vị).
 */

const FOV = 48
/** Tỉ lệ bản mẫu → cảnh thật cho các khung cận (thân tòa A2 từ đất tới mái ≈ 17,1 / 26,9) */
const K = 0.64
/** Trục tòa A2 trên mặt đất */
const AXIS = a2Point(0, 0, -0.7)

type V3 = [number, number, number]
interface Key {
    cam: THREE.Vector3
    tg: THREE.Vector3
    /** Dịch khung hình theo bề ngang (đơn vị chiều rộng): dương đẩy mô hình sang trái */
    off: number
    /** Dịch theo chiều cao (đơn vị chiều cao khung): dương đẩy mô hình xuống */
    offY: number
    dusk: number
}
/** Khung cận: tọa độ trong hệ bản mẫu (gốc ở chân tòa), nhân K */
const near = (cam: V3, tg: V3, off: number, dusk = 0, offY = 0): Key => ({
    cam: new THREE.Vector3(...cam).multiplyScalar(K).add(AXIS),
    tg: new THREE.Vector3(...tg).multiplyScalar(K).add(AXIS),
    off,
    offY,
    dusk,
})

// Khung 5 (kết): kéo ra xa cho TOÀN BỘ khuôn viên nhỏ giữa màn; hướng nhìn chéo như trang chủ cũ
const FAR_TARGET = new THREE.Vector3(0, 7, -1)
const FAR_DIR = new THREE.Vector3(60, 39, 84).normalize()
const KEYS: Key[] = [
    // 01 PTIT: góc từ dưới ngước lên, tòa A2 ở giữa hạ xuống vừa phải (offY) để chữ PTIT phía sau lộ ra: mái và đồng hồ nằm quanh giữa chiều cao chữ
    near([0, 1.2, 40], [0, 15.5, 0], 0, 0, 0.16),
    // 02 Học phần: góc thấp, tòa sát mép trái và bị cắt ~1/4
    near([-12, 1.5, 40], [0, 14.5, 0], 0.43),
    // 03 Ôn tập: nhìn từ trên cao xuống, mô hình nghiêng về góc phải
    near([22, 42, 34], [2, 6, 0], -0.26),
    // 04 Studio 3D: hoàng hôn, sát chân tòa ngước lên, tòa bên phải
    near([7, 0.4, 22], [0, 17, 0], -0.3, 1),
    // 05 Tiến độ: toàn cảnh
    { cam: FAR_TARGET.clone().addScaledVector(FAR_DIR, 110), tg: FAR_TARGET.clone(), off: 0, offY: 0.03, dusk: 0 },
]

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = THREE.MathUtils.lerp

// Ánh sáng: ban ngày (token CAMPUS) → hoàng hôn ấm (nắng cam, trời tím) → buổi tối của cảnh khi dusk = 1
const SUN_DAY = new THREE.Color(CAMPUS.sunlight)
const SUN_DUSK = new THREE.Color('#FF9A6B')
const HEMI_SKY_DAY = new THREE.Color(CAMPUS.skyLight)
const HEMI_SKY_DUSK = new THREE.Color('#9B86D6')
const HEMI_GROUND_DAY = new THREE.Color(CAMPUS.groundLight)
const HEMI_GROUND_DUSK = new THREE.Color('#5A4A7E')
const FOG_DAY = new THREE.Color('#EEF1F8')
const FOG_DUSK = new THREE.Color('#3A2F6B')

/** Cây gần camera ở trang Studio bị che khuất mô hình: thu nhỏ về 0 (mờ dần ~300ms) rồi ẩn */
const TREE_HIDE_DIST = 20
interface TreeRef {
    g: THREE.Object3D
    base: number
    cur: number
}

const _pos = new THREE.Vector3()
const _tg = new THREE.Vector3()

function World({ night, reduce, dailyLit }: { night: boolean; reduce: boolean; dailyLit: React.MutableRefObject<DailyLit> }) {
    const hemi = useRef<THREE.HemisphereLight>(null)
    const sun = useRef<THREE.DirectionalLight>(null)
    const registry = useRef(new Map<string, THREE.Group>())
    const nightRef = useRef(0)
    // Campus đọc "S" để mở cửa kính sảnh và bật hiệu ứng tầng đèn: ở trang chủ này luôn đứng ở S = 1 (cửa đóng, tầng đèn hoạt động)
    const stage = useRef(1)
    const gateOn = useRef(true)
    const frame = useRef(0)
    const trees = useRef<TreeRef[]>([])
    const mouse = useRef({ x: 0, y: 0 })
    const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
    const size = useThree((s) => s.size)
    const scene = useThree((s) => s.scene)
    const setDpr = useThree((s) => s.setDpr)
    const maxDpr = Math.min(DPR_MAX, window.devicePixelRatio || 1)

    useEffect(() => {
        scene.fog = new THREE.Fog(FOG_DAY, 170, 560)
        camera.fov = FOV
        camera.near = 0.3
        camera.far = 700
        camera.updateProjectionMatrix()
    }, [scene, camera])

    useFrame((state, delta) => {
        frame.current++
        const p = THREE.MathUtils.clamp(tower.p, 0, KEYS.length - 1)
        const i = Math.min(KEYS.length - 2, Math.floor(p))
        const f = easeInOutCubic(Math.min(1, p - i))
        const a = KEYS[i]
        const b = KEYS[i + 1]

        // Chuột nghiêng nhẹ camera (làm mượt, bỏ khi giảm chuyển động)
        const k = reduce ? 0 : 1 - Math.exp(-delta * 4)
        mouse.current.x += (tower.mx - mouse.current.x) * k
        mouse.current.y += (tower.my - mouse.current.y) * k
        _pos.lerpVectors(a.cam, b.cam, f)
        _tg.lerpVectors(a.tg, b.tg, f)
        _pos.x += mouse.current.x * 2.5 * K
        _pos.y -= mouse.current.y * 1.2 * K
        camera.position.copy(_pos)
        camera.lookAt(_tg)

        const off = lerp(a.off, b.off, f)
        const offY = lerp(a.offY, b.offY, f)
        const ox = off * size.width
        const oy = -offY * size.height
        if (!camera.view || Math.abs(camera.view.offsetX - ox) > 0.05 || Math.abs(camera.view.offsetY - oy) > 0.05 || camera.view.fullWidth !== size.width) {
            camera.setViewOffset(size.width, size.height, ox, oy, size.width, size.height)
        }
        camera.updateMatrixWorld()

        // Hoàng hôn theo tiến độ cuộn
        const d = lerp(a.dusk, b.dusk, f)
        nightRef.current = night ? Math.max(d, 1) : d
        const n = nightRef.current
        if (sun.current) {
            sun.current.intensity = lerp(1.15, 0.7, n) * Math.PI
            sun.current.color.copy(SUN_DAY).lerp(SUN_DUSK, n)
        }
        if (hemi.current) {
            hemi.current.intensity = lerp(0.5, 0.36, n) * Math.PI
            hemi.current.color.copy(HEMI_SKY_DAY).lerp(HEMI_SKY_DUSK, n)
            hemi.current.groundColor.copy(HEMI_GROUND_DAY).lerp(HEMI_GROUND_DUSK, n)
        }
        if (scene.fog) scene.fog.color.copy(FOG_DAY).lerp(FOG_DUSK, n)

        // Cây tiền cảnh (gom một lần vài khung đầu, sau khi cảnh dựng xong)
        if (!trees.current.length && frame.current < 60) {
            scene.traverse((o) => {
                const t = o.userData.tree as { base: number } | undefined
                if (t) trees.current.push({ g: o, base: t.base, cur: 1 })
            })
        }
        // Chỉ quanh trang Studio (p = 3): cây cách camera dưới TREE_HIDE_DIST bị ẩn, thu nhỏ mượt theo thời gian (300ms)
        const around = Math.abs(p - 3) < 0.55
        const k3 = reduce ? 1 : 1 - Math.exp(-delta / 0.1)
        let moved = false
        for (const t of trees.current) {
            const want = around && t.g.position.distanceTo(camera.position) < TREE_HIDE_DIST ? 0 : 1
            if (Math.abs(want - t.cur) < 0.002) continue
            t.cur += (want - t.cur) * k3
            if (Math.abs(want - t.cur) < 0.02) t.cur = want
            t.g.scale.setScalar(t.base * Math.max(t.cur, 0.001))
            t.g.visible = t.cur > 0.01
            moved = true
        }
        if (moved) state.gl.shadowMap.needsUpdate = true

        // Cổng trường nằm đúng đường nhìn ở các khung thấp: chỉ hiện ở khung từ trên cao và toàn cảnh
        const wantGate = (p > 1.5 && p < 2.5) || p > 3.5
        if (wantGate !== gateOn.current) {
            gateOn.current = wantGate
            const gate = registry.current.get('Cổng Học viện')
            if (gate) gate.visible = wantGate
            state.gl.shadowMap.needsUpdate = true
        }
        // Bóng tĩnh: chỉ vẽ lại vài khung đầu (ánh sáng không đổi hướng)
        if (frame.current < 10) state.gl.shadowMap.needsUpdate = true
    })

    return (
        <>
            <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} />
            {PERF_ON && <PerfHud />}
            <hemisphereLight ref={hemi} args={[CAMPUS.skyLight, CAMPUS.groundLight, 0.5 * Math.PI]} />
            <directionalLight
                ref={sun}
                color={CAMPUS.sunlight}
                intensity={1.15 * Math.PI}
                position={[-26, 38, 22]}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-32}
                shadow-camera-right={32}
                shadow-camera-top={32}
                shadow-camera-bottom={-32}
                shadow-camera-near={1}
                shadow-camera-far={120}
                shadow-bias={-0.0006}
                shadow-normalBias={0.04}
                shadow-radius={4}
            />
            <group>
                <Campus registry={registry} nightRef={nightRef} reduce={reduce} dailyLit={dailyLit} stage={stage} lowQuality={false} />
            </group>
        </>
    )
}

/**
 * Vẽ canvas trong vòng rAF chung (sau useTowerScroll): Canvas ở frameloop="never", ở đây gọi advance. Không vẽ khi tab ẩn hoặc màn chuyển giao diện che.
 * Khung ĐẦU TIÊN được vẽ thẳng ngay khi canvas có kích thước (không chờ vòng rAF, vốn tạm dừng lúc intro chạy): World đặt camera từ
 * tower.p hiện tại nên khung đầu là đúng camera trang 01 (hoặc trang đang cuộn tới), không nội suy từ camera mặc định.
 */
function Driver({ onReady }: { onReady?: () => void }) {
    const advance = useThree((s) => s.advance)
    const clock = useThree((s) => s.clock)
    const get = useThree((s) => s.get)
    useEffect(() => {
        let prev = 0
        let ready = false
        let timer = 0
        const first = () => {
            if (ready) return
            const { size } = get()
            if (size.width < 10 || size.height < 10) {
                timer = window.setTimeout(first, 40)
                return
            }
            ready = true
            advance(clock.elapsedTime + 0.016)
            onReady?.()
        }
        timer = window.setTimeout(first, 60)
        const off = addFrame((t) => {
            const dt = Math.min(prev ? (t - prev) / 1000 : 0.016, 0.1)
            prev = t
            if (document.hidden || useThemeStore.getState().frozen) return
            if (!ready) return first()
            advance(clock.elapsedTime + dt)
        }, 1)
        return () => {
            window.clearTimeout(timer)
            off()
        }
    }, [advance, clock, get, onReady])
    return null
}

export interface TowerSceneProps {
    reduce: boolean
    dailyLit: React.MutableRefObject<DailyLit>
    /** Gọi sau khung render đầu tiên (trang fade canvas vào) */
    onReady?: () => void
}

export default function TowerScene({ reduce, dailyLit, onReady }: TowerSceneProps) {
    const night = useThemeStore((s) => s.theme === 'dark')
    const [fontsReady, setFontsReady] = useState(false)
    // Chờ font Be Vietnam Pro (tối đa 1,5 giây) để chữ trên biển hiệu không bị font dự phòng
    useEffect(() => {
        let alive = true
        const loads = document.fonts?.load ? document.fonts.load('800 40px "Be Vietnam Pro"', 'HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG') : Promise.resolve()
        Promise.race([loads, new Promise((r) => setTimeout(r, 1500))]).finally(() => alive && setFontsReady(true))
        return () => {
            alive = false
        }
    }, [])
    if (!fontsReady || FLAGS.no3d) return null
    return (
        <Canvas
            frameloop="never"
            legacy
            flat
            shadows="percentage"
            dpr={[1, DPR_MAX]}
            camera={{ fov: FOV, position: KEYS[0].cam.toArray(), near: 0.3, far: 700 }}
            gl={{ antialias: true, alpha: true }}
            style={{ pointerEvents: 'none' }}
            onCreated={({ gl, scene }) => {
                gl.shadowMap.autoUpdate = false
                gl.shadowMap.needsUpdate = true
                // Màu tươi như ảnh minh họa phẳng: Khronos Neutral giữ nguyên độ bão hòa, phơi sáng 1,15 (giống cảnh trang chủ cũ)
                gl.toneMapping = THREE.NeutralToneMapping
                gl.toneMappingExposure = 1.15
                applyGlassEnv(gl, scene)
            }}
            aria-label="Mô hình 3D khuôn viên PTIT"
            role="img"
        >
            <Driver onReady={onReady} />
            <World night={night} reduce={reduce} dailyLit={dailyLit} />
        </Canvas>
    )
}

// Giữ tham chiếu để tiện chỉnh bằng tay khi cần (console: window.__towerKeys)
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __towerKeys: Key[] }).__towerKeys = KEYS
