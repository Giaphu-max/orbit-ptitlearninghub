import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, FogExp2, MathUtils, MeshStandardMaterial, Vector3, type PointLight, type SpotLight } from 'three'
import { STUDIO } from '@/components/home/campus-palette'
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

/** Vật liệu của cảnh, tạo riêng cho từng canvas; màu gốc được pha theo môi trường (cảnh đêm thì sàn và vật thể tối đi). */
type MaterialKey = 'floor' | 'wall' | 'plinth' | 'skin' | 'hair' | 'suit' | 'scarf' | 'propBlue' | 'propYellow' | 'propGreen' | 'column'

const BASE_COLORS: Record<MaterialKey, { color: string; roughness: number; floor?: boolean; flat?: boolean }> = {
    floor: { color: STUDIO.floor, roughness: 0.9, floor: true },
    wall: { color: STUDIO.backdrop, roughness: 1 },
    plinth: { color: STUDIO.plinth, roughness: 0.6 },
    skin: { color: STUDIO.skin, roughness: 0.55, flat: true },
    hair: { color: STUDIO.hair, roughness: 0.8, flat: true },
    suit: { color: STUDIO.suit, roughness: 0.7, flat: true },
    scarf: { color: STUDIO.scarf, roughness: 0.8, flat: true },
    propBlue: { color: STUDIO.propBlue, roughness: 0.5 },
    propYellow: { color: STUDIO.propYellow, roughness: 0.4 },
    propGreen: { color: STUDIO.propGreen, roughness: 0.6 },
    column: { color: STUDIO.column, roughness: 0.8 },
}

type Materials = Record<MaterialKey, MeshStandardMaterial>

function createMaterials(): Materials {
    const out = {} as Materials
    for (const key of Object.keys(BASE_COLORS) as MaterialKey[]) {
        out[key] = new MeshStandardMaterial({ color: BASE_COLORS[key].color, roughness: BASE_COLORS[key].roughness, flatShading: BASE_COLORS[key].flat })
    }
    return out
}

const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
const DEFAULT_LUMINANCE = luminance(new Color(STUDIO.backdrop))

/** Pha màu vật thể theo màu nền: nền càng tối (cảnh đêm) thì sàn và vật thể càng tối, hơi ngả về màu nền. */
function tintMaterials(mats: Materials, background: Color) {
    const tone = MathUtils.clamp(luminance(background) / DEFAULT_LUMINANCE, 0, 1)
    for (const key of Object.keys(BASE_COLORS) as MaterialKey[]) {
        const base = BASE_COLORS[key]
        if (key === 'wall') {
            mats.wall.color.copy(background)
            continue
        }
        const gain = base.floor ? 0.15 + 0.85 * tone : 0.5 + 0.5 * tone
        mats[key].color.set(base.color).multiplyScalar(gain).lerp(background, base.floor ? 0.3 : 0.12)
    }
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
    return (
        <group>
            <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
                <cylinderGeometry args={[0.7, 0.8, 0.12, 40]} />
                <primitive object={mats.plinth} attach="material" />
            </mesh>
            {/* Nhân vật low-poly: thân, vai, tay, cổ, đầu (mặt hướng +z, về phía máy ảnh), tóc, khăn đỏ */}
            <group>
                <mesh position={[0, 0.57, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.28, 0.32, 0.9, 8]} />
                    <primitive object={mats.suit} attach="material" />
                </mesh>
                <mesh position={[0, 1.28, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.4, 0.28, 0.58, 8]} />
                    <primitive object={mats.suit} attach="material" />
                </mesh>
                <mesh position={[0, 1.57, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                    <capsuleGeometry args={[0.13, 0.74, 3, 8]} />
                    <primitive object={mats.suit} attach="material" />
                </mesh>
                {[-1, 1].map((side) => (
                    <mesh key={side} position={[side * 0.53, 1.12, 0]} rotation={[0, 0, side * 0.08]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.09, 0.075, 0.8, 6]} />
                        <primitive object={mats.suit} attach="material" />
                    </mesh>
                ))}
                <mesh position={[0, 1.72, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.085, 0.1, 0.2, 8]} />
                    <primitive object={mats.skin} attach="material" />
                </mesh>
                <mesh position={[0, 1.68, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <torusGeometry args={[0.17, 0.06, 6, 12]} />
                    <primitive object={mats.scarf} attach="material" />
                </mesh>
                <mesh position={[0, 1.94, 0]} castShadow receiveShadow>
                    <icosahedronGeometry args={[0.24, 1]} />
                    <primitive object={mats.skin} attach="material" />
                </mesh>
                <mesh position={[0, 1.97, -0.03]} rotation={[-0.25, 0, 0]} castShadow>
                    <sphereGeometry args={[0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <primitive object={mats.hair} attach="material" />
                </mesh>
                {[-1, 1].map((side) => (
                    <mesh key={side} position={[side * 0.085, 1.95, 0.215]}>
                        <sphereGeometry args={[0.027, 6, 6]} />
                        <primitive object={mats.hair} attach="material" />
                    </mesh>
                ))}
                <mesh position={[0, 1.9, 0.235]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <coneGeometry args={[0.035, 0.07, 4]} />
                    <primitive object={mats.skin} attach="material" />
                </mesh>
            </group>
            {/* Vật thể xung quanh để sinh viên cân nhắc bố cục */}
            <mesh position={[-1.7, 0.4, -0.6]} castShadow receiveShadow>
                <boxGeometry args={[0.8, 0.8, 0.8]} />
                <primitive object={mats.propBlue} attach="material" />
            </mesh>
            <mesh position={[1.5, 0.35, 0.2]} castShadow receiveShadow>
                <sphereGeometry args={[0.35, 32, 32]} />
                <primitive object={mats.propYellow} attach="material" />
            </mesh>
            <mesh position={[2.3, 0.9, -1.4]} castShadow receiveShadow>
                <cylinderGeometry args={[0.28, 0.28, 1.8, 32]} />
                <primitive object={mats.propGreen} attach="material" />
            </mesh>
            <mesh position={[-2.8, 1.2, -2.4]} castShadow receiveShadow>
                <cylinderGeometry args={[0.35, 0.35, 2.4, 32]} />
                <primitive object={mats.column} attach="material" />
            </mesh>
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
            {/* Phông cong sau lưng chủ thể */}
            <mesh position={[0, 3.5, -4.5]} receiveShadow material={mats.wall}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[0, 3.5, 4.5]} rotation={[0, Math.PI, 0]} material={mats.wall}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[-6, 3.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={mats.wall}>
                <planeGeometry args={[18, 8]} />
            </mesh>
            <mesh position={[6, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={mats.wall}>
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
