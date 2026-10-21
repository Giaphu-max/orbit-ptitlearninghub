import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMPUS, LOBBY as L } from './campus-palette'
import { Box, stdMat, type BoxProps, type Vec3 } from './campus-prims'
import { DEFAULT_SETUP } from '@/lib/studio-setup'
import { createMaterials, PropBlue, PropColumn, PropGreen, PropYellow, STUDIO_PROP_AT, StudioFigure, StudioPlinth, StudioWalls, tintMaterials } from '@/components/studio/studio-set'

// Phòng thực hành sau hành lang A2: lớp học với bàn ghế đỏ và bộ studio ở đầu lớp, dùng đúng vật thể (studio-set)
// và bố trí đèn 3 điểm mặc định của trang Studio. Toạ độ theo hệ nội thất của bản mẫu (xem campus-a2.tsx).

/** Tâm studio ở đầu lớp (z trong hệ nội thất) */
export const STUDIO_Z = -27.5
/** Mét (studio) → đơn vị nội thất: nhân vật ~2,1 m cao ~3 đơn vị, bằng chiều cao người so với bàn học */
const K = 1.45
const STUDIO_TARGET: Vec3 = [0, 1.1, 0]

const LOOK = DEFAULT_SETUP.look
const KEY_SIDE = Math.sign(DEFAULT_SETUP.keyAngleDeg) || 1
const polar = (azDeg: number, elDeg: number, r: number): Vec3 => {
    const a = THREE.MathUtils.degToRad(azDeg)
    const e = THREE.MathUtils.degToRad(elDeg)
    return [Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r + STUDIO_TARGET[1], Math.cos(a) * Math.cos(e) * r]
}
const KEY_POS = polar(DEFAULT_SETUP.azimuthDeg + DEFAULT_SETUP.keyAngleDeg, LOOK.keyElevationDeg, 6)
const FILL_POS = polar(DEFAULT_SETUP.azimuthDeg - KEY_SIDE * LOOK.fillSideDeg, LOOK.fillElevationDeg, 6)
const RIM_POS = polar(DEFAULT_SETUP.azimuthDeg + 180 + KEY_SIDE * LOOK.rimSideDeg, LOOK.rimElevationDeg, 5)
/** Đèn viền mặc định là 0; bật nhẹ để thấy viền đỏ */
const RIM_ON = 30

const band = (s: number, a: number, b: number) => Math.max(0, Math.min(1, (s - a) / (b - a)))
const lerp = THREE.MathUtils.lerp

const roomWhite = stdMat(L.white, { flat: false, roughness: 0.95 })
const DESKS = Array.from({ length: 12 }, (_, i) => [-6 + (i % 4) * 4, -16 - Math.floor(i / 4) * 3.2] as const)
const LAMP_Z = [-16, -21, -26, -31]
const LEGS: [number, number][] = [[-1.2, -0.55], [1.2, -0.55], [-1.2, 0.55], [1.2, 0.55]]

function RB(p: BoxProps) {
    return <Box mid cast={false} {...p} />
}

/**
 * `worldScale` = tỉ lệ của nhóm nội thất (mét-nội-thất → thế giới), dùng đổi cường độ đèn cho đúng suy giảm theo bình phương khoảng cách.
 * `stage` là S đã làm mượt: đèn lớp tối dần từ S 1.9, bộ đèn studio bật ở S 2.62–2.95.
 */
export function PracticeRoom({ stage, floorY, worldScale }: { stage: React.MutableRefObject<number>; floorY: number; worldScale: number }) {
    const mats = useMemo(() => {
        const m = createMaterials()
        tintMaterials(m, new THREE.Color(DEFAULT_SETUP.look.background))
        return m
    }, [])
    const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: L.roomLamp, emissive: L.roomLamp, emissiveIntensity: 1.1 }), [])
    useEffect(
        () => () => {
            lampMat.dispose()
            for (const m of Object.values(mats)) m.dispose()
        },
        [lampMat, mats],
    )
    const keyT = useMemo(() => new THREE.Object3D(), [])
    const rimT = useMemo(() => new THREE.Object3D(), [])
    const keyL = useRef<THREE.SpotLight>(null)
    const fillL = useRef<THREE.PointLight>(null)
    const rimL = useRef<THREE.SpotLight>(null)
    const roomPts = useRef<(THREE.PointLight | null)[]>([])
    const ws2 = (K * worldScale) ** 2
    const I_KEY = (DEFAULT_SETUP.key / 100) * 140 * ws2
    const I_FILL = (DEFAULT_SETUP.fill / 100) * 40 * ws2
    const I_RIM = (RIM_ON / 100) * 160 * ws2

    useFrame(() => {
        const S = stage.current
        const st = band(S, 2.62, 2.95)
        for (const l of roomPts.current) if (l) l.intensity = lerp(18, 2, st) * band(S, 1.9, 2.2)
        lampMat.emissiveIntensity = lerp(1.1, 0.15, st)
        if (keyL.current) {
            keyL.current.intensity = I_KEY * st
            // Chỉ đổ bóng khi đèn thật sự sáng: shadow map luôn được vẽ khi đã được đưa vào shader
            const shadow = st > 0.01
            if (keyL.current.castShadow !== shadow) keyL.current.castShadow = shadow
        }
        if (fillL.current) fillL.current.intensity = I_FILL * st
        if (rimL.current) rimL.current.intensity = I_RIM * st
    })

    return (
        <>
            {/* Vỏ lớp: sàn gỗ, trần, tường (mặt trước chừa lối vào 4,4 rộng thông với hành lang) */}
            <RB s={[20, 0.2, 21]} c={L.roomFloor} o={{ flat: false, roughness: 0.6 }} at={[0, floorY - 0.1, -23.5]} cast={false} recv />
            <RB s={[20, 0.2, 21]} c={L.roomCeil} at={[0, 6.1, -23.5]} />
            <RB s={[0.3, 6, 21]} mat={roomWhite} at={[-10, 3, -23.5]} />
            <RB s={[0.3, 6, 21]} mat={roomWhite} at={[10, 3, -23.5]} />
            <RB s={[20, 6, 0.3]} mat={roomWhite} at={[0, 3, -34]} />
            <RB s={[7.8, 6, 0.3]} mat={roomWhite} at={[-6.1, 3, -13]} />
            <RB s={[7.8, 6, 0.3]} mat={roomWhite} at={[6.1, 3, -13]} />
            <RB s={[4.4, 2, 0.3]} mat={roomWhite} at={[0, 5, -13]} />
            {LAMP_Z.map((z) => (
                <mesh key={z} position={[0, 5.98, z]} material={lampMat}>
                    <boxGeometry args={[3, 0.06, 1]} />
                </mesh>
            ))}
            {/* Bàn ghế: 3 hàng × 4, ghế đỏ phía sau mỗi bàn */}
            {DESKS.map(([x, z]) => (
                <group key={`${x}_${z}`}>
                    <RB s={[2.6, 0.08, 1.3]} c={L.desk} at={[x, 1.05, z]} />
                    {LEGS.map(([a, b]) => (
                        <RB key={`${a}_${b}`} s={[0.08, 1, 0.08]} c={L.deskLeg} at={[x + a, 0.5, z + b]} />
                    ))}
                    <RB s={[0.8, 0.7, 0.8]} c={CAMPUS.ptitRed} at={[x, 0.55, z + 1.1]} />
                </group>
            ))}

            {/* Bộ studio thật ở đầu lớp (vật thể và đèn như trang Studio) */}
            <group position={[0, floorY, STUDIO_Z]} scale={K}>
                <group scale={[1, 0.7, 1]}>
                    <StudioWalls mats={mats} />
                </group>
                <mesh position={[0, 0.01, 0]} receiveShadow material={mats.floor}>
                    <boxGeometry args={[12, 0.02, 9]} />
                </mesh>
                <StudioPlinth mats={mats} />
                <StudioFigure mats={mats} />
                <group position={[...STUDIO_PROP_AT.yellow]}>
                    <PropYellow mats={mats} />
                </group>
                <group position={[...STUDIO_PROP_AT.blue]}>
                    <PropBlue mats={mats} />
                </group>
                <group position={[...STUDIO_PROP_AT.green]}>
                    <PropGreen mats={mats} />
                </group>
                <group position={[...STUDIO_PROP_AT.column]}>
                    <PropColumn mats={mats} />
                </group>
                <primitive object={keyT} position={STUDIO_TARGET} />
                <primitive object={rimT} position={STUDIO_TARGET} />
                <spotLight ref={keyL} target={keyT} position={KEY_POS} color={LOOK.keyColor} intensity={0} angle={0.6} penumbra={0.6} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
                <pointLight ref={fillL} position={FILL_POS} color={LOOK.fillColor} intensity={0} />
                <spotLight ref={rimL} target={rimT} position={RIM_POS} color={LOOK.rimColor} intensity={0} angle={0.7} penumbra={0.5} />
            </group>

            {[-22].map((z, i) => (
                <pointLight key={z} ref={(l) => void (roomPts.current[i] = l)} position={[0, 5.5, z]} color={L.roomPoint} intensity={0} distance={16} decay={1.2} />
            ))}
        </>
    )
}
