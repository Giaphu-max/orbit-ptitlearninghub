import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// Khuôn viên PTIT low-poly, chuyển từ docs/ptit-campus.html (three.js thuần) sang React Three Fiber.
// Hình khối, màu và số đo giữ nguyên bản gốc; không dùng file model nào.
// Canvas chạy chế độ legacy + flat (không color management, không tone mapping) và cường độ đèn
// nhân π để ra đúng màu như bản three r128 mà bản gốc dùng.

const C = {
    plate: '#EFE7E1', plateEdge: '#8E0E13', pave: '#E2D8D0', road: '#6B5F5C', grass: '#8DBF8F', grassDark: '#6FA474',
    cream: '#F4EEE4', granite: '#8C8583', glass: '#2E8C70', win: '#3F8F79', roofRed: '#C23A2C',
    yellow: '#EFC86E', white: '#F7F4EF', stripe: '#BDB5AE', trunk: '#7A5544', tree: '#5E9E6A', tree2: '#7DB27A',
}

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

function makeTextTexture(text: string, { w = 1024, h = 256, fg = '#C4161C', size = 150, weight = 800 }: TextOpts) {
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
const T_SAMSUNG: TextOpts = { fg: '#1A3E8C', size: 64, weight: 800 }
const T_PTIT: TextOpts = { size: 200 }
const T_HEART: TextOpts = { size: 170 }
const T_GATE: TextOpts = { size: [96, 56], h: 300 }

// ─── Tòa nhà (có nâng khi hover và nhãn) ───────────────────────────────────

interface BuildingProps {
    name: string
    sub: string
    anchorY: number
    position: Vec3
    hovered: boolean
    compact: boolean
    registry: React.MutableRefObject<Map<string, THREE.Group>>
    children: ReactNode
}

function Building({ name, sub, anchorY, position, hovered, compact, registry, children }: BuildingProps) {
    const ref = useRef<THREE.Group>(null)
    useLayoutEffect(() => {
        const g = ref.current
        if (!g) return
        const map = registry.current
        g.userData.buildingName = name
        map.set(name, g)
        return () => {
            map.delete(name)
        }
    }, [name, registry])

    // Trên màn hình hẹp chỉ giữ nhãn tòa A2 và nhãn tòa đang hover
    const hidden = compact && !hovered && name !== 'Tòa A2'
    return (
        <group ref={ref} position={position}>
            {children}
            <Html position={[0, anchorY, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <div
                    className="flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1 transition-opacity duration-200"
                    style={{ opacity: hidden ? 0 : 1 }}
                >
                    <div
                        className={`whitespace-nowrap rounded-xl px-[11px] py-[7px] text-xs font-bold shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition duration-200 ${
                            hovered ? '-translate-y-1.5 bg-[#C4161C] text-white' : 'bg-white/95 text-[#1A1412]'
                        }`}
                    >
                        {name}
                        <small className={`block text-[11px] font-medium ${hovered ? 'text-white/85' : 'text-[#5E5551]'}`}>{sub}</small>
                    </div>
                    <div className="h-4 w-0.5 bg-white/80" />
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

function A2Windows({ nightRef, reduce }: { nightRef: React.MutableRefObject<number>; reduce: boolean }) {
    const winRef = useRef<THREE.InstancedMesh>(null)
    const litRef = useRef<THREE.InstancedMesh>(null)
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
    }, [])

    useFrame((_, delta) => {
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
                <meshBasicMaterial color="#FFD27A" />
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
            <Cylinder r={0.05} h={5.5} c="#D6D2CF" at={[x, 2.75, 5.2]} seg={6} />
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
                    <meshStandardMaterial color="#FFFFFF" flatShading transparent opacity={0.92} />
                </mesh>
            ))}
        </group>
    )
}

// ─── Mô hình khuôn viên ────────────────────────────────────────────────────

type BuildingName = 'Tòa A2' | 'Tòa A3' | 'Hội trường A1' | 'Tòa A1' | 'Canteen' | 'Cổng trường'

const TREE_SPOTS: [number, number][] = [[-20, 14], [-17, 14], [-13, 13.5], [8, 13.5], [11, 13.6], [14, 13.3], [17.5, 13.6], [20, 12], [-20, 8], [-20, -1], [-19.5, -12], [-16, -14], [-6, -14], [3, -14], [7, -14.5], [19.5, -14], [20, -1], [19.5, 5], [-6, 6], [-5, 0.5], [9, 4], [10, -2], [-7, -5]]
const LAWNS: [number, number, number, number][] = [[-15, 11, 9, 6], [14, 9, 10, 8], [-16, -3, 8, 6], [15, -4, 8, 6], [-4, -3, 6, 5]]
const CARS: [string, number, number][] = [['#C4161C', -1.8, 10.8], ['#FFFFFF', 0.9, 8.2], ['#2B2B33', 3.8, 10.8], ['#B9C4CC', 5.2, 8.2]]

interface WorldProps {
    hovered: BuildingName | null
    compact: boolean
    registry: React.MutableRefObject<Map<string, THREE.Group>>
    nightRef: React.MutableRefObject<number>
    reduce: boolean
}

function Campus({ hovered, compact, registry, nightRef, reduce }: WorldProps) {
    const shared = { hovered: false, compact, registry }
    const b = (name: BuildingName) => ({ ...shared, name, hovered: hovered === name })

    return (
        <>
            {/* Nền, đường, bãi cỏ */}
            <Box s={[46, 1, 36]} c={C.plateEdge} at={[0, -1.2, 0]} />
            <Box s={[45, 0.4, 35]} c={C.plate} at={[0, -0.4, 0]} />
            <Box s={[45, 0.02, 3]} c={C.road} at={[0, 0, 16]} />
            <Box s={[9, 0.02, 8]} c={C.pave} at={[2, 0, 9]} />
            {LAWNS.map(([x, z, w, d], i) => (
                <Box key={i} s={[w, 0.08, d]} c={i % 2 ? C.grassDark : C.grass} at={[x, 0, z]} />
            ))}
            {Array.from({ length: 7 }, (_, i) => (
                <Box key={i} s={[0.2, 0.03, 3.4]} c="#FFFFFF" at={[-2.5 + i * 1.4, 0, 9.5]} />
            ))}
            {CARS.map(([c, x, z]) => (
                <group key={c}>
                    <Box s={[1, 0.5, 2]} c={c} at={[x, 0, z]} />
                    <Box s={[0.85, 0.35, 1.1]} c={c} at={[x, 0.5, z - 0.1]} />
                </group>
            ))}

            {/* Tòa A2 */}
            <Building {...b('Tòa A2')} sub="Thiết kế đồ họa · UX/UI" anchorY={17.6} position={[2, 0, 1]}>
                <Box s={[11, 2.8, 7.4]} c={C.granite} />
                {Array.from({ length: 5 }, (_, i) => (
                    <Box key={i} s={[1.5, 1, 0.1]} c={C.win} at={[-4.2 + i * 1.9, 1.4, 3.72]} />
                ))}
                <Box s={[3.4, 0.35, 2.4]} c={C.granite} at={[4.2, 2.8, 4.4]} />
                {[3.1, 5.3].map((x) => (
                    <Cylinder key={x} r={0.24} h={2.8} c="#D6D2CF" at={[x, 1.4, 5.3]} />
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
                <Box s={[6.8, 0.5, 4.8]} c="#E8E0D4" at={[0, 13.8, -0.8]} />
                <HipRoof w={5.2} h={1.6} d={3.6} c={C.roofRed} at={[0, 14.3, -1.2]} />
                <Gable len={0.5} h={1.8} depth={5} c={C.cream} at={[0, 13.8, 1.35]} alongZ />
                {/* Đồng hồ */}
                <mesh position={[0, 14.55, 1.65]} rotation={[Math.PI / 2, 0, 0]} material={stdMat('#FFFFFF')} castShadow receiveShadow>
                    <cylinderGeometry args={[0.62, 0.62, 0.12, 24]} />
                </mesh>
                <mesh position={[0, 14.55, 1.7]} material={stdMat(C.glass)} castShadow receiveShadow>
                    <torusGeometry args={[0.62, 0.08, 6, 24]} />
                </mesh>
                <Box s={[0.06, 0.45, 0.04]} c="#1A1412" at={[0, 14.55, 1.74]} />
                <Box s={[0.36, 0.06, 0.04]} c="#1A1412" at={[0.16, 14.55, 1.74]} />
                <TextPlane w={2.4} h={0.6} text="PTIT" at={[0, 13.45, 1.62]} opts={T_PTIT} />

                <A2Windows nightRef={nightRef} reduce={reduce} />

                <TextPlane w={3.2} h={0.8} text="I ♥ PTIT" at={[2.8, 0.45, 6.6]} opts={T_HEART} doubleSide />
                {([[-5.8, '#C4161C'], [-5, '#F2C230'], [-4.2, '#3E7BD6']] as const).map(([x, c], i) => (
                    <Flag key={x} x={x} color={c} index={i} reduce={reduce} />
                ))}
            </Building>

            {/* Tòa A3: khối vàng, mái chóp đỏ */}
            <Building {...b('Tòa A3')} sub="Nhiếp ảnh · Quay phim" anchorY={7.6} position={[12.5, 0, -9.5]}>
                <Box s={[13, 4.6, 4.4]} c={C.yellow} />
                {Array.from({ length: 10 }, (_, i) => (
                    <Box key={i} s={[0.7, 3.4, 0.1]} c={C.win} at={[-5.4 + i * 1.2, 0.6, 2.23]} />
                ))}
                <HipRoof w={14} h={2} d={5.4} c={C.roofRed} at={[0, 4.6, 0]} />
                <Box s={[2.6, 5.2, 1]} c={C.yellow} at={[0, 0, 2.6]} />
                <Gable len={1.2} h={1.2} depth={3} c={C.roofRed} at={[0, 5.2, 2.6]} alongZ />
            </Building>

            {/* Hội trường A1: dài, trắng, mái đầu hồi đỏ */}
            <Building {...b('Hội trường A1')} sub="Sự kiện · Seminar" anchorY={6.2} position={[-11, 0, -9]}>
                <Box s={[12, 3.6, 5]} c={C.white} />
                {Array.from({ length: 8 }, (_, i) => (
                    <Box key={i} s={[0.8, 1.6, 0.1]} c="#9FB7C4" at={[-4.9 + i * 1.4, 1, 2.53]} />
                ))}
                <Gable len={12.6} h={2.2} depth={5.8} c={C.roofRed} at={[0, 3.6, 0]} />
                <Box s={[3, 4.4, 1.2]} c={C.white} at={[0, 0, 3]} />
                <Gable len={1.4} h={1.4} depth={3.4} c={C.roofRed} at={[0, 4.4, 3]} alongZ />
            </Building>

            {/* Tòa A1: khối trắng thấp có dải ngang */}
            <Building {...b('Tòa A1')} sub="Lý thuyết · Phòng học" anchorY={6.4} position={[-11.5, 0, 3.5]}>
                <Box s={[7.5, 5.2, 6]} c={C.white} />
                {Array.from({ length: 5 }, (_, r) => (
                    <Box key={r} s={[7.6, 0.18, 6.1]} c={C.stripe} at={[0, 0.7 + r * 0.95, 0]} />
                ))}
                <Box s={[7.6, 0.9, 0.1]} c="#3C9E5B" at={[0, 0.2, 3.05]} />
            </Building>

            <Building {...b('Canteen')} sub="Góc nghỉ" anchorY={4.2} position={[-1.5, 0, -11]}>
                <Box s={[5.5, 2.2, 3.4]} c={C.white} />
                <HipRoof w={6.4} h={1.4} d={4.2} c={C.roofRed} at={[0, 2.2, 0]} />
            </Building>

            <Building {...b('Cổng trường')} sub="Học viện Công nghệ BCVT" anchorY={5.6} position={[2, 0, 13.2]}>
                {[-3.4, 3.4].map((x) => (
                    <Box key={x} s={[0.8, 3.6, 0.8]} c="#D8C29C" at={[x, 0, 0]} />
                ))}
                <Box s={[8, 0.5, 1]} c="#E4D7BF" at={[0, 3.6, 0]} />
                <Box s={[7.4, 1.6, 0.2]} c="#F3EFEA" at={[0, 4.1, 0]} />
                <TextPlane w={7.2} h={1.5} text={'HỌC VIỆN\nCÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG'} at={[0, 4.9, 0.12]} opts={T_GATE} />
                {Array.from({ length: 9 }, (_, i) => (
                    <Box key={i} s={[0.08, 1.4, 0.08]} c="#C9C3BD" at={[4.6 + i * 0.55, 0, 0]} />
                ))}
                <Box s={[5, 0.08, 0.08]} c="#C9C3BD" at={[6.8, 1.3, 0]} />
            </Building>

            {/* Cây */}
            {TREE_SPOTS.map(([x, z], i) => {
                const s = 0.8 + ((i * 37) % 10) / 22
                return (
                    <group key={i}>
                        <mesh position={[x, 0.6 * s, z]} material={stdMat(C.trunk)} castShadow receiveShadow>
                            <cylinderGeometry args={[0.14 * s, 0.2 * s, 1.2 * s, 6]} />
                        </mesh>
                        <mesh position={[x, 1.9 * s, z]} material={stdMat(i % 3 ? C.tree : C.tree2)} castShadow receiveShadow>
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

// ─── Cảnh: camera, đèn, xoay theo chuột, hover, ngày/đêm ───────────────────

const SUN_DAY = new THREE.Color('#FFD9B8')
const SUN_NIGHT = new THREE.Color('#7E8FD6')
const LOOK_AT = new THREE.Vector3(0, 3, 0)

interface SceneProps {
    night: boolean
    reduce: boolean
    pointer: React.MutableRefObject<{ x: number; y: number; inside: boolean }>
}

function Scene({ night, reduce, pointer }: SceneProps) {
    const world = useRef<THREE.Group>(null)
    const hemi = useRef<THREE.HemisphereLight>(null)
    const sun = useRef<THREE.DirectionalLight>(null)
    const rim = useRef<THREE.DirectionalLight>(null)
    const registry = useRef(new Map<string, THREE.Group>())
    const lifts = useRef(new Map<string, number>())
    const hoverRef = useRef<BuildingName | null>(null)
    const nightRef = useRef(reduce && night ? 1 : 0)
    const nightTarget = useRef(night ? 1 : 0)
    const [hovered, setHovered] = useState<BuildingName | null>(null)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const ndc = useMemo(() => new THREE.Vector2(-9, -9), [])

    const size = useThree((s) => s.size)
    const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
    const domElement = useThree((s) => s.gl.domElement)
    const compact = size.width < 560

    useEffect(() => {
        nightTarget.current = night ? 1 : 0
        if (reduce) nightRef.current = nightTarget.current
    }, [night, reduce])

    useEffect(() => {
        camera.fov = compact ? 38 : 28
        camera.updateProjectionMatrix()
    }, [camera, compact])

    useFrame((state, delta) => {
        const g = world.current
        if (!g) return
        const p = pointer.current
        const mx = p.inside ? p.x : 0
        const my = p.inside ? p.y : 0
        const t = state.clock.elapsedTime

        // Xoay theo chuột (cộng chút lắc nhẹ), camera nghiêng theo chiều dọc
        const sway = reduce ? 0 : Math.sin(t * 0.25) * 0.12
        g.rotation.y += (mx * 0.45 + sway - g.rotation.y) * 0.06
        camera.position.y += (40 + my * 6 - camera.position.y) * 0.05
        camera.lookAt(LOOK_AT)

        // Tia từ con trỏ: tòa nào bị trúng thì được nâng lên
        ndc.set(p.inside ? p.x : -9, p.inside ? p.y : -9)
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
            domElement.style.cursor = hb ? 'pointer' : 'grab'
            setHovered(hb)
        }
        registry.current.forEach((grp, name) => {
            const lift = lifts.current.get(name) ?? 0
            const next = lift + ((name === hb ? 0.9 : 0) - lift) * (reduce ? 1 : 0.12)
            lifts.current.set(name, next)
            grp.position.y = next
        })

        // Chuyển hoàng hôn ↔ buổi tối
        nightRef.current += (nightTarget.current - nightRef.current) * (reduce ? 1 : 0.04)
        const n = nightRef.current
        if (sun.current) {
            sun.current.intensity = (1.05 - n * 0.75) * Math.PI
            sun.current.color.copy(SUN_DAY).lerp(SUN_NIGHT, n)
        }
        if (hemi.current) hemi.current.intensity = (0.75 - n * 0.4) * Math.PI
        if (rim.current) rim.current.intensity = (0.35 + n * 0.25) * Math.PI
        void delta
    })

    return (
        <>
            <hemisphereLight ref={hemi} args={[0xffe9e0, 0x5a2a28, 0.75 * Math.PI]} />
            <directionalLight
                ref={sun}
                color="#FFD9B8"
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
            <directionalLight ref={rim} color="#FF6B5E" intensity={0.35 * Math.PI} position={[30, 14, -30]} />
            <group ref={world}>
                <Campus hovered={hovered} compact={compact} registry={registry} nightRef={nightRef} reduce={reduce} />
            </group>
        </>
    )
}

// ─── Điểm vào: Canvas + chờ font trước khi dựng chữ lên texture ────────────

export interface CampusSceneProps {
    night: boolean
    reduce: boolean
}

export default function CampusScene({ night, reduce }: CampusSceneProps) {
    const [fontsReady, setFontsReady] = useState(false)
    const pointer = useRef({ x: 0, y: 0, inside: false })
    const wrapRef = useRef<HTMLDivElement>(null)

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

    useEffect(() => {
        const el = wrapRef.current
        if (!el) return
        const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1), inside: true }
        }
        const leave = () => {
            pointer.current.inside = false
        }
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        return () => {
            el.removeEventListener('pointermove', move)
            el.removeEventListener('pointerleave', leave)
        }
    }, [])

    return (
        <div ref={wrapRef} className="absolute inset-0" style={{ cursor: 'grab' }}>
            {fontsReady && (
                <Canvas
                    legacy
                    flat
                    shadows="soft"
                    dpr={[1, 2]}
                    camera={{ fov: 28, position: [52, 40, 58], near: 1, far: 400 }}
                    gl={{ antialias: true, alpha: true }}
                    aria-label="Mô hình 3D khuôn viên PTIT, có thể xoay bằng chuột"
                    role="img"
                >
                    <Scene night={night} reduce={reduce} pointer={pointer} />
                </Canvas>
            )}
        </div>
    )
}
