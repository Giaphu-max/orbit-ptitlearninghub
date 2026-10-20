import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, FogExp2, MathUtils, MeshStandardMaterial, Vector3, type PointLight, type SpotLight } from 'three'
import { STUDIO } from '@/components/home/campus-palette'
import type { DirectorSetup } from '@/lib/api-types'
import { DEFAULT_ENVIRONMENT, type EnvironmentSpec } from '@/lib/environment'

// Cảnh studio của Virtual Director: phông, chủ thể, vài vật thể gây nhiễu và 3 đèn.
// Máy ảnh điều khiển bằng thông số nhiếp ảnh (tiêu cự, góc xoay, độ cao, khoảng cách, dịch khung).

/**
 * Phần "diện mạo" ánh sáng ngoài cường độ (thanh trượt): màu, độ cao, vị trí đèn phụ/đèn viền,
 * màu nền, sương. Prompt-to-Environment ghi vào đây; thanh trượt vẫn chỉnh được cường độ và góc đèn chính.
 */
export interface LightLook {
    keyColor: string
    keyElevationDeg: number
    fillColor: string
    /** Góc đèn phụ tính ở phía đối diện đèn chính (dương = đối diện, âm = cùng phía) */
    fillSideDeg: number
    fillElevationDeg: number
    rimColor: string
    /** Lệch của đèn viền so với đường thẳng sau chủ thể, tính theo phía của đèn chính */
    rimSideDeg: number
    rimElevationDeg: number
    background: string
    /** 0–1 */
    fogDensity: number
}

export interface CameraSetup extends DirectorSetup {
    /** Dịch khung theo tỉ lệ khung hình: dương = chủ thể dịch sang phải / lên trên */
    shiftX: number
    shiftY: number
    look: LightLook
}

const DEFAULT_LOOK: LightLook = {
    keyColor: DEFAULT_ENVIRONMENT.key.color,
    keyElevationDeg: DEFAULT_ENVIRONMENT.key.elevationDeg,
    fillColor: DEFAULT_ENVIRONMENT.fill.color,
    fillSideDeg: DEFAULT_ENVIRONMENT.fill.azimuthDeg,
    fillElevationDeg: DEFAULT_ENVIRONMENT.fill.elevationDeg,
    rimColor: DEFAULT_ENVIRONMENT.rim.color,
    rimSideDeg: 30,
    rimElevationDeg: DEFAULT_ENVIRONMENT.rim.elevationDeg,
    background: DEFAULT_ENVIRONMENT.background,
    fogDensity: DEFAULT_ENVIRONMENT.fogDensity,
}

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

/** Áp thông số AI vào setup: cường độ + góc đèn chính vào thanh trượt, phần còn lại vào look. Máy ảnh giữ nguyên. */
export function setupFromEnvironment(base: CameraSetup, env: EnvironmentSpec): CameraSetup {
    const side = Math.sign(env.key.azimuthDeg) || 1
    return {
        ...base,
        key: Math.round(env.key.intensity),
        fill: Math.round(env.fill.intensity),
        rim: Math.round(env.rim.intensity),
        keyAngleDeg: Math.round(env.key.azimuthDeg),
        look: {
            keyColor: env.key.color,
            keyElevationDeg: env.key.elevationDeg,
            fillColor: env.fill.color,
            fillSideDeg: -side * env.fill.azimuthDeg,
            fillElevationDeg: env.fill.elevationDeg,
            rimColor: env.rim.color,
            rimSideDeg: wrap180((env.rim.azimuthDeg - 180) * side),
            rimElevationDeg: env.rim.elevationDeg,
            background: env.background,
            fogDensity: env.fogDensity,
        },
    }
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
    look: DEFAULT_LOOK,
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
/** Sương: 0–1 → mật độ FogExp2 (0,12 ở mức dày nhất, cách máy 6 m còn khoảng 60% rõ nét) */
const FOG_MAX = 0.12
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Các giá trị mà cảnh nội suy mượt tới thông số mới. Góc là độ, màu là Color. */
interface EnvState {
    keyAz: number
    keyEl: number
    keyI: number
    fillAz: number
    fillEl: number
    fillI: number
    rimAz: number
    rimEl: number
    rimI: number
    keyColor: Color
    fillColor: Color
    rimColor: Color
    background: Color
    fog: number
}

function targetOf(setup: CameraSetup): EnvState {
    const side = Math.sign(setup.keyAngleDeg) || 1
    const l = setup.look
    return {
        keyAz: setup.azimuthDeg + setup.keyAngleDeg,
        keyEl: l.keyElevationDeg,
        keyI: intensity(setup.key, 140),
        fillAz: setup.azimuthDeg - side * l.fillSideDeg,
        fillEl: l.fillElevationDeg,
        fillI: intensity(setup.fill, 40),
        rimAz: setup.azimuthDeg + 180 + side * l.rimSideDeg,
        rimEl: l.rimElevationDeg,
        rimI: intensity(setup.rim, 160),
        keyColor: new Color(l.keyColor),
        fillColor: new Color(l.fillColor),
        rimColor: new Color(l.rimColor),
        background: new Color(l.background),
        fog: l.fogDensity,
    }
}

const NUMERIC = ['keyEl', 'keyI', 'fillEl', 'fillI', 'rimEl', 'rimI', 'fog'] as const
const ANGLES = ['keyAz', 'fillAz', 'rimAz'] as const
const COLORS = ['keyColor', 'fillColor', 'rimColor', 'background'] as const

function stepToward(cur: EnvState, target: EnvState, k: number) {
    for (const n of NUMERIC) cur[n] += (target[n] - cur[n]) * k
    // Góc đi theo đường ngắn nhất để đèn không quay vòng dài qua ±180°
    for (const a of ANGLES) cur[a] += wrap180(target[a] - cur[a]) * k
    for (const c of COLORS) cur[c].lerp(target[c], k)
}

/**
 * Ba đèn, màu phông và sương. Thông số mới được nội suy mượt (chuyển cảnh); tôn trọng prefers-reduced-motion.
 * snapRef cho phép chụp ảnh ngay đúng thông số đích mà không chờ chuyển xong.
 */
function Environment({ setup, snapRef }: { setup: CameraSetup; snapRef: MutableRefObject<(() => void) | null> }) {
    const scene = useThree((s) => s.scene)
    const keyRef = useRef<SpotLight>(null)
    const fillRef = useRef<PointLight>(null)
    const rimRef = useRef<SpotLight>(null)
    const target = useMemo(() => targetOf(setup), [setup])
    const targetRef = useRef(target)
    const cur = useRef<EnvState | null>(null)
    cur.current ??= targetOf(setup)
    const fog = useMemo(() => new FogExp2('#000000', 0), [])
    const reduced = useMemo(reducedMotion, [])

    const apply = () => {
        const c = cur.current!
        keyRef.current?.position.copy(polar(c.keyAz, c.keyEl, 6, TARGET))
        fillRef.current?.position.copy(polar(c.fillAz, c.fillEl, 6, TARGET))
        rimRef.current?.position.copy(polar(c.rimAz, c.rimEl, 5, TARGET))
        if (keyRef.current) {
            keyRef.current.intensity = c.keyI
            keyRef.current.color.copy(c.keyColor)
        }
        if (fillRef.current) {
            fillRef.current.intensity = c.fillI
            fillRef.current.color.copy(c.fillColor)
        }
        if (rimRef.current) {
            rimRef.current.intensity = c.rimI
            rimRef.current.color.copy(c.rimColor)
        }
        wallMaterial.color.copy(c.background)
        fog.color.copy(c.background)
        fog.density = c.fog * FOG_MAX
    }

    useEffect(() => {
        targetRef.current = target
    }, [target])

    useEffect(() => {
        scene.background = new Color(setup.look.background)
        scene.fog = fog
        snapRef.current = () => {
            stepToward(cur.current!, targetRef.current, 1)
            apply()
        }
        apply()
        return () => {
            snapRef.current = null
            scene.fog = null
            scene.background = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, fog])

    useFrame((_, delta) => {
        const c = cur.current!
        stepToward(c, targetRef.current, reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 4))
        apply()
        ;(scene.background as Color).copy(c.background)
    })

    return (
        <>
            <ambientLight intensity={0.12} color={STUDIO.ambient} />
            <spotLight ref={keyRef} angle={0.6} penumbra={0.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
            <pointLight ref={fillRef} />
            <spotLight ref={rimRef} angle={0.7} penumbra={0.5} />
        </>
    )
}

/** Vật liệu phông dùng chung cho 4 mặt tường, để đổi màu một chỗ khi AI chọn màu nền. */
const wallMaterial = new MeshStandardMaterial({ color: STUDIO.backdrop, roughness: 1 })

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
            <mesh position={[0, 3.5, -4.5]} receiveShadow material={wallMaterial}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[0, 3.5, 4.5]} rotation={[0, Math.PI, 0]} material={wallMaterial}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[-6, 3.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wallMaterial}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[6, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={wallMaterial}>
                <planeGeometry args={[18, 8]} />
            </mesh>
        </group>
    )
}

/** Chụp khung hình hiện tại thành JPEG (base64 không có tiền tố) và data URL để xem lại. */
export type CaptureFn = () => { dataUrl: string; base64: string }

function CaptureBridge({ onReady, snapRef }: { onReady: (fn: CaptureFn) => void; snapRef: MutableRefObject<(() => void) | null> }) {
    const { gl, scene, camera } = useThree()
    useEffect(() => {
        onReady(() => {
            // Chụp đúng thông số đích, không đợi chuyển cảnh xong
            snapRef.current?.()
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
    }, [gl, scene, camera, onReady, snapRef])
    return null
}

interface Props {
    setup: CameraSetup
    onReady: (fn: CaptureFn) => void
}

export default function StudioScene({ setup, onReady }: Props) {
    const snapRef = useRef<(() => void) | null>(null)
    return (
        <Canvas shadows dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ position: [0, 2, 6], fov: 27 }} aria-label="Studio 3D">
            <Rig setup={setup} />
            <Environment setup={setup} snapRef={snapRef} />
            <Set />
            <Subject />
            <CaptureBridge onReady={onReady} snapRef={snapRef} />
        </Canvas>
    )
}
