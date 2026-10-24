import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMPUS } from './campus-palette'
import type { Vec3 } from './campus-prims'

// Chi tiết "viễn thông" của khuôn viên: cột ăng-ten + sóng tín hiệu trên nóc A2 và mạng cáp quang có xung dữ liệu dưới sân.
// Chỉ đổi transform / opacity / uniform mỗi khung, không tạo geometry trong useFrame. Giảm chuyển động: tắt sóng và xung, giữ đường sáng tĩnh.

const WAVE_PERIOD = 2.4
const WAVE_COUNT = 3
const steel = new THREE.MeshStandardMaterial({ color: '#B9BEC8', roughness: 0.4, metalness: 0.6 })

/** Cột ăng-ten thép mảnh, đèn đỏ nhấp nháy chậm ở đỉnh, 3 vòng sóng nở to dần rồi mờ (lặp mỗi 2,4s). `at` là chân cột. */
export function Antenna({ at, height = 4.6, reduce }: { at: Vec3; height?: number; reduce: boolean }) {
    const beacon = useRef<THREE.MeshStandardMaterial>(null)
    const rings = useRef<(THREE.Mesh | null)[]>([])
    const ringMats = useMemo(
        () => Array.from({ length: WAVE_COUNT }, (_, i) => new THREE.MeshBasicMaterial({ color: i % 2 ? '#FF9A92' : '#E8554B', transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide })),
        [],
    )
    useFrame(({ clock }) => {
        const t = clock.elapsedTime
        if (beacon.current) beacon.current.emissiveIntensity = reduce ? 1 : 0.25 + 1.6 * Math.max(0, Math.sin((t * Math.PI * 2) / 2.2)) ** 2
        rings.current.forEach((m, i) => {
            if (!m) return
            if (reduce) {
                m.visible = false
                return
            }
            const k = (t / WAVE_PERIOD + i / WAVE_COUNT) % 1
            m.visible = true
            m.scale.setScalar(0.35 + k * 5.2)
            ringMats[i].opacity = 0.8 * (1 - k) ** 1.4
        })
    })
    return (
        <group position={at}>
            <mesh position={[0, height / 2, 0]} material={steel} castShadow>
                <cylinderGeometry args={[0.035, 0.07, height, 6]} />
            </mesh>
            {[0.35, 0.6, 0.82].map((f) => (
                <mesh key={f} position={[0, height * f, 0]} rotation={[0, 0, Math.PI / 2]} material={steel}>
                    <cylinderGeometry args={[0.02, 0.02, 1.1 * (1.1 - f), 4]} />
                </mesh>
            ))}
            <mesh position={[0, height + 0.12, 0]}>
                <sphereGeometry args={[0.14, 10, 8]} />
                <meshStandardMaterial ref={beacon} color={CAMPUS.ledRed} emissive={CAMPUS.ledRed} emissiveIntensity={0.6} />
            </mesh>
            {ringMats.map((mat, i) => (
                <mesh key={i} ref={(m) => void (rings.current[i] = m)} position={[0, height + 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat} visible={false} renderOrder={3}>
                    <ringGeometry args={[0.93, 1, 48]} />
                </mesh>
            ))}
        </group>
    )
}

// ── Cáp quang dưới sân: cổng → A2 → A1 → hội trường, A2 → A3, chạy dọc lối đi ──
type P2 = [number, number]
const ROUTES: P2[][] = [
    [[2, 16.5], [2, 9], [2, 7.5]],
    [[2, 7.5], [-12, 7.5], [-12, 1], [-12, -8]],
    [[-12, 1], [-13.2, 1]],
    [[2, 7.5], [15, 7.5], [15, -6], [15.2, -6]],
]
const FIBER_Y = 0.12
const PULSES_PER_ROUTE = [3, 4, 1, 4]
const TAIL = 3

interface Route {
    pts: THREE.Vector3[]
    cum: number[]
    len: number
}
const routes: Route[] = ROUTES.map((r) => {
    const pts = r.map(([x, z]) => new THREE.Vector3(x, FIBER_Y, z))
    const cum = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    return { pts, cum, len: cum[cum.length - 1] }
})
const _p = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
function pointAt(r: Route, d: number, out: THREE.Vector3) {
    const x = Math.max(0, Math.min(r.len, d))
    let i = 1
    while (i < r.cum.length - 1 && r.cum[i] < x) i++
    const k = (x - r.cum[i - 1]) / Math.max(1e-6, r.cum[i] - r.cum[i - 1])
    return out.lerpVectors(r.pts[i - 1], r.pts[i], k)
}

const PULSES = ROUTES.flatMap((_, ri) => Array.from({ length: PULSES_PER_ROUTE[ri] }, (_, k) => ({ ri, off: (k + ((ri * 0.37) % 1)) / PULSES_PER_ROUTE[ri], speed: 5 + ri * 0.6 })))

/** Mạng cáp quang: đường mảnh sáng (#BC2626 ~35%) + khoảng 12 xung dữ liệu (một InstancedMesh, mỗi xung gồm đầu và 2 vệt đuôi nhỏ dần). */
export function FiberNetwork({ reduce }: { reduce: boolean }) {
    const inst = useRef<THREE.InstancedMesh>(null)
    const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: CAMPUS.fiber, transparent: true, opacity: 0.5, depthWrite: false }), [])
    const segs = useMemo(() => {
        const out: { pos: Vec3; size: [number, number]; rotY: number }[] = []
        routes.forEach((r) => {
            for (let i = 1; i < r.pts.length; i++) {
                const a = r.pts[i - 1]
                const b = r.pts[i]
                const len = a.distanceTo(b)
                out.push({ pos: [(a.x + b.x) / 2, FIBER_Y, (a.z + b.z) / 2], size: [len + 0.55, 0.55], rotY: Math.atan2(-(b.z - a.z), b.x - a.x) })
            }
        })
        return out
    }, [])
    const pulseMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FF6A5E', toneMapped: false, fog: false }), [])
    const count = PULSES.length * TAIL

    // Xung đặt sẵn ở vị trí tĩnh (giảm chuyển động: không chạy, ẩn bằng scale 0)
    useLayoutEffect(() => {
        const m = inst.current
        if (!m) return
        _s.set(0, 0, 0)
        for (let i = 0; i < count; i++) m.setMatrixAt(i, _m.compose(_p.set(0, -5, 0), _q.identity(), _s))
        m.instanceMatrix.needsUpdate = true
    }, [count])

    useFrame(({ clock }) => {
        const m = inst.current
        if (!m || reduce) return
        const t = clock.elapsedTime
        PULSES.forEach((p, pi) => {
            const r = routes[p.ri]
            const head = (t * p.speed + p.off * r.len) % (r.len + 3)
            for (let k = 0; k < TAIL; k++) {
                const d = head - k * 0.55
                const vis = d >= 0 && d <= r.len
                pointAt(r, d, _p)
                const sc = vis ? 0.8 * (1 - k * 0.3) : 0
                _m.compose(_p, _q.identity(), _s.set(sc, sc * 0.5, sc))
                m.setMatrixAt(pi * TAIL + k, _m)
            }
        })
        m.instanceMatrix.needsUpdate = true
    })

    return (
        <group>
            {segs.map((s, i) => (
                <mesh key={i} position={s.pos} rotation={[-Math.PI / 2, 0, s.rotY]} material={lineMat} renderOrder={2}>
                    <planeGeometry args={s.size} />
                </mesh>
            ))}
            {!reduce && (
                <instancedMesh ref={inst} args={[undefined, undefined, count]} material={pulseMat} frustumCulled={false} renderOrder={4}>
                    <sphereGeometry args={[1, 8, 6]} />
                </instancedMesh>
            )}
        </group>
    )
}
