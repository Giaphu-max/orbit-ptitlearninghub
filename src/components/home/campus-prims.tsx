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
    /** Viền nét kiểu minh họa (#9AA0B4, ~45%): chỉ cho khối lớn của tòa nhà, không cho cây và chi tiết nhỏ */
    edges?: boolean
}

// Viền nét: một EdgesGeometry (ngưỡng 20°) cho mỗi kích thước hộp và một vật liệu dùng chung
const edgeMat = new THREE.LineBasicMaterial({ color: CAMPUS.edge, transparent: true, opacity: 0.45 })
const edgeCache = new Map<string, THREE.EdgesGeometry>()
function edgeGeo(s: Vec3) {
    const key = s.join('_')
    let g = edgeCache.get(key)
    if (!g) {
        const b = new THREE.BoxGeometry(...s)
        g = new THREE.EdgesGeometry(b, 20)
        b.dispose()
        edgeCache.set(key, g)
    }
    return g
}

/** Hộp: mặc định `at` là tâm đáy (y là mặt dưới), như hàm box() của bản gốc. */
export function Box({ s, c = '#fff', at = [0, 0, 0], o, mid, mat, cast = true, recv = true, edges }: BoxProps) {
    return (
        <mesh position={[at[0], mid ? at[1] : at[1] + s[1] / 2, at[2]]} material={mat ?? stdMat(c, o)} castShadow={cast} receiveShadow={recv}>
            <boxGeometry args={s} />
            {edges && <lineSegments geometry={edgeGeo(s)} material={edgeMat} />}
        </mesh>
    )
}

// Tấm bóng mờ bake sẵn dưới chân tòa nhà (gradient tròn #0A1A50, không tốn render động) để tòa bám đất
let blobTex: THREE.CanvasTexture | null = null
function getBlobTex() {
    if (!blobTex) {
        const cv = document.createElement('canvas')
        cv.width = cv.height = 128
        const ctx = cv.getContext('2d')!
        const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62)
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(0.55, 'rgba(255,255,255,0.55)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 128, 128)
        blobTex = new THREE.CanvasTexture(cv)
    }
    return blobTex
}
const blobMat = new THREE.MeshBasicMaterial({ color: CAMPUS.shadowInk, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
/** Bóng tiếp đất [rộng, sâu, lệch x, lệch z] dưới chân tòa (hệ tọa độ của tòa) */
export function GroundBlob({ foot, y = 0.1, opacity }: { foot: [number, number, number?, number?]; y?: number; opacity?: number }) {
    const mat = useMemo(() => {
        blobMat.map = getBlobTex()
        if (opacity === undefined) return blobMat
        const m = blobMat.clone()
        m.opacity = opacity
        return m
    }, [opacity])
    return (
        <mesh position={[foot[2] ?? 0, y, foot[3] ?? 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={1}>
            <planeGeometry args={[foot[0], foot[1]]} />
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

const GLOW_SCALE = 1.2 // mặt phẳng quầng lớn hơn chữ 20%
const TEXT_FILL = 0.88 // dòng chữ chỉ được chiếm tối đa 88% bề ngang

/** Canvas đúng tỉ lệ mặt phẳng pw:ph (cạnh dài `long` px). Mỗi dòng tự thu nhỏ cho vừa bề ngang; cả khối căn giữa cả hai chiều. */
interface TextFx {
    /** Viền vẽ trước lõi chữ (kiểu LED: viền đỏ, lõi sáng) */
    stroke?: string
    /** Quầng: một lượt vẽ cho mỗi độ blur (tỉ lệ theo cỡ chữ) */
    glow?: { color: string; blurs: number[] }
    /** Chữ chiếm 1/textScale canvas (canvas to hơn mặt chữ để quầng không bị cắt) */
    textScale?: number
}

function makeTextTexture(text: string, { h = 256, fg = CAMPUS.ptitRed, size = 150, weight = 800, bg }: TextOpts, pw: number, ph: number, long = 2048, fx: TextFx = {}) {
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
    const ts = fx.textScale ?? 1
    const scale = ch / h / ts
    const font = (px: number) => `${weight} ${px}px "Be Vietnam Pro", Arial, sans-serif`
    // Đo từng dòng, thu nhỏ riêng dòng quá rộng; giữ tỉ lệ khoảng cách giữa các dòng
    const sizes = lines.map((ln, i) => {
        let sz = (Array.isArray(size) ? size[i] : size) * scale
        ctx.font = font(sz)
        const mw = ctx.measureText(ln).width
        if (mw > (cw / ts) * TEXT_FILL) sz *= ((cw / ts) * TEXT_FILL) / mw
        return sz
    })
    const lh = sizes.map((sz) => sz * 1.15)
    const total = lh.reduce((a, b) => a + b, 0)
    // Khối chữ cao hơn 88% canvas thì thu nhỏ đồng loạt
    const f = total > (ch / ts) * TEXT_FILL ? ((ch / ts) * TEXT_FILL) / total : 1
    const draw = (fill: boolean) => {
        let yy = ch / 2 - (total * f) / 2
        lines.forEach((ln, i) => {
            ctx.font = font(sizes[i] * f)
            yy += (lh[i] * f) / 2
            if (fill) ctx.fillText(ln, cw / 2, yy)
            else ctx.strokeText(ln, cw / 2, yy)
            yy += (lh[i] * f) / 2
        })
    }
    if (fx.glow) {
        ctx.fillStyle = fx.glow.color
        ctx.shadowColor = fx.glow.color
        for (const bl of fx.glow.blurs) {
            ctx.shadowBlur = sizes[0] * f * bl
            draw(true)
        }
        ctx.shadowBlur = 0
        ctx.fillStyle = fg
        ctx.shadowColor = 'transparent'
    }
    if (fx.stroke) {
        ctx.strokeStyle = fx.stroke
        ctx.lineJoin = 'round'
        ctx.lineWidth = sizes[0] * f * 0.1
        draw(false)
    }
    draw(true)
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
    const litTex = useMemo(() => (nightRef ? makeTextTexture(text, { ...opts, fg: CAMPUS.ptitLedCore }, w, h, 2048, { stroke: CAMPUS.ptitLedEdge }) : null), [text, opts, w, h, nightRef])
    const glowTex = useMemo(() => (nightRef && glow ? makeTextTexture(text, { ...opts, fg: CAMPUS.ptitLedCore }, w, h, 1024, { glow: { color: CAMPUS.ptitRedGlow, blurs: [0.25, 0.08] }, textScale: GLOW_SCALE }) : null), [text, opts, w, h, nightRef, glow])
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
                    <planeGeometry args={[w * GLOW_SCALE, h * GLOW_SCALE]} />
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

// ─── Nền sân: CanvasTexture vẽ một lần (không dùng ảnh ngoài), lặp, mipmap + anisotropy 4 ──────────

function makeTileTexture(draw: (ctx: CanvasRenderingContext2D, n: number) => void, repeat: [number, number]) {
    const N = 512
    const cv = document.createElement('canvas')
    cv.width = cv.height = N
    draw(cv.getContext('2d')!, N)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
    t.anisotropy = 4
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    return t
}
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

/**
 * Sân bê tông xám sáng #C4C8CF: nhiễu hạt ±4% độ sáng, vài vết loang mờ lớn (#BBC0C8 / #CDD1D7), ron chia ô lớn #B2B7C0.
 * Một tile 512px = 12 đơn vị cảnh, 3 ô mỗi chiều (≈4 đơn vị/ô); các vết loang vẽ cả bản sao qua mép để lặp liền mạch.
 */
export function makeConcreteTexture(repeat: [number, number]) {
    return makeTileTexture((ctx, n) => {
        const rnd = rng(23)
        ctx.fillStyle = '#C4C8CF'
        ctx.fillRect(0, 0, n, n)
        for (let i = 0; i < 26; i++) {
            const x = rnd() * n
            const y = rnd() * n
            const r = 50 + rnd() * 90
            const col = rnd() < 0.5 ? '187,192,200' : '205,209,215'
            for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) {
                const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
                g.addColorStop(0, `rgba(${col},0.55)`)
                g.addColorStop(1, `rgba(${col},0)`)
                ctx.fillStyle = g
                ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
            }
        }
        // Hạt: cộng/trừ tới ±4% độ sáng
        const img = ctx.getImageData(0, 0, n, n)
        for (let i = 0; i < n * n; i++) {
            const d = (rnd() - 0.5) * 2 * 0.04 * 255
            img.data[i * 4] += d
            img.data[i * 4 + 1] += d
            img.data[i * 4 + 2] += d
        }
        ctx.putImageData(img, 0, 0)
        // Ron: đường mờ 2px ở 0, n/3, 2n/3 (đường ở 0 vẽ cả hai mép tile)
        ctx.fillStyle = 'rgba(178,183,192,0.75)'
        for (let k = 0; k < 3; k++) {
            const o = Math.round((k * n) / 3)
            ctx.fillRect(o - 1, 0, 2, n)
            ctx.fillRect(0, o - 1, n, 2)
            if (k === 0) {
                ctx.fillRect(n - 1, 0, 1, n)
                ctx.fillRect(0, n - 1, n, 1)
            }
        }
    }, repeat)
}

/** Mặt phẳng nằm ngang (sàn sân/lối đi) có texture, nhận bóng. `at` là tâm; y nâng nhẹ để không z-fight. */
export function GroundPlane({ s, at, tex }: { s: [number, number]; at: Vec3; tex: THREE.Texture }) {
    const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }), [tex])
    return (
        <mesh position={at} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow>
            <planeGeometry args={s} />
        </mesh>
    )
}
