import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useThemeStore } from '@/store/useThemeStore'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CAMPUS } from './campus-palette'
import { A2_AT, A2Lobby, A2Podium, a2Point, HallA2, kioskScreenFrame, LOBBY_SCALE, lobbyPoint, PODIUM_TOP, SCR_H, SCR_W } from './campus-a2'
import { STUDIO_Z } from './campus-room'
import { PERF_ON, PerfHud } from './campus-perf'
import { isWebKit } from '@/lib/browser'
import { FLAGS } from '@/lib/perf'
import { addFrame } from '@/lib/frame-loop'
import { footerCover, page } from '@/lib/page-metrics'
import { flushOverlay, overlay, stageSignal } from '@/lib/stage-signal'
import { KIOSK_H, KIOSK_W, type KioskBridge } from './kiosk-screen'
import { Antenna } from './campus-tech'
import { Box, Cylinder, FlatRoof, RibbonEdge, GroundBlob, GroundPlane, Gable, LedFrame, makeConcreteTexture, stdMat, TextPlane, type TextOpts, type Vec3 } from './campus-prims'
import { A2_TIERS, FINALE_STEP_MS, type DailyLit } from '@/lib/daily-lit'

// Khuôn viên PTIT low-poly, chuyển từ docs/ptit-campus.html (three.js thuần) sang React Three Fiber.
// Hình khối, màu và số đo giữ nguyên bản gốc; không dùng file model nào. Tòa A2 (đế rộng, sảnh kính) và Hội trường A2
// theo bản mẫu docs/mockup/orbit-campus-journey.html (xem campus-a2.tsx).
// Canvas chạy chế độ legacy + flat (không color management, không tone mapping) và cường độ đèn
// nhân π để ra đúng màu như bản three r128 mà bản gốc dùng.

const C = CAMPUS

/** Độ phân giải tối đa của canvas (MacBook DPR 2 vẽ ở 1.5 để nhẹ hơn; Safari 1.25) */
/** Safari: thêm ?noaa vào URL để thử tắt antialias nếu ?perf báo dưới 50fps lúc bay */
const NO_AA = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('noaa')
const DPR_MAX = isWebKit ? 1.25 : 1.5
/** Canvas đục (alpha:false) trên Safari/WebKit hoặc ?opaque: trời vẽ trong WebGL (scene.background), không để trình duyệt hợp thành canvas trong suốt với gradient CSS phía sau */
const OPAQUE = isWebKit || FLAGS.opaque

// Hằng số ngoài component để useMemo của TextPlane không tính lại mỗi lần render
const T_PTIT: TextOpts = { size: 200 }
const T_HEART: TextOpts = { size: 170 }
/** Kính mảng lớn của các tòa: bóng, phản chiếu nhẹ */
const GLASS = { roughness: 0.15, metalness: 0.35 }

const T_GATE_W: TextOpts = { size: [120, 62], h: 256, fg: CAMPUS.pureWhite }

// ─── Tòa nhà (có nâng khi hover và nhãn) ───────────────────────────────────

interface BuildingProps {
    name: string
    anchorY: number
    position: Vec3
    registry: React.MutableRefObject<Map<string, THREE.Group>>
    /** Xoay quanh trục đứng (rad), mặc định mặt trước nhìn về +z */
    rotY?: number
    /** Tấm bóng tiếp đất [rộng, sâu, lệch x, lệch z] */
    foot?: [number, number, number?, number?]
    children: ReactNode
}

function Building({ name, anchorY, position, registry, rotY = 0, foot, children }: BuildingProps) {
    const ref = useRef<THREE.Group>(null)
    useLayoutEffect(() => {
        const g = ref.current
        if (!g) return
        const map = registry.current
        g.userData.buildingName = name
        g.userData.anchorY = anchorY
        map.set(name, g)
        return () => {
            map.delete(name)
        }
    }, [name, anchorY, registry])

    return (
        <group ref={ref} position={position} rotation={[0, rotY, 0]}>
            {foot && <GroundBlob foot={foot} />}
            {children}
        </group>
    )
}

// ─── Cửa sổ tòa A2: lớp kính + lớp sáng đèn (bật ngẫu nhiên khi buổi tối) ──

const WIN_SLOTS: [number, number, number, number][] = (() => {
    const slots: [number, number, number, number][] = []
    for (let f = 0; f < 10; f++) {
        const y = 3.5 + f * 1.02
        ;[-2.6, -1.75, 1.75, 2.6].forEach((x) => slots.push([x, y, 1.52, 0]))
        ;[-4.05, 4.05].forEach((x) => {
            if (f < 9) slots.push([x, y, 1.12, 0])
        })
        if (f < 9) [-2.4, -0.8, 0.8].forEach((z) => slots.push([4.72, y, z, Math.PI / 2]))
    }
    return slots
})()

const dummy = new THREE.Object3D()
function setSlot(mesh: THREE.InstancedMesh, i: number, lit: boolean | null) {
    const [x, y, z, ry] = WIN_SLOTS[i]
    // lit = null: lớp kính (đặt đúng vị trí); còn lại: lớp sáng, lệch ra 0.02, thu về 0 khi tắt
    dummy.position.set(lit === null ? x : x + (ry ? 0.02 : 0), y, lit === null ? z : z + (ry ? 0 : 0.02))
    dummy.rotation.set(0, ry, 0)
    const s = lit === false ? 0 : 1
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
}

/** Tầng cửa sổ A2 = bài Daily thứ k đã đọc hôm nay: slot thuộc tầng nào theo chiều cao (mỗi tầng nhà một nhóm, thấp → cao). */
const TIER_OF_SLOT = WIN_SLOTS.map(([, y]) => Math.min(A2_TIERS - 1, Math.round((y - 3.5) / 1.02)))
/** Độ sáng hiện tại của từng tầng (0..1). Để ở module: rời trang chủ rồi quay lại thì tầng mới đọc sáng lên mượt từ giá trị cũ. */
const tierShown = new Array<number>(A2_TIERS).fill(0)
const TIER_EPS_STAGE = 0.78 // chỉ chạy hiệu ứng khi chương Hôm nay đã vào khung nhìn
/** Mặt đồng hồ trên nóc A2 phát sáng khi mọi tầng đã sáng (0..1, làm mượt trong A2Windows, đọc ở Campus) */
const clockGlow = { v: 0 }
/** Vật liệu riêng của mặt đồng hồ (phát sáng theo clockGlow); chỉ ghi khi giá trị đổi */
const CLOCK_FACE = stdMat(CAMPUS.pureWhite, { emissive: CAMPUS.windowLit, emissiveIntensity: 0 })

/** Một InstancedMesh cho cả 10 tầng: độ trong suốt theo từng instance (thuộc tính aAlpha) thay vì 10 mesh/10 draw call. */
function patchTierAlpha(shader: { vertexShader: string; fragmentShader: string }) {
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'attribute float aAlpha;\nvarying float vTierA;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvTierA = aAlpha;')
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'varying float vTierA;\nvoid main() {').replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.a *= vTierA;')
}

function A2Windows({ nightRef, reduce, dailyLit, stage }: { nightRef: React.MutableRefObject<number>; reduce: boolean; dailyLit: React.MutableRefObject<DailyLit>; stage: React.MutableRefObject<number> }) {
    const winRef = useRef<THREE.InstancedMesh>(null)
    const litRef = useRef<THREE.InstancedMesh>(null)
    const tierRef = useRef<THREE.InstancedMesh>(null)
    const alphaRef = useRef<THREE.InstancedBufferAttribute>(null)
    const lit = useRef<boolean[]>(new Array(WIN_SLOTS.length).fill(false))
    const flickerT = useRef(0)

    useLayoutEffect(() => {
        const win = winRef.current
        const lm = litRef.current
        const tm = tierRef.current
        if (!win || !lm || !tm) return
        WIN_SLOTS.forEach((_, i) => {
            setSlot(win, i, null)
            setSlot(lm, i, false)
            // Lớp tầng: đặt đúng chỗ, lệch ra 0.04 để nằm trên lớp đèn ngẫu nhiên
            const [x, y, z, ry] = WIN_SLOTS[i]
            dummy.position.set(x + (ry ? 0.04 : 0), y, z + (ry ? 0 : 0.04))
            dummy.rotation.set(0, ry, 0)
            dummy.scale.setScalar(1)
            dummy.updateMatrix()
            tm.setMatrixAt(i, dummy.matrix)
        })
        win.instanceMatrix.needsUpdate = true
        lm.instanceMatrix.needsUpdate = true
        tm.instanceMatrix.needsUpdate = true
    }, [])

    useFrame((_, delta) => {
        // Tầng theo bài Daily đã đọc: chỉ đổi alpha từng instance, không đụng React
        const active = stage.current > TIER_EPS_STAGE
        const gate = Math.min(1, Math.max(0, (stage.current - 0.75) / 0.25))
        const tm = tierRef.current
        const alpha = alphaRef.current
        if (tm && alpha) {
            const d = dailyLit.current
            const sinceFinale = d.finaleAt ? performance.now() - d.finaleAt : Infinity
            let changed = false
            let any = false
            for (let t = 0; t < A2_TIERS; t++) {
                if (active) {
                    // Tầng đã đọc sáng ngay; các tầng còn lại sáng nối tiếp từ dưới lên (mỗi tầng trễ FINALE_STEP_MS) khi nhiệm vụ ẩn đạt
                    const want = t < d.read || (d.finale && (reduce || sinceFinale >= (t - d.read) * FINALE_STEP_MS)) ? 1 : 0
                    tierShown[t] = reduce ? want : tierShown[t] + (want - tierShown[t]) * (1 - Math.exp(-delta * 3.2))
                    if (Math.abs(want - tierShown[t]) < 0.002) tierShown[t] = want
                }
                // Sáng dần theo chương (gate), khi sang Studio giữ nguyên
                const a = tierShown[t] * gate
                if (a > 0.003) any = true
                for (let i = 0; i < WIN_SLOTS.length; i++) {
                    if (TIER_OF_SLOT[i] === t && Math.abs(alpha.array[i] - a) > 0.001) {
                        alpha.array[i] = a
                        changed = true
                    }
                }
            }
            if (changed) alpha.needsUpdate = true
            tm.visible = any
            // Đồng hồ trên nóc sáng khi tầng cuối cùng đã bật
            const clockWant = d.finale && tierShown[A2_TIERS - 1] > 0.5 ? 1 : 0
            clockGlow.v = reduce ? clockWant : clockGlow.v + (clockWant - clockGlow.v) * (1 - Math.exp(-delta * 2.5))
            const glow = Math.round(clockGlow.v * 140) / 100
            if (CLOCK_FACE.emissiveIntensity !== glow) CLOCK_FACE.emissiveIntensity = glow
        }

        const lm = litRef.current
        if (!lm) return
        flickerT.current += Math.min(delta, 0.05)
        if (flickerT.current <= (reduce ? 0 : 0.12)) return
        flickerT.current = 0
        const want = nightRef.current > 0.5 ? 0.7 : 0.08
        const n = reduce ? WIN_SLOTS.length : 6
        for (let k = 0; k < n; k++) {
            const i = reduce ? k : Math.floor(Math.random() * WIN_SLOTS.length)
            lit.current[i] = Math.random() < want
            setSlot(lm, i, lit.current[i])
        }
        lm.instanceMatrix.needsUpdate = true
    })

    return (
        <>
            <instancedMesh ref={winRef} args={[undefined, undefined, WIN_SLOTS.length]} material={stdMat(C.win, { roughness: 0.35, metalness: 0.25 })} castShadow receiveShadow>
                <boxGeometry args={[0.5, 0.62, 0.08]} />
            </instancedMesh>
            <instancedMesh ref={litRef} args={[undefined, undefined, WIN_SLOTS.length]}>
                <boxGeometry args={[0.5, 0.62, 0.08]} />
                <meshBasicMaterial color={CAMPUS.windowLit} />
            </instancedMesh>
            <instancedMesh ref={tierRef} args={[undefined, undefined, WIN_SLOTS.length]} visible={false}>
                <boxGeometry args={[0.5, 0.62, 0.08]}>
                    <instancedBufferAttribute ref={alphaRef} attach="attributes-aAlpha" args={[new Float32Array(WIN_SLOTS.length), 1]} />
                </boxGeometry>
                <meshBasicMaterial color={CAMPUS.windowTier} transparent depthWrite={false} onBeforeCompile={patchTierAlpha} />
            </instancedMesh>
        </>
    )
}

// ─── Cờ phấp phới ──────────────────────────────────────────────────────────

function Flag({ color, x, index, reduce }: { color: string; x: number; index: number; reduce: boolean }) {
    const geo = useMemo(() => {
        const g = new THREE.PlaneGeometry(1, 0.6, 10, 1)
        g.translate(0.5, 0, 0)
        g.userData.base = g.attributes.position.array.slice()
        return g
    }, [])
    useFrame(({ clock }) => {
        if (reduce) return
        const p = geo.attributes.position
        const base = geo.userData.base as Float32Array
        const t = clock.elapsedTime
        for (let i = 0; i < p.count; i++) {
            const bx = base[i * 3]
            ;(p.array as Float32Array)[i * 3 + 2] = Math.sin(bx * 4 - t * 5 + index) * 0.12 * bx
        }
        p.needsUpdate = true
    })
    return (
        <>
            <Cylinder r={0.05} h={5.5} c={CAMPUS.pillar} at={[x, 2.75, 5.2]} seg={6} />
            <mesh geometry={geo} position={[x + 0.05, 5.15, 5.2]} castShadow>
                <meshStandardMaterial color={color} side={THREE.DoubleSide} flatShading />
            </mesh>
        </>
    )
}

// ─── Mây ───────────────────────────────────────────────────────────────────

const CLOUD_PUFFS: [number, number, number, number][] = [[0, 0, 0, 1.6], [1.6, -0.2, 0.3, 1.2], [-1.5, -0.3, -0.2, 1.1], [0.6, 0.6, 0, 1.1]]

function Cloud({ index, reduce }: { index: number; reduce: boolean }) {
    const ref = useRef<THREE.Group>(null)
    const speed = 0.6 + index * 0.15
    useFrame((_, delta) => {
        const g = ref.current
        if (!g || reduce) return
        g.position.x += speed * Math.min(delta, 0.05)
        if (g.position.x > 34) g.position.x = -34
    })
    return (
        <group ref={ref} position={[-30 + index * 17, 20 + (index % 2) * 3, -16 + index * 7]}>
            {CLOUD_PUFFS.map(([x, y, z, r], i) => (
                <mesh key={i} position={[x, y, z]}>
                    <icosahedronGeometry args={[r, 0]} />
                    <meshStandardMaterial color={CAMPUS.pureWhite} flatShading />
                </mesh>
            ))}
        </group>
    )
}

// ─── Mô hình khuôn viên ────────────────────────────────────────────────────

type BuildingName = 'Tòa A2' | 'Hội trường A2' | 'Tòa A3' | 'Hội trường A1' | 'Tòa A1' | 'Canteen' | 'Cổng Học viện'

// Bố cục theo bản mẫu: đế A2 chiếm x ∈ [-8.6, 12.6], z ∈ [-21.7, 7]; các tòa/cây/bãi cỏ nằm ngoài vùng đó
const TREE_SPOTS: [number, number][] = [[-21, 15], [-18, 16.5], [-12.5, 16.5], [-5, 14], [-20.5, 3], [-21, -5], [-21, -17.5], [-17, -18.5], [-12, -18.5], [-10.8, 6.5], [-10.8, -2], [-11, -6], [-7, 9], [7.5, 8.5], [13.5, 16], [17, 16.5], [20.5, 15], [20.8, 9], [20.8, 4], [21.2, -9], [10, 13], [-8, 12.5]]
const LAWNS: [number, number, number, number][] = [[-15, 14, 9, 4], [16, 10, 9, 7], [-15.5, -5, 8, 4]]
const CARS: [string, number, number][] = [[CAMPUS.ptitRed, -5.5, 11], [CAMPUS.pureWhite, -7.8, 11.2], [CAMPUS.carDark, 8.8, 10.5], [CAMPUS.carSilver, 10.6, 10.8]]

interface WorldProps {
    registry: React.MutableRefObject<Map<string, THREE.Group>>
    nightRef: React.MutableRefObject<number>
    reduce: boolean
    dailyLit: React.MutableRefObject<DailyLit>
    /** S đã làm mượt (Scene ghi mỗi khung hình) */
    stage: React.MutableRefObject<number>
    /** Máy yếu: cây không đổ bóng */
    lowQuality: boolean
}

/** Vị trí cổng trường (gốc cổng, mặt ngoài hướng +z): đường máy quay chương 02 đi dưới dầm cổng */
const GATE_AT: Vec3 = [2, 0, 16.5]

/** Tấm biển nền của chữ: ban đêm tối dần để chữ LED nổi lên (không hắt sáng, không đèn chiếu lên mặt biển) */
function SignBoard({ nightRef, size, at, color = CAMPUS.gateSign }: { nightRef: React.MutableRefObject<number>; size: Vec3; at: Vec3; color?: string }) {
    const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }), [color])
    const day = useMemo(() => new THREE.Color(color), [color])
    const night = useMemo(() => new THREE.Color(CAMPUS.signNight), [])
    useEffect(() => () => mat.dispose(), [mat])
    useFrame(() => mat.color.copy(day).lerp(night, nightRef.current))
    return (
        <mesh position={at} material={mat} castShadow receiveShadow>
            <boxGeometry args={size} />
        </mesh>
    )
}

// Texture sân (vẽ một lần ở module, dùng lại giữa các lần dựng lại cảnh): gạch tile 14,4 đơn vị, đá lát tile 10 đơn vị
let concreteTex: THREE.Texture | null = null

/** Cây hoa sưa: tán xanh nhạt điểm chùm hoa trắng (khối cầu nhỏ trắng xen xanh), cao hơn cây thường */
const SUA_SPOTS: [number, number, number][] = [[-1.6, 8.6, 1.35], [5.6, 12.2, 1.25], [-1.6, 13.6, 1.4]]
const SUA_PUFFS: [number, number, number, number][] = [[0, 0, 0, 1.15], [0.8, -0.35, 0.3, 0.8], [-0.75, -0.2, -0.35, 0.8], [0.15, 0.75, 0.2, 0.75], [-0.3, 0.1, 0.85, 0.7], [0.45, 0.3, -0.7, 0.7]]
function SuaTree({ x, z, s, lowQuality }: { x: number; z: number; s: number; lowQuality: boolean }) {
    return (
        <group position={[x, 0, z]} scale={s}>
            <mesh position={[0, 0.9, 0]} material={stdMat(C.trunk)} castShadow={!lowQuality} receiveShadow>
                <cylinderGeometry args={[0.13, 0.2, 1.8, 6]} />
            </mesh>
            {SUA_PUFFS.map(([px, py, pz, r], i) => (
                <mesh key={i} position={[px, 2.5 + py, pz]} material={stdMat(i % 2 ? C.suaWhite : C.suaGreen)} castShadow={!lowQuality} receiveShadow>
                    <icosahedronGeometry args={[r, 0]} />
                </mesh>
            ))}
        </group>
    )
}

/**
 * Env map nhỏ (RoomEnvironment, PMREM 256px) chỉ gắn cho vật liệu kính (roughness ≤ 0,25 và metalness ≥ 0,3) để kính có phản chiếu;
 * tường và mặt đất không dùng env nên không bị sáng thêm. Vật liệu dùng chung nên gắn một lần sau khi cảnh dựng xong.
 */
function applyGlassEnv(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
    try {
        const pm = new THREE.PMREMGenerator(gl)
        const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
        pm.dispose()
        const apply = () =>
            scene.traverse((o) => {
                const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
                if (m && m.isMeshStandardMaterial && m.roughness <= 0.25 && m.metalness >= 0.3 && m.envMap !== env) {
                    m.envMap = env
                    m.envMapIntensity = 0.9
                    m.needsUpdate = true
                }
            })
        window.setTimeout(apply, 1500)
        window.setTimeout(apply, 5000)
    } catch {
        /* không dựng được env thì kính chỉ mất phản chiếu */
    }
}

function Campus({ registry, nightRef, reduce, dailyLit, stage, lowQuality }: WorldProps) {
    const b = (name: BuildingName) => ({ registry, name })
    concreteTex ??= makeConcreteTexture([45 / 12, 41 / 12])

    return (
        <>
            {/* Nền, đường, bãi cỏ */}
            <Box s={[45.9, 1, 41.9]} c={C.plateEdge} at={[0, -1.2, -1]} />
            <RibbonEdge w={46} d={42} h={1} at={[0, -1.2, -1]} />
            <Box s={[45, 0.4, 41]} c={C.plate} at={[0, -0.4, -1]} />
            {/* Sân bê tông xám (texture lặp) nằm ngay trên mặt đế; lối xe nhựa đường từ cổng vào A2 */}
            <GroundPlane s={[45, 41]} at={[0, 0.005, -1]} tex={concreteTex} />
            <Box s={[45, 0.02, 2]} c={C.road} at={[0, 0, 18.4]} />
            <Box s={[5, 0.03, 11]} c={C.pave} at={[2, 0, 11]} />
            {LAWNS.map(([x, z, w, d]) => (
                <group key={`${x}_${z}`}>
                    <Box s={[w + 0.5, 0.06, d + 0.5]} c={C.lawnEdge} at={[x, 0, z]} />
                    <Box s={[w, 0.09, d]} c={C.grass} at={[x, 0, z]} />
                </group>
            ))}
            {Array.from({ length: 7 }, (_, i) => (
                <Box key={i} s={[0.2, 0.03, 1.8]} c={CAMPUS.pureWhite} at={[-2.5 + i * 1.4, 0, 18.4]} />
            ))}
            {CARS.map(([c, x, z]) => (
                <group key={c}>
                    <Box s={[1, 0.5, 2]} c={c} at={[x, 0, z]} />
                    <Box s={[0.85, 0.35, 1.1]} c={c} at={[x, 0.5, z - 0.1]} />
                </group>
            ))}

            {/* Tòa A2: đế rộng + sảnh kính nhìn xuyên vào trong; thân tháp đứng trên mái đế */}
            <Building {...b('Tòa A2')} anchorY={20.2} position={A2_AT} foot={[24, 29, 0, -9.5]}>
                <A2Podium stage={stage} />
                <A2Lobby stage={stage} />
                <group position={[0, PODIUM_TOP - 2.8, 0]}>
                    <Box edges s={[6.8, 11, 4.6]} c={C.cream} at={[0, 2.8, -0.8]} />
                    <Box edges s={[1.3, 9.6, 3.8]} c={C.cream} at={[-4.05, 2.8, -0.8]} />
                    <Box edges s={[1.3, 9.6, 3.8]} c={C.cream} at={[4.05, 2.8, -0.8]} />
                    <Box s={[1.8, 10.4, 0.25]} c={C.glass} at={[0, 3.1, 1.6]} o={{ roughness: 0.2, metalness: 0.35 }} />
                    <Box s={[0.25, 9, 1.8]} c={C.glass} at={[-4.75, 3.2, -0.8]} o={{ roughness: 0.2, metalness: 0.35 }} />
                    <Box edges s={[6.8, 0.5, 4.8]} c={CAMPUS.cornice} at={[0, 13.8, -0.8]} />
                    {/* Mái bằng như ảnh thật: khối mái trắng, tam giác trắng phía trước, viền đỏ mảnh */}
                    <FlatRoof w={6.4} d={4.2} at={[0, 14.3, -0.9]} gear={false} />
                    <LedFrame w={6.8} d={4.8} at={[0, 14.3, -0.8]} t={0.1} h={0.1} />
                    <Box s={[0.8, 0.45, 0.6]} c="#C9CDD3" at={[-1.9, 14.44, -1.9]} />
                    <Box s={[0.8, 0.45, 0.6]} c="#C9CDD3" at={[1.9, 14.44, -1.9]} />
                    <Antenna at={[0, 14.44, -1.1]} reduce={reduce} />
                    <Gable len={0.5} h={1.8} depth={5} c={C.roofFlat} at={[0, 13.8, 1.35]} alongZ />
                    {/* Đồng hồ */}
                    <mesh position={[0, 14.55, 1.65]} rotation={[Math.PI / 2, 0, 0]} material={CLOCK_FACE} castShadow receiveShadow>
                        <cylinderGeometry args={[0.62, 0.62, 0.12, 24]} />
                    </mesh>
                    <mesh position={[0, 14.55, 1.7]} material={stdMat(C.glass)} castShadow receiveShadow>
                        <torusGeometry args={[0.62, 0.08, 6, 24]} />
                    </mesh>
                    <Box s={[0.06, 0.45, 0.04]} c={CAMPUS.ink} at={[0, 14.55, 1.74]} />
                    <Box s={[0.36, 0.06, 0.04]} c={CAMPUS.ink} at={[0.16, 14.55, 1.74]} />
                    {/* Biển nền mỏng nằm trên dải kính (rộng 1.8) làm khung cho chữ */}
                    <SignBoard nightRef={nightRef} size={[1.6, 0.7, 0.06]} at={[0, 12.9, 1.755]} color={C.signWhite} />
                    <TextPlane w={1.4} h={0.5} text="PTIT" at={[0, 12.9, 1.8]} opts={T_PTIT} nightRef={nightRef} glow={!lowQuality} />

                    <A2Windows nightRef={nightRef} reduce={reduce} dailyLit={dailyLit} stage={stage} />
                </group>

                <TextPlane w={3.2} h={0.8} text="I ♥ PTIT" at={[7.6, 0.5, 5.6]} opts={T_HEART} doubleSide nightRef={nightRef} glow={!lowQuality} />
                {([[-8.4, '#EE3B2E'], [-7.6, '#F4D431'], [-6.8, '#41A5E1'], [-6.0, '#2EC3A8']] as const).map(([x, c], i) => (
                    <Flag key={x} x={x} color={c} index={i} reduce={reduce} />
                ))}
            </Building>

            {/* Hội trường A2: bên trái A2, cỡ nửa A2 */}
            <Building {...b('Hội trường A2')} anchorY={10.4} position={[-15.4, 0, 1]} foot={[8.5, 8.5]}>
                <HallA2 />
            </Building>

            {/* Tòa A3: khối trắng + kính, mái bằng, dải đỏ ở cạnh; xoay mặt về phía A2 */}
            <Building {...b('Tòa A3')} anchorY={7.6} position={[17.5, 0, -6]} rotY={-Math.PI / 2} foot={[16, 8]}>
                <Box edges s={[13, 4.6, 4.4]} c={C.yellow} />
                <Box s={[13.3, 0.28, 4.7]} c={C.mmPink} at={[0, 4.32, 0]} />
                {[0.5, 2.5].map((y) => (
                    <Box key={y} s={[11.6, 1.5, 0.1]} c={C.glassBand} at={[0, y, 2.23]} o={GLASS} />
                ))}
                <FlatRoof w={13.4} d={4.6} at={[0, 4.6, 0]} />
                <Box s={[2.6, 5.2, 1]} c={C.yellow} at={[0, 0, 2.6]} />
                <Box s={[2.0, 3.8, 0.1]} c={C.glassBand} at={[0, 0.5, 3.13]} o={GLASS} />
                <Box s={[0.18, 5.2, 1.05]} c={C.mmPink} at={[1.4, 0, 2.6]} />
            </Building>

            {/* Hội trường A1: dài, trắng, mái đầu hồi đỏ */}
            <Building {...b('Hội trường A1')} anchorY={6.2} position={[-15.5, 0, -11]} foot={[15, 8.5]}>
                <Box edges s={[12, 3.6, 5]} c={C.hallWall} />
                <Box s={[11, 1.4, 0.1]} c={C.glassBand} at={[0, 1.0, 2.53]} o={GLASS} />
                <Box s={[12.1, 0.3, 5.1]} c={C.mmOrange} at={[0, 3.15, 0]} />
                <FlatRoof w={12.4} d={5.4} at={[0, 3.6, 0]} led />
                <Box s={[3, 4.4, 1.2]} c={C.hallWall} at={[0, 0, 3]} />
                <Box s={[2.4, 2.6, 0.1]} c={C.glassBand} at={[0, 0.6, 3.63]} o={GLASS} />
                <FlatRoof w={3.3} d={1.5} at={[0, 4.4, 3]} gear={false} />
            </Building>

            {/* Tòa A1: khối trắng thấp có dải ngang */}
            <Building {...b('Tòa A1')} anchorY={6.4} position={[-16, 0, 8]} foot={[11, 9]}>
                <Box edges s={[7.5, 5.2, 6]} c={C.a1Wall} />
                {Array.from({ length: 5 }, (_, r) => (
                    <Box key={r} s={[7.6, 0.18, 6.1]} c={C.a1Trim} at={[0, 0.7 + r * 0.95, 0]} />
                ))}
                {Array.from({ length: 4 }, (_, r) => (
                    <Box key={`w${r}`} s={[6.8, 0.55, 0.1]} c={C.glassBand} at={[0, 1.0 + r * 0.95, 3.04]} o={GLASS} />
                ))}
                <FlatRoof w={7.6} d={6.1} at={[0, 5.2, 0]} />
            </Building>

            <Building {...b('Canteen')} anchorY={4.2} position={[17.5, 0, -17.5]} foot={[9, 7]}>
                <Box edges s={[5.5, 2.2, 3.4]} c={C.hallWall} />
                <Box s={[5.6, 0.25, 3.5]} c={C.mmYellow} at={[0, 1.8, 0]} />
                <FlatRoof w={5.9} d={3.8} at={[0, 2.2, 0]} />
            </Building>

            <Building {...b('Cổng Học viện')} anchorY={5.6} position={GATE_AT}>
                {[-3.4, 3.4].map((x) => (
                    <Box edges key={x} s={[0.8, 3.6, 0.8]} c={CAMPUS.gatePost} at={[x, 0, 0]} />
                ))}
                <Box edges s={[8, 0.5, 1]} c={CAMPUS.gateBeam} at={[0, 3.6, 0]} />
                <SignBoard nightRef={nightRef} size={[7.4, 1.6, 0.2]} at={[0, 4.9, 0]} />
                <Box s={[7.4, 0.32, 0.12]} c={C.gateBlue} at={[0, 3.66, 0.56]} />
                <TextPlane w={7.0} h={1.3} text={'HỌC VIỆN\nCÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG'} at={[0, 4.9, 0.115]} opts={T_GATE_W} nightRef={nightRef} glow={!lowQuality} />
                {Array.from({ length: 9 }, (_, i) => (
                    <Box key={i} s={[0.08, 1.4, 0.08]} c={CAMPUS.fence} at={[4.6 + i * 0.55, 0, 0]} />
                ))}
                <Box s={[5, 0.08, 0.08]} c={CAMPUS.fence} at={[6.8, 1.3, 0]} />
            </Building>

            {/* Cây */}
            {TREE_SPOTS.map(([x, z], i) => {
                const s = 0.8 + ((i * 37) % 10) / 22
                return (
                    <group key={i}>
                        <mesh position={[x, 0.6 * s, z]} material={stdMat(C.trunk)} castShadow={!lowQuality} receiveShadow>
                            <cylinderGeometry args={[0.14 * s, 0.2 * s, 1.2 * s, 6]} />
                        </mesh>
                        <mesh position={[x, 1.9 * s, z]} material={stdMat(i % 3 ? C.tree : C.tree2)} castShadow={!lowQuality} receiveShadow>
                            <icosahedronGeometry args={[1.15 * s, 0]} />
                        </mesh>
                    </group>
                )
            })}

            {SUA_SPOTS.map(([x, z, s]) => (
                <SuaTree key={`${x}_${z}`} x={x} z={z} s={s} lowQuality={lowQuality} />
            ))}

            {[0, 1, 2, 3].map((i) => (
                <Cloud key={i} index={i} reduce={reduce} />
            ))}
        </>
    )
}

// ─── Cảnh: máy quay theo cuộn, đèn, xoay theo chuột, hover, ngày/đêm ────────

const SUN_DAY = new THREE.Color(CAMPUS.sunlight)
const SUN_NIGHT = new THREE.Color(CAMPUS.moonlight)
const HEMI_SKY_DAY = new THREE.Color(CAMPUS.skyLight)
const HEMI_SKY_NIGHT = new THREE.Color(CAMPUS.nightSkyLight)
const HEMI_GROUND_DAY = new THREE.Color(CAMPUS.groundLight)
const HEMI_GROUND_NIGHT = new THREE.Color(CAMPUS.nightGroundLight)
const TARGET = new THREE.Vector3(0, 3, 0)
const START_POS = new THREE.Vector3(52, 40, 58)

/** Phạm vi cần nằm gọn trong khung ở mọi góc xoay (đơn vị cảnh): bán kính ngang (đế + mây) và nửa chiều cao (tính cả nhãn). */
const BOUND_RADIUS = 31
const BOUND_HALF_HEIGHT = 20
const FIT_MARGIN = 1.05
const FOV = 28
/** Sau khi buông tay, chờ chừng này rồi mới tự xoay tiếp. */
const RETURN_DELAY_MS = 700
/** Góc mặc định của hero (từ START_POS) và biên kéo xoay: ±25° ngang, hẹp theo chiều dọc; buông tay thì về lại góc này */
const HERO_OFF = START_POS.clone().sub(TARGET)
const HERO_SPH = new THREE.Spherical().setFromVector3(HERO_OFF)
const AZ_RANGE = (25 * Math.PI) / 180
const POLAR_RANGE = 0.17
/** Khuôn viên (cả cạnh đế) chiếm tối đa chừng này bề ngang ở hero: mô hình là bối cảnh, không phải tiêu điểm */
const HERO_MAX_W = 0.5
const FIT_RADIUS = BOUND_RADIUS
const RETURN_RATE = 2.2
const _sph = new THREE.Spherical()
const _off = new THREE.Vector3()
/** S ≤ ngưỡng này là còn ở hero: OrbitControls và tự xoay hoạt động; vượt ngưỡng thì camera chạy theo đường bay. */
const HERO_EPS = 0.05
/**
 * Lưới chung của trang (khớp .container-page): tối đa 1440, lề 96 (≥1280), 12 cột, gap 24.
 * Màn rộng: cột chữ chiếm 5 cột trái, chủ thể nằm giữa vùng 7 cột phải; riêng chương Học phần cột chữ rộng 6 cột nên chủ thể (kiosk) nằm giữa 6 cột phải.
 */
const GRID_GAP = 24
function gridSpan(w: number, from: number, span: number) {
    const gutter = w >= 1280 ? 96 : THREE.MathUtils.clamp(w * 0.04, 24, 96)
    const page = Math.min(w, 1440)
    const col = (page - gutter * 2 - GRID_GAP * 11) / 12
    const x0 = (w - page) / 2 + gutter + from * (col + GRID_GAP)
    const x1 = x0 + span * col + (span - 1) * GRID_GAP
    return { x0, x1, c: (x0 + x1) / 2 }
}
/** Tâm vùng chủ thể (px) theo chương: 7 cột phải, riêng quanh S = 1.8 (Học phần) là 6 cột phải. */
function subjectCenter(w: number, S: number) {
    const t = band(S, 1.4, 1.8) * (1 - band(S, 2.3, 3))
    return THREE.MathUtils.lerp(gridSpan(w, 5, 7).c, gridSpan(w, 6, 6).c, t)
}
/** Tỉ lệ rộng/cao của vùng trống mà khung chính diện A2 (chế độ tĩnh) được viết cho; vùng hẹp hơn thì camera lùi xa tương ứng. */
const REF_ASPECT = 1.05
/** Làm mượt độ tối nền khi có chữ (đích chỉ là 0/1) */
const DIM_SMOOTH = 3
/** Footer phủ quá chừng này (0..1) thì ngừng vẽ cảnh 3D */
const FOOTER_STOP = 0.6

// ── Máy quay: mỗi chuyển cảnh là MỘT động tác đơn giản; đoạn dài thì cắt bằng tối màn (dip) ──
//   S 0→1: vòng quanh khuôn viên, kết thúc chính diện A2
//   S 1→1.8: tiến thẳng tới cửa A2 (cửa mở S 1.28–1.44), CẮT ở 62%, hiện ở góc 3/4 trước kiosk rồi đẩy nhẹ vào
//   S 1.8→3: lùi nhẹ khỏi kiosk, CẮT ở 36%, hiện ở cửa phòng thực hành rồi đẩy thẳng về bộ studio
const ORBIT_EL = 12
const ORBIT_R = 50
const ORBIT_FOV = 30
const CUT2 = 0.62
const CUT3 = 0.36
const A2_FACE = a2Point(0, 6, 1)
const KSCR = kioskScreenFrame()
// Kiosk: máy quay ở độ cao mắt, nhìn chéo 3/4 CHỈ xoay quanh trục đứng của thế giới (camera.up luôn (0,1,0): sàn, cột, quầy thẳng).
// Cả kiosk (đế → đầu) chiếm ~55% chiều cao khung; điểm nhìn ở giữa thân.
const KIOSK_FOV = 38
const KIOSK_AZ = THREE.MathUtils.degToRad(35)
const KIOSK_EYE_Y = KSCR.baseY + 1.6 * LOBBY_SCALE
const KIOSK_HEIGHT = KSCR.topY - KSCR.baseY
const KIOSK_LOOK = new THREE.Vector3(KSCR.center.x, KSCR.baseY + KIOSK_HEIGHT / 2, KSCR.center.z)
const KIOSK_D = KIOSK_HEIGHT / (0.55 * 2 * Math.tan(THREE.MathUtils.degToRad(KIOSK_FOV / 2)))
/** Hướng ngang từ kiosk ra máy quay: pháp tuyến mặt trước (chiếu xuống mặt phẳng ngang) xoay KIOSK_AZ quanh trục đứng */
const KDIR = new THREE.Vector3(KSCR.normal.x, 0, KSCR.normal.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), KIOSK_AZ)
const kioskEye = (k: number) => new THREE.Vector3(KIOSK_LOOK.x + KDIR.x * KIOSK_D * k, KIOSK_EYE_Y, KIOSK_LOOK.z + KDIR.z * KIOSK_D * k)
const KIOSK_CAM = kioskEye(1)
const KIOSK_FAR = kioskEye(1.2)
const KIOSK_BACK = kioskEye(1.15)
const ORBIT_END = new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(ORBIT_EL)) * ORBIT_R, Math.cos(THREE.MathUtils.degToRad(ORBIT_EL)) * ORBIT_R).add(A2_FACE)
const DOOR_IN = a2Point(0, 1.5, 2.3)
const DOOR_LOOK = a2Point(0, 1.6, -2)
// Đường qua cổng trường: cuối vòng quay → trước cổng trên cao (cách cổng ~17) → hạ thấp → giữa lối cổng (thấp hơn dầm, lọt giữa hai trụ) → giữa sân → trước cửa A2.
// Mắt và điểm nhìn là hai đường cong cùng số mốc, tham số hóa theo độ dài cung nên dùng chung một t.
const GATE_SIGN = new THREE.Vector3(GATE_AT[0], 4.6, GATE_AT[2])
const gatePos = new THREE.CatmullRomCurve3(
    [ORBIT_END.clone(), new THREE.Vector3(GATE_AT[0], 7, GATE_AT[2] + 17), new THREE.Vector3(GATE_AT[0], 2.1, GATE_AT[2] + 7), new THREE.Vector3(GATE_AT[0], 1.9, GATE_AT[2]), new THREE.Vector3(GATE_AT[0], 1.8, 9), DOOR_IN.clone()],
    false,
    'centripetal',
)
const gateLook = new THREE.CatmullRomCurve3([A2_FACE.clone(), GATE_SIGN, new THREE.Vector3(GATE_AT[0], 2.6, 8), a2Point(0, 2.4, 1), a2Point(0, 2, 0), DOOR_LOOK.clone()], false, 'centripetal')
const ROOM_A = lobbyPoint(0, 2.5, -13.6)
const ROOM_B = lobbyPoint(0, 2.4, -19)
const ROOM_LOOK = lobbyPoint(0, 1.5, STUDIO_Z)
/** S tại điểm cắt chương 02: từ đây trở đi là "trong nhà" (trời, nắng, đèn sảnh đổi trong lúc tối màn) */
const INDOOR_S = 1 + 0.8 * CUT2
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
/** Độ tối màn: đỉnh ở điểm cắt, tắt dần trong ±0,07 quãng */
function dipAt(s: number) {
    const d2 = s > 1 && s < 1.8 ? clamp01(1 - Math.abs(band(s, 1, 1.8) - CUT2) / 0.07) : 0
    const d3 = s > 1.8 && s < 3 ? clamp01(1 - Math.abs(band(s, 1.8, 3) - CUT3) / 0.07) : 0
    return Math.max(d2, d3)
}
/** Máy quay cho S ≥ 1: ghi vị trí vào `pos`, điểm nhìn vào `look`, trả về FOV */
function transitCamera(s: number, pos: THREE.Vector3, look: THREE.Vector3) {
    if (s < 1.8) {
        const u = band(s, 1, 1.8)
        if (u < CUT2) {
            // Đi đều, chậm lại một chút khi tới cửa
            const x = u / CUT2
            const k = x * 0.5 + x * (2 - x) * 0.5
            const t = gatePos.getUtoTmapping(k, 0)
            gatePos.getPoint(t, pos)
            gateLook.getPoint(t, look)
            return lerp(ORBIT_FOV, 44, smoothstep(clamp01(k * 1.6)))
        }
        pos.copy(KIOSK_FAR).lerp(KIOSK_CAM, easeOut((u - CUT2) / (1 - CUT2)))
        look.copy(KIOSK_LOOK)
        return KIOSK_FOV
    }
    if (s >= 3) {
        pos.copy(ROOM_B)
        look.copy(ROOM_LOOK)
        return 44
    }
    const u = band(s, 1.8, 3)
    if (u < CUT3) {
        pos.copy(KIOSK_CAM).lerp(KIOSK_BACK, smoothstep(u / CUT3))
        look.copy(KIOSK_LOOK)
        return KIOSK_FOV
    }
    const k = smoothstep((u - CUT3) / (1 - CUT3))
    pos.copy(ROOM_A).lerp(ROOM_B, k)
    look.copy(ROOM_LOOK)
    return lerp(48, 44, k)
}

// ── Màn kiosk: map khối DOM 960×600 lên 4 góc màn 3D bằng CSS matrix3d (homography) ──
const _corner = new THREE.Vector3()
const _toCam = new THREE.Vector3()
/** Giải hệ 8 ẩn bằng khử Gauss có chọn trụ */
function solve8(A: number[][], b: number[]) {
    for (let i = 0; i < 8; i++) {
        let m = i
        for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r
        ;[A[i], A[m]] = [A[m], A[i]]
        ;[b[i], b[m]] = [b[m], b[i]]
        for (let r = i + 1; r < 8; r++) {
            const f = A[r][i] / A[i][i]
            for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]
            b[r] -= f * b[i]
        }
    }
    const x = new Array<number>(8)
    for (let i = 7; i >= 0; i--) {
        let t = b[i]
        for (let c = i + 1; c < 8; c++) t -= A[i][c] * x[c]
        x[i] = t / A[i][i]
    }
    return x
}
/** Góc của khối w×h (trái-trên, phải-trên, trái-dưới, phải-dưới) → 4 điểm P (px màn hình) */
function homography(w: number, h: number, P: number[][]) {
    const S = [[0, 0], [w, 0], [0, h], [w, h]]
    const A: number[][] = []
    const B: number[] = []
    for (let i = 0; i < 4; i++) {
        const [x, y] = S[i]
        const [u, v] = P[i]
        A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
        B.push(u)
        A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
        B.push(v)
    }
    const [a, b, c, d, e, f, g, k] = solve8(A, B)
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${k},0,0,1,0,${c},${f},0,1)`
}
/** Trạng thái khung hình trước của màn kiosk: chỉ ghi DOM khi giá trị đổi (ghi transform/opacity mỗi khung hình rất tốn trên Safari) */
const kioskLast = { pts: [] as number[][], opacity: '', visibility: '', transform: '' }
const sameQuad = (a: number[][], b: number[][]) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 0.05 && Math.abs(p[1] - b[i][1]) < 0.05)

function placeKiosk(kiosk: KioskBridge, camera: THREE.PerspectiveCamera, size: { width: number; height: number }, S: number, enabled: boolean) {
    const el = kiosk.screen.current
    const K = kioskLast
    if (!el) return
    let op = enabled ? band(S, 1.52, 1.6) * (1 - band(S, 1.92, 2.1)) : 0
    // Màn quay lưng lại camera thì ẩn
    if (op > 0 && _toCam.copy(camera.position).sub(KSCR.center).dot(KSCR.normal) <= 0) op = 0
    const pts: number[][] = []
    if (op > 0) {
        for (const [x, y] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
            _corner.set((x * SCR_W) / 2, (y * SCR_H) / 2, 0).applyMatrix4(KSCR.matrix).project(camera)
            // Góc nằm ngoài frustum (gần/xa) thì ẩn
            if (_corner.z > 1 || _corner.z < -1) {
                op = 0
                break
            }
            pts.push([((_corner.x + 1) / 2) * size.width, ((1 - _corner.y) / 2) * size.height])
        }
    }
    // Poster chỉ để trang trí (pointer-events: none), bám theo máy quay suốt quãng bay tới/rời kiosk
    const opacity = op.toFixed(3)
    const visibility = op > 0.002 ? 'visible' : 'hidden'
    if (opacity !== K.opacity) {
        K.opacity = opacity
        el.style.opacity = opacity
    }
    if (visibility !== K.visibility) {
        K.visibility = visibility
        el.style.visibility = visibility
    }
    // Transform chỉ ghi khi máy quay làm 4 góc dịch quá 0,05px
    if (op > 0 && !sameQuad(pts, K.pts)) {
        K.pts = pts
        el.style.transform = homography(KIOSK_W, KIOSK_H, pts)
    }
}

/**
 * Phần "vỏ" quanh cảnh, ghi thẳng vào DOM (chỉ khi giá trị đổi): lớp phủ màu nền chung
 * (nền tối nhẹ khi có chữ + che quanh điểm cắt cảnh, xem stage-signal). Chế độ làm mờ: lớp phủ đậm hơn (0,45).
 */
function updateChrome(S: number, calm: boolean, delta: number) {
    const target = calm ? 0.45 : 0.03 * stageSignal.onStage
    overlay.dim += (target - overlay.dim) * (1 - Math.exp(-Math.min(delta, 0.2) * DIM_SMOOTH))
    if (Math.abs(target - overlay.dim) < 0.001) overlay.dim = target
    overlay.dip = dipAt(S)
    flushOverlay()
}

/** Footer đi vào: stage (canvas) mờ dần, dock mờ hẳn. Chạy mỗi khung trong FrameDriver kể cả lúc đã dừng vẽ cảnh; chỉ ghi opacity khi đổi. */
const fadeLast = { stage: '', dock: '' }
function footerFade(kiosk: KioskBridge, calm: boolean) {
    const out = footerCover()
    const stageOpacity = calm ? '' : (1 - out * 0.9).toFixed(2)
    const dockOpacity = (1 - out).toFixed(2)
    if (stageOpacity !== fadeLast.stage && kiosk.stage.current) {
        fadeLast.stage = stageOpacity
        kiosk.stage.current.style.opacity = stageOpacity
    }
    const dock = kiosk.dock.current
    if (dock && dockOpacity !== fadeLast.dock) {
        fadeLast.dock = dockOpacity
        dock.style.opacity = dockOpacity
        dock.style.pointerEvents = out > 0.5 ? 'none' : ''
    }
}

const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const RAD = Math.PI / 180
const lerp = THREE.MathUtils.lerp
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const smoothstep = (x: number) => x * x * (3 - 2 * x)
/** 0→1 khi s đi từ a tới b */
const band = (s: number, a: number, b: number) => clamp01((s - a) / (b - a))

/** Gradient trời của .stage-sky (linear 180° qua --sky-1..4 + quầng --sky-glow góc trên phải) vẽ vào texture, cho canvas đục */
function makeSkyTexture() {
    const cs = getComputedStyle(document.documentElement)
    const tok = (n: string) => cs.getPropertyValue(n).trim()
    const W = 256
    const H = 256
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    const lin = ctx.createLinearGradient(0, 0, 0, H)
    ;[[0, '--sky-1'], [0.42, '--sky-2'], [0.75, '--sky-3'], [1, '--sky-4']].forEach(([at, n]) => lin.addColorStop(at as number, `hsl(${tok(n as string)})`))
    ctx.fillStyle = lin
    ctx.fillRect(0, 0, W, H)
    const glow = tok('--sky-glow')
    const alpha = parseFloat(tok('--sky-glow-alpha') || '0')
    if (glow && alpha > 0) {
        // radial-gradient(40% 34% at 78% 16%): elip bán kính 40% × 34%, tâm (78%, 16%)
        ctx.save()
        ctx.translate(W * 0.78, H * 0.16)
        ctx.scale(W * 0.4, H * 0.34)
        const rad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
        rad.addColorStop(0, `hsl(${glow} / ${alpha})`)
        rad.addColorStop(0.7, `hsl(${glow} / 0)`)
        ctx.fillStyle = rad
        ctx.fillRect(-3, -3, 6, 6)
        ctx.restore()
    }
    return new THREE.CanvasTexture(cv)
}

/** Màu token CSS dạng "H S% L%" → THREE.Color (canvas chạy legacy nên không chuyển không gian màu). */
function tokenColor(name: string, fallback: string) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const [h, s, l] = raw.split(/\s+/).map((v) => parseFloat(v))
    return Number.isFinite(h + s + l) ? new THREE.Color().setHSL(h / 360, s / 100, l / 100) : new THREE.Color(fallback)
}

interface SceneProps {
    night: boolean
    reduce: boolean
    /** Màn cảm ứng: không cho kéo xoay (nhường thao tác cuộn trang), chỉ tự xoay */
    touch: boolean
    /** Không chuyển cảnh (màn hẹp / giảm chuyển động): mỗi chương một khung máy cố định, canvas cao 55vh */
    staticMode: boolean
    /** Giảm chuyển động: không bay, mọi chương sau hero đứng ở khung chính diện A2 */
    flat: boolean
    /** S liên tục 0..3 do useScrollStage cung cấp (ref, không phải state) */
    stage: React.MutableRefObject<number>
    /** Bài Daily hôm nay (theo thứ tự) đã đọc chưa: mỗi bài = một tầng cửa sổ A2 */
    dailyLit: React.MutableRefObject<DailyLit>
    /** Màn kiosk (DOM) được định vị lên màn 3D */
    kiosk: KioskBridge
    /** % tiến độ khóa theo tên tòa, hiện trên nhãn */
    pointer: React.MutableRefObject<{ x: number; y: number; inside: boolean }>
    /** Bấm vào tòa có khóa học thì mở khóa đó */
}

/**
 * Canvas cố định phủ cả màn hình, nội dung các chương nằm đè lên ở cột trái. Chủ thể được đặt vào "vùng trống"
 * (nửa phải trên màn rộng) bằng view offset của camera; camera hero lùi đủ xa để khối cầu bao khuôn viên nằm gọn
 * trong vùng đó.
 */
function useStageFit(controls: React.RefObject<OrbitControlsImpl | null>, staticMode: boolean, heroPos: React.MutableRefObject<THREE.Vector3>, fitScale: React.MutableRefObject<number>, stage: React.MutableRefObject<number>) {
    const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
    const size = useThree((s) => s.size)

    useEffect(() => {
        const { width: w, height: h } = size
        const region = gridSpan(w, 5, 7)
        const regionW = staticMode ? w : region.x1 - region.x0
        const ra = regionW / h
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
        // Tầm nhìn hiện có = 2·d·tanHalf theo chiều dọc và ·(w/h) theo chiều ngang
        const fitW = (BOUND_RADIUS * FIT_MARGIN) / (tanHalf * ra)
        const fitH = (BOUND_HALF_HEIGHT * FIT_MARGIN) / tanHalf
        const distance = Math.max(fitW, fitH)
        fitScale.current = Math.max(1, REF_ASPECT / ra)

        camera.aspect = w / h
        // Cắt khung từ vị trí âm = đẩy cảnh sang phải
        camera.setViewOffset(w, h, staticMode ? 0 : -(region.c - w / 2), 0, w, h)
        camera.far = Math.max(400, distance * 4)
        camera.updateProjectionMatrix()

        // Giữ nguyên hướng nhìn hiện tại của hero, chỉ đổi khoảng cách
        const offset = heroPos.current.clone().sub(TARGET)
        if (offset.lengthSq() < 1e-6) offset.copy(START_POS).sub(TARGET)
        heroPos.current.copy(TARGET).add(offset.setLength(distance))
        if (stage.current <= HERO_EPS) {
            camera.position.copy(heroPos.current)
            controls.current?.update()
        }
        return () => camera.clearViewOffset()
    }, [camera, size, controls, staticMode, heroPos, fitScale, stage])
}

const _look = new THREE.Vector3()

function Scene({ night, reduce, touch, staticMode, flat, stage, dailyLit, kiosk, pointer }: SceneProps) {
    const world = useRef<THREE.Group>(null)
    const hemi = useRef<THREE.HemisphereLight>(null)
    const sun = useRef<THREE.DirectionalLight>(null)
    const controls = useRef<OrbitControlsImpl>(null)
    const registry = useRef(new Map<string, THREE.Group>())
    const lifts = useRef(new Map<string, number>())
    const hoverRef = useRef<BuildingName | null>(null)
    const dragging = useRef(false)
    const resumeTimer = useRef<number>(0)
    const nightRef = useRef(reduce && night ? 1 : 0)
    const nightTarget = useRef(night ? 1 : 0)
    const ctlOn = useRef(true)
    // S đã làm mượt (lerp theo dt) và mức "đã vào trong nhà" (0 ngoài sân → 1 trong sảnh): nắng giảm, đèn trong sảnh nổi lên
    const sm = useRef(stage.current)
    const indoor = useRef(0)
    // Đo FPS: dưới 40 thì giảm chất lượng (shadow map nhỏ, cây không đổ bóng)
    const perf = useRef({ t: 0, n: 0, bad: 0 })
    const [lowQuality, setLowQuality] = useState(false)
    const lowRef = useRef(false)
    const heroPos = useRef(START_POS.clone())
    const fitScale = useRef(1)
    // Tránh cột chữ: zoom (≤1) và độ dịch ngang (px) đã làm mượt, mép phải cột chữ (px)
    const avoid = useRef({ zoom: 1, shift: 0 })
    const returning = useRef(false)
    const frame = useRef(0)
    const shadowSig = useRef('')
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const ndc = useMemo(() => new THREE.Vector2(-9, -9), [])
    // Sương lấy từ token trời (--sky-*), nền nội thất từ --stage-deep. Đọc lại khi đổi giao diện sáng/tối (trời ngoài trời là gradient CSS sau canvas trong suốt).
    const colors = useMemo(() => ({ fogA: new THREE.Color(), fogB: new THREE.Color(), deep: tokenColor('--stage-deep', '#130D0E'), now: new THREE.Color() }), [])
    // Canvas đục: bầu trời (cùng gradient với .stage-sky) vẽ vào texture dùng làm scene.background
    const skyTex = useRef<THREE.CanvasTexture | null>(null)
    const readSky = () => {
        colors.fogA.copy(tokenColor('--sky-2', '#F2E7DB'))
        colors.fogB.copy(tokenColor('--sky-3', '#F8F2EA'))
        if (OPAQUE) {
            skyTex.current?.dispose()
            skyTex.current = makeSkyTexture()
        }
    }
    const camHero = useMemo(() => ({ v: new THREE.Vector3() }), [])

    const size = useThree((s) => s.size)
    const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
    const domElement = useThree((s) => s.gl.domElement)
    const scene = useThree((s) => s.scene)

    useStageFit(controls, staticMode, heroPos, fitScale, sm)

    // Đưa camera về góc nhìn ban đầu (OrbitControls lấy vị trí camera làm điểm xuất phát)
    useLayoutEffect(() => {
        camera.position.copy(START_POS)
        camera.lookAt(TARGET)
        readSky()
        scene.background = OPAQUE ? skyTex.current : null
        scene.fog = new THREE.Fog(colors.fogB, 100, 400)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [camera, scene, colors])
    // Đổi giao diện: đợi class `dark` lên <html> rồi đọc lại màu sương
    useEffect(() => {
        const id = requestAnimationFrame(readSky)
        return () => cancelAnimationFrame(id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [night])

    const applyLights = (n: number) => {
        // Vào trong nhà: nắng, trời và đèn viền giảm hẳn để đèn trong sảnh làm chủ
        const inside = indoor.current
        if (sun.current) {
            sun.current.intensity = (1.15 - n * 0.85) * Math.PI * (1 - inside)
            sun.current.color.copy(SUN_DAY).lerp(SUN_NIGHT, n)
        }
        if (hemi.current) {
            hemi.current.intensity = (0.5 - n * 0.07) * Math.PI * (1 - 0.68 * inside)
            hemi.current.color.copy(HEMI_SKY_DAY).lerp(HEMI_SKY_NIGHT, n)
            hemi.current.groundColor.copy(HEMI_GROUND_DAY).lerp(HEMI_GROUND_NIGHT, n)
        }
    }

    // Màn chuyển giao diện đang che: đặt thẳng ánh sáng mới rồi vẽ đúng một khung (canvas đang dừng)
    const frozen = useThemeStore((s) => s.frozen)
    const advance = useThree((s) => s.advance)
    const clockRef = useThree((s) => s.clock)
    useEffect(() => {
        nightTarget.current = night ? 1 : 0
        if (reduce || frozen) {
            nightRef.current = nightTarget.current
            applyLights(nightRef.current)
            if (frozen) advance(clockRef.elapsedTime + 0.001)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [night, reduce, frozen])

    const updateCursor = () => {
        domElement.style.cursor = touch || !ctlOn.current ? 'default' : dragging.current ? 'grabbing' : 'grab'
    }
    useEffect(() => {
        domElement.style.touchAction = touch ? 'pan-y' : 'none'
        updateCursor()
        return () => window.clearTimeout(resumeTimer.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [domElement, touch])

    // Giảm chất lượng: shadow map nhỏ hơn (tạo lại khi đổi kích thước)
    const setDpr = useThree((s) => s.setDpr)
    const gl = useThree((s) => s.gl)
    const maxDpr = Math.min(DPR_MAX, window.devicePixelRatio || 1)
    useEffect(() => {
        if (!lowQuality || !sun.current) return
        setDpr(1)
        sun.current.shadow.mapSize.set(1024, 1024)
        sun.current.shadow.map?.dispose()
        sun.current.shadow.map = null
        // autoUpdate đang tắt: phải yêu cầu vẽ lại để shadow map được tạo ngay, không để shader lấy mẫu texture rỗng
        gl.shadowMap.needsUpdate = true
    }, [lowQuality, setDpr, gl])

    // Kéo thì dừng tự xoay; buông tay chờ 3 giây rồi xoay tiếp
    const onStart = () => {
        dragging.current = true
        window.clearTimeout(resumeTimer.current)
        returning.current = false
        updateCursor()
    }
    // Buông tay: đợi một nhịp rồi damping về góc mặc định (xem useFrame)
    const onEnd = () => {
        dragging.current = false
        updateCursor()
        window.clearTimeout(resumeTimer.current)
        resumeTimer.current = window.setTimeout(() => {
            returning.current = true
        }, RETURN_DELAY_MS)
    }

    useFrame((state, delta) => {
        const g = world.current
        if (!g) return
        const p = pointer.current

        // ── S làm mượt theo dt. Chế độ tĩnh: không bay, mọi chương sau hero đứng ở khung chính diện A2 (S = 1) ──
        // Chế độ làm mờ: camera ngừng theo cuộn (giữ nguyên S)
        const calmOn = kiosk.calm.current && !staticMode
        const want = flat ? Math.min(stage.current, 1) : stage.current
        if (!calmOn) {
            sm.current = want // useScrollStage đã tween S theo thời gian nên không làm mượt thêm
        }
        // Chốt chặn: S hỏng (NaN/Infinity) thì về chương gần nhất, S ngoài [0, 3] thì kẹp lại
        if (!Number.isFinite(sm.current)) {
            if (import.meta.env.DEV) console.warn('[campus] S không hợp lệ:', sm.current, '→ đặt về chương gần nhất')
            sm.current = Number.isFinite(want) ? want : 0
        }
        sm.current = THREE.MathUtils.clamp(sm.current, 0, 3)
        const S = sm.current
        const live = S > HERO_EPS // đã rời hero: camera chạy theo đường bay, hero tắt kéo xoay và tự xoay
        // Vào/ra nhà đổi ngay tại điểm cắt, lúc màn đang tối hẳn
        indoor.current = S > INDOOR_S ? 1 : 0

        // ── Máy quay ──
        const ctl = controls.current
        if (ctl) {
            if (live && ctl.enabled) {
                ctl.enabled = false
                window.clearTimeout(resumeTimer.current)
                returning.current = false
                dragging.current = false
                ctlOn.current = false
                updateCursor()
            } else if (!live && !ctl.enabled) {
                // Về hero: camera đang ở (gần) đúng góc hero, bật lại kéo xoay + tự xoay
                ctl.enabled = true
                ctl.target.copy(TARGET)
                // Về hero bằng cắt cảnh (logo, rail, Home): máy quay còn nằm ở chương cũ (trong sảnh, sát kiosk...) nên đặt lại thẳng góc hero mặc định
                // (giữ khoảng cách hero đã fit), bỏ góc kéo chuột và damping cũ. Bay về từ từ thì máy quay đã ở đúng heroPos, không đổi gì.
                const hd = heroPos.current.distanceTo(TARGET)
                const hdist = Number.isFinite(hd) && hd > 5 ? hd : START_POS.distanceTo(TARGET)
                const cp = camera.position
                if (!Number.isFinite(cp.x + cp.y + cp.z) || cp.distanceTo(heroPos.current) > 1) {
                    cp.copy(TARGET).add(_off.copy(HERO_OFF).setLength(hdist))
                    heroPos.current.copy(cp)
                }
                camera.up.set(0, 1, 0)
                camera.lookAt(TARGET)
                returning.current = false
                returning.current = !dragging.current
                ctl.update()
                ctlOn.current = true
                updateCursor()
            }
        }

        if (!live) {
            camera.up.set(0, 1, 0)
            if (!touch && ctl && returning.current && !dragging.current) {
                // Về góc mặc định có damping (ngang + dọc), rồi để OrbitControls đọc lại vị trí máy quay
                _off.copy(camera.position).sub(TARGET)
                _sph.setFromVector3(_off)
                const k = reduce ? 1 : 1 - Math.exp(-delta * RETURN_RATE)
                _sph.theta += (HERO_SPH.theta - _sph.theta) * k
                _sph.phi += (HERO_SPH.phi - _sph.phi) * k
                if (Math.abs(HERO_SPH.theta - _sph.theta) < 0.002 && Math.abs(HERO_SPH.phi - _sph.phi) < 0.002) returning.current = false
                camera.position.copy(TARGET).add(_off.setFromSpherical(_sph))
                ctl.update()
            }
            if (touch) {
                // Cảm ứng không kéo xoay: giữ đúng góc mặc định
                heroPos.current.copy(TARGET).add(_off.copy(HERO_OFF).setLength(heroPos.current.distanceTo(TARGET) || HERO_OFF.length()))
            } else heroPos.current.copy(camera.position)
            if (touch) {
                camera.position.copy(heroPos.current)
                camera.lookAt(TARGET)
            }
            if (camera.fov !== FOV || camera.near !== 1) {
                camera.fov = FOV
                camera.near = 1
                camera.updateProjectionMatrix()
            }
        } else {
            // heroPos đứng yên từ lúc rời hero nên cuộn ngược về hero quay đúng góc lúc rời đi.
            let fov: number
            if (S <= 1) {
                // Vòng quanh khuôn viên: góc ngang tuyến tính theo cuộn (không chậm dần rồi dừng), kết thúc chính diện A2 (az = 360°)
                const hv = camHero.v.copy(heroPos.current).sub(TARGET)
                const hr = hv.length()
                const hAz = wrapDeg(Math.atan2(hv.x, hv.z) / RAD)
                const hEl = Math.asin(hv.y / hr) / RAD
                const t = band(S, HERO_EPS, 1)
                const az = (hAz + (360 - hAz) * t) * RAD
                const el = lerp(hEl, ORBIT_EL, t) * RAD
                const r = lerp(hr, staticMode ? ORBIT_R * fitScale.current : ORBIT_R, t)
                _look.copy(TARGET).lerp(A2_FACE, t)
                camera.position.set(_look.x + r * Math.sin(az) * Math.cos(el), _look.y + r * Math.sin(el), _look.z + r * Math.cos(az) * Math.cos(el))
                fov = lerp(FOV, ORBIT_FOV, t)
            } else {
                fov = transitCamera(S, camera.position, _look)
            }
            // Cận gần hơn khi vào sảnh: màn hình kiosk ở cách máy chưa tới 1 đơn vị
            const near = S > 1.05 ? 0.1 : 1
            if (camera.fov !== fov || camera.near !== near) {
                camera.fov = fov
                camera.near = near
                camera.updateProjectionMatrix()
            }
            camera.up.set(0, 1, 0)
            camera.lookAt(_look)
            if (import.meta.env.DEV) (window as unknown as { __cam: unknown }).__cam = { S, pos: camera.position.toArray(), look: _look.toArray(), fov }
        }

        // ── Kiosk: khung nhìn dịch sang phải như mọi chương; poster DOM bám 4 góc màn 3D ──
        if (!staticMode) {
            // Hero: khuôn viên nằm gọn trong vùng 7 cột phải của lưới. Khối cầu bao chiếu lên màn hình có tâm = tâm khung + độ dịch, bán kính r0·zoom;
            // tâm đặt giữa vùng, quá rộng thì thu nhỏ (zoom < 1).
            const av = avoid.current
            const w = size.width
            let zoomT = 1
            let shiftT = subjectCenter(w, S) - w / 2
            if (!live) {
                const dist = camera.position.distanceTo(TARGET)
                const r0 = (FIT_RADIUS * size.height) / (2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2)))
                const { x0: left, x1: right } = gridSpan(w, 5, 7)
                const room = right - left
                zoomT = THREE.MathUtils.clamp(Math.min(room, w * HERO_MAX_W) / (2 * r0), 0.4, 1)
                const r = r0 * zoomT
                const c = THREE.MathUtils.clamp(w / 2 + shiftT, left + r, right - r)
                shiftT = c - w / 2
            }
            const kk = reduce ? 1 : 1 - Math.exp(-delta * 6)
            av.zoom += (zoomT - av.zoom) * kk
            av.shift += (shiftT - av.shift) * kk
            const ox = -av.shift
            if (Math.abs(ox - (camera.view?.offsetX ?? 0)) > 0.01 || Math.abs(camera.zoom - av.zoom) > 1e-4) {
                camera.zoom = av.zoom
                camera.setViewOffset(size.width, size.height, ox, 0, size.width, size.height)
            }
        }
        camera.updateMatrixWorld()
        placeKiosk(kiosk, camera, size, S, !staticMode && !calmOn)
        updateChrome(S, calmOn, delta)

        // ── Sương theo màu trời; ngoài trời nền trong suốt (thấy gradient trời CSS), vào nhà thì nền nội thất tối (đổi lúc tối màn) ──
        colors.now.copy(colors.fogA).lerp(colors.fogB, band(S, 0, 1)).lerp(colors.deep, indoor.current)
        if (indoor.current) {
            if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color()
            scene.background.copy(colors.deep)
        } else if (scene.background !== (OPAQUE ? skyTex.current : null)) scene.background = OPAQUE ? skyTex.current : null
        if (scene.fog) {
            // Sương theo khoảng cách tới tâm khuôn viên; trong sảnh (gần tâm) giữ nguyên mức ở xa để không phủ mờ nội thất
            const d = Math.max(camera.position.distanceTo(TARGET), 90)
            scene.fog.color.copy(colors.now)
            ;(scene.fog as THREE.Fog).near = d * 2.4
            ;(scene.fog as THREE.Fog).far = d * 6
        }

        // ── Hover (chỉ khi còn ở ngoài trời) ──
        // Tia từ con trỏ: tòa nào bị trúng thì được nâng lên (không nâng khi đang kéo)
        const pick = p.inside && !dragging.current && S < 1.3
        ndc.set(pick ? p.x : -9, pick ? p.y : -9)
        raycaster.setFromCamera(ndc, camera)
        const hit = pick ? raycaster.intersectObjects([...registry.current.values()], true)[0] : undefined
        let hb: BuildingName | null = null
        if (hit) {
            let o: THREE.Object3D | null = hit.object
            while (o && !o.userData.buildingName) o = o.parent
            hb = (o?.userData.buildingName as BuildingName) ?? null
        }
        if (hb !== hoverRef.current) {
            hoverRef.current = hb
            updateCursor()
        }
        registry.current.forEach((grp, name) => {
            const lift = lifts.current.get(name) ?? 0
            const next = lift + ((name === hb ? 0.9 : 0) - lift) * (reduce ? 1 : 0.12)
            lifts.current.set(name, next)
            grp.position.y = next
        })

        // ── Đo FPS (chỉ khi tab đang hiện): hai lần liên tiếp dưới 40fps thì giảm chất lượng ──
        const pf = perf.current
        pf.t += delta
        if (++pf.n >= 90) {
            const fps = pf.n / pf.t
            pf.bad = fps < 40 && !document.hidden && !lowRef.current ? pf.bad + 1 : 0
            if (pf.bad >= 2 && !lowRef.current) {
                lowRef.current = true
                setLowQuality(true)
            }
            pf.t = 0
            pf.n = 0
        }

        frame.current++

        // Chuyển hoàng hôn ↔ buổi tối
        nightRef.current += (nightTarget.current - nightRef.current) * (reduce ? 1 : 0.04)
        applyLights(nightRef.current)
        // Bóng chỉ vẽ lại khi có vật chuyển động đổ bóng (tòa nâng lên khi hover, cửa kính mở), đổi vào/ra nhà hoặc chất lượng, và vài khung đầu.
        // Số đèn và castShadow cố định (đổi chúng làm three.js biên dịch lại shader gây giật); shadowMap.autoUpdate = false.
        let liftSum = 0
        lifts.current.forEach((v) => (liftSum += v))
        const sig = `${Math.round(liftSum * 200)}|${Math.round(band(sm.current, 1.37, 1.47) * 50)}|${indoor.current}|${lowRef.current ? 1 : 0}`
        if (sig !== shadowSig.current || frame.current < 10) {
            shadowSig.current = sig
            state.gl.shadowMap.needsUpdate = true
        }
    })

    return (
        <>
            {!touch && (
                <OrbitControls
                    ref={controls}
                    makeDefault
                    target={TARGET.toArray()}
                    enableZoom={false}
                    enablePan={false}
                    enableDamping
                    dampingFactor={0.07}
                    rotateSpeed={0.7}
                    // Chỉ xoay trong khoảng hẹp quanh góc mặc định để mô hình không quét vào cột chữ; buông tay thì về lại góc mặc định
                    minAzimuthAngle={HERO_SPH.theta - AZ_RANGE}
                    maxAzimuthAngle={HERO_SPH.theta + AZ_RANGE}
                    minPolarAngle={HERO_SPH.phi - POLAR_RANGE}
                    maxPolarAngle={HERO_SPH.phi + POLAR_RANGE}
                    // Chỉ chuột trái xoay; chuột phải/giữa không bị chiếm
                    mouseButtons={{ LEFT: THREE.MOUSE.ROTATE }}
                    touches={{}}
                    onStart={onStart}
                    onEnd={onEnd}
                />
            )}
            {/* fps thấp thì hạ độ phân giải về 1, ổn định thì trả lại */}
            <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => !lowRef.current && setDpr(maxDpr)} />
            {PERF_ON && <PerfHud />}
            <hemisphereLight ref={hemi} args={[CAMPUS.skyLight, CAMPUS.groundLight, 0.5 * Math.PI]} />
            <directionalLight
                ref={sun}
                color={CAMPUS.sunlight}
                intensity={1.15 * Math.PI}
                position={[-26, 38, 22]}
                castShadow
                shadow-mapSize={isWebKit ? [1024, 1024] : [2048, 2048]}
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
            <group ref={world}>
                <Campus registry={registry} nightRef={nightRef} reduce={reduce} dailyLit={dailyLit} stage={sm} lowQuality={lowQuality} />
            </group>
        </>
    )
}

// ─── Điểm vào: Canvas + chờ font trước khi dựng chữ lên texture ────────────

export interface CampusSceneProps {
    night: boolean
    reduce: boolean
    staticMode: boolean
    flat: boolean
    stage: React.MutableRefObject<number>
    dailyLit: React.MutableRefObject<DailyLit>
    kiosk: KioskBridge
}

/**
 * Vẽ canvas trong vòng rAF chung (lib/frame-loop), sau Lenis và máy quay: Canvas ở frameloop="never", ở đây gọi advance.
 * Không vẽ khi không ai thấy: tab ẩn, footer đã phủ kín màn (số đo từ page-metrics, không đọc layout), hoặc màn chuyển giao diện đang che.
 */
function FrameDriver({ kiosk }: { kiosk: KioskBridge }) {
    const advance = useThree((s) => s.advance)
    const clock = useThree((s) => s.clock)
    useEffect(() => {
        let prev = 0
        let drew = false
        return addFrame((t) => {
            // Delta tối đa 0,1s: khung bị treo lâu (tab ẩn) không tạo delta khổng lồ
            const dt = Math.min(prev ? (t - prev) / 1000 : 0.016, 0.1)
            prev = t
            footerFade(kiosk, kiosk.calm.current)
            // Footer đã phủ quá 60% màn: dừng vẽ cảnh, giữ khung cuối (canvas đang mờ dần bằng opacity của lớp stage)
            if (document.hidden || useThemeStore.getState().frozen || footerCover() > (page.paged ? 0.999 : FOOTER_STOP)) return
            advance(clock.elapsedTime + dt)
            // Canvas đục đã có khung đầu: trời đã vẽ bằng WebGL, bỏ gradient CSS phía sau
            if (!drew && OPAQUE) {
                drew = true
                kiosk.stage.current?.classList.add('sky-gl')
            }
        }, 1)
    }, [advance, clock, kiosk])
    return null
}

export default function CampusScene({ night, reduce, staticMode, flat, stage, dailyLit, kiosk }: CampusSceneProps) {
    const [fontsReady, setFontsReady] = useState(false)
    const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches)
    const pointer = useRef({ x: 0, y: 0, inside: false })
    const canvasWrap = useRef<HTMLDivElement>(null)

    // Chờ font Be Vietnam Pro (tối đa 1,5 giây) để chữ trên biển hiệu không bị font dự phòng
    useEffect(() => {
        let alive = true
        const loads = document.fonts?.load
            ? Promise.all([document.fonts.load('800 40px "Be Vietnam Pro"', 'HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG')])
            : Promise.resolve()
        Promise.race([loads, new Promise((r) => setTimeout(r, 1500))]).finally(() => alive && setFontsReady(true))
        return () => {
            alive = false
        }
    }, [])

    // Con trỏ theo dõi toàn trang; chỉ tính là "trên cảnh" khi đang ở trên canvas (chữ và thẻ nằm đè nên không nhận hover của cảnh)
    const cvSize = useRef({ w: 0, h: 0 })
    useEffect(() => {
        const wrap = canvasWrap.current
        if (!wrap) return
        const ro = new ResizeObserver(([e]) => (cvSize.current = { w: e.contentRect.width, h: e.contentRect.height }))
        ro.observe(wrap)
        return () => ro.disconnect()
    }, [])
    useEffect(() => {
        const move = (e: PointerEvent) => {
            const cv = canvasWrap.current?.querySelector('canvas')
            if (!cv || e.target !== cv) {
                pointer.current.inside = false
                return
            }
            // offsetX/Y theo canvas (không đọc layout bằng getBoundingClientRect); kích thước canvas đo sẵn
            const { w, h } = cvSize.current
            if (!w || !h) return
            pointer.current = { x: (e.offsetX / w) * 2 - 1, y: -((e.offsetY / h) * 2 - 1), inside: true }
        }
        const leave = () => {
            pointer.current.inside = false
        }
        window.addEventListener('pointermove', move, { passive: true })
        document.documentElement.addEventListener('pointerleave', leave)
        return () => {
            window.removeEventListener('pointermove', move)
            document.documentElement.removeEventListener('pointerleave', leave)
        }
    }, [])

    return (
        <div ref={canvasWrap} className="absolute inset-0">
            {fontsReady && !FLAGS.no3d && (
                <Canvas
                    frameloop="never"
                    legacy
                    flat
                    shadows="percentage"
                    dpr={[1, DPR_MAX]}
                    camera={{ fov: FOV, position: START_POS.toArray(), near: 1, far: 400 }}
                    gl={{ antialias: !(isWebKit && NO_AA), alpha: !OPAQUE }}
                    onCreated={({ gl, scene }) => {
                        gl.shadowMap.autoUpdate = false
                        gl.shadowMap.needsUpdate = true
                        // Màu tươi như ảnh minh họa phẳng: tone mapping (Khronos Neutral giữ nguyên độ bão hòa; ACES/AgX làm xỉn màu), phơi sáng 1,15
                        gl.toneMapping = THREE.NeutralToneMapping
                        gl.toneMappingExposure = 1.15
                        applyGlassEnv(gl, scene)
                    }}
                    aria-label="Mô hình 3D khuôn viên PTIT, kéo để xoay"
                    role="img"
                >
                    <FrameDriver kiosk={kiosk} />
                    <Scene night={night} reduce={reduce} touch={touch} staticMode={staticMode} flat={flat} stage={stage} dailyLit={dailyLit} kiosk={kiosk} pointer={pointer} />
                </Canvas>
            )}
        </div>
    )
}
