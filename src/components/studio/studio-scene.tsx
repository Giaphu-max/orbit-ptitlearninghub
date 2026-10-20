import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, FogExp2, MathUtils, Vector3, type PointLight, type SpotLight } from 'three'
import { STUDIO } from '@/components/home/campus-palette'
import { createMaterials, tintMaterials, StudioPlinth, PropBlue, PropColumn, PropGreen, PropYellow, STUDIO_PROP_AT, StudioFigure, StudioWalls, type Materials } from '@/components/studio/studio-set'
import { wrap180, type CameraSetup } from '@/lib/studio-setup'

// Cảnh studio của Virtual Director: phông, chủ thể, vài vật thể gây nhiễu và 3 đèn.
// Máy ảnh điều khiển bằng thông số nhiếp ảnh (tiêu cự, góc xoay, độ cao, khoảng cách, dịch khung).

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
function Environment({ setup, snapRef, mats }: { setup: CameraSetup; snapRef: MutableRefObject<(() => void) | null>; mats: Materials }) {
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
        tintMaterials(mats, c.background)
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
        // Sau khi rời trang, cảnh đã được dọn (background = null) nhưng một khung hình cuối vẫn có thể chạy
        ;(scene.background as Color | null)?.copy(c.background)
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

function Subject({ mats }: { mats: Materials }) {
    const P = STUDIO_PROP_AT
    return (
        <group>
            <StudioPlinth mats={mats} />
            <StudioFigure mats={mats} />
            {/* Vật thể xung quanh để sinh viên cân nhắc bố cục */}
            <group position={P.blue}><PropBlue mats={mats} /></group>
            <group position={P.yellow}><PropYellow mats={mats} /></group>
            <group position={P.green}><PropGreen mats={mats} /></group>
            <group position={P.column}><PropColumn mats={mats} /></group>
        </group>
    )
}

function Set({ mats }: { mats: Materials }) {
    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[14, 64]} />
                <primitive object={mats.floor} attach="material" />
            </mesh>
            <StudioWalls mats={mats} />
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
            // Thu nhỏ về cạnh dài 960px, JPEG 0.7: ảnh ~100–200 KB để kho 24 ảnh không phình bộ nhớ
            const k = Math.min(1, 960 / Math.max(src.width, src.height))
            const out = document.createElement('canvas')
            out.width = Math.round(src.width * k)
            out.height = Math.round(src.height * k)
            out.getContext('2d')?.drawImage(src, 0, 0, out.width, out.height)
            const dataUrl = out.toDataURL('image/jpeg', 0.7)
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
    const mats = useMemo(() => createMaterials(), [])
    return (
        <Canvas shadows dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ position: [0, 2, 6], fov: 27 }} aria-label="Studio 3D">
            <Rig setup={setup} />
            <Environment setup={setup} snapRef={snapRef} mats={mats} />
            <Set mats={mats} />
            <Subject mats={mats} />
            <CaptureBridge onReady={onReady} snapRef={snapRef} />
        </Canvas>
    )
}
