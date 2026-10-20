import { useId, useMemo } from 'react'
import type { Course } from '@/data/types'
import { COVER_MOTIFS, deriveCover, type CoverAccent, type CoverMotif } from '@/lib/cover-kinds'
import { useOrbitStore } from '@/store/useOrbitStore'

// Bìa khóa học tự sinh: SVG inline 1280×560, không chữ, nền tối gradient + họa tiết trừu tượng.
// Mọi màu lấy từ token (--subject-* cho màu nhấn, --cover-* cho ánh sáng), pha bằng color-mix; vị trí/độ dài/góc do PRNG theo seed.
// Mẫu tham chiếu: docs/mockup/covers/*.svg

const W = 1280
const H = 560

function hash(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

function rng(seed: number) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
type Rand = () => number
const between = (r: Rand, a: number, b: number) => a + (b - a) * r()
const pick = <T,>(r: Rand, list: readonly T[]) => list[Math.floor(r() * list.length)]
const f1 = (n: number) => Math.round(n * 10) / 10

interface Palette {
    A: string
    /** accent pha với màu khác, pct = % accent */
    mix: (pct: number, other: string) => string
    ink: string
    white: string
    warm: string
    cool: string
    rim: string
}

function paletteOf(accent: CoverAccent): Palette {
    const A = `hsl(var(--subject-${accent}))`
    const ink = 'hsl(var(--ink))'
    const white = 'hsl(var(--ink-foreground))'
    return { A, mix: (pct, other) => `color-mix(in srgb, ${A} ${pct}%, ${other})`, ink, white, warm: 'hsl(var(--cover-warm))', cool: 'hsl(var(--cover-cool))', rim: 'hsl(var(--cover-rim))' }
}

interface Props {
    course: Pick<Course, 'id'> & { subject?: string; cover?: Course['cover'] }
    seed?: number
    motif?: CoverMotif
    accent?: CoverAccent
    className?: string
}

/** Bìa SVG co giãn theo khung (cover-fit). Thứ tự ưu tiên: props → course.cover → suy từ subject. */
export function CourseCover({ course, seed, motif, accent, className = '' }: Props) {
    const derived = deriveCover(course.subject ?? '')
    const m = motif ?? course.cover?.motif ?? derived.motif
    const a = accent ?? course.cover?.accent ?? derived.accent
    const s = seed ?? course.cover?.seed ?? 0
    // id gradient/filter duy nhất theo khóa (và theo lần dựng) để nhiều bìa trên một trang không đè nhau
    const uid = `cc-${course.id.replace(/[^a-z0-9]/gi, '')}-${useId().replace(/:/g, '')}`
    const art = useMemo(() => {
        const r = rng(hash(`${course.id}:${s}`))
        const p = paletteOf(a)
        switch (COVER_MOTIFS.includes(m) ? m : 'shapes') {
            case 'timeline':
                return timeline(uid, r, p)
            case 'light':
                return light(uid, r, p)
            case 'wave':
                return wave(uid, r, p)
            case 'grid':
                return grid(uid, r, p)
            default:
                return shapes(uid, r, p)
        }
    }, [course.id, s, a, m, uid])

    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden className={`block h-full w-full ${className}`}>
            {art}
        </svg>
    )
}

/** Bìa của khóa theo lựa chọn của giảng viên: ảnh tải lên ưu tiên hơn bìa tự sinh; đổi kiểu/họa tiết lưu trong store. */
export function CourseArt({ course, className = '' }: { course: Course; className?: string }) {
    const override = useOrbitStore((s) => s.courseCovers[course.id])
    if (override?.image) return <img src={override.image} alt="" loading="lazy" className={`block h-full w-full object-cover ${className}`} />
    return <CourseCover course={course} seed={override?.seed} motif={override?.motif} accent={override?.accent} className={className} />
}

// ─── Nền chung ──────────────────────────────────────────────────────────────

function Background({ uid, r, p, glowX = 0.4 }: { uid: string; r: Rand; p: Palette; glowX?: number }) {
    const gx = glowX + between(r, -0.08, 0.08)
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" style={{ stopColor: p.mix(16, p.ink) }} />
                    <stop offset=".55" style={{ stopColor: p.mix(8, p.ink) }} />
                    <stop offset="1" style={{ stopColor: p.mix(3, p.ink) }} />
                </linearGradient>
                <radialGradient id={`${uid}-glow`} cx={gx} cy=".45" r=".55">
                    <stop offset="0" style={{ stopColor: p.A, stopOpacity: 0.45 }} />
                    <stop offset="1" style={{ stopColor: p.A, stopOpacity: 0 }} />
                </radialGradient>
                <linearGradient id={`${uid}-fade`} x1="0" x2="1">
                    <stop offset="0" style={{ stopColor: p.mix(3, p.ink), stopOpacity: 0 }} />
                    <stop offset=".75" style={{ stopColor: p.mix(3, p.ink), stopOpacity: 0 }} />
                    <stop offset="1" style={{ stopColor: p.mix(3, p.ink), stopOpacity: 0.85 }} />
                </linearGradient>
            </defs>
            <rect width={W} height={H} fill={`url(#${uid}-bg)`} />
            <rect width={W} height={H} fill={`url(#${uid}-glow)`} />
        </>
    )
}
const Fade = ({ uid }: { uid: string }) => <rect width={W} height={H} fill={`url(#${uid}-fade)`} />

// ─── Dòng thời gian dựng phim (track clip + playhead + sóng âm) ─────────────

function timeline(uid: string, r: Rand, p: Palette) {
    const tilt = between(r, -8, -4)
    const ticks: React.ReactNode[] = []
    for (let x = 60, i = 0; x < W; x += 40, i++) ticks.push(<rect key={x} x={x} y={96} width={1} height={i % 4 === 0 ? 14 : 7} />)

    // Mỗi hàng: các clip nối tiếp, độ rộng ngẫu nhiên, vạch cắt đều bên trong clip
    const widths = [90, 130, 180, 220, 260, 320]
    const rows = [
        { y: 150, fill: p.mix(25, p.white), ops: [0.52, 0.71, 0.95], splice: true, x0: 101 },
        { y: 228, fill: p.A, ops: [0.52, 0.71, 0.95], splice: true, x0: 132 },
        { y: 306, fill: p.mix(60, p.ink), ops: [0.5, 0.68, 0.9], splice: false, x0: 73 },
        { y: 384, fill: p.mix(25, p.white), ops: [0.19, 0.26, 0.35], splice: false, x0: 106 },
    ]
    const clips = rows.flatMap((row, ri) => {
        const out: React.ReactNode[] = []
        let x = row.x0 + between(r, -30, 30)
        let k = 0
        while (x < 1250) {
            const w = Math.min(pick(r, widths), 1250 - x)
            if (w < 40) break
            out.push(<rect key={`c${ri}-${k}`} x={Math.round(x)} y={row.y} width={w} height={52} rx={12} fill={row.fill} opacity={pick(r, row.ops)} />)
            if (row.splice) for (let sx = 28; sx < w - 14; sx += 28) out.push(<rect key={`s${ri}-${k}-${sx}`} x={Math.round(x) + sx} y={row.y + 6} width={2} height={40} fill={p.ink} opacity={0.12} />)
            x += w + 6
            k++
        }
        return out
    })

    const bars: React.ReactNode[] = []
    for (let x = 60; x < 1220; x += 9) {
        const peak = r() < 0.12
        const h = peak ? between(r, 34, 64) : 4 + r() * r() * 34
        bars.push(<rect key={x} x={x} y={f1(488 - h / 2)} width={5} height={f1(h)} rx={2.5} />)
    }
    const px = Math.round(between(r, 380, 700))
    const head = p.mix(85, p.white)
    return (
        <>
            <Background uid={uid} r={r} p={p} />
            <g transform={`rotate(${f1(tilt)} 640 280)`}>
                <g fill={p.mix(20, p.white)} opacity={0.5}>{ticks}</g>
                {clips}
                <g fill={p.mix(25, p.white)} opacity={0.55}>{bars}</g>
                <rect x={px - 1.5} y={70} width={3} height={420} style={{ fill: head }} />
                <path d={`M${px - 14} 64 h28 l-14 18z`} style={{ fill: head }} />
            </g>
            <Fade uid={uid} />
        </>
    )
}

// ─── Ánh sáng: đèn key/fill, quả cầu viền sáng, khẩu độ, lưới 1/3 ───────────

function light(uid: string, r: Rand, p: Palette) {
    const kx = 150 + between(r, -60, 60)
    const fx = 830 + between(r, -50, 50)
    const bx = 540 + between(r, -70, 70)
    const by = 330 + between(r, -18, 18)
    const br = 118 + between(r, -12, 14)
    const ax = 1010 + between(r, -50, 50)
    const ay = 260 + between(r, -25, 25)
    const R = 190 + between(r, -14, 14)
    const a0 = 15 + between(r, -10, 10)
    const rad = (d: number) => (d * Math.PI) / 180
    const pt = (cx: number, cy: number, rr: number, deg: number) => `${f1(cx + rr * Math.cos(rad(deg)))} ${f1(cy + rr * Math.sin(rad(deg)))}`
    const blades = Array.from({ length: 6 }, (_, i) => {
        const d = a0 + 60 * i
        return <path key={i} d={`M${pt(ax, ay, R, d)} L${pt(ax, ay, R, d + 60)} L${pt(ax, ay, R * 0.38, d + 25)}Z`} />
    })
    const arc0 = -75 + between(r, -10, 10)
    const arc1 = 20 + between(r, -10, 10)
    const arcD = `M${pt(bx, by, br - 1, arc0)} A${br - 1} ${br - 1} 0 0 1 ${pt(bx, by, br - 1, arc1)}`
    const floor = p.mix(18, p.ink)
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" style={{ stopColor: p.mix(16, p.ink) }} />
                    <stop offset=".6" style={{ stopColor: p.mix(8, p.ink) }} />
                    <stop offset="1" style={{ stopColor: p.mix(3, p.ink) }} />
                </linearGradient>
                <linearGradient id={`${uid}-key`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" style={{ stopColor: p.warm, stopOpacity: 0.55 }} />
                    <stop offset="1" style={{ stopColor: p.warm, stopOpacity: 0 }} />
                </linearGradient>
                <linearGradient id={`${uid}-fill`} x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: p.cool, stopOpacity: 0.22 }} />
                    <stop offset="1" style={{ stopColor: p.cool, stopOpacity: 0 }} />
                </linearGradient>
                <radialGradient id={`${uid}-ball`} cx=".32" cy=".3" r=".8">
                    <stop offset="0" style={{ stopColor: p.mix(35, p.white) }} />
                    <stop offset=".35" style={{ stopColor: p.mix(85, p.white) }} />
                    <stop offset=".75" style={{ stopColor: p.mix(45, p.ink) }} />
                    <stop offset="1" style={{ stopColor: p.mix(20, p.ink) }} />
                </radialGradient>
                <radialGradient id={`${uid}-shadow`} cx=".5" cy=".5" r=".5">
                    <stop offset="0" style={{ stopColor: p.ink, stopOpacity: 0.6 }} />
                    <stop offset="1" style={{ stopColor: p.ink, stopOpacity: 0 }} />
                </radialGradient>
                <radialGradient id={`${uid}-hot`} cx=".5" cy=".5" r=".5">
                    <stop offset="0" style={{ stopColor: p.white }} />
                    <stop offset=".3" style={{ stopColor: p.warm, stopOpacity: 0.8 }} />
                    <stop offset="1" style={{ stopColor: p.warm, stopOpacity: 0 }} />
                </radialGradient>
                <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" /></filter>
                <filter id={`${uid}-soft2`}><feGaussianBlur stdDeviation="30" /></filter>
            </defs>
            <rect width={W} height={H} fill={`url(#${uid}-bg)`} />
            <path d="M0 430 C 300 400, 900 400, 1280 430 L1280 560 L0 560Z" style={{ fill: floor }} />
            {/* đèn key từ trên trái */}
            <path d={`M${kx} 40 L${kx + 490} 250 L${kx + 320} 470 Z`} fill={`url(#${uid}-key)`} filter={`url(#${uid}-soft)`} />
            <circle cx={kx} cy={40} r={70} fill={`url(#${uid}-hot)`} />
            <rect x={kx - 32} y={20} width={64} height={40} rx={8} transform={`rotate(30 ${kx} 40)`} style={{ fill: p.mix(12, p.ink), stroke: p.warm, strokeOpacity: 0.6 }} />
            {/* đèn fill từ phải */}
            <path d={`M${fx} 40 L${fx - 230} 260 L${fx - 130} 440 Z`} fill={`url(#${uid}-fill)`} filter={`url(#${uid}-soft)`} />
            <rect x={fx - 24} y={24} width={48} height={30} rx={6} transform={`rotate(-40 ${fx} 40)`} style={{ fill: p.mix(6, p.ink), stroke: p.cool, strokeOpacity: 0.5 }} />
            {/* chủ thể */}
            <ellipse cx={bx} cy={452} rx={f1((150 * br) / 118)} ry={22} fill={`url(#${uid}-shadow)`} />
            <circle cx={bx} cy={by} r={br} fill={`url(#${uid}-ball)`} />
            <path d={arcD} fill="none" strokeWidth={4} strokeLinecap="round" opacity={0.9} style={{ stroke: p.mix(35, p.rim) }} />
            <path d={arcD} fill="none" strokeWidth={14} strokeLinecap="round" opacity={0.35} filter={`url(#${uid}-soft)`} style={{ stroke: p.rim }} />
            <circle cx={bx + 20} cy={by - 30} r={170} opacity={0.08} filter={`url(#${uid}-soft2)`} style={{ fill: p.warm }} />
            {/* khẩu độ */}
            <circle cx={ax} cy={ay} r={R} fill="none" strokeWidth={2} strokeOpacity={0.45} style={{ stroke: p.mix(30, p.warm) }} />
            <circle cx={ax} cy={ay} r={R + 26} fill="none" strokeWidth={12} strokeOpacity={0.15} strokeDasharray="2 10" style={{ stroke: p.mix(30, p.warm) }} />
            <g fill="none" strokeWidth={2} strokeOpacity={0.35} style={{ stroke: p.mix(30, p.warm) }}>{blades}</g>
            <circle cx={ax} cy={ay} r={f1(R * 0.36)} fillOpacity={0.12} style={{ fill: p.warm }} />
            {/* gợi ý lưới 1/3 */}
            <path d={`M${W / 3} 0V${H}M${(2 * W) / 3} 0V${H}M0 ${H / 3}H${W}M0 ${(2 * H) / 3}H${W}`} strokeOpacity={0.12} style={{ stroke: p.mix(30, p.warm) }} />
        </>
    )
}

// ─── Sóng âm nhiều lớp ──────────────────────────────────────────────────────

function wave(uid: string, r: Rand, p: Palette) {
    const layers = Array.from({ length: 6 }, (_, i) => {
        const cy = 250 + i * 34 + between(r, -10, 10)
        const comps = Array.from({ length: 3 }, () => ({ a: between(r, 14, 62) / (1 + i * 0.25), f: between(r, 0.003, 0.012), ph: between(r, 0, 6.28) }))
        const pts: string[] = []
        for (let x = 0; x <= W; x += 16) pts.push(`${x},${f1(cy + comps.reduce((s, c) => s + c.a * Math.sin(x * c.f + c.ph), 0))}`)
        const line = `M${pts.join(' L')}`
        return { line, area: `${line} L${W},${H} L0,${H}Z`, i }
    })
    const bars: React.ReactNode[] = []
    for (let x = 40; x < W; x += 14) {
        const h = 10 + (Math.sin(x * 0.011) * 0.5 + 0.5) * r() * 150
        bars.push(<rect key={x} x={x} y={f1(210 - h / 2)} width={6} height={f1(h)} rx={3} />)
    }
    return (
        <>
            <Background uid={uid} r={r} p={p} glowX={0.55} />
            <g fill={p.mix(35, p.white)} opacity={0.16}>{bars}</g>
            {layers.map((l) => (
                <g key={l.i}>
                    <path d={l.area} opacity={0.1 + l.i * 0.05} style={{ fill: l.i % 2 ? p.mix(60, p.ink) : p.A }} />
                    <path d={l.line} fill="none" strokeWidth={l.i === 2 ? 3 : 1.5} opacity={l.i === 2 ? 0.95 : 0.35} style={{ stroke: l.i === 2 ? p.mix(80, p.white) : p.mix(40, p.white) }} />
                </g>
            ))}
            <Fade uid={uid} />
        </>
    )
}

// ─── Lưới bố cục + khối ─────────────────────────────────────────────────────

function grid(uid: string, r: Rand, p: Palette) {
    const cell = 80
    const lines: React.ReactNode[] = []
    for (let x = 0; x <= W; x += cell) lines.push(<path key={`v${x}`} d={`M${x} 0V${H}`} />)
    for (let y = 0; y <= H; y += cell) lines.push(<path key={`h${y}`} d={`M0 ${y}H${W}`} />)
    const taken = new Set<string>()
    const blocks: React.ReactNode[] = []
    const fills = [p.A, p.mix(60, p.ink), p.mix(25, p.white), p.mix(60, p.ink)]
    for (let i = 0; i < 34 && blocks.length < 9; i++) {
        const cw = pick(r, [1, 2, 2, 3, 4])
        const ch = pick(r, [1, 2, 2, 3])
        const cx = Math.floor(r() * (W / cell - cw))
        const cy = Math.floor(r() * (H / cell - ch))
        const keys = Array.from({ length: cw * ch }, (_, k) => `${cx + (k % cw)}:${cy + Math.floor(k / cw)}`)
        if (keys.some((k) => taken.has(k))) continue
        keys.forEach((k) => taken.add(k))
        blocks.push(<rect key={i} x={cx * cell + 6} y={cy * cell + 6} width={cw * cell - 12} height={ch * cell - 12} rx={14} opacity={f1(between(r, 0.3, 0.95))} style={{ fill: pick(r, fills) }} />)
    }
    return (
        <>
            <Background uid={uid} r={r} p={p} glowX={0.6} />
            <g fill="none" strokeWidth={1} opacity={0.12} style={{ stroke: p.white }}>{lines}</g>
            {blocks}
            {/* giao điểm 1/3 */}
            <g style={{ fill: p.mix(80, p.white) }}>
                {[W / 3, (2 * W) / 3].flatMap((x) => [H / 3, (2 * H) / 3].map((y) => <circle key={`${x}${y}`} cx={f1(x)} cy={f1(y)} r={6} opacity={0.8} />))}
            </g>
            <Fade uid={uid} />
        </>
    )
}

// ─── Khối hình học (mặc định) ───────────────────────────────────────────────

function shapes(uid: string, r: Rand, p: Palette) {
    const fills = [p.A, p.mix(60, p.ink), p.mix(25, p.white), p.mix(45, p.white)]
    const items = Array.from({ length: 11 }, (_, i) => {
        const x = between(r, 40, W - 40)
        const y = between(r, 30, H - 30)
        const s = between(r, 50, 190)
        const rot = between(r, -40, 40)
        const kind = pick(r, ['circle', 'rect', 'tri', 'ring', 'half'] as const)
        const fill = pick(r, fills)
        const op = f1(between(r, 0.25, 0.9))
        const t = `rotate(${f1(rot)} ${f1(x)} ${f1(y)})`
        switch (kind) {
            case 'circle':
                return <circle key={i} cx={f1(x)} cy={f1(y)} r={f1(s / 2)} opacity={op} style={{ fill }} />
            case 'rect':
                return <rect key={i} x={f1(x - s / 2)} y={f1(y - s / 2)} width={f1(s)} height={f1(s * between(r, 0.5, 1))} rx={16} transform={t} opacity={op} style={{ fill }} />
            case 'tri':
                return <path key={i} d={`M${f1(x)} ${f1(y - s / 2)} L${f1(x + s / 2)} ${f1(y + s / 2)} L${f1(x - s / 2)} ${f1(y + s / 2)}Z`} transform={t} opacity={op} style={{ fill }} />
            case 'ring':
                return <circle key={i} cx={f1(x)} cy={f1(y)} r={f1(s / 2)} fill="none" strokeWidth={f1(between(r, 4, 14))} opacity={op} style={{ stroke: fill }} />
            default:
                return <path key={i} d={`M${f1(x - s / 2)} ${f1(y)} A${f1(s / 2)} ${f1(s / 2)} 0 0 1 ${f1(x + s / 2)} ${f1(y)}Z`} transform={t} opacity={op} style={{ fill }} />
        }
    })
    return (
        <>
            <Background uid={uid} r={r} p={p} glowX={0.5} />
            {items}
            <Fade uid={uid} />
        </>
    )
}
