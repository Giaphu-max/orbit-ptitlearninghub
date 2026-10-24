import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMPUS } from './campus-palette'
import type { Vec3 } from './campus-prims'

// Chi tiết "viễn thông" của khuôn viên: cột ăng-ten + sóng tín hiệu trên nóc A2.
// Chỉ đổi transform / opacity / uniform mỗi khung, không tạo geometry trong useFrame. Giảm chuyển động: tắt sóng.

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
