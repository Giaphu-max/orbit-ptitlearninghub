import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A2COL as A, CAMPUS, LOBBY as L } from './campus-palette'
import { PracticeRoom } from './campus-room'
import { Box, Cylinder, DrawPlane, FlatRoof, stdMat, TextPlane, type BoxProps, type TextOpts, type Vec3 } from './campus-prims'

// Phần mới của khuôn viên theo bản mẫu docs/mockup/orbit-campus-journey.html: đế tòa A2 (sảnh lõm, mặt kính nhìn xuyên vào trong,
// cửa kính tự mở), sảnh bên trong và Hội trường A2. Toạ độ trong file này là toạ độ cục bộ của tòa A2, trừ khi ghi khác.

/** Vị trí tòa A2 trong khuôn viên */
export const A2_AT: Vec3 = [2, 0, 1]
/** Mặt sàn sảnh (cao hơn sân một chút nhờ 3 bậc thềm) */
export const FLOOR_H = 0.33
/** Nhóm nội thất: vẽ theo toạ độ bản mẫu rồi thu một nửa và đặt vào trong đế (cục bộ tòa A2) */
export const LOBBY_AT: Vec3 = [0, FLOOR_H - 0.06, 0.9 - 6]
export const LOBBY_SCALE = 0.5
export const FY = 0.12 // sàn sảnh trong toạ độ nội thất, cao hơn tấm nền để không bị z-fighting
/** Mặt trên của đế (chân của thân tháp) */
export const PODIUM_TOP = 5.6

// Kiosk khóa học (nội thất, toạ độ bản mẫu): đích cuối của máy quay chương này
export const KIOSK: Vec3 = [-6, 0, -3.3]
export const KS = 0.72
export const KIOSK_RY = 0.22
export const SCR_W = 2.4
export const SCR_H = 1.5
// Màn ngả nhẹ ra sau (kiosk đứng thẳng như mockup docs/mockup/orbit-courses-chapter.html, ~14°)
export const TILT = THREE.MathUtils.degToRad(14)
const KIOSK_HEAD_AT: Vec3 = [0, 2.05, 0.05]

/** Điểm trong toạ độ cục bộ của tòa A2 → toạ độ thế giới */
export const a2Point = (x: number, y: number, z: number) => new THREE.Vector3(A2_AT[0] + x, A2_AT[1] + y, A2_AT[2] + z)
/** Điểm trong toạ độ nội thất (bản mẫu) → toạ độ thế giới */
export const lobbyPoint = (x: number, y: number, z: number) => a2Point(LOBBY_AT[0] + x * LOBBY_SCALE, LOBBY_AT[1] + y * LOBBY_SCALE, LOBBY_AT[2] + z * LOBBY_SCALE)

/** Tâm, pháp tuyến (hướng ra phía người xem) và chiều cao thật (thế giới) của màn hình kiosk, tính từ cùng chuỗi phép biến đổi với mô hình. */
export function kioskScreenFrame() {
    const lobby = new THREE.Group()
    lobby.position.set(A2_AT[0] + LOBBY_AT[0], A2_AT[1] + LOBBY_AT[1], A2_AT[2] + LOBBY_AT[2])
    lobby.scale.setScalar(LOBBY_SCALE)
    const floor = new THREE.Group()
    floor.position.y = FY
    lobby.add(floor)
    const kiosk = new THREE.Group()
    kiosk.position.set(...KIOSK)
    kiosk.scale.setScalar(KS)
    kiosk.rotation.y = KIOSK_RY
    floor.add(kiosk)
    const head = new THREE.Group()
    head.position.set(...KIOSK_HEAD_AT)
    head.rotation.x = -TILT
    kiosk.add(head)
    const screen = new THREE.Object3D()
    screen.position.z = 0.05
    head.add(screen)
    lobby.updateMatrixWorld(true)
    const base = kiosk.getWorldPosition(new THREE.Vector3())
    // Đỉnh kiosk = mép trên khung màn (đầu ngả TILT)
    const topY = head.getWorldPosition(new THREE.Vector3()).y + ((SCR_H + 0.14) / 2) * Math.cos(TILT) * KS * LOBBY_SCALE
    const corners: THREE.Vector3[] = []
    const kx0 = -1.25, kx1 = 1.25, ky0 = 0, ky1 = 2.85, kz0 = -0.6, kz1 = 0.6
    for (let k = 0; k < 8; k++) {
        const p = new THREE.Vector3(k & 1 ? kx1 : kx0, k & 2 ? ky1 : ky0, k & 4 ? kz1 : kz0)
        corners.push(p.applyMatrix4(kiosk.matrixWorld))
    }
    return { baseY: base.y, topY, center: screen.getWorldPosition(new THREE.Vector3()), normal: new THREE.Vector3(0, 0, 1).transformDirection(screen.matrixWorld), height: SCR_H * KS * LOBBY_SCALE, matrix: screen.matrixWorld.clone(), up: new THREE.Vector3(0, 1, 0).transformDirection(screen.matrixWorld), right: new THREE.Vector3(1, 0, 0).transformDirection(screen.matrixWorld), corners }
}

const HW = 10.35 // nửa bề ngang đế
const PODIUM_BACK = -22.5

const beige = stdMat(A.beige)
const stone = stdMat(A.stone)
const parapet = stdMat(A.parapet)
const glassFacade = stdMat(A.facade, { opacity: 0.38, roughness: 0.05, metalness: 0.2 })
const glassDoor = stdMat(A.door, { opacity: 0.6, roughness: 0.05, metalness: 0.3 })
const frameM = stdMat(A.frame)
const mullion = stdMat(A.mullion)

const T_SAMSUNG: TextOpts = { fg: CAMPUS.signBlue, size: 64, weight: 800 }
const T_HALL: TextOpts = { h: 96, size: 46, bg: A.hallSign, fg: A.hallSignText }

const lerp = THREE.MathUtils.lerp
const band = (s: number, a: number, b: number) => Math.max(0, Math.min(1, (s - a) / (b - a)))
const smooth = (t: number) => t * t * (3 - 2 * t)

// ─── Đế tòa A2: cánh hai bên, sảnh lõm có 2 cột, bậc, mặt kính, 2 cánh cửa trượt ──

const WING_WINDOWS: [number, number][] = [-9.4, -7.7, -6, -4.3, 4.3, 6, 7.7, 9.4].flatMap((x) => [1.5, 3.5].map((y) => [x, y] as [number, number]))
const STEPS = [0, 1, 2]
const DOOR_H = 2.5
const DOOR_Y = FLOOR_H + DOOR_H / 2

function CB(p: BoxProps) {
    return <Box mid {...p} />
}

function Door({ side, doorRef }: { side: 1 | -1; doorRef: React.RefObject<THREE.Group | null> }) {
    return (
        <group ref={doorRef} position={[side * 0.8, DOOR_Y, 0.95]}>
            <CB s={[1.6, DOOR_H, 0.05]} mat={glassDoor} cast={false} recv={false} />
            <CB s={[1.6, 0.1, 0.08]} mat={frameM} at={[0, DOOR_H / 2 - 0.05, 0]} cast={false} recv={false} />
            <CB s={[1.6, 0.1, 0.08]} mat={frameM} at={[0, -DOOR_H / 2 + 0.05, 0]} cast={false} recv={false} />
            <CB s={[0.08, DOOR_H, 0.08]} mat={frameM} at={[-0.78, 0, 0]} cast={false} recv={false} />
            <CB s={[0.08, DOOR_H, 0.08]} mat={frameM} at={[0.78, 0, 0]} cast={false} recv={false} />
            {/* Tay nắm ở mép trong (phía giữa cửa) */}
            <CB s={[0.05, 0.6, 0.1]} c={A.handle} at={[side * -0.6, 0, 0.04]} cast={false} recv={false} />
        </group>
    )
}

/** Đế rộng của A2 + mặt tiền kính + cửa. `stage` là S đã làm mượt: cửa mở trong ~15% quãng cuối tới cửa (S 1.38 → 1.49). */
export function A2Podium({ stage }: { stage: React.MutableRefObject<number> }) {
    const left = useRef<THREE.Group>(null)
    const right = useRef<THREE.Group>(null)
    useFrame(() => {
        const open = smooth(band(stage.current, 1.38, 1.49))
        if (left.current) left.current.position.x = -0.8 - open * 1.55
        if (right.current) right.current.position.x = 0.8 + open * 1.55
    })
    return (
        <>
            {/* Vỏ đế: 2 cánh trước, tường bên, tường sau, mái */}
            <CB edges s={[7.35, 5, 2.6]} mat={stone} at={[-6.675, 2.5, 2.2]} />
            <CB edges s={[7.35, 5, 2.6]} mat={stone} at={[6.675, 2.5, 2.2]} />
            <CB edges s={[0.3, 5, 23.4]} mat={stone} at={[-HW, 2.5, (PODIUM_BACK + 0.9) / 2]} />
            <CB edges s={[0.3, 5, 23.4]} mat={stone} at={[HW, 2.5, (PODIUM_BACK + 0.9) / 2]} />
            <CB edges s={[2 * HW, 5, 0.3]} mat={stone} at={[0, 2.5, PODIUM_BACK]} />
            <CB edges s={[2 * HW + 0.4, 0.6, 26]} mat={beige} at={[0, 5.3, (PODIUM_BACK + 3.5) / 2]} />
            <CB s={[2 * HW + 0.6, 0.25, 6.6]} mat={parapet} at={[0, 4.9, 1]} />
            {WING_WINDOWS.map(([x, y]) => (
                <CB key={`${x}_${y}`} s={[1.1, 1.2, 0.1]} c={A.winG} at={[x, y, 3.52]} />
            ))}
            <TextPlane w={5.4} h={0.8} text="SAMSUNG LAB · FPT TELECOM LAB" at={[-6.675, 4.55, 3.57]} opts={T_SAMSUNG} />

            {/* Hai cột trắng, bậc đỏ, sàn thềm */}
            {[-2.3, 2.3].map((x) => (
                <Cylinder key={x} r={0.45} h={5} c={A.column} at={[x, 2.5, 3.1]} seg={16} o={{ flat: false }} />
            ))}
            {STEPS.map((i) => (
                <Box key={i} s={[8.4 - i * 0.3, 0.11 * (i + 1), 0.55]} c={A.step} at={[0, 0, 5.6 - i * 0.55]} />
            ))}
            <Box s={[6, FLOOR_H + 0.005, 3.4]} c={A.mat} at={[0, 0, 2.6]} />

            {/* Mặt tiền kính nhìn xuyên vào sảnh */}
            <CB s={[1.4, 4.6, 0.06]} mat={glassFacade} at={[-2.3, 2.4, 0.9]} cast={false} recv={false} />
            <CB s={[1.4, 4.6, 0.06]} mat={glassFacade} at={[2.3, 2.4, 0.9]} cast={false} recv={false} />
            <CB s={[4.6, 1.9, 0.06]} mat={glassFacade} at={[0, 3.75, 0.9]} cast={false} recv={false} />
            {[-3, -1.6, 1.6, 3].map((x) => (
                <CB key={x} s={[0.08, 4.8, 0.1]} mat={mullion} at={[x, 2.4, 0.9]} cast={false} />
            ))}
            <CB s={[6, 0.1, 0.12]} mat={mullion} at={[0, 2.8, 0.9]} cast={false} />
            <Door side={-1} doorRef={left} />
            <Door side={1} doorRef={right} />
        </>
    )
}

// ─── Sảnh bên trong ────────────────────────────────────────────────────────

const wood = stdMat(L.wood, { flat: false, roughness: 0.55 })
const white = stdMat(L.white, { flat: false, roughness: 0.95 })
const granite = stdMat(L.granite, { flat: false, roughness: 0.6 })
const slab = stdMat(L.slab, { flat: false })
const railGlass = stdMat(L.rail, { opacity: 0.28, roughness: 0.05, flat: false })

function IB(p: BoxProps) {
    return <Box mid cast={false} {...p} />
}

// Số ngẫu nhiên có hạt giống: texture giống nhau mỗi lần dựng
function seeded(seed: number) {
    let s = seed
    return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function drawFloor(g: CanvasRenderingContext2D, w: number, h: number) {
    g.fillStyle = L.floor
    g.fillRect(0, 0, w, h)
    const rnd = seeded(7)
    for (let i = 0; i < 16000; i++) {
        const v = (110 + rnd() * 120) | 0
        g.fillStyle = `rgba(${v},${v},${v - 6},.3)`
        g.fillRect(rnd() * w, rnd() * h, 2, 2)
    }
    g.fillStyle = L.floorBand
    g.fillRect(0, 426, w, 148)
    g.fillRect(426, 0, 148, h)
    g.fillStyle = L.floorLine
    g.fillRect(0, 440, w, 120)
    g.fillRect(440, 0, 120, h)
}
function drawBanner(g: CanvasRenderingContext2D, w: number, h: number) {
    const gr = g.createLinearGradient(0, 0, w, 0)
    gr.addColorStop(0, L.bannerA)
    gr.addColorStop(1, L.bannerB)
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
    g.strokeStyle = L.bannerLine
    g.lineWidth = 6
    g.strokeRect(6, 6, w - 12, h - 12)
    g.fillStyle = L.bannerText
    g.font = '800 80px "Be Vietnam Pro", Arial, sans-serif'
    g.textAlign = 'center'
    g.fillText('KHOA HỌC, CÔNG NGHỆ, ĐỔI MỚI SÁNG TẠO VÀ CHUYỂN ĐỔI SỐ', w / 2, 108)
}
function drawTech(g: CanvasRenderingContext2D, w: number, h: number) {
    const gr = g.createLinearGradient(0, 0, w, h)
    gr.addColorStop(0, L.techA)
    gr.addColorStop(1, L.techB)
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
    g.strokeStyle = L.techLine
    const rnd = seeded(11)
    for (let i = 0; i < 30; i++) {
        g.beginPath()
        g.moveTo(rnd() * w, rnd() * h)
        g.lineTo(rnd() * w, rnd() * h)
        g.stroke()
    }
    g.fillStyle = L.techText
    g.font = '800 90px "Be Vietnam Pro", Arial, sans-serif'
    g.textAlign = 'center'
    g.fillText('AI · 5G · IoT', w / 2, 160)
}
function drawLove(g: CanvasRenderingContext2D, w: number, h: number) {
    g.fillStyle = L.loveBg
    g.fillRect(0, 0, w, h)
    const rnd = seeded(5)
    for (let y = 0; y < h; y += 16)
        for (let x = 0; x < w; x += 16) {
            g.fillStyle = `rgba(${L.loveTile},${0.05 + rnd() * 0.15})`
            g.fillRect(x, y, 14, 14)
        }
    g.fillStyle = L.loveRed
    g.font = '900 150px "Be Vietnam Pro", Arial, sans-serif'
    g.textAlign = 'center'
    g.fillText('I ♥ PTIT', w / 2, 220)
    g.fillStyle = L.loveRed2
    g.beginPath()
    g.arc(w / 2, h, 240, Math.PI, 0)
    g.fill()
    g.fillStyle = L.loveDark
    g.beginPath()
    g.arc(w / 2, h, 190, Math.PI, 0)
    g.fill()
}
function drawRoomSign(g: CanvasRenderingContext2D, w: number, h: number) {
    g.fillStyle = L.roomRed
    g.fillRect(0, 0, w, h)
    g.fillStyle = L.roomText
    g.textAlign = 'center'
    g.font = '800 64px "Be Vietnam Pro", Arial, sans-serif'
    g.fillText('PHÒNG THỰC HÀNH', w / 2, 82)
    g.font = '600 40px "Be Vietnam Pro", Arial, sans-serif'
    g.fillText('ĐA PHƯƠNG TIỆN · STUDIO', w / 2, 140)
}

function Led({ r, at }: { r: number; at: Vec3 }) {
    return (
        <mesh position={at} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.05, 8, 64]} />
            <meshBasicMaterial color={L.led} />
        </mesh>
    )
}

/** Cột "cây" gỗ: thân granite, hai tay cong gỗ có dải đèn. */
function TreeColumn({ x, z, face }: { x: number; z: number; face: number }) {
    return (
        <group position={[x, 0, z]} rotation={[0, face, 0]}>
            <IB s={[0.8, 4, 0.8]} mat={granite} at={[0, 2, 0]} />
            <IB s={[0.8, 1, 1]} c={L.colBase} o={{ flat: false }} at={[0, 0.5, 0]} />
            {[-1, 1].map((sd) => (
                <group key={sd}>
                    <IB s={[0.5, 2.6, 0.9]} mat={wood} at={[sd * 0.62, 1.3, 0]} />
                    <mesh position={[sd * 1.85, 2.6, 0]} rotation={[0, 0, sd > 0 ? Math.PI / 2 : 0]} scale={[1, 1, 1.6]} material={wood}>
                        <torusGeometry args={[1.2, 0.24, 8, 24, Math.PI / 2]} />
                    </mesh>
                    <mesh position={[sd * 1.85, 2.6, 0.48]} rotation={[0, 0, sd > 0 ? Math.PI / 2 : 0]}>
                        <torusGeometry args={[1.1, 0.03, 6, 24, Math.PI / 2]} />
                        <meshBasicMaterial color={L.led} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

function Bench({ x, z, ry }: { x: number; z: number; ry: number }) {
    return (
        <group position={[x, 0, z]} rotation={[0, ry, 0]}>
            <IB s={[2.6, 0.12, 1]} mat={wood} at={[0, 0.5, 0]} />
            <IB s={[2.2, 0.4, 0.7]} mat={white} at={[0, 0.24, 0]} />
            <IB s={[1.6, 0.8, 0.12]} mat={wood} at={[0, 0.95, -0.3]} />
        </group>
    )
}

/** Kiosk khóa học: chân chữ K màu trắng, màn hình 16:10 nghiêng. */
function Kiosk() {
    const kWhite = stdMat(L.kiosk, { flat: false, roughness: 0.35 })
    return (
        <group position={KIOSK} scale={KS} rotation={[0, KIOSK_RY, 0]}>
            <IB s={[1.5, 0.08, 1.15]} mat={kWhite} at={[0, 0.04, 0]} cast />
            <group position={[0, 0.6, -0.12]} rotation={[0.42, 0, 0]}>
                <IB s={[1, 1.05, 0.2]} mat={kWhite} cast />
            </group>
            <group position={[0, 1.48, -0.12]} rotation={[-0.42, 0, 0]}>
                <IB s={[1, 1.05, 0.2]} mat={kWhite} cast />
            </group>
            <group position={KIOSK_HEAD_AT} rotation={[-TILT, 0, 0]}>
                <IB s={[SCR_W + 0.05, SCR_H + 0.05, 0.09]} mat={kWhite} cast />
                <mesh position={[0, 0, 0.05]}>
                    <planeGeometry args={[SCR_W, SCR_H]} />
                    <meshStandardMaterial color={L.screen} roughness={0.4} metalness={0.1} emissive={L.screenGlow} emissiveIntensity={0.6} />
                </mesh>
            </group>
        </group>
    )
}

const DOWNLIGHTS: [number, number][] = [[-16.5, 8], [-16.5, 1], [-16.5, -6], [16.5, 8], [16.5, 1], [16.5, -6], [-7, -7.5], [7, -7.5]]
// Ít đèn điểm để shader không phình (mỗi đèn nhân chi phí biên dịch của mọi vật liệu)
const LOBBY_LIGHTS: Vec3[] = [[-9, 6, 2], [9, 6, 2]]
const PLANT_LEAVES = Array.from({ length: 9 }, (_, i) => [Math.cos(i * 0.7) * 0.8, 1.25 + (i % 3) * 0.2, 3 + Math.sin(i * 0.7) * 0.8, i % 2] as const)

/** Sảnh A2 (rộng 20 × sâu 11 sau khi thu nhỏ): sáng dần từ lúc máy còn đứng ngoài nhìn qua kính. */
export function A2Lobby({ stage }: { stage: React.MutableRefObject<number> }) {
    const lights = useRef<(THREE.PointLight | null)[]>([])
    const floorMat = useMemo(() => {
        const cv = document.createElement('canvas')
        cv.width = cv.height = 1024
        drawFloor(cv.getContext('2d')!, 1024, 1024)
        const t = new THREE.CanvasTexture(cv)
        t.colorSpace = THREE.SRGBColorSpace
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(4, 2.2)
        t.anisotropy = 4
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.02 })
    }, [])
    useEffect(() => () => {
        floorMat.map?.dispose()
        floorMat.dispose()
    }, [floorMat])

    useFrame(() => {
        const k = lerp(7.5, 22, band(stage.current, 1.1, 1.43)) * (1 - band(stage.current, 2.2, 2.6) * 0.5)
        for (const l of lights.current) if (l) l.intensity = k
    })

    return (
        <group position={LOBBY_AT} scale={LOBBY_SCALE}>
            {/* Vỏ sảnh */}
            <IB s={[40, 0.2, 22]} mat={floorMat} at={[0, FY - 0.1, 1]} cast={false} recv />
            <IB s={[40, 0.3, 22]} c={L.ceiling} o={{ flat: false }} at={[0, 8.15, 1]} />
            <IB s={[0.3, 8, 22]} mat={white} at={[-20, 4, 1]} />
            <IB s={[0.3, 8, 22]} mat={white} at={[20, 4, 1]} />
            <IB s={[14, 8, 0.3]} mat={white} at={[-13, 4, 12]} />
            <IB s={[14, 8, 0.3]} mat={white} at={[13, 4, 12]} />
            <IB s={[17.8, 4.2, 0.3]} mat={granite} at={[-11.1, 2.1, -10]} />
            <IB s={[17.8, 4.2, 0.3]} mat={granite} at={[11.1, 2.1, -10]} />
            <IB s={[40, 3.8, 0.3]} mat={white} at={[0, 6.1, -10]} />
            <IB s={[4.4, 0.4, 0.3]} mat={white} at={[0, 4, -10]} />
            {/* Hành lang ngắn sau lối đi giữa nối vào phòng thực hành */}
            <IB s={[4.4, 0.2, 3]} mat={floorMat} at={[0, FY - 0.1, -11.5]} />
            <IB s={[0.3, 4, 3]} mat={white} at={[-2.2, 2, -11.5]} />
            <IB s={[0.3, 4, 3]} mat={white} at={[2.2, 2, -11.5]} />
            <IB s={[4.4, 0.2, 3]} mat={white} at={[0, 4, -11.5]} />
            <DrawPlane w={3.6} h={0.64} cw={1024} ch={180} draw={drawRoomSign} at={[0, 3.55, -9.84]} />

            {/* Sàn lửng hai bên và phía sau, lan can kính */}
            <IB s={[7, 0.6, 22]} mat={slab} at={[-16.5, 4.3, 1]} />
            <IB s={[7, 0.6, 22]} mat={slab} at={[16.5, 4.3, 1]} />
            <IB s={[26, 0.6, 5]} mat={slab} at={[0, 4.3, -7.5]} />
            <IB s={[0.06, 1.1, 17]} mat={railGlass} at={[-13, 5.15, 3.5]} />
            <IB s={[0.06, 1.1, 17]} mat={railGlass} at={[13, 5.15, 3.5]} />
            <IB s={[26, 1.1, 0.06]} mat={railGlass} at={[0, 5.15, -5]} />
            <IB s={[0.06, 0.06, 17]} c={L.railBar} at={[-13, 5.7, 3.5]} />
            <IB s={[0.06, 0.06, 17]} c={L.railBar} at={[13, 5.7, 3.5]} />
            <IB s={[26, 0.06, 0.06]} c={L.railBar} at={[0, 5.7, -5]} />
            {DOWNLIGHTS.map(([x, z]) => (
                <mesh key={`${x}_${z}`} position={[x, 3.98, z]}>
                    <cylinderGeometry args={[1.3, 1.3, 0.04, 36]} />
                    <meshBasicMaterial color={L.light} />
                </mesh>
            ))}
            <DrawPlane w={12} h={0.94} cw={2048} ch={160} draw={drawBanner} at={[0, 4.3, -4.98]} />
            <DrawPlane w={10} h={1.1} cw={1024} ch={256} draw={drawTech} at={[12.95, 5.15, 3]} rotY={-Math.PI / 2} />
            <Led r={4} at={[0, 7.9, 3]} />
            <Led r={2} at={[0, 7.9, 3]} />
            <Led r={1.4} at={[-4, 7.9, 8]} />
            <Led r={1.4} at={[4, 7.9, 8]} />
            <mesh position={[0, 6.4, 3]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.1, 0.05, 8, 48]} />
                <meshStandardMaterial color={L.gold} metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Mọi thứ dưới đây nằm trên sàn sảnh */}
            <group position={[0, FY, 0]}>
                {[9, 2, -5].map((z) => (
                    <group key={z}>
                        <TreeColumn x={-13} z={z} face={Math.PI / 2} />
                        <TreeColumn x={13} z={z} face={Math.PI / 2} />
                    </group>
                ))}
                <TreeColumn x={-6} z={-5} face={0} />
                <TreeColumn x={6} z={-5} face={0} />

                {/* Tường đặc trưng dưới sàn lửng, đối xứng trái/phải */}
                <DrawPlane w={5.4} h={3.4} cw={1024} ch={640} draw={drawLove} at={[-19.8, 1.75, -2]} rotY={Math.PI / 2} />
                <IB s={[0.2, 3.6, 5.8]} mat={wood} at={[-19.88, 1.8, -2]} />
                <group position={[19.8, 0, -2]} rotation={[0, -Math.PI / 2, 0]}>
                    <IB s={[4.4, 2.4, 0.2]} mat={wood} at={[0, 1.2, 0]} />
                    <mesh position={[0, 2.4, 0.12]} material={stdMat(L.houseRoof, { side: THREE.DoubleSide })}>
                        <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-2.3, 0), new THREE.Vector2(2.3, 0), new THREE.Vector2(0, 1.4)])]} />
                    </mesh>
                </group>

                {/* Nội thất đối xứng, căn theo lưới sàn */}
                {[-1, 1].map((sd) => (
                    <group key={sd}>
                        <Bench x={sd * 16.5} z={5} ry={(sd * Math.PI) / 2} />
                        <Cylinder r={0.48} h={0.55} c={L.ottoman} at={[sd * 16.5, 0.28, 2.6]} seg={20} o={{ flat: false }} />
                        <Cylinder r={0.5} h={0.04} c={L.tableTop} at={[sd * 15, 0.62, 7.2]} seg={24} o={{ flat: false }} />
                        <Cylinder r={0.4} h={0.6} c={L.tableLeg} at={[sd * 15, 0.3, 7.2]} seg={12} />
                        <Bench x={sd * 9} z={9.4} ry={0} />
                        <Cylinder r={0.48} h={0.55} c={L.ottoman} at={[sd * 11.4, 0.28, 9.4]} seg={20} o={{ flat: false }} />
                        <Cylinder r={0.48} h={0.55} c={L.ottoman} at={[sd * 6.6, 0.28, 9.4]} seg={20} o={{ flat: false }} />
                    </group>
                ))}

                {/* Bồn cây tròn ở giữa */}
                <mesh position={[0, 0.25, 3]} material={stdMat(L.wood, { flat: false, roughness: 0.55, side: THREE.DoubleSide })}>
                    <cylinderGeometry args={[2.2, 2.2, 0.45, 40, 1, true]} />
                </mesh>
                <Cylinder r={2.2} h={0.04} c={L.wood} at={[0, 0.47, 3]} seg={40} o={{ flat: false, roughness: 0.55 }} />
                <Cylinder r={1.3} h={0.6} c={L.wood} at={[0, 0.5, 3]} seg={32} o={{ flat: false, roughness: 0.55 }} />
                {PLANT_LEAVES.map(([x, y, z, k], i) => (
                    <mesh key={i} position={[x, y, z]} material={stdMat(k ? L.plantA : L.plantB)}>
                        <icosahedronGeometry args={[0.42, 0]} />
                    </mesh>
                ))}
                {[-4.5, 4.5].map((x) => (
                    <group key={x}>
                        <IB s={[3, 0.8, 0.9]} mat={wood} at={[x, 0.4, 11.2]} />
                        {[0, 1, 2, 3, 4].map((i) => (
                            <mesh key={i} position={[x - 1.2 + i * 0.6, 1, 11.2]} material={stdMat(L.plantC)}>
                                <icosahedronGeometry args={[0.35, 0]} />
                            </mesh>
                        ))}
                    </group>
                ))}
                <Kiosk />
            </group>

            <PracticeRoom stage={stage} floorY={FY} worldScale={LOBBY_SCALE} />

            {LOBBY_LIGHTS.map(([x, y, z], i) => (
                <pointLight key={i} ref={(l) => void (lights.current[i] = l)} position={[x, y, z]} color={L.point} intensity={7.5} distance={22} decay={1.2} />
            ))}
        </group>
    )
}

// ─── Hội trường A2: bên trái A2, cỡ nửa A2, mái đỏ, biển đỏ ────────────────

export function HallA2() {
    return (
        <>
            <Box edges s={[4.6, 7, 4.6]} c={CAMPUS.hallWall} />
            <FlatRoof w={5} d={5} at={[0, 7, 0]} led />
            <CB s={[4, 3.6, 0.1]} c={A.glassM} at={[0, 3, 2.32]} o={{ roughness: 0.2, metalness: 0.35 }} />
            <CB s={[2, 2.4, 0.12]} c={A.hallDoor} at={[0, 1.2, 2.33]} />
            <TextPlane w={3.4} h={0.64} text="HỘI TRƯỜNG A2" at={[0, 5.8, 2.4]} opts={T_HALL} />
        </>
    )
}
