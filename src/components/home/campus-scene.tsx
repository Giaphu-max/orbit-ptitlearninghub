import { courseOfBuilding } from '@/lib/campus-courses'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useThemeStore } from '@/store/useThemeStore'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { CAMPUS } from './campus-palette'
import { DEFAULT_SETUP } from '@/lib/studio-setup'
import { createMaterials, PropBlue, PropColumn, PropGreen, PropYellow, STUDIO_PROP_AT, StudioFigure, StudioPlinth, StudioWalls, tintMaterials } from '@/components/studio/studio-set'

// Khuôn viên PTIT low-poly, chuyển từ docs/ptit-campus.html (three.js thuần) sang React Three Fiber.
// Hình khối, màu và số đo giữ nguyên bản gốc; không dùng file model nào.
// Canvas chạy chế độ legacy + flat (không color management, không tone mapping) và cường độ đèn
// nhân π để ra đúng màu như bản three r128 mà bản gốc dùng.

const C = CAMPUS

type Vec3 = [number, number, number]
type MatOpts = { roughness?: number; metalness?: number }

// Vật liệu dùng chung theo (màu, thông số) để hàng trăm khối không tạo hàng trăm vật liệu
const matCache = new Map<string, THREE.MeshStandardMaterial>()
function stdMat(color: string, o: MatOpts = {}) {
    const key = color + JSON.stringify(o)
    let m = matCache.get(key)
    if (!m) {
        m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...o })
        matCache.set(key, m)
    }
    return m
}

// ─── Khối cơ bản ───────────────────────────────────────────────────────────

/** Hộp: `at` là tâm đáy (y là mặt dưới), như hàm box() của bản gốc. */
function Box({ s, c, at = [0, 0, 0], o }: { s: Vec3; c: string; at?: Vec3; o?: MatOpts }) {
    return (
        <mesh position={[at[0], at[1] + s[1] / 2, at[2]]} material={stdMat(c, o)} castShadow receiveShadow>
            <boxGeometry args={s} />
        </mesh>
    )
}

function Cylinder({ r, h, c, at, seg = 10 }: { r: number; h: number; c: string; at: Vec3; seg?: number }) {
    return (
        <mesh position={at} material={stdMat(c)} castShadow receiveShadow>
            <cylinderGeometry args={[r, r, h, seg]} />
        </mesh>
    )
}

/** Mái chóp 4 mặt. */
function HipRoof({ w, h, d, c, at }: { w: number; h: number; d: number; c: string; at: Vec3 }) {
    const geo = useMemo(() => {
        const g = new THREE.ConeGeometry(1, 1, 4)
        g.rotateY(Math.PI / 4)
        g.scale(w / Math.SQRT2, h, d / Math.SQRT2)
        return g
    }, [w, h, d])
    return <mesh geometry={geo} position={[at[0], at[1] + h / 2, at[2]]} material={stdMat(c)} castShadow receiveShadow />
}

/** Mái hai mái / đầu hồi tam giác, đùn dọc theo trục Z (hoặc X khi alongZ = false). */
function Gable({ len, h, depth, c, at, alongZ = false }: { len: number; h: number; depth: number; c: string; at: Vec3; alongZ?: boolean }) {
    const geo = useMemo(() => {
        const s = new THREE.Shape()
        s.moveTo(-depth / 2, 0)
        s.lineTo(depth / 2, 0)
        s.lineTo(0, h)
        s.lineTo(-depth / 2, 0)
        const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false })
        g.translate(0, 0, -len / 2)
        if (!alongZ) g.rotateY(Math.PI / 2)
        return g
    }, [len, h, depth, alongZ])
    return <mesh geometry={geo} position={at} material={stdMat(c)} castShadow receiveShadow />
}

// ─── Chữ vẽ lên canvas làm texture ─────────────────────────────────────────

interface TextOpts { w?: number; h?: number; fg?: string; size?: number | number[]; weight?: number }

function makeTextTexture(text: string, { w = 1024, h = 256, fg = CAMPUS.ptitRed, size = 150, weight = 800 }: TextOpts) {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = text.split('\n')
    lines.forEach((ln, i) => {
        const sz = Array.isArray(size) ? size[i] : size
        ctx.font = `${weight} ${sz}px "Be Vietnam Pro", Arial, sans-serif`
        ctx.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * sz * 1.15)
    })
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
}

/** Mặt phẳng dán chữ. Chỉ dựng sau khi font đã tải (xem CampusScene) nên texture dùng đúng font. */
function TextPlane({ w, h, text, at, opts, doubleSide }: { w: number; h: number; text: string; at: Vec3; opts: TextOpts; doubleSide?: boolean }) {
    const tex = useMemo(() => makeTextTexture(text, opts), [text, opts])
    useEffect(() => () => tex.dispose(), [tex])
    return (
        <mesh position={at}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial map={tex} transparent side={doubleSide ? THREE.DoubleSide : THREE.FrontSide} />
        </mesh>
    )
}

// Hằng số ngoài component để useMemo của TextPlane không tính lại mỗi lần render
const T_SAMSUNG: TextOpts = { fg: CAMPUS.signBlue, size: 64, weight: 800 }
const T_PTIT: TextOpts = { size: 200 }
const T_HEART: TextOpts = { size: 170 }
const T_GATE: TextOpts = { size: [96, 56], h: 300 }

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
    children: ReactNode
}

function Building({ name, anchorY, position, hovered, labelVisible, pct, registry, children }: BuildingProps) {
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
        <group ref={ref} position={position}>
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

type BuildingName = 'Tòa A2' | 'Tòa A3' | 'Hội trường A1' | 'Tòa A1' | 'Canteen' | 'Cổng trường'

const TREE_SPOTS: [number, number][] = [[-20, 14], [-17, 14], [-13, 13.5], [8, 13.5], [11, 13.6], [14, 13.3], [17.5, 13.6], [20, 12], [-20, 8], [-20, -1], [-19.5, -12], [-16, -14], [-6, -14], [3, -14], [7, -14.5], [19.5, -14], [20, -1], [19.5, 5], [-6, 6], [-5, 0.5], [9, 4], [10, -2], [-7, -5]]
const LAWNS: [number, number, number, number][] = [[-15, 11, 9, 6], [14, 9, 10, 8], [-16, -3, 8, 6], [15, -4, 8, 6], [-4, -3, 6, 5]]
const CARS: [string, number, number][] = [[CAMPUS.ptitRed, -1.8, 10.8], [CAMPUS.pureWhite, 0.9, 8.2], [CAMPUS.carDark, 3.8, 10.8], [CAMPUS.carSilver, 5.2, 8.2]]

interface WorldProps {
    hovered: BuildingName | null
    visibleLabels: ReadonlySet<string>
    registry: React.MutableRefObject<Map<string, THREE.Group>>
    nightRef: React.MutableRefObject<number>
    reduce: boolean
    dailyLit: React.MutableRefObject<boolean[]>
    stage: React.MutableRefObject<number>
    coursePct: Readonly<Record<string, number>>
    /** Các nhóm thu nhỏ biến mất ở chương Studio (cảnh đặt scale theo S, không qua React) */
    shrink: { trees: React.RefObject<THREE.Group | null>; clouds: React.RefObject<THREE.Group | null>; ground: React.RefObject<THREE.Group | null> }
    /** Máy yếu: cây không đổ bóng */
    lowQuality: boolean
}

function Campus({ hovered, visibleLabels, registry, nightRef, reduce, dailyLit, stage, coursePct, shrink, lowQuality }: WorldProps) {
    const b = (name: BuildingName) => ({ registry, name, hovered: hovered === name, labelVisible: visibleLabels.has(name), pct: coursePct[name] })

    return (
        <>
            {/* Nền, đường, bãi cỏ */}
            <Box s={[46, 1, 36]} c={C.plateEdge} at={[0, -1.2, 0]} />
            <Box s={[45, 0.4, 35]} c={C.plate} at={[0, -0.4, 0]} />
            <group ref={shrink.ground}>
            <Box s={[45, 0.02, 3]} c={C.road} at={[0, 0, 16]} />
            <Box s={[9, 0.02, 8]} c={C.pave} at={[2, 0, 9]} />
            {LAWNS.map(([x, z, w, d], i) => (
                <Box key={i} s={[w, 0.08, d]} c={i % 2 ? C.grassDark : C.grass} at={[x, 0, z]} />
            ))}
            {Array.from({ length: 7 }, (_, i) => (
                <Box key={i} s={[0.2, 0.03, 3.4]} c={CAMPUS.pureWhite} at={[-2.5 + i * 1.4, 0, 9.5]} />
            ))}
            {CARS.map(([c, x, z]) => (
                <group key={c}>
                    <Box s={[1, 0.5, 2]} c={c} at={[x, 0, z]} />
                    <Box s={[0.85, 0.35, 1.1]} c={c} at={[x, 0.5, z - 0.1]} />
                </group>
            ))}
            </group>

            {/* Tòa A2 */}
            <Building {...b('Tòa A2')} anchorY={17.6} position={[2, 0, 1]}>
                <Box s={[11, 2.8, 7.4]} c={C.granite} />
                {Array.from({ length: 5 }, (_, i) => (
                    <Box key={i} s={[1.5, 1, 0.1]} c={C.win} at={[-4.2 + i * 1.9, 1.4, 3.72]} />
                ))}
                <Box s={[3.4, 0.35, 2.4]} c={C.granite} at={[4.2, 2.8, 4.4]} />
                {[3.1, 5.3].map((x) => (
                    <Cylinder key={x} r={0.24} h={2.8} c={CAMPUS.pillar} at={[x, 1.4, 5.3]} />
                ))}
                {[0, 1, 2, 3].map((s) => (
                    <Box key={s} s={[3.2 - s * 0.2, 0.18, 0.5]} c={C.roofRed} at={[4.2, s * 0.18, 6 + (3 - s) * 0.45]} />
                ))}
                <Box s={[5.6, 1.2, 0.12]} c={C.white} at={[-2.4, 1.6, 3.76]} />
                <TextPlane w={5.4} h={1.1} text="SAMSUNG LAB · FPT TELECOM LAB" at={[-2.4, 2.2, 3.84]} opts={T_SAMSUNG} />
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
                <TextPlane w={2.4} h={0.6} text="PTIT" at={[0, 13.45, 1.62]} opts={T_PTIT} />

                <A2Windows nightRef={nightRef} reduce={reduce} dailyLit={dailyLit} stage={stage} />

                <TextPlane w={3.2} h={0.8} text="I ♥ PTIT" at={[2.8, 0.45, 6.6]} opts={T_HEART} doubleSide />
                {([[-5.8, CAMPUS.ptitRed], [-5, CAMPUS.flagYellow], [-4.2, CAMPUS.flagBlue]] as const).map(([x, c], i) => (
                    <Flag key={x} x={x} color={c} index={i} reduce={reduce} />
                ))}
            </Building>

            {/* Tòa A3: khối vàng, mái chóp đỏ */}
            <Building {...b('Tòa A3')} anchorY={7.6} position={[12.5, 0, -9.5]}>
                <Box s={[13, 4.6, 4.4]} c={C.yellow} />
                {Array.from({ length: 10 }, (_, i) => (
                    <Box key={i} s={[0.7, 3.4, 0.1]} c={C.win} at={[-5.4 + i * 1.2, 0.6, 2.23]} />
                ))}
                <HipRoof w={14} h={2} d={5.4} c={C.roofRed} at={[0, 4.6, 0]} />
                <Box s={[2.6, 5.2, 1]} c={C.yellow} at={[0, 0, 2.6]} />
                <Gable len={1.2} h={1.2} depth={3} c={C.roofRed} at={[0, 5.2, 2.6]} alongZ />
            </Building>

            {/* Hội trường A1: dài, trắng, mái đầu hồi đỏ */}
            <Building {...b('Hội trường A1')} anchorY={6.2} position={[-11, 0, -9]}>
                <Box s={[12, 3.6, 5]} c={C.white} />
                {Array.from({ length: 8 }, (_, i) => (
                    <Box key={i} s={[0.8, 1.6, 0.1]} c={CAMPUS.hallWindow} at={[-4.9 + i * 1.4, 1, 2.53]} />
                ))}
                <Gable len={12.6} h={2.2} depth={5.8} c={C.roofRed} at={[0, 3.6, 0]} />
                <Box s={[3, 4.4, 1.2]} c={C.white} at={[0, 0, 3]} />
                <Gable len={1.4} h={1.4} depth={3.4} c={C.roofRed} at={[0, 4.4, 3]} alongZ />
            </Building>

            {/* Tòa A1: khối trắng thấp có dải ngang */}
            <Building {...b('Tòa A1')} anchorY={6.4} position={[-11.5, 0, 3.5]}>
                <Box s={[7.5, 5.2, 6]} c={C.white} />
                {Array.from({ length: 5 }, (_, r) => (
                    <Box key={r} s={[7.6, 0.18, 6.1]} c={C.stripe} at={[0, 0.7 + r * 0.95, 0]} />
                ))}
                <Box s={[7.6, 0.9, 0.1]} c={CAMPUS.bandGreen} at={[0, 0.2, 3.05]} />
            </Building>

            <Building {...b('Canteen')} anchorY={4.2} position={[-1.5, 0, -11]}>
                <Box s={[5.5, 2.2, 3.4]} c={C.white} />
                <HipRoof w={6.4} h={1.4} d={4.2} c={C.roofRed} at={[0, 2.2, 0]} />
            </Building>

            <Building {...b('Cổng trường')} anchorY={5.6} position={[2, 0, 13.2]}>
                {[-3.4, 3.4].map((x) => (
                    <Box key={x} s={[0.8, 3.6, 0.8]} c={CAMPUS.gatePost} at={[x, 0, 0]} />
                ))}
                <Box s={[8, 0.5, 1]} c={CAMPUS.gateBeam} at={[0, 3.6, 0]} />
                <Box s={[7.4, 1.6, 0.2]} c={CAMPUS.gateSign} at={[0, 4.1, 0]} />
                <TextPlane w={7.2} h={1.5} text={'HỌC VIỆN\nCÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG'} at={[0, 4.9, 0.12]} opts={T_GATE} />
                {Array.from({ length: 9 }, (_, i) => (
                    <Box key={i} s={[0.08, 1.4, 0.08]} c={CAMPUS.fence} at={[4.6 + i * 0.55, 0, 0]} />
                ))}
                <Box s={[5, 0.08, 0.08]} c={CAMPUS.fence} at={[6.8, 1.3, 0]} />
            </Building>

            {/* Cây */}
            <group ref={shrink.trees}>
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
            </group>

            <group ref={shrink.clouds}>
                {[0, 1, 2, 3].map((i) => (
                    <Cloud key={i} index={i} reduce={reduce} />
                ))}
            </group>
        </>
    )
}

// ─── Cảnh: camera theo chương, đèn, xoay theo chuột, hover, ngày/đêm ───────

const SUN_DAY = new THREE.Color(CAMPUS.sunlight)
const SUN_NIGHT = new THREE.Color(CAMPUS.moonlight)
const TARGET = new THREE.Vector3(0, 3, 0)
const START_POS = new THREE.Vector3(52, 40, 58)
const Y_AXIS = new THREE.Vector3(0, 1, 0)

/** Phạm vi cần nằm gọn trong khung ở mọi góc xoay (đơn vị cảnh): bán kính ngang (đế + mây) và nửa chiều cao (tính cả nhãn). */
const BOUND_RADIUS = 28
const BOUND_HALF_HEIGHT = 20
const FIT_MARGIN = 1.05
const FOV = 28
/** Sau khi buông tay, chờ chừng này rồi mới tự xoay tiếp. */
const RESUME_AUTOROTATE_MS = 3000
/** S ≤ ngưỡng này là còn ở hero: OrbitControls và tự xoay hoạt động; vượt ngưỡng thì camera chạy theo keyframe. */
const HERO_EPS = 0.05
/** Màn rộng: chủ thể nằm ở nửa phải. Vùng trống rộng ~62% khung, tâm dịch sang phải 18% bề rộng. */
const DESKTOP_REGION = 0.62
const DESKTOP_SHIFT = 0.18
/** Tỉ lệ rộng/cao của vùng trống mà các keyframe được viết cho; vùng hẹp hơn thì camera lùi xa tương ứng. */
const REF_ASPECT = 1.05

/** Keyframe máy quay theo tọa độ cầu quanh target: az (độ, 0 = nhìn từ +z, tăng dần về phía +x), el (độ), r, fov */
interface CamKey {
    t: Vec3
    az: number
    el: number
    r: number
    fov: number
}

/** Hệ số từ mét (studio) sang đơn vị khuôn viên: nhân vật Studio cao ~2 m thành ~10 đơn vị, vừa tầm tòa A2. */
const K = 5
const STUDIO_TARGET: Vec3 = [0, 1.1 * K, 0]
/** Góc máy mặc định của Studio (tiêu cự 50mm, góc/độ cao/khoảng cách theo DEFAULT_SETUP) trong hệ khuôn viên */
function studioCam(): CamKey {
    const d = DEFAULT_SETUP
    return {
        t: STUDIO_TARGET,
        // Cùng hướng nhìn và tiêu cự với Studio, lùi 1,7 lần để thấy đủ nhân vật, vật thể và phông.
        // +360° để quỹ đạo đi tiếp cùng chiều từ chương Khóa học (az 105°) tới đây.
        az: d.azimuthDeg + 360,
        el: d.elevationDeg,
        r: d.distance * K * 1.7,
        fov: THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * d.focalLengthMm))),
    }
}

// Match cut chương Studio: vị trí gốc các tòa và đích của chúng (khối vật thể Studio, mét × K)
const BASE_XZ: Record<string, [number, number]> = { 'Tòa A2': [2, 1], 'Tòa A3': [12.5, -9.5], 'Hội trường A1': [-11, -9], 'Tòa A1': [-11.5, 3.5], Canteen: [-1.5, -11], 'Cổng trường': [2, 13.2] }
const P_AT = STUDIO_PROP_AT
const MORPH_TO: Record<string, [number, number]> = {
    'Tòa A2': [0, 0],
    'Tòa A3': [P_AT.yellow[0] * K, P_AT.yellow[2] * K],
    'Tòa A1': [P_AT.blue[0] * K, P_AT.blue[2] * K],
    'Hội trường A1': [P_AT.column[0] * K, P_AT.column[2] * K],
}
/** Cửa kính xanh của A2 (tâm, hệ thế giới) thành trụ xanh */
const A2_GLASS_AT: Vec3 = [2, 8.3, 2.6]
/** Khoảng S của match cut và của từng khối */
const MORPH_FROM = 2.15
const MORPH_TO_S = 2.95
/** Máy chỉ di chuyển trong [0.2, 0.8] của mỗi đoạn S∈[i, i+1]; hai đầu đứng yên cho người xem đọc chữ chương. Match cut chạy đúng trong khoảng máy di chuyển của đoạn Khóa học → Studio. */
const MOVE_FROM = 0.2
const MOVE_TO = 0.8
const SWAY = 0.12 // r tăng tới 12% giữa đường
/** Đèn Studio mặc định; đèn viền (mặc định 0) bật nhẹ để thấy viền đỏ. Cường độ ×K² vì ánh sáng điểm giảm theo bình phương khoảng cách. */
const RIM_ON = 30
const I_KEY = (DEFAULT_SETUP.key / 100) * 140 * K * K
const I_FILL = (DEFAULT_SETUP.fill / 100) * 40 * K * K
const I_RIM = (RIM_ON / 100) * 160 * K * K
const polarAt = (azDeg: number, elDeg: number, radius: number): Vec3 => {
    const a = THREE.MathUtils.degToRad(azDeg)
    const e = THREE.MathUtils.degToRad(elDeg)
    return [Math.sin(a) * Math.cos(e) * radius + STUDIO_TARGET[0], Math.sin(e) * radius + STUDIO_TARGET[1], Math.cos(a) * Math.cos(e) * radius + STUDIO_TARGET[2]]
}
const LOOK = DEFAULT_SETUP.look
const KEY_SIDE = Math.sign(DEFAULT_SETUP.keyAngleDeg) || 1
const KEY_POS = polarAt(DEFAULT_SETUP.azimuthDeg + DEFAULT_SETUP.keyAngleDeg, LOOK.keyElevationDeg, 6 * K)
const FILL_POS = polarAt(DEFAULT_SETUP.azimuthDeg - KEY_SIDE * LOOK.fillSideDeg, LOOK.fillElevationDeg, 6 * K)
const RIM_POS = polarAt(DEFAULT_SETUP.azimuthDeg + 180 + KEY_SIDE * LOOK.rimSideDeg, LOOK.rimElevationDeg, 5 * K)
const PLATE_LIGHT = new THREE.Color(CAMPUS.plate)
const PLATE_DARK = new THREE.Color(CAMPUS.plateDark)

/** Máy quay theo chương 1..3 (chương 0 là góc nhìn hero do OrbitControls điều khiển). */
const CHAPTER_CAMS: CamKey[] = [
    { t: [2, 8, 2.5], az: 15, el: 14, r: 54, fov: 30 }, // 01 Hôm nay: chính diện A2, hơi chéo phải, thấy trọn 3 tầng cửa sổ
    { t: [7, 6, -3], az: 105, el: 24, r: 80, fov: 32 }, // 02 Khóa học: từ phía đông, A3 ở tiền cảnh, thấy A2 + A3 và nhãn
    studioCam(), // 03 Studio: đúng góc máy mặc định của trang Studio
]
/** Một đầu của đoạn quỹ đạo đang nội suy */
interface CamOut {
    t: THREE.Vector3
    az: number
    el: number
    r: number
    fov: number
}
const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const smoothstep = (x: number) => x * x * (3 - 2 * x)
const RAD = Math.PI / 180

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
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
    /** S liên tục 0..3 do useScrollStage cung cấp (ref, không phải state) */
    stage: React.MutableRefObject<number>
    /** Các tòa nhấc lên ở chương Khóa học */
    liftNames: ReadonlySet<string>
    /** Bài Daily hôm nay (theo thứ tự) đã đọc chưa: mỗi bài = một tầng cửa sổ A2 */
    dailyLit: React.MutableRefObject<boolean[]>
    /** % tiến độ khóa theo tên tòa, hiện trên nhãn */
    coursePct: Readonly<Record<string, number>>
    pointer: React.MutableRefObject<{ x: number; y: number; inside: boolean }>
    /** Bấm vào tòa có khóa học thì mở khóa đó */
    onOpenCourse?: (courseId: string) => void
}

/**
 * Canvas cố định phủ cả màn hình, nội dung các chương nằm đè lên ở cột trái. Chủ thể được đặt vào "vùng trống"
 * (nửa phải trên màn rộng) bằng view offset của camera; camera hero lùi đủ xa để khối cầu bao khuôn viên nằm gọn
 * trong vùng đó. Các chương sau dùng keyframe, kéo giãn theo tỉ lệ vùng trống.
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

function Scene({ night, reduce, touch, staticMode, stage, liftNames, dailyLit, coursePct, pointer, onOpenCourse }: SceneProps) {
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
    const mood = useRef(0)
    const morph = useRef(0)
    const morphed = useRef(false)
    const ctlOn = useRef(true)
    // Match cut → Studio: vật thể Studio thật (studio-set), đèn 3 điểm mặc định, nhóm thu nhỏ của khuôn viên
    const treesG = useRef<THREE.Group>(null)
    const cloudsG = useRef<THREE.Group>(null)
    const groundG = useRef<THREE.Group>(null)
    const shrink = useMemo(() => ({ trees: treesG, clouds: cloudsG, ground: groundG }), [])
    const plinthG = useRef<THREE.Group>(null)
    const figureG = useRef<THREE.Group>(null)
    const blueG = useRef<THREE.Group>(null)
    const yellowG = useRef<THREE.Group>(null)
    const greenG = useRef<THREE.Group>(null)
    const columnG = useRef<THREE.Group>(null)
    const wallsG = useRef<THREE.Group>(null)
    const keyL = useRef<THREE.SpotLight>(null)
    const fillL = useRef<THREE.PointLight>(null)
    const rimL = useRef<THREE.SpotLight>(null)
    const studioMats = useMemo(() => {
        const m = createMaterials()
        tintMaterials(m, new THREE.Color(DEFAULT_SETUP.look.background))
        return m
    }, [])
    const plateMat = useMemo(() => stdMat(CAMPUS.plate), [])
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
    // Màu trời lấy từ token CSS (--stage-*), đọc một lần khi dựng cảnh
    const colors = useMemo(() => ({ sky: tokenColor('--stage-sky', '#9E1218'), mid: tokenColor('--stage-mid', '#4A0A0E'), deep: tokenColor('--stage-deep', '#130D0E'), now: new THREE.Color() }), [])
    const camA = useMemo<CamOut>(() => ({ t: new THREE.Vector3(), az: 0, el: 0, r: 0, fov: 0 }), [])
    const camB = useMemo<CamOut>(() => ({ t: new THREE.Vector3(), az: 0, el: 0, r: 0, fov: 0 }), [])
    const camHero = useMemo(() => ({ v: new THREE.Vector3() }), [])

    const size = useThree((s) => s.size)
    const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
    const domElement = useThree((s) => s.gl.domElement)
    const scene = useThree((s) => s.scene)

    useStageFit(controls, staticMode, heroPos, fitScale, stage)

    // Đưa camera về góc nhìn ban đầu (OrbitControls lấy vị trí camera làm điểm xuất phát)
    useLayoutEffect(() => {
        camera.position.copy(START_POS)
        camera.lookAt(TARGET)
        scene.background = colors.now.copy(colors.sky)
        scene.fog = new THREE.Fog(colors.sky, 100, 400)
    }, [camera, scene, colors])

    const applyLights = (n: number) => {
        // Về cuối trang chủ (chương Studio) ánh sáng dịu bớt cho hợp nền gần đen
        const dim = 1 - 0.3 * mood.current
        // Match cut: nắng khuôn viên tắt dần khi bộ đèn Studio bật
        const off = 1 - morph.current
        if (sun.current) {
            sun.current.intensity = (1.05 - n * 0.75) * Math.PI * dim * (0.04 + 0.96 * off)
            sun.current.color.copy(SUN_DAY).lerp(SUN_NIGHT, n)
        }
        if (hemi.current) hemi.current.intensity = (0.75 - n * 0.4) * Math.PI * dim * (0.2 + 0.8 * off)
        if (rim.current) rim.current.intensity = (0.35 + n * 0.25) * Math.PI * off
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
    useEffect(() => {
        if (!lowQuality) return
        for (const [light, size] of [[sun.current, 1024], [keyL.current, 512]] as const) {
            if (!light) continue
            light.shadow.mapSize.set(size, size)
            light.shadow.map?.dispose()
            light.shadow.map = null
        }
    }, [lowQuality])

    // Bấm (không phải kéo) vào tòa có khóa học: mở khóa đó. Tia lấy theo điểm bấm nên cảm ứng cũng dùng được.
    useEffect(() => {
        let down: { x: number; y: number } | null = null
        const onDown = (e: PointerEvent) => {
            down = { x: e.clientX, y: e.clientY }
        }
        const onClick = (e: MouseEvent) => {
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
        const S = stage.current
        const live = S > HERO_EPS // đã rời hero: camera chạy theo keyframe, hero tắt kéo xoay và tự xoay

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
            if (touch && !reduce) heroPos.current.applyAxisAngle(Y_AXIS, -delta * 0.12) // cảm ứng: chỉ tự xoay
            else heroPos.current.copy(camera.position)
            if (touch) {
                camera.position.copy(heroPos.current)
                camera.lookAt(TARGET)
            }
            if (camera.fov !== FOV) {
                camera.fov = FOV
                camera.updateProjectionMatrix()
            }
        } else {
            // Một vòng quỹ đạo liên tục, một chiều: nội suy az/el/r/fov/target rồi mới tính vị trí từ tọa độ cầu.
            // heroPos đứng yên từ lúc rời hero nên cuộn ngược về hero quay đúng az lúc rời đi.
            const hv = camHero.v.copy(heroPos.current).sub(TARGET)
            const hr = hv.length()
            const hAz = Math.atan2(hv.x, hv.z) / RAD
            const hEl = Math.asin(hv.y / hr) / RAD
            // Hero → Hôm nay: unwrap về az gần nhất; các keyframe sau cộng cùng độ lệch để az luôn tăng
            const off = hAz + wrapDeg(CHAPTER_CAMS[0].az - hAz) - CHAPTER_CAMS[0].az
            const key = (n: number, out: CamOut) => {
                if (n === 0) {
                    out.t.copy(TARGET)
                    out.az = hAz
                    out.el = hEl
                    out.r = hr
                    out.fov = FOV
                    return
                }
                const k = CHAPTER_CAMS[n - 1]
                out.t.set(...k.t)
                out.az = k.az + off
                out.el = k.el
                out.r = k.r * fitScale.current
                out.fov = k.fov
            }
            const i = Math.min(Math.floor(S), CHAPTER_CAMS.length - 1)
            const f = smoothstep(band(S - i, MOVE_FROM, MOVE_TO))
            key(i, camA)
            key(i + 1, camB)
            const az = camA.az + (camB.az - camA.az) * f
            const el = camA.el + (camB.el - camA.el) * f
            const r = (camA.r + (camB.r - camA.r) * f) * (1 + SWAY * Math.sin(Math.PI * f))
            camA.t.lerp(camB.t, f)
            const fov = camA.fov + (camB.fov - camA.fov) * f
            const ce = Math.cos(el * RAD)
            camera.position.set(camA.t.x + r * Math.sin(az * RAD) * ce, camA.t.y + r * Math.sin(el * RAD), camA.t.z + r * Math.cos(az * RAD) * ce)
            if (camera.fov !== fov) {
                camera.fov = fov
                camera.updateProjectionMatrix()
            }
            camera.lookAt(camA.t)
            if (import.meta.env.DEV) (window as unknown as { __cam: unknown }).__cam = { S, az, el, r, f }
        }

        // ── Nền trời và sương theo chương: đỏ PTIT → đỏ sẫm → gần đen ──
        colors.now.copy(colors.sky).lerp(colors.mid, band(S, 0.4, 1.2)).lerp(colors.deep, easeInOutCubic(band(S, 2.2, 2.8)))
        if (scene.background instanceof THREE.Color) scene.background.copy(colors.now)
        if (scene.fog) {
            const d = camera.position.distanceTo(TARGET)
            scene.fog.color.copy(colors.now)
            ;(scene.fog as THREE.Fog).near = d * 1.1
            ;(scene.fog as THREE.Fog).far = d * 3.2
        }
        const moodNext = band(S, 1.2, 3)
        if (Math.abs(moodNext - mood.current) > 0.002) {
            mood.current = moodNext
            applyLights(nightRef.current)
        }

        // ── Hover ──
        // Tia từ con trỏ: tòa nào bị trúng thì được nâng lên (không nâng khi đang kéo)
        ndc.set(p.inside && !dragging.current ? p.x : -9, p.inside && !dragging.current ? p.y : -9)
        raycaster.setFromCamera(ndc, camera)
        const hit = raycaster.intersectObjects([...registry.current.values()], true)[0]
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
        // Chương Khóa học: các tòa có khóa nhấc lên (rồi hạ xuống khi sang Studio)
        // Nhấc lên khi máy tới chương Khóa học (dừng ở S 1.8–2.2), hạ xuống khi máy rời đi
        const courseLift = easeInOutCubic(band(S, 1.5, 1.9)) * (1 - easeInOutCubic(band(S, 2.2, 2.5)))
        registry.current.forEach((grp, name) => {
            const lift = lifts.current.get(name) ?? 0
            const want = Math.max(name === hb ? 0.9 : 0, liftNames.has(name) ? courseLift * 1.6 : 0)
            const next = lift + (want - lift) * (reduce ? 1 : 0.12)
            lifts.current.set(name, next)
            grp.position.y = next
        })

        // ── Match cut khuôn viên → phòng chụp Studio (S 2.15 → 2.95; cuộn ngược thì chạy ngược) ──
        // Máy chỉ di chuyển ở S ∈ [2.2, 2.8]: match cut được co đúng vào khoảng đó (Sm chạy 2.1 → 3.0 theo các mốc bên dưới)
        const Sm = 2.1 + band(S, 2 + MOVE_FROM, 2 + MOVE_TO) * 0.9
        const m = easeInOutCubic(band(Sm, MORPH_FROM, MORPH_TO_S))
        if (S > 2.05 || morphed.current) {
            morphed.current = S > 2.05
            if (Math.abs(m - morph.current) > 0.0005 || !morphed.current) {
                morph.current = m
                applyLights(nightRef.current)
            }
            const grow = (a: number, b: number) => Math.max(easeInOutCubic(band(Sm, a, b)), 0.001)
            const out = (a: number, b: number) => Math.max(1 - easeInOutCubic(band(Sm, a, b)), 0.001)
            const set = (g: THREE.Object3D | null, sc: number, x = 0, y = 0, z = 0) => {
                if (!g) return
                g.visible = sc > 0.01
                g.scale.setScalar(sc)
                g.position.set(x, y, z)
            }
            // Cây, mây, đường/bãi cỏ/xe thu nhỏ biến mất
            const sOut = out(2.1, 2.5)
            for (const g of [treesG.current, cloudsG.current, groundG.current]) {
                if (g) {
                    g.visible = sOut > 0.01
                    g.scale.setScalar(sOut)
                }
            }
            // Các tòa trượt về đích và thu nhỏ; vật thể Studio tương ứng lớn lên ở đích
            const buildingScale: Record<string, number> = { 'Tòa A3': out(2.35, 2.8), 'Hội trường A1': out(2.3, 2.8), 'Tòa A1': out(2.3, 2.8), Canteen: sOut, 'Cổng trường': sOut }
            registry.current.forEach((grp, name) => {
                const base = BASE_XZ[name]
                if (!base) return
                const to = MORPH_TO[name] ?? base
                grp.position.x = base[0] + (to[0] - base[0]) * m
                grp.position.z = base[1] + (to[1] - base[1]) * m
                if (name === 'Tòa A2') {
                    // A2 thu vào bục: thấp và mảnh dần, ẩn hẳn khi gần xong
                    grp.scale.set(1 - 0.65 * m, 1 - 0.55 * m, 1 - 0.65 * m)
                    grp.visible = m < 0.98
                } else {
                    const sc = buildingScale[name] ?? 1
                    grp.scale.setScalar(sc)
                    grp.visible = sc > 0.01
                }
            })
            const Y = P_AT.yellow
            set(plinthG.current, K * grow(2.3, 2.8))
            set(figureG.current, K * grow(2.6, 3))
            set(yellowG.current, K * grow(2.45, 2.95), Y[0] * K, Y[1] * K, Y[2] * K)
            set(blueG.current, K * grow(2.4, 2.9), P_AT.blue[0] * K, P_AT.blue[1] * K, P_AT.blue[2] * K)
            set(columnG.current, K * grow(2.4, 2.95), P_AT.column[0] * K, P_AT.column[1] * K, P_AT.column[2] * K)
            // Dải kính xanh A2 → trụ xanh
            set(greenG.current, K * grow(2.3, 2.9), A2_GLASS_AT[0] + (P_AT.green[0] * K - A2_GLASS_AT[0]) * m, A2_GLASS_AT[1] + (P_AT.green[1] * K - A2_GLASS_AT[1]) * m, A2_GLASS_AT[2] + (P_AT.green[2] * K - A2_GLASS_AT[2]) * m)
            if (wallsG.current) {
                const e = grow(2.4, 3)
                wallsG.current.visible = e > 0.01
                wallsG.current.scale.set(K, K * e, K)
            }
            // Mặt đất tối dần
            plateMat.color.copy(PLATE_LIGHT).lerp(PLATE_DARK, m)
            // Bộ đèn 3 điểm của Studio
            if (keyL.current) keyL.current.intensity = I_KEY * m
            if (fillL.current) fillL.current.intensity = I_FILL * m
            if (rimL.current) rimL.current.intensity = I_RIM * m
            if (keyL.current) keyL.current.shadow.autoUpdate = m > 0.01
        }

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

        // Nhãn: chỉ ở hero và chương Khóa học; mỗi 6 khung hình tính lại tòa nào được hiện (không bị che, không chồng nhãn khác)
        if (frame.current++ % 6 === 0) {
            const gate = S < 0.2 || (S > 1.75 && S < 2.22)
            const key = gate ? computeVisibleLabels(registry.current, camera, size, raycaster, hb) : ''
            if (key !== labelKey.current) {
                labelKey.current = key
                setVisibleLabels(new Set(key ? key.split('|') : []))
            }
        }

        // Chuyển hoàng hôn ↔ buổi tối
        nightRef.current += (nightTarget.current - nightRef.current) * (reduce ? 1 : 0.04)
        applyLights(nightRef.current)
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
                shadow-camera-left={-30}
                shadow-camera-right={30}
                shadow-camera-top={30}
                shadow-camera-bottom={-30}
                shadow-camera-near={1}
                shadow-camera-far={120}
                shadow-bias={-0.0006}
            />
            <directionalLight ref={rim} color={CAMPUS.rimLight} intensity={0.35 * Math.PI} position={[30, 14, -30]} />
            {/* Bộ đèn 3 điểm của Studio (thông số mặc định), tắt cho tới chương Studio */}
            <spotLight ref={keyL} position={KEY_POS} color={LOOK.keyColor} intensity={0} angle={0.6} penumbra={0.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
            <pointLight ref={fillL} position={FILL_POS} color={LOOK.fillColor} intensity={0} />
            <spotLight ref={rimL} position={RIM_POS} color={LOOK.rimColor} intensity={0} angle={0.7} penumbra={0.5} />
            {/* Vật thể Studio thật (studio-set), hiện dần theo match cut */}
            <group ref={wallsG} visible={false} scale={[K, 0.001, K]}>
                <StudioWalls mats={studioMats} />
            </group>
            <group ref={plinthG} visible={false} scale={0.001}>
                <StudioPlinth mats={studioMats} />
            </group>
            <group ref={figureG} visible={false} scale={0.001}>
                <StudioFigure mats={studioMats} />
            </group>
            <group ref={yellowG} visible={false} scale={0.001}>
                <PropYellow mats={studioMats} />
            </group>
            <group ref={greenG} visible={false} scale={0.001}>
                <PropGreen mats={studioMats} />
            </group>
            <group ref={blueG} visible={false} scale={0.001}>
                <PropBlue mats={studioMats} />
            </group>
            <group ref={columnG} visible={false} scale={0.001}>
                <PropColumn mats={studioMats} />
            </group>
            <group ref={world}>
                <Campus hovered={hovered} visibleLabels={visibleLabels} registry={registry} nightRef={nightRef} reduce={reduce} dailyLit={dailyLit} stage={stage} coursePct={coursePct} shrink={shrink} lowQuality={lowQuality} />
            </group>
        </>
    )
}

// ─── Điểm vào: Canvas + chờ font trước khi dựng chữ lên texture ────────────

export interface CampusSceneProps {
    night: boolean
    reduce: boolean
    staticMode: boolean
    stage: React.MutableRefObject<number>
    liftNames: ReadonlySet<string>
    dailyLit: React.MutableRefObject<boolean[]>
    coursePct: Readonly<Record<string, number>>
    onOpenCourse?: (courseId: string) => void
}

export default function CampusScene({ night, reduce, staticMode, stage, liftNames, dailyLit, coursePct, onOpenCourse }: CampusSceneProps) {
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
                    shadows="soft"
                    dpr={[1, 2]}
                    camera={{ fov: FOV, position: START_POS.toArray(), near: 1, far: 400 }}
                    gl={{ antialias: true, alpha: true }}
                    aria-label="Mô hình 3D khuôn viên PTIT, kéo để xoay"
                    role="img"
                >
                    <Scene night={night} reduce={reduce} touch={touch} staticMode={staticMode} stage={stage} liftNames={liftNames} dailyLit={dailyLit} coursePct={coursePct} pointer={pointer} onOpenCourse={onOpenCourse} />
                </Canvas>
            )}
        </div>
    )
}
