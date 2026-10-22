import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMPUS } from './campus-palette'

// Khối cơ bản dùng chung cho các tòa trong khuôn viên (campus-scene, campus-a2).

export type Vec3 = [number, number, number]
export interface MatOpts {
    roughness?: number
    metalness?: number
    /** false = bóng mượt (mặc định low-poly: flat shading) */
    flat?: boolean
    /** Có giá trị = vật liệu trong suốt (không ghi độ sâu) */
    opacity?: number
    emissive?: string
    emissiveIntensity?: number
    side?: THREE.Side
}

// Vật liệu dùng chung theo (màu, thông số) để hàng trăm khối không tạo hàng trăm vật liệu
const matCache = new Map<string, THREE.MeshStandardMaterial>()
export function stdMat(color: string, o: MatOpts = {}) {
    const key = color + JSON.stringify(o)
    let m = matCache.get(key)
    if (!m) {
        const { flat = true, opacity, ...rest } = o
        const params = { color, flatShading: flat, roughness: 0.9, metalness: 0, ...rest, ...(opacity === undefined ? {} : { transparent: true, opacity, depthWrite: false }) }
        // Three cảnh báo khi tham số có giá trị undefined: bỏ các khóa đó
        m = new THREE.MeshStandardMaterial(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)))
        matCache.set(key, m)
    }
    return m
}

export interface BoxProps {
    s: Vec3
    c?: string
    at?: Vec3
    o?: MatOpts
    /** true: `at` là tâm khối (mặc định `at` là tâm đáy) */
    mid?: boolean
    mat?: THREE.Material
    cast?: boolean
    recv?: boolean
}

/** Hộp: mặc định `at` là tâm đáy (y là mặt dưới), như hàm box() của bản gốc. */
export function Box({ s, c = '#fff', at = [0, 0, 0], o, mid, mat, cast = true, recv = true }: BoxProps) {
    return (
        <mesh position={[at[0], mid ? at[1] : at[1] + s[1] / 2, at[2]]} material={mat ?? stdMat(c, o)} castShadow={cast} receiveShadow={recv}>
            <boxGeometry args={s} />
        </mesh>
    )
}

export function Cylinder({ r, h, c, at, seg = 10, o }: { r: number; h: number; c: string; at: Vec3; seg?: number; o?: MatOpts }) {
    return (
        <mesh position={at} material={stdMat(c, o)} castShadow receiveShadow>
            <cylinderGeometry args={[r, r, h, seg]} />
        </mesh>
    )
}

/** Mái chóp 4 mặt. */
export function HipRoof({ w, h, d, c, at }: { w: number; h: number; d: number; c: string; at: Vec3 }) {
    const geo = useMemo(() => {
        const g = new THREE.ConeGeometry(1, 1, 4)
        g.rotateY(Math.PI / 4)
        g.scale(w / Math.SQRT2, h, d / Math.SQRT2)
        return g
    }, [w, h, d])
    return <mesh geometry={geo} position={[at[0], at[1] + h / 2, at[2]]} material={stdMat(c)} castShadow receiveShadow />
}

/** Mái hai mái / đầu hồi tam giác, đùn dọc theo trục Z (hoặc X khi alongZ = false). */
export function Gable({ len, h, depth, c, at, alongZ = false }: { len: number; h: number; depth: number; c: string; at: Vec3; alongZ?: boolean }) {
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

// ─── Chữ và họa tiết vẽ lên canvas làm texture ─────────────────────────────

export interface TextOpts {
    /** Chiều cao canvas ảo mà `size` được tính theo (mặc định 256); canvas thật luôn theo đúng tỉ lệ mặt phẳng */
    h?: number
    fg?: string
    size?: number | number[]
    weight?: number
    /** Nền tô trước khi viết chữ (mặc định trong suốt) */
    bg?: string
}

const TEXT_FILL = 0.88 // dòng chữ chỉ được chiếm tối đa 88% bề ngang

/** Canvas đúng tỉ lệ mặt phẳng pw:ph (cạnh dài `long` px). Mỗi dòng tự thu nhỏ cho vừa bề ngang; cả khối căn giữa cả hai chiều. */
function makeTextTexture(text: string, { h = 256, fg = CAMPUS.ptitRed, size = 150, weight = 800, bg }: TextOpts, pw: number, ph: number, long = 2048, glowColor?: string) {
    const k = long / Math.max(pw, ph)
    const cw = Math.round(pw * k)
    const ch = Math.round(ph * k)
    const cv = document.createElement('canvas')
    cv.width = cw
    cv.height = ch
    const ctx = cv.getContext('2d')!
    if (bg) {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, cw, ch)
    }
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = text.split('\n')
    const scale = ch / h
    const font = (px: number) => `${weight} ${px}px "Be Vietnam Pro", Arial, sans-serif`
    // Đo từng dòng, thu nhỏ riêng dòng quá rộng; giữ tỉ lệ khoảng cách giữa các dòng
    const sizes = lines.map((ln, i) => {
        let sz = (Array.isArray(size) ? size[i] : size) * scale
        ctx.font = font(sz)
        const mw = ctx.measureText(ln).width
        if (mw > cw * TEXT_FILL) sz *= (cw * TEXT_FILL) / mw
        return sz
    })
    const lh = sizes.map((sz) => sz * 1.15)
    const total = lh.reduce((a, b) => a + b, 0)
    // Khối chữ cao hơn 88% canvas thì thu nhỏ đồng loạt
    const f = total > ch * TEXT_FILL ? (ch * TEXT_FILL) / total : 1
    let y = ch / 2 - (total * f) / 2
    if (glowColor) {
        ctx.shadowColor = glowColor
        ctx.shadowBlur = ch * 0.06
    }
    lines.forEach((ln, i) => {
        ctx.font = font(sizes[i] * f)
        y += (lh[i] * f) / 2
        ctx.fillText(ln, cw / 2, y)
        if (glowColor) ctx.fillText(ln, cw / 2, y)
        y += (lh[i] * f) / 2
    })
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
}

/**
 * Mặt phẳng dán chữ. Chỉ dựng sau khi font đã tải (xem CampusScene) nên texture dùng đúng font.
 * Có `nightRef`: ban đêm chữ chuyển đỏ sáng như đèn LED, thêm quầng sáng cộng (`glow`), cùng nhịp với đèn cửa sổ.
 */
export function TextPlane({ w, h, text, at, opts, doubleSide, rotY = 0, nightRef, glow = true }: { w: number; h: number; text: string; at: Vec3; opts: TextOpts; doubleSide?: boolean; rotY?: number; nightRef?: React.MutableRefObject<number>; glow?: boolean }) {
    const tex = useMemo(() => makeTextTexture(text, opts, w, h), [text, opts, w, h])
    const litTex = useMemo(() => (nightRef ? makeTextTexture(text, { ...opts, fg: CAMPUS.ptitRedLit }, w, h) : null), [text, opts, w, h, nightRef])
    const glowTex = useMemo(() => (nightRef && glow ? makeTextTexture(text, { ...opts, fg: CAMPUS.ptitRedLit }, w, h, 1024, CAMPUS.ptitRedGlow) : null), [text, opts, w, h, nightRef, glow])
    useEffect(() => () => {
        tex.dispose()
        litTex?.dispose()
        glowTex?.dispose()
    }, [tex, litTex, glowTex])
    const litMat = useRef<THREE.MeshBasicMaterial>(null)
    const glowMat = useRef<THREE.MeshBasicMaterial>(null)
    useFrame(() => {
        if (!nightRef) return
        const n = nightRef.current
        if (litMat.current) {
            litMat.current.opacity = n
            litMat.current.visible = n > 0.01
        }
        if (glowMat.current) {
            glowMat.current.opacity = n
            glowMat.current.visible = n > 0.01
        }
    })
    const side = doubleSide ? THREE.DoubleSide : THREE.FrontSide
    return (
        <group position={at} rotation={[0, rotY, 0]}>
            <mesh>
                <planeGeometry args={[w, h]} />
                <meshBasicMaterial map={tex} transparent depthWrite={false} side={side} polygonOffset polygonOffsetFactor={-2} />
            </mesh>
            {litTex && (
                <mesh position={[0, 0, 0.006]}>
                    <planeGeometry args={[w, h]} />
                    <meshBasicMaterial ref={litMat} map={litTex} transparent opacity={0} depthWrite={false} toneMapped={false} side={side} polygonOffset polygonOffsetFactor={-3} />
                </mesh>
            )}
            {glowTex && (
                <mesh position={[0, 0, 0.012]}>
                    <planeGeometry args={[w, h]} />
                    <meshBasicMaterial ref={glowMat} map={glowTex} transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={side} polygonOffset polygonOffsetFactor={-4} />
                </mesh>
            )}
        </group>
    )
}

/** Mặt phẳng dán texture tự vẽ (`draw` phải là hàm hằng, định nghĩa ngoài component). */
export function DrawPlane({ w, h, cw, ch, draw, at, rotY = 0 }: { w: number; h: number; cw: number; ch: number; draw: (g: CanvasRenderingContext2D, w: number, h: number) => void; at: Vec3; rotY?: number }) {
    const tex = useMemo(() => {
        const cv = document.createElement('canvas')
        cv.width = cw
        cv.height = ch
        draw(cv.getContext('2d')!, cw, ch)
        const t = new THREE.CanvasTexture(cv)
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        return t
    }, [cw, ch, draw])
    useEffect(() => () => tex.dispose(), [tex])
    return (
        <mesh position={at} rotation={[0, rotY, 0]}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial map={tex} />
        </mesh>
    )
}
