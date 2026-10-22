import { courseOfBuilding } from '@/lib/campus-courses'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useThemeStore } from '@/store/useThemeStore'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { CAMPUS } from './campus-palette'
import { A2_AT, A2Lobby, A2Podium, a2Point, HallA2, kioskScreenFrame, lobbyPoint, PODIUM_TOP, SCR_H, SCR_W } from './campus-a2'
import { STUDIO_Z } from './campus-room'
import { KIOSK_H, KIOSK_W, type KioskBridge } from './kiosk-screen'
import { Box, Cylinder, Gable, HipRoof, stdMat, TextPlane, type TextOpts, type Vec3 } from './campus-prims'

// Khuôn viên PTIT low-poly, chuyển từ docs/ptit-campus.html (three.js thuần) sang React Three Fiber.
// Hình khối, màu và số đo giữ nguyên bản gốc; không dùng file model nào. Tòa A2 (đế rộng, sảnh kính) và Hội trường A2
// theo bản mẫu docs/mockup/orbit-campus-journey.html (xem campus-a2.tsx).
// Canvas chạy chế độ legacy + flat (không color management, không tone mapping) và cường độ đèn
// nhân π để ra đúng màu như bản three r128 mà bản gốc dùng.

const C = CAMPUS

// Hằng số ngoài component để useMemo của TextPlane không tính lại mỗi lần render
const T_PTIT: TextOpts = { size: 200 }
const T_HEART: TextOpts = { size: 170 }
const T_GATE: TextOpts = { size: [120, 62], h: 256 }

// ─── Tòa nhà (có nâng khi hover và nhãn) ───────────────────────────────────

interface BuildingProps {
    name: string
    anchorY: number
    position: Vec3
    hovered: boolean
    /** Nhãn đang hiển thị (không bị che, không chồng nhãn khác) */
    labelVisible: boolean
    /** % tiến độ khóa của tòa (hiện cạnh tên khóa); undefined nếu tòa không có khóa */
    pct?: number
    registry: React.MutableRefObject<Map<string, THREE.Group>>
    /** Xoay quanh trục đứng (rad), mặc định mặt trước nhìn về +z */
    rotY?: number
    children: ReactNode
}

function Building({ name, anchorY, position, hovered, labelVisible, pct, registry, rotY = 0, children }: BuildingProps) {
    const ref = useRef<THREE.Group>(null)
    useLayoutEffect(() => {
        const g = ref.current
        if (!g) return
        const map = registry.current
        g.userData.buildingName = name
        g.userData.anchorY = anchorY
        g.userData.labelSub = courseOfBuilding(name)?.title ?? 'Sắp mở'
        map.set(name, g)
        return () => {
            map.delete(name)
        }
    }, [name, anchorY, registry])

    const hidden = !labelVisible && !hovered
    const course = courseOfBuilding(name)
    return (
        <group ref={ref} position={position} rotation={[0, rotY, 0]}>
            {children}
            <Html position={[0, anchorY, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <div
                    className="flex w-max -translate-x-1/2 -translate-y-full flex-col items-center gap-1 transition-opacity duration-200"
                    style={{ opacity: hidden ? 0 : 1, visibility: hidden ? 'hidden' : 'visible' }}
                >
                    <div
                        className={`w-max max-w-[220px] whitespace-nowrap rounded-xl px-[11px] py-[7px] text-xs font-bold shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition duration-200 ${
                            hovered ? '-translate-y-1.5 bg-brand-600 text-ink-foreground' : 'bg-card/95 text-foreground'
                        }`}
                    >
                        {name}
                        {/* Dòng phụ: khóa học thật của tòa, hoặc "Sắp mở" nếu chưa có khóa */}
                        <small className={`mt-0.5 block text-[11px] font-medium ${hovered ? 'text-ink-foreground/85' : 'text-muted-foreground'}`}>
                            {course ? (hovered ? `${course.title} · bấm để vào khóa` : `${course.title}${pct === undefined ? '' : ` · ${pct}%`}`) : 'Sắp mở'}
                        </small>
                    </div>
                    <div className="h-4 w-0.5 bg-ink-foreground/80" />
                </div>
            </Html>
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

/** 3 tầng cửa sổ A2 = 3 bài Daily hôm nay: slot thuộc tầng nào theo chiều cao (10 tầng nhà chia 3 nhóm, thấp → cao). */
const TIER_OF_SLOT = WIN_SLOTS.map(([, y]) => Math.min(2, Math.floor(((y - 3.5) / 1.02) / (10 / 3))))
const TIER_SLOTS = [0, 1, 2].map((t) => WIN_SLOTS.map((_, i) => i).filter((i) => TIER_OF_SLOT[i] === t))
/** Độ sáng hiện tại của từng tầng (0..1). Để ở module: rời trang chủ rồi quay lại thì tầng mới đọc sáng lên mượt từ giá trị cũ. */
const tierShown = [0, 0, 0]
const TIER_EPS_STAGE = 0.78 // chỉ chạy hiệu ứng khi chương Hôm nay đã vào khung nhìn

function A2Windows({ nightRef, reduce, dailyLit, stage }: { nightRef: React.MutableRefObject<number>; reduce: boolean; dailyLit: React.MutableRefObject<boolean[]>; stage: React.MutableRefObject<number> }) {
    const winRef = useRef<THREE.InstancedMesh>(null)
    const litRef = useRef<THREE.InstancedMesh>(null)
    const tierRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null])
    const tierMats = useRef<(THREE.MeshBasicMaterial | null)[]>([null, null, null])
    const lit = useRef<boolean[]>(new Array(WIN_SLOTS.length).fill(false))
    const flickerT = useRef(0)

    useLayoutEffect(() => {
        const win = winRef.current
        const lm = litRef.current
        if (!win || !lm) return
        WIN_SLOTS.forEach((_, i) => {
            setSlot(win, i, null)
            setSlot(lm, i, false)
        })
        win.instanceMatrix.needsUpdate = true
        lm.instanceMatrix.needsUpdate = true
        // Lớp tầng: đặt đúng chỗ, lệch ra 0.04 để nằm trên lớp đèn ngẫu nhiên
        TIER_SLOTS.forEach((slots, t) => {
            const m = tierRefs.current[t]
            if (!m) return
            slots.forEach((slot, k) => {
                const [x, y, z, ry] = WIN_SLOTS[slot]
                dummy.position.set(x + (ry ? 0.04 : 0), y, z + (ry ? 0 : 0.04))
                dummy.rotation.set(0, ry, 0)
                dummy.scale.setScalar(1)
                dummy.updateMatrix()
                m.setMatrixAt(k, dummy.matrix)
            })
            m.instanceMatrix.needsUpdate = true
        })
    }, [])

    useFrame((_, delta) => {
        // Tầng theo bài Daily đã đọc: chỉ đổi opacity vật liệu, không đụng React
        const active = stage.current > TIER_EPS_STAGE
        const gate = Math.min(1, Math.max(0, (stage.current - 0.75) / 0.25))
        for (let t = 0; t < 3; t++) {
            if (active) {
                const want = dailyLit.current[t] ? 1 : 0
                tierShown[t] = reduce ? want : tierShown[t] + (want - tierShown[t]) * (1 - Math.exp(-delta * 3.2))
                if (Math.abs(want - tierShown[t]) < 0.002) tierShown[t] = want
            }
            const mat = tierMats.current[t]
            const m = tierRefs.current[t]
            if (mat && m) {
                // Sáng dần theo chương (gate), khi sang Studio giữ nguyên
                mat.opacity = tierShown[t] * gate
                m.visible = mat.opacity > 0.003
            }
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
            {TIER_SLOTS.map((slots, t) => (
                <instancedMesh key={t} ref={(m) => void (tierRefs.current[t] = m)} args={[undefined, undefined, slots.length]} visible={false}>
                    <boxGeometry args={[0.5, 0.62, 0.08]} />
                    <meshBasicMaterial ref={(m) => void (tierMats.current[t] = m)} color={CAMPUS.windowTier} transparent opacity={0} depthWrite={false} />
                </instancedMesh>
            ))}
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
                    <meshStandardMaterial color={CAMPUS.pureWhite} flatShading transparent opacity={0.92} />
                </mesh>
            ))}
        </group>
    )
}

// ─── Mô hình khuôn viên ────────────────────────────────────────────────────

type BuildingName = 'Tòa A2' | 'Hội trường A2' | 'Tòa A3' | 'Hội trường A1' | 'Tòa A1' | 'Canteen' | 'Cổng trường'

// Bố cục theo bản mẫu: đế A2 chiếm x ∈ [-8.6, 12.6], z ∈ [-21.7, 7]; các tòa/cây/bãi cỏ nằm ngoài vùng đó
const TREE_SPOTS: [number, number][] = [[-21, 15], [-18, 16.5], [-12.5, 16.5], [-5, 14], [-20.5, 3], [-21, -5], [-21, -17.5], [-17, -18.5], [-12, -18.5], [-10.8, 6.5], [-10.8, -2], [-11, -6], [-7, 9], [7.5, 8.5], [13.5, 16], [17, 16.5], [20.5, 15], [20.8, 9], [20.8, 4], [21.2, -9], [10, 13], [-8, 12.5]]
const LAWNS: [number, number, number, number][] = [[-15, 14, 9, 4], [16, 10, 9, 7], [-15.5, -5, 8, 4]]
const CARS: [string, number, number][] = [[CAMPUS.ptitRed, -5.5, 11], [CAMPUS.pureWhite, -7.8, 11.2], [CAMPUS.carDark, 8.8, 10.5], [CAMPUS.carSilver, 10.6, 10.8]]

interface WorldProps {
    hovered: BuildingName | null
    visibleLabels: ReadonlySet<string>
    registry: React.MutableRefObject<Map<string, THREE.Group>>
    nightRef: React.MutableRefObject<number>
    reduce: boolean
    dailyLit: React.MutableRefObject<boolean[]>
    /** S đã làm mượt (Scene ghi mỗi khung hình) */
    stage: React.MutableRefObject<number>
    coursePct: Readonly<Record<string, number>>
    /** Máy yếu: cây không đổ bóng */
    lowQuality: boolean
}

/** Vị trí cổng trường (gốc cổng, mặt ngoài hướng +z): đường máy quay chương 02 đi dưới dầm cổng */
const GATE_AT: Vec3 = [2, 0, 16.5]

/** Tấm biển cổng: ban đêm hắt sáng nhẹ như hộp đèn, kèm một đèn điểm yếu phía trước (không đổ bóng) */
function GateSign({ nightRef, size = [7.4, 1.6, 0.2], at = [0, 4.9, 0], withLight = true }: { nightRef: React.MutableRefObject<number>; size?: Vec3; at?: Vec3; withLight?: boolean }) {
    const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: CAMPUS.gateSign, flatShading: true, roughness: 0.9, emissive: CAMPUS.windowLit, emissiveIntensity: 0 }), [])
    const light = useRef<THREE.PointLight>(null)
    useEffect(() => () => mat.dispose(), [mat])
    useFrame(() => {
        const n = nightRef.current
        mat.emissiveIntensity = 0.6 * n
        if (light.current) {
            light.current.intensity = 1.2 * Math.PI * n
            light.current.visible = n > 0.01
        }
    })
    return (
        <>
            <mesh position={at} material={mat} castShadow receiveShadow>
                <boxGeometry args={size} />
            </mesh>
            {withLight && <pointLight ref={light} position={[at[0], at[1], at[2] + 1.6]} color={CAMPUS.windowLit} distance={7} decay={2} intensity={0} />}
        </>
    )
}

function Campus({ hovered, visibleLabels, registry, nightRef, reduce, dailyLit, stage, coursePct, lowQuality }: WorldProps) {
    const b = (name: BuildingName) => ({ registry, name, hovered: hovered === name, labelVisible: visibleLabels.has(name), pct: coursePct[name] })

    return (
        <>
            {/* Nền, đường, bãi cỏ */}
            <Box s={[46, 1, 42]} c={C.plateEdge} at={[0, -1.2, -1]} />
            <Box s={[45, 0.4, 41]} c={C.plate} at={[0, -0.4, -1]} />
            <Box s={[45, 0.02, 2]} c={C.road} at={[0, 0, 18.4]} />
            <Box s={[5, 0.02, 11]} c={C.pave} at={[2, 0, 11]} />
            {LAWNS.map(([x, z, w, d], i) => (
                <Box key={i} s={[w, 0.08, d]} c={i % 2 ? C.grassDark : C.grass} at={[x, 0, z]} />
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
            <Building {...b('Tòa A2')} anchorY={20.2} position={A2_AT}>
                <A2Podium stage={stage} />
                <A2Lobby stage={stage} />
                <group position={[0, PODIUM_TOP - 2.8, 0]}>
                    <Box s={[6.8, 11, 4.6]} c={C.cream} at={[0, 2.8, -0.8]} />
                    <Box s={[1.3, 9.6, 3.8]} c={C.cream} at={[-4.05, 2.8, -0.8]} />
                    <Box s={[1.3, 9.6, 3.8]} c={C.cream} at={[4.05, 2.8, -0.8]} />
                    <Box s={[1.8, 10.4, 0.25]} c={C.glass} at={[0, 3.1, 1.6]} o={{ roughness: 0.25, metalness: 0.35 }} />
                    <Box s={[0.25, 9, 1.8]} c={C.glass} at={[-4.75, 3.2, -0.8]} o={{ roughness: 0.25, metalness: 0.35 }} />
                    <Box s={[6.8, 0.5, 4.8]} c={CAMPUS.cornice} at={[0, 13.8, -0.8]} />
                    <HipRoof w={5.2} h={1.6} d={3.6} c={C.roofRed} at={[0, 14.3, -1.2]} />
                    <Gable len={0.5} h={1.8} depth={5} c={C.cream} at={[0, 13.8, 1.35]} alongZ />
                    {/* Đồng hồ */}
                    <mesh position={[0, 14.55, 1.65]} rotation={[Math.PI / 2, 0, 0]} material={stdMat(CAMPUS.pureWhite)} castShadow receiveShadow>
                        <cylinderGeometry args={[0.62, 0.62, 0.12, 24]} />
                    </mesh>
                    <mesh position={[0, 14.55, 1.7]} material={stdMat(C.glass)} castShadow receiveShadow>
                        <torusGeometry args={[0.62, 0.08, 6, 24]} />
                    </mesh>
                    <Box s={[0.06, 0.45, 0.04]} c={CAMPUS.ink} at={[0, 14.55, 1.74]} />
                    <Box s={[0.36, 0.06, 0.04]} c={CAMPUS.ink} at={[0.16, 14.55, 1.74]} />
                    {/* Biển nền mỏng nằm trên dải kính (rộng 1.8) làm khung cho chữ */}
                    <GateSign nightRef={nightRef} size={[1.6, 0.7, 0.06]} at={[0, 12.9, 1.755]} withLight={false} />
                    <TextPlane w={1.4} h={0.5} text="PTIT" at={[0, 12.9, 1.8]} opts={T_PTIT} nightRef={nightRef} glow={!lowQuality} />

                    <A2Windows nightRef={nightRef} reduce={reduce} dailyLit={dailyLit} stage={stage} />
                </group>

                <TextPlane w={3.2} h={0.8} text="I ♥ PTIT" at={[7.6, 0.5, 5.6]} opts={T_HEART} doubleSide />
                {([[-8.4, CAMPUS.ptitRed], [-7.6, CAMPUS.flagYellow], [-6.8, CAMPUS.flagBlue]] as const).map(([x, c], i) => (
                    <Flag key={x} x={x} color={c} index={i} reduce={reduce} />
                ))}
            </Building>

            {/* Hội trường A2: bên trái A2, cỡ nửa A2 */}
            <Building {...b('Hội trường A2')} anchorY={10.4} position={[-15.4, 0, 1]}>
                <HallA2 />
            </Building>

            {/* Tòa A3: khối vàng, mái chóp đỏ; xoay mặt về phía A2 */}
            <Building {...b('Tòa A3')} anchorY={7.6} position={[17.5, 0, -6]} rotY={-Math.PI / 2}>
                <Box s={[13, 4.6, 4.4]} c={C.yellow} />
                {Array.from({ length: 10 }, (_, i) => (
                    <Box key={i} s={[0.7, 3.4, 0.1]} c={C.win} at={[-5.4 + i * 1.2, 0.6, 2.23]} />
                ))}
                <HipRoof w={14} h={2} d={5.4} c={C.roofRed} at={[0, 4.6, 0]} />
                <Box s={[2.6, 5.2, 1]} c={C.yellow} at={[0, 0, 2.6]} />
                <Gable len={1.2} h={1.2} depth={3} c={C.roofRed} at={[0, 5.2, 2.6]} alongZ />
            </Building>

            {/* Hội trường A1: dài, trắng, mái đầu hồi đỏ */}
            <Building {...b('Hội trường A1')} anchorY={6.2} position={[-15.5, 0, -11]}>
                <Box s={[12, 3.6, 5]} c={C.white} />
                {Array.from({ length: 8 }, (_, i) => (
                    <Box key={i} s={[0.8, 1.6, 0.1]} c={CAMPUS.hallWindow} at={[-4.9 + i * 1.4, 1, 2.53]} />
                ))}
                <Gable len={12.6} h={2.2} depth={5.8} c={C.roofRed} at={[0, 3.6, 0]} />
                <Box s={[3, 4.4, 1.2]} c={C.white} at={[0, 0, 3]} />
                <Gable len={1.4} h={1.4} depth={3.4} c={C.roofRed} at={[0, 4.4, 3]} alongZ />
            </Building>

            {/* Tòa A1: khối trắng thấp có dải ngang */}
            <Building {...b('Tòa A1')} anchorY={6.4} position={[-16, 0, 8]}>
                <Box s={[7.5, 5.2, 6]} c={C.white} />
                {Array.from({ length: 5 }, (_, r) => (
                    <Box key={r} s={[7.6, 0.18, 6.1]} c={C.stripe} at={[0, 0.7 + r * 0.95, 0]} />
                ))}
                <Box s={[7.6, 0.9, 0.1]} c={CAMPUS.bandGreen} at={[0, 0.2, 3.05]} />
            </Building>

            <Building {...b('Canteen')} anchorY={4.2} position={[17.5, 0, -17.5]}>
                <Box s={[5.5, 2.2, 3.4]} c={C.white} />
                <HipRoof w={6.4} h={1.4} d={4.2} c={C.roofRed} at={[0, 2.2, 0]} />
            </Building>

            <Building {...b('Cổng trường')} anchorY={5.6} position={GATE_AT}>
                {[-3.4, 3.4].map((x) => (
                    <Box key={x} s={[0.8, 3.6, 0.8]} c={CAMPUS.gatePost} at={[x, 0, 0]} />
                ))}
                <Box s={[8, 0.5, 1]} c={CAMPUS.gateBeam} at={[0, 3.6, 0]} />
                <GateSign nightRef={nightRef} />
                <TextPlane w={7.0} h={1.3} text={'HỌC VIỆN\nCÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG'} at={[0, 4.9, 0.115]} opts={T_GATE} nightRef={nightRef} glow={!lowQuality} />
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
const Y_AXIS = new THREE.Vector3(0, 1, 0)

/** Phạm vi cần nằm gọn trong khung ở mọi góc xoay (đơn vị cảnh): bán kính ngang (đế + mây) và nửa chiều cao (tính cả nhãn). */
const BOUND_RADIUS = 31
const BOUND_HALF_HEIGHT = 20
const FIT_MARGIN = 1.05
const FOV = 28
/** Sau khi buông tay, chờ chừng này rồi mới tự xoay tiếp. */
const RESUME_AUTOROTATE_MS = 3000
/** S ≤ ngưỡng này là còn ở hero: OrbitControls và tự xoay hoạt động; vượt ngưỡng thì camera chạy theo đường bay. */
const HERO_EPS = 0.05
/** Màn rộng: chủ thể nằm ở nửa phải. Vùng trống rộng ~62% khung, tâm dịch sang phải 18% bề rộng. */
const DESKTOP_REGION = 0.62
const DESKTOP_SHIFT = 0.18
/** Tỉ lệ rộng/cao của vùng trống mà khung chính diện A2 (chế độ tĩnh) được viết cho; vùng hẹp hơn thì camera lùi xa tương ứng. */
const REF_ASPECT = 1.05
/** Làm mượt độ tối nền khi có chữ (đích chỉ là 0/1) */
const DIM_SMOOTH = 3

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
/** Khoảng cách để màn hình kiosk chiếm ~84% chiều cao khung ở FOV 46 */
const KIOSK_D = KSCR.height / (0.84 * 2 * Math.tan(THREE.MathUtils.degToRad(23)))
/** Hướng nhìn 3/4 vào màn: pháp tuyến xoay -0,2 rad quanh trục dọc của màn và +0,12 quanh trục ngang (không nhìn thẳng góc) */
const KDIR = KSCR.normal.clone().applyAxisAngle(KSCR.up, -0.2).applyAxisAngle(KSCR.right, 0.12).normalize()
const KIOSK_CAM = KSCR.center.clone().addScaledVector(KDIR, KIOSK_D * 1.6)
const KIOSK_FAR = KSCR.center.clone().addScaledVector(KDIR, KIOSK_D * 2.5)
const KIOSK_BACK = KSCR.center.clone().addScaledVector(KDIR, KIOSK_D * 2.2)
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
            const t = gatePos.getUtoTmapping(k)
            gatePos.getPoint(t, pos)
            gateLook.getPoint(t, look)
            return lerp(ORBIT_FOV, 44, smoothstep(clamp01(k * 1.6)))
        }
        pos.copy(KIOSK_FAR).lerp(KIOSK_CAM, easeOut((u - CUT2) / (1 - CUT2)))
        look.copy(KSCR.center)
        return 46
    }
    if (s >= 3) {
        pos.copy(ROOM_B)
        look.copy(ROOM_LOOK)
        return 44
    }
    const u = band(s, 1.8, 3)
    if (u < CUT3) {
        pos.copy(KIOSK_CAM).lerp(KIOSK_BACK, smoothstep(u / CUT3))
        look.copy(KSCR.center)
        return 46
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
/** Mức zoom vào kiosk: 0 → 1 trong S 1.55–1.74, rời đi ở S 1.86–2.1 */
const kioskFocus = (s: number) => band(s, 1.55, 1.74) * (1 - band(s, 1.86, 2.1))

function placeKiosk(kiosk: KioskBridge, camera: THREE.PerspectiveCamera, size: { width: number; height: number }, S: number, f: number, enabled: boolean) {
    const el = kiosk.screen.current
    kiosk.root.current?.style.setProperty('--kiosk-focus', f.toFixed(3))
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
    const shown = op * (0.4 + 0.6 * f)
    // Chỉ nhận chuột/bàn phím khi đã zoom xong
    const live = f > 0.9 && op > 0.9
    el.style.opacity = shown.toFixed(3)
    el.style.visibility = shown > 0.002 ? 'visible' : 'hidden'
    el.style.pointerEvents = live ? 'auto' : 'none'
    el.inert = !live
    if (op > 0) el.style.transform = homography(KIOSK_W, KIOSK_H, pts)
}

const CAPTIONS: [number, string][] = [[0.15, 'Khuôn viên PTIT'], [1, 'Vòng quanh trường'], [1.5, 'Tòa A2 · cửa kính tự mở'], [2.23, 'Sảnh A2']]
const captionAt = (s: number) => CAPTIONS.find(([to]) => s < to)?.[1] ?? 'Phòng thực hành'

/**
 * Phần "vỏ" quanh cảnh, ghi thẳng vào DOM (chỉ khi giá trị đổi): chú thích máy quay, canvas và dock mờ dần khi footer đi vào.
 * Chế độ làm mờ để CSS (data-calm) lo phần canvas.
 */
function updateChrome(kiosk: KioskBridge, S: number, calm: boolean, delta: number, last: { cap: string; stage: string; dock: string; dip: string; dim: number; dimCss: string }) {
    const footer = kiosk.footer.current
    const out = footer ? clamp01(1 - footer.getBoundingClientRect().top / window.innerHeight) : 0
    const stageOpacity = calm ? '' : (1 - out * 0.9).toFixed(3)
    const dockOpacity = (1 - out).toFixed(2)
    // Độ tối nền khi có chữ: hook ghi đích 0/1 (data-on-stage), ở đây làm mượt theo thời gian rồi ghi --on-stage
    const root = kiosk.root.current
    if (root) {
        const target = root.dataset.onStage === '1' ? 1 : 0
        last.dim += (target - last.dim) * (1 - Math.exp(-Math.min(delta, 0.2) * DIM_SMOOTH))
        if (Math.abs(target - last.dim) < 0.001) last.dim = target
        const css = last.dim.toFixed(3)
        if (css !== last.dimCss) {
            last.dimCss = css
            root.style.setProperty('--on-stage', css)
        }
    }
    const cap = captionAt(S)
    const dip = dipAt(S).toFixed(3)
    if (dip !== last.dip && kiosk.dip.current) {
        last.dip = dip
        kiosk.dip.current.style.opacity = dip
    }
    if (stageOpacity !== last.stage && kiosk.stage.current) {
        last.stage = stageOpacity
        kiosk.stage.current.style.opacity = stageOpacity
    }
    const dock = kiosk.dock.current
    if (dock && dockOpacity !== last.dock) {
        last.dock = dockOpacity
        dock.style.opacity = dockOpacity
        dock.style.pointerEvents = out > 0.5 ? 'none' : ''
    }
    if (cap !== last.cap && kiosk.cap.current) {
        last.cap = cap
        kiosk.cap.current.textContent = cap
    }
}

const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const RAD = Math.PI / 180
const lerp = THREE.MathUtils.lerp
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const smoothstep = (x: number) => x * x * (3 - 2 * x)
/** 0→1 khi s đi từ a tới b */
const band = (s: number, a: number, b: number) => clamp01((s - a) / (b - a))

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
    dailyLit: React.MutableRefObject<boolean[]>
    /** Màn kiosk (DOM) được định vị lên màn 3D */
    kiosk: KioskBridge
    /** % tiến độ khóa theo tên tòa, hiện trên nhãn */
    coursePct: Readonly<Record<string, number>>
    pointer: React.MutableRefObject<{ x: number; y: number; inside: boolean }>
    /** Bấm vào tòa có khóa học thì mở khóa đó */
    onOpenCourse?: (courseId: string) => void
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
        const regionW = staticMode ? w : w * DESKTOP_REGION
        const ra = regionW / h
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
        // Tầm nhìn hiện có = 2·d·tanHalf theo chiều dọc và ·(w/h) theo chiều ngang
        const fitW = (BOUND_RADIUS * FIT_MARGIN) / (tanHalf * ra)
        const fitH = (BOUND_HALF_HEIGHT * FIT_MARGIN) / tanHalf
        const distance = Math.max(fitW, fitH)
        fitScale.current = Math.max(1, REF_ASPECT / ra)

        camera.aspect = w / h
        // Cắt khung từ vị trí âm = đẩy cảnh sang phải
        camera.setViewOffset(w, h, staticMode ? 0 : -w * DESKTOP_SHIFT, 0, w, h)
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

const _anchor = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _look = new THREE.Vector3()

/**
 * Chọn nhãn được hiện: ưu tiên tòa đang hover rồi tới tòa gần camera; bỏ nhãn nằm ngoài khung,
 * bị tòa khác che (tia từ camera tới điểm neo trúng tòa khác) hoặc chồng lên nhãn đã chọn.
 */
function computeVisibleLabels(
    registry: Map<string, THREE.Group>,
    camera: THREE.PerspectiveCamera,
    size: { width: number; height: number },
    raycaster: THREE.Raycaster,
    hovered: string | null,
) {
    const items = [...registry.entries()].map(([name, grp]) => {
        _anchor.set(0, grp.userData.anchorY as number, 0)
        grp.localToWorld(_anchor)
        const world = _anchor.clone()
        const dist = world.distanceTo(camera.position)
        const p = world.clone().project(camera)
        return { name, grp, world, dist, x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, behind: p.z > 1 }
    })
    items.sort((a, b) => (a.name === hovered ? -1 : b.name === hovered ? 1 : a.dist - b.dist))

    const taken: { l: number; t: number; r: number; b: number }[] = []
    const shown: string[] = []
    for (const it of items) {
        // Hộp nhãn ước lượng: chip (tên) + cọc 16px phía trên điểm neo, rộng theo độ dài chữ
        const w = Math.max(it.name.length, String(it.grp.userData.labelSub ?? '').length * 0.85) * 7.6 + 30
        const rect = { l: it.x - w / 2, r: it.x + w / 2, t: it.y - 16 - 48, b: it.y }
        if (it.behind || rect.l < 4 || rect.r > size.width - 4 || rect.t < 4 || rect.b > size.height - 4) continue
        if (it.name !== hovered) {
            if (taken.some((o) => rect.l < o.r + 6 && rect.r > o.l - 6 && rect.t < o.b + 6 && rect.b > o.t - 6)) continue
            _dir.copy(it.world).sub(camera.position).normalize()
            raycaster.set(camera.position, _dir)
            raycaster.far = it.dist - 1.5
            const others = items.filter((o) => o.name !== it.name).map((o) => o.grp)
            const blocked = raycaster.intersectObjects(others, true).length > 0
            raycaster.far = Infinity
            if (blocked) continue
        }
        taken.push(rect)
        shown.push(it.name)
    }
    return shown.sort().join('|')
}

function Scene({ night, reduce, touch, staticMode, flat, stage, dailyLit, kiosk, coursePct, pointer, onOpenCourse }: SceneProps) {
    const world = useRef<THREE.Group>(null)
    const hemi = useRef<THREE.HemisphereLight>(null)
    const sun = useRef<THREE.DirectionalLight>(null)
    const rim = useRef<THREE.DirectionalLight>(null)
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
    const chrome = useRef({ cap: '', stage: '', dock: '', dip: '', dim: 0, dimCss: '' })
    // Đo FPS: dưới 40 thì giảm chất lượng (shadow map nhỏ, cây không đổ bóng)
    const perf = useRef({ t: 0, n: 0, bad: 0 })
    const [lowQuality, setLowQuality] = useState(false)
    const lowRef = useRef(false)
    const heroPos = useRef(START_POS.clone())
    const fitScale = useRef(1)
    const [hovered, setHovered] = useState<BuildingName | null>(null)
    const [visibleLabels, setVisibleLabels] = useState<ReadonlySet<string>>(() => new Set())
    const labelKey = useRef('')
    const frame = useRef(0)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const ndc = useMemo(() => new THREE.Vector2(-9, -9), [])
    // Sương lấy từ token trời (--sky-*), nền nội thất từ --stage-deep. Đọc lại khi đổi giao diện sáng/tối (trời ngoài trời là gradient CSS sau canvas trong suốt).
    const colors = useMemo(() => ({ fogA: new THREE.Color(), fogB: new THREE.Color(), deep: tokenColor('--stage-deep', '#130D0E'), now: new THREE.Color() }), [])
    const readSky = () => {
        colors.fogA.copy(tokenColor('--sky-2', '#F2E7DB'))
        colors.fogB.copy(tokenColor('--sky-3', '#F8F2EA'))
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
        scene.background = null
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
            sun.current.intensity = (1.05 - n * 0.75) * Math.PI * (1 - inside)
            sun.current.color.copy(SUN_DAY).lerp(SUN_NIGHT, n)
        }
        if (hemi.current) {
            hemi.current.intensity = (0.75 - n * 0.4) * Math.PI * (1 - 0.68 * inside)
            hemi.current.color.copy(HEMI_SKY_DAY).lerp(HEMI_SKY_NIGHT, n)
            hemi.current.groundColor.copy(HEMI_GROUND_DAY).lerp(HEMI_GROUND_NIGHT, n)
        }
        if (rim.current) rim.current.intensity = (0.35 + n * 0.25) * Math.PI * (1 - inside)
    }

    // Màn chuyển giao diện đang che: đặt thẳng ánh sáng mới rồi vẽ đúng một khung (canvas đang dừng)
    const frozen = useThemeStore((s) => s.frozen)
    const advance = useThree((s) => s.advance)
    useEffect(() => {
        nightTarget.current = night ? 1 : 0
        if (reduce || frozen) {
            nightRef.current = nightTarget.current
            applyLights(nightRef.current)
            if (frozen) advance(performance.now())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [night, reduce, frozen])

    const updateCursor = () => {
        domElement.style.cursor = hoverRef.current && courseOfBuilding(hoverRef.current) ? 'pointer' : touch || !ctlOn.current ? 'default' : dragging.current ? 'grabbing' : 'grab'
    }
    useEffect(() => {
        domElement.style.touchAction = touch ? 'pan-y' : 'none'
        updateCursor()
        return () => window.clearTimeout(resumeTimer.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [domElement, touch])

    // Giảm chất lượng: shadow map nhỏ hơn (tạo lại khi đổi kích thước)
    const setDpr = useThree((s) => s.setDpr)
    useEffect(() => {
        if (!lowQuality || !sun.current) return
        setDpr(1)
        sun.current.shadow.mapSize.set(1024, 1024)
        sun.current.shadow.map?.dispose()
        sun.current.shadow.map = null
    }, [lowQuality, setDpr])

    // Bấm (không phải kéo) vào tòa có khóa học: mở khóa đó. Tia lấy theo điểm bấm nên cảm ứng cũng dùng được.
    useEffect(() => {
        let down: { x: number; y: number } | null = null
        const onDown = (e: PointerEvent) => {
            down = { x: e.clientX, y: e.clientY }
        }
        const onClick = (e: MouseEvent) => {
            if (sm.current > 1.3) return // đã vào trong sảnh: không còn bấm vào mô hình tòa
            if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
            const r = domElement.getBoundingClientRect()
            const ray = new THREE.Raycaster()
            ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)), camera)
            let o: THREE.Object3D | null = ray.intersectObjects([...registry.current.values()], true)[0]?.object ?? null
            while (o && !o.userData.buildingName) o = o.parent
            const course = o ? courseOfBuilding(o.userData.buildingName as string) : undefined
            if (course) onOpenCourse?.(course.id)
        }
        domElement.addEventListener('pointerdown', onDown)
        domElement.addEventListener('click', onClick)
        return () => {
            domElement.removeEventListener('pointerdown', onDown)
            domElement.removeEventListener('click', onClick)
        }
    }, [domElement, camera, onOpenCourse])

    // Kéo thì dừng tự xoay; buông tay chờ 3 giây rồi xoay tiếp
    const onStart = () => {
        dragging.current = true
        window.clearTimeout(resumeTimer.current)
        if (controls.current) controls.current.autoRotate = false
        updateCursor()
    }
    const onEnd = () => {
        dragging.current = false
        updateCursor()
        window.clearTimeout(resumeTimer.current)
        resumeTimer.current = window.setTimeout(() => {
            if (controls.current && !reduce) controls.current.autoRotate = true
        }, RESUME_AUTOROTATE_MS)
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
        const S = sm.current
        const live = S > HERO_EPS // đã rời hero: camera chạy theo đường bay, hero tắt kéo xoay và tự xoay
        // Vào/ra nhà đổi ngay tại điểm cắt, lúc màn đang tối hẳn
        indoor.current = S > INDOOR_S ? 1 : 0

        // ── Máy quay ──
        const ctl = controls.current
        if (ctl) {
            if (live && ctl.enabled) {
                ctl.enabled = false
                ctl.autoRotate = false
                window.clearTimeout(resumeTimer.current)
                dragging.current = false
                ctlOn.current = false
                updateCursor()
            } else if (!live && !ctl.enabled) {
                // Về hero: camera đang ở (gần) đúng góc hero, bật lại kéo xoay + tự xoay
                ctl.enabled = true
                ctl.target.copy(TARGET)
                ctl.autoRotate = !reduce && !dragging.current
                ctl.update()
                ctlOn.current = true
                updateCursor()
            }
        }

        if (!live) {
            camera.up.set(0, 1, 0)
            if (touch && !reduce) heroPos.current.applyAxisAngle(Y_AXIS, -delta * 0.12) // cảm ứng: chỉ tự xoay
            else heroPos.current.copy(camera.position)
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
            // Gần kiosk: trục dọc của máy nghiêng theo màn để màn không bị xiên
            camera.up.set(0, 1, 0).lerp(KSCR.up, calmOn ? 0 : kioskFocus(S)).normalize()
            camera.lookAt(_look)
            if (import.meta.env.DEV) (window as unknown as { __cam: unknown }).__cam = { S, pos: camera.position.toArray(), look: _look.toArray(), fov }
        }

        // ── Kiosk: zoom tới thì khung nhìn về giữa (hết dịch sang phải), màn DOM bám 4 góc màn 3D ──
        const f = calmOn ? 0 : kioskFocus(S)
        if (!staticMode) {
            const ox = -size.width * DESKTOP_SHIFT * (1 - f)
            if (Math.abs(ox - (camera.view?.offsetX ?? 0)) > 0.01) camera.setViewOffset(size.width, size.height, ox, 0, size.width, size.height)
        }
        camera.updateMatrixWorld()
        placeKiosk(kiosk, camera, size, S, f, !staticMode && !calmOn)
        updateChrome(kiosk, S, calmOn, delta, chrome.current)

        // ── Sương theo màu trời; ngoài trời nền trong suốt (thấy gradient trời CSS), vào nhà thì nền nội thất tối (đổi lúc tối màn) ──
        colors.now.copy(colors.fogA).lerp(colors.fogB, band(S, 0, 1)).lerp(colors.deep, indoor.current)
        if (indoor.current) {
            if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color()
            scene.background.copy(colors.deep)
        } else if (scene.background) scene.background = null
        if (scene.fog) {
            // Sương theo khoảng cách tới tâm khuôn viên; trong sảnh (gần tâm) giữ nguyên mức ở xa để không phủ mờ nội thất
            const d = Math.max(camera.position.distanceTo(TARGET), 60)
            scene.fog.color.copy(colors.now)
            ;(scene.fog as THREE.Fog).near = d * 1.1
            ;(scene.fog as THREE.Fog).far = d * 3.2
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
            setHovered(hb)
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

        // Nhãn: chỉ ở hero; mỗi 6 khung hình tính lại tòa nào được hiện (không bị che, không chồng nhãn khác)
        if (frame.current++ % 6 === 0) {
            const key = S < 0.2 ? computeVisibleLabels(registry.current, camera, size, raycaster, hb) : ''
            if (key !== labelKey.current) {
                labelKey.current = key
                setVisibleLabels(new Set(key ? key.split('|') : []))
            }
        }

        // Chuyển hoàng hôn ↔ buổi tối
        nightRef.current += (nightTarget.current - nightRef.current) * (reduce ? 1 : 0.04)
        applyLights(nightRef.current)
        // Chỉ một đèn đổ bóng tại một thời điểm: nắng ngoài trời; vào hẳn trong nhà (nắng đã về 0) thì tắt, nhường đèn key của studio.
        // Đèn castShadow mà không được vẽ shadow map sẽ làm sampler bóng thiếu texture (GL_INVALID_OPERATION), nên luôn bật/tắt cùng lúc với nguồn sáng.
        const sunShadow = indoor.current < 1
        if (sun.current && sun.current.castShadow !== sunShadow) sun.current.castShadow = sunShadow
        void state
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
                    // Xoay ngang 360°; dọc giới hạn để không lật xuống dưới đế hay nhìn thẳng từ trên xuống
                    minPolarAngle={0.55}
                    maxPolarAngle={1.35}
                    autoRotate={!reduce}
                    autoRotateSpeed={0.6}
                    // Chỉ chuột trái xoay; chuột phải/giữa không bị chiếm
                    mouseButtons={{ LEFT: THREE.MOUSE.ROTATE }}
                    touches={{}}
                    onStart={onStart}
                    onEnd={onEnd}
                />
            )}
            <hemisphereLight ref={hemi} args={[CAMPUS.skyLight, CAMPUS.groundLight, 0.75 * Math.PI]} />
            <directionalLight
                ref={sun}
                color={CAMPUS.sunlight}
                intensity={1.05 * Math.PI}
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
            />
            <directionalLight ref={rim} color={CAMPUS.rimLight} intensity={0.35 * Math.PI} position={[30, 14, -30]} />
            <group ref={world}>
                <Campus hovered={hovered} visibleLabels={visibleLabels} registry={registry} nightRef={nightRef} reduce={reduce} dailyLit={dailyLit} stage={sm} coursePct={coursePct} lowQuality={lowQuality} />
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
    dailyLit: React.MutableRefObject<boolean[]>
    kiosk: KioskBridge
    coursePct: Readonly<Record<string, number>>
    onOpenCourse?: (courseId: string) => void
}

export default function CampusScene({ night, reduce, staticMode, flat, stage, dailyLit, kiosk, coursePct, onOpenCourse }: CampusSceneProps) {
    const [fontsReady, setFontsReady] = useState(false)
    const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches)
    const pointer = useRef({ x: 0, y: 0, inside: false })
    const canvasWrap = useRef<HTMLDivElement>(null)
    const frozen = useThemeStore((s) => s.frozen)

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
    useEffect(() => {
        const move = (e: PointerEvent) => {
            const cv = canvasWrap.current?.querySelector('canvas')
            if (!cv || e.target !== cv) {
                pointer.current.inside = false
                return
            }
            const r = cv.getBoundingClientRect()
            pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1), inside: true }
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
            {fontsReady && (
                <Canvas
                    frameloop={frozen ? 'never' : 'always'}
                    legacy
                    flat
                    shadows="percentage"
                    dpr={[1, 2]}
                    camera={{ fov: FOV, position: START_POS.toArray(), near: 1, far: 400 }}
                    gl={{ antialias: true, alpha: true }}
                    aria-label="Mô hình 3D khuôn viên PTIT, kéo để xoay"
                    role="img"
                >
                    <Scene night={night} reduce={reduce} touch={touch} staticMode={staticMode} flat={flat} stage={stage} dailyLit={dailyLit} kiosk={kiosk} coursePct={coursePct} pointer={pointer} onOpenCourse={onOpenCourse} />
                </Canvas>
            )}
        </div>
    )
}
