import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'
import { STUDIO } from '@/components/home/campus-palette'
import type { DirectorSetup } from '@/lib/api-types'

// Cảnh studio của Virtual Director: phông, chủ thể, vài vật thể gây nhiễu và 3 đèn.
// Máy ảnh điều khiển bằng thông số nhiếp ảnh (tiêu cự, góc xoay, độ cao, khoảng cách, dịch khung).

export interface CameraSetup extends DirectorSetup {
    /** Dịch khung theo tỉ lệ khung hình: dương = chủ thể dịch sang phải / lên trên */
    shiftX: number
    shiftY: number
}

export const DEFAULT_SETUP: CameraSetup = {
    focalLengthMm: 50,
    azimuthDeg: 0,
    elevationDeg: 8,
    distance: 6,
    key: 70,
    fill: 30,
    rim: 0,
    keyAngleDeg: -40,
    shiftX: 0,
    shiftY: 0,
}

const TARGET = new Vector3(0, 1.1, 0)
/** Phim full-frame 36×24 mm → góc nhìn dọc theo tiêu cự */
const verticalFov = (focalMm: number) => MathUtils.radToDeg(2 * Math.atan(24 / (2 * focalMm)))

function polar(azimuthDeg: number, elevationDeg: number, radius: number, center: Vector3) {
    const a = MathUtils.degToRad(azimuthDeg)
    const e = MathUtils.degToRad(elevationDeg)
    return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(radius).add(center)
}

function Rig({ setup }: { setup: CameraSetup }) {
    const camera = useThree((s) => s.camera)
    const aspect = useThree((s) => s.size.width / s.size.height)
    useEffect(() => {
        const cam = camera as import('three').PerspectiveCamera
        cam.fov = verticalFov(setup.focalLengthMm)
        cam.aspect = aspect
        cam.position.copy(polar(setup.azimuthDeg, setup.elevationDeg, setup.distance, TARGET))
        cam.lookAt(TARGET)
        cam.updateMatrixWorld()
        // Dịch khung: dời điểm ngắm ngược chiều để chủ thể dịch theo hướng đã chọn
        const frameH = 2 * setup.distance * Math.tan(MathUtils.degToRad(cam.fov) / 2)
        const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
        const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
        const target = TARGET.clone().addScaledVector(right, -setup.shiftX * frameH * aspect).addScaledVector(up, -setup.shiftY * frameH)
        cam.lookAt(target)
        cam.updateProjectionMatrix()
    }, [camera, aspect, setup.focalLengthMm, setup.azimuthDeg, setup.elevationDeg, setup.distance, setup.shiftX, setup.shiftY])
    return null
}

const intensity = (v: number, max: number) => (v / 100) * max

function Lights({ setup }: { setup: CameraSetup }) {
    const keyPos = polar(setup.azimuthDeg + setup.keyAngleDeg, 28, 6, TARGET)
    const fillPos = polar(setup.azimuthDeg - Math.sign(setup.keyAngleDeg || 1) * 40, 10, 6, TARGET)
    const rimPos = polar(setup.azimuthDeg + 180 + Math.sign(setup.keyAngleDeg || 1) * 30, 25, 5, TARGET)
    return (
        <>
            <ambientLight intensity={0.12} color={STUDIO.ambient} />
            <spotLight position={keyPos} angle={0.6} penumbra={0.6} intensity={intensity(setup.key, 140)} color={STUDIO.key} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
            <pointLight position={fillPos} intensity={intensity(setup.fill, 40)} color={STUDIO.fill} />
            <spotLight position={rimPos} angle={0.7} penumbra={0.5} intensity={intensity(setup.rim, 160)} color={STUDIO.rim} />
        </>
    )
}

function Subject() {
    return (
        <group>
            <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
                <cylinderGeometry args={[0.7, 0.8, 0.12, 40]} />
                <meshStandardMaterial color={STUDIO.plinth} roughness={0.6} />
            </mesh>
            {/* Nhân vật: thân, đầu, khăn đỏ */}
            <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
                <capsuleGeometry args={[0.28, 1.0, 8, 24]} />
                <meshStandardMaterial color={STUDIO.suit} roughness={0.7} />
            </mesh>
            <mesh position={[0, 1.78, 0]} castShadow receiveShadow>
                <sphereGeometry args={[0.24, 32, 32]} />
                <meshStandardMaterial color={STUDIO.skin} roughness={0.55} />
            </mesh>
            <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[0.27, 0.07, 16, 32]} />
                <meshStandardMaterial color={STUDIO.scarf} roughness={0.8} />
            </mesh>
            {/* Vật thể xung quanh để sinh viên cân nhắc bố cục */}
            <mesh position={[-1.7, 0.4, -0.6]} castShadow receiveShadow>
                <boxGeometry args={[0.8, 0.8, 0.8]} />
                <meshStandardMaterial color={STUDIO.propBlue} roughness={0.5} />
            </mesh>
            <mesh position={[1.5, 0.35, 0.2]} castShadow receiveShadow>
                <sphereGeometry args={[0.35, 32, 32]} />
                <meshStandardMaterial color={STUDIO.propYellow} roughness={0.4} />
            </mesh>
            <mesh position={[2.3, 0.9, -1.4]} castShadow receiveShadow>
                <cylinderGeometry args={[0.28, 0.28, 1.8, 32]} />
                <meshStandardMaterial color={STUDIO.propGreen} roughness={0.6} />
            </mesh>
            <mesh position={[-2.8, 1.2, -2.4]} castShadow receiveShadow>
                <cylinderGeometry args={[0.35, 0.35, 2.4, 32]} />
                <meshStandardMaterial color={STUDIO.column} roughness={0.8} />
            </mesh>
        </group>
    )
}

function Set() {
    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[14, 64]} />
                <meshStandardMaterial color={STUDIO.floor} roughness={0.9} />
            </mesh>
            {/* Phông cong sau lưng chủ thể */}
            <mesh position={[0, 3.5, -4.5]} receiveShadow>
                <planeGeometry args={[18, 8]} />
                <meshStandardMaterial color={STUDIO.backdrop} roughness={1} />
            </mesh>
            <mesh position={[0, 3.5, 4.5]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[18, 8]} />
                <meshStandardMaterial color={STUDIO.backdrop} roughness={1} />
            </mesh>
            <mesh position={[-6, 3.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[18, 8]} />
                <meshStandardMaterial color={STUDIO.backdrop} roughness={1} />
            </mesh>
            <mesh position={[6, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[18, 8]} />
                <meshStandardMaterial color={STUDIO.backdrop} roughness={1} />
            </mesh>
        </group>
    )
}

/** Chụp khung hình hiện tại thành JPEG (base64 không có tiền tố) và data URL để xem lại. */
export type CaptureFn = () => { dataUrl: string; base64: string }

function CaptureBridge({ onReady }: { onReady: (fn: CaptureFn) => void }) {
    const { gl, scene, camera } = useThree()
    useEffect(() => {
        onReady(() => {
            gl.render(scene, camera)
            const src = gl.domElement
            const width = Math.min(768, src.width)
            const out = document.createElement('canvas')
            out.width = width
            out.height = Math.round((src.height / src.width) * width)
            out.getContext('2d')?.drawImage(src, 0, 0, out.width, out.height)
            const dataUrl = out.toDataURL('image/jpeg', 0.82)
            return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
        })
    }, [gl, scene, camera, onReady])
    return null
}

interface Props {
    setup: CameraSetup
    onReady: (fn: CaptureFn) => void
}

export default function StudioScene({ setup, onReady }: Props) {
    return (
        <Canvas shadows dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ position: [0, 2, 6], fov: 27 }} aria-label="Studio 3D">
            <Rig setup={setup} />
            <Lights setup={setup} />
            <Set />
            <Subject />
            <CaptureBridge onReady={onReady} />
        </Canvas>
    )
}
