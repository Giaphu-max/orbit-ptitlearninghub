import colorUrl from '@/assets/role/big-color2.webp?url'
import monoUrl from '@/assets/role/big-mono.webp?url'

type Pt = [number, number]

// Hình "xé tay" của collage (docs/mockup/ptit-login/ptit-role-select.html). Seed cố định và thứ tự gọi rnd giữ nguyên
// để lần nào cũng ra đúng một hình.
let seed = 29
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** Chia nhỏ từng cạnh rồi rung lệch vuông góc, như giấy xé bằng tay. */
function torn(pts: Pt[], amp: number, seg: number): Pt[] {
    const out: Pt[] = []
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i]
        const [x2, y2] = pts[(i + 1) % pts.length]
        const L = Math.hypot(x2 - x1, y2 - y1)
        const n = Math.max(2, Math.round(L / seg))
        const nx = -(y2 - y1) / L
        const ny = (x2 - x1) / L
        let w = 0
        for (let k = 0; k < n; k++) {
            const t = k / n
            w = w * 0.55 + (rnd() - 0.5) * amp
            out.push([x1 + (x2 - x1) * t + nx * w, y1 + (y2 - y1) * t + ny * w])
        }
    }
    return out
}
/** Bản lớn hơn d px, dùng làm viền giấy trắng phía sau mảnh. */
function grow(pts: Pt[], d: number): Pt[] {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
    return pts.map(([x, y]) => {
        const l = Math.hypot(x - cx, y - cy) || 1
        return [x + ((x - cx) / l) * d, y + ((y - cy) / l) * d]
    })
}
const str = (p: Pt[]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')

// Nửa phải khuôn mặt, dải mắt, mảng đầu khuyết (C), cẳng tay đeo đồng hồ, vạt áo
const R: Pt[] = [[392, 96], [520, 104], [536, 300], [476, 394], [398, 404], [404, 250]]
const E: Pt[] = [[268, 206], [522, 200], [528, 276], [272, 286]]
const C: Pt[] = [[150, 0], [420, 0], [408, 40], [330, 96], [262, 150], [196, 176], [150, 170]]
const Wp: Pt[] = [[462, 500], [650, 516], [642, 652], [468, 642]]
const Hp: Pt[] = [[96, 606], [300, 590], [312, 752], [104, 770]]

const r = torn(R, 7, 9)
const e = torn(E, 6, 7)
const c = torn(C, 9, 8)
const w = torn(Wp, 7, 8)
const hh = torn(Hp, 8, 8)
const SHAPE = {
    tW: str(w),
    pW: str(grow(torn(Wp, 7, 8), 6)),
    tH: str(hh),
    pH: str(grow(hh, 0)),
    tR: str(r),
    pR: str(grow(torn(R, 7, 9), 5)),
    tE: str(e),
    pE: str(grow(torn(E, 6, 7), 6)),
    tCut: str(c),
    // Bản trên của sợi dây chỉ vẽ ngoài dải mắt: dây luồn ra sau dải mắt rồi đè lên phần còn lại
    topOnly: `M-100 -100H900V1000H-100Z M${e.map((q) => q.join(' ')).join(' L')}Z`,
}

// Các cột ký tự lấp chỗ đầu khuyết
const CH = '01<>/\\{}[]#=+*?:;ACGTXZ%&'.split('')
const DATA: { x: number; y: number; ch: string }[] = []
for (let x = 158; x < 430; x += 11) {
    if (rnd() < 0.25) continue
    const y0 = 4 + rnd() * 30
    const len = (6 + rnd() * 18) | 0
    for (let i = 0; i < len; i++) DATA.push({ x, y: Math.round(y0 + i * 11), ch: CH[(rnd() * CH.length) | 0] })
}

const THREAD = 'M214 352 C 252 318 290 270 330 250 C 372 230 420 236 452 250 C 500 270 540 232 568 190 C 600 140 652 104 744 62'

/** Chân dung dạng collage: ảnh màu + đen trắng, các mảnh xé tay, sợi dây và cột ký tự. Chuyển động do class của .rs-art điều khiển (role-select.css). */
export function PortraitCollage() {
    return (
        <svg className="rs-portrait" viewBox="0 0 700 880" preserveAspectRatio="xMidYMax meet">
            <defs>
                <clipPath id="rc-R"><polygon points={SHAPE.tR} /></clipPath>
                <clipPath id="rc-E"><polygon points={SHAPE.tE} /></clipPath>
                <clipPath id="rc-W"><polygon points={SHAPE.tW} /></clipPath>
                <clipPath id="rc-cut"><polygon points={SHAPE.tCut} /></clipPath>
                <clipPath id="rc-top"><path clipRule="evenodd" d={SHAPE.topOnly} /></clipPath>
                <pattern id="rc-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.7" fill="#DE221A" /></pattern>
                <mask id="rc-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="700" height="880">
                    <rect width="700" height="880" fill="#fff" />
                    <polygon className="rs-cut2" points={SHAPE.tCut} fill="#000" />
                </mask>
                <filter id="rc-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0A1A50" floodOpacity=".28" />
                </filter>
            </defs>
            <g mask="url(#rc-mask)">
                <image className="pc" href={colorUrl} width="700" height="880" />
                <image className="pm" href={monoUrl} width="700" height="880" />
            </g>
            <g className="data" clipPath="url(#rc-cut)">
                {DATA.map((d, i) => (
                    <text key={i} x={d.x} y={d.y}>{d.ch}</text>
                ))}
            </g>
            <g className="s sR">
                <polygon className="paper" points={SHAPE.pR} />
                <image href={colorUrl} width="700" height="880" clipPath="url(#rc-R)" />
            </g>
            <g className="s sH">
                <polygon className="paper" points={SHAPE.pH} />
                <polygon points={SHAPE.tH} fill="url(#rc-dots)" />
            </g>
            <g className="s sW" filter="url(#rc-shadow)">
                <polygon className="paper" points={SHAPE.pW} />
                <image href={colorUrl} width="700" height="880" clipPath="url(#rc-W)" />
            </g>
            <path className="thread" pathLength={1} d={THREAD} />
            <g className="s sE" filter="url(#rc-shadow)">
                <polygon className="paper" points={SHAPE.pE} />
                <image href={colorUrl} width="700" height="880" clipPath="url(#rc-E)" />
            </g>
            <path className="thread" clipPath="url(#rc-top)" pathLength={1} d={THREAD} />
            <circle className="knot" cx="214" cy="352" r="4" />
            <circle className="knot" cx="744" cy="62" r="4" />
            <polygon className="tri" points="512,96 570,108 538,150" />
        </svg>
    )
}
