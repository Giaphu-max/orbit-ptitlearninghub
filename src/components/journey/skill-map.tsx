import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Lock, Star } from 'lucide-react'
import { UNLOCK_THRESHOLD, type SkillNode } from '@/lib/gamification'

/** Mỗi câu đúng nâng mức nắm vững khoảng chừng này (ước lượng cho "còn N câu đúng nữa"). */
export const MASTERY_PER_CORRECT = 0.15
const H = 280
const PAD = 70
const R = 32
const RING = 2 * Math.PI * R

const calm = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const questionsLeft = (m: number) => Math.max(1, Math.ceil((UNLOCK_THRESHOLD - m) / MASTERY_PER_CORRECT))

/**
 * Bản đồ kỹ năng của MỘT chặng (bài): đường cong uốn lượn nối các trạm xen kẽ cao/thấp, mỗi khái niệm một trạm tròn 76px đặt đúng trên đường,
 * trạm cuối là "Test cuối chặng". Đoạn đã đi tô đỏ (vẽ dần), trạm đang học có vòng tiến độ SVG đỏ đúng % (không nước dâng).
 * Component được remount (key) khi đổi chặng / mở tab để chạy lại hiệu ứng.
 */
export function SkillMap({ nodes, lessonId }: { nodes: SkillNode[]; lessonId: string }) {
    const boxRef = useRef<HTMLDivElement>(null)
    const [w, setW] = useState(0)
    const [drawn, setDrawn] = useState(calm)
    const [hover, setHover] = useState<number | null>(null)

    useLayoutEffect(() => {
        const el = boxRef.current
        if (!el) return
        const ro = new ResizeObserver(() => setW(el.clientWidth))
        ro.observe(el)
        setW(el.clientWidth)
        return () => ro.disconnect()
    }, [])
    useEffect(() => {
        if (drawn) return
        const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
        return () => cancelAnimationFrame(id)
    }, [drawn])

    const n = nodes.length + 1
    const curIdx = (() => {
        const i = nodes.findIndex((x) => x.mastery < UNLOCK_THRESHOLD)
        return i < 0 ? nodes.length : i
    })()
    const pts = Array.from({ length: n }, (_, i) => [PAD + ((w - PAD * 2) * i) / Math.max(1, n - 1), H * (i % 2 ? 0.64 : 0.36)] as const)
    let d = ''
    pts.forEach(([x, y], i) => {
        if (i === 0) d = `M${x},${y}`
        else {
            const [x0, y0] = pts[i - 1]
            const mx = (x0 + x) / 2
            d += ` C${mx},${y0} ${mx},${y} ${x},${y}`
        }
    })
    // Phần đã đi: tới trạm hiện tại, cộng thêm theo % của trạm đó (các đoạn gần bằng nhau nên tính theo chỉ số)
    const curM = curIdx < nodes.length ? nodes[curIdx].mastery : 0
    const frac = Math.min(1, (curIdx + curM) / Math.max(1, n - 1))
    const hovered = hover !== null && hover < nodes.length ? nodes[hover] : null

    return (
        <div ref={boxRef} className="relative -mx-1.5" style={{ height: H }}>
            {w > 0 && (
                <>
                    <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
                        <defs>
                            <linearGradient id="sk-grad" x1="0" x2="1">
                                <stop offset="0" style={{ stopColor: 'hsl(var(--brand) / 0.6)' }} />
                                <stop offset="1" style={{ stopColor: 'hsl(var(--brand))' }} />
                            </linearGradient>
                        </defs>
                        <path d={d} fill="none" strokeWidth="18" strokeLinecap="round" className="stroke-muted" />
                        <path d={d} fill="none" stroke="url(#sk-grad)" strokeWidth="18" strokeLinecap="round" pathLength="1000" strokeDasharray="1000" strokeDashoffset={drawn ? 1000 * (1 - frac) : 1000} className="sk-road" />
                        <path d={d} fill="none" strokeWidth="2.5" strokeDasharray="2 12" strokeLinecap="round" className="stroke-card" opacity=".9" />
                    </svg>
                    {nodes.map((node, i) => (
                        <Station
                            key={node.concept.id}
                            node={node}
                            state={node.mastery >= UNLOCK_THRESHOLD ? 'ok' : !node.unlocked ? 'lock' : 'doing'}
                            here={i === curIdx && node.unlocked}
                            x={pts[i][0]}
                            y={pts[i][1]}
                            delay={i * 80}
                            drawn={drawn}
                            onHover={(on) => setHover(on ? i : null)}
                        />
                    ))}
                    <Link
                        to={`/checkpoint/${lessonId}`}
                        className="sk-pop absolute flex flex-col items-center gap-2.5 focus-visible:outline-none"
                        style={{ left: pts[n - 1][0], top: pts[n - 1][1], animationDelay: `${(n - 1) * 80}ms` }}
                    >
                        <span className="grid h-[76px] w-[76px] place-items-center rounded-[22px] bg-ink text-ink-foreground shadow-raised transition-transform duration-base hover:scale-[1.08]">
                            <Star size={28} className="fill-current" />
                        </span>
                        <span className="max-w-[150px] text-center text-[13.5px] font-bold leading-[1.3] text-strong">Test cuối chặng</span>
                    </Link>
                    {hovered && hover !== null && (
                        <div role="tooltip" className="pointer-events-none absolute z-[5] min-w-[220px] max-w-[260px] -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3.5 py-3 text-[13px] leading-[1.45] text-ink-foreground shadow-raised" style={{ left: Math.min(Math.max(pts[hover][0], 130), w - 130), top: pts[hover][1] - 38 - (hover === curIdx && hovered.unlocked ? 42 : 12) }}>
                            <b className="block text-sm">{hovered.concept.name}</b>
                            {!hovered.unlocked ? (
                                'Mở khi khái niệm trước đạt 80%'
                            ) : hovered.mastery >= UNLOCK_THRESHOLD ? (
                                'Đã vững'
                            ) : (
                                <>
                                    {Math.round(hovered.mastery * 100)}% · còn {questionsLeft(hovered.mastery)} câu đúng nữa
                                </>
                            )}
                            {hovered.unlocked && (
                                <>
                                    <span className="relative my-2 block h-[5px] rounded-[3px] bg-ink-foreground/20">
                                        <i className="absolute inset-y-0 left-0 rounded-[3px] bg-brand-300" style={{ width: `${Math.min(100, hovered.mastery * 100)}%` }} />
                                        <u className="absolute -top-[3px] left-[80%] h-[11px] w-0.5 bg-ink-foreground no-underline" />
                                    </span>
                                    <span className="text-ink-foreground/75">Bấm để ôn đúng đoạn video</span>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function Station({ node, state, here, x, y, delay, drawn, onHover }: { node: SkillNode; state: 'ok' | 'doing' | 'lock'; here: boolean; x: number; y: number; delay: number; drawn: boolean; onHover: (on: boolean) => void }) {
    const pct = Math.round(node.mastery * 100)
    const isZero = pct === 0
    const isDoing = state === 'doing'
    const isCurrentDoing = here && !isZero

    const body = (
        <>
            {here && <span className="absolute -top-[34px] whitespace-nowrap rounded-lg bg-ink px-2.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink-foreground after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-[5px] after:border-transparent after:border-t-ink">Bạn ở đây</span>}
            <span className={`relative grid h-[76px] w-[76px] place-items-center rounded-full shadow-raised transition-transform duration-base group-hover:scale-[1.08] ${state === 'ok' ? 'bg-brand-600' : state === 'lock' ? 'bg-muted shadow-none' : 'bg-card'} ${isCurrentDoing ? 'sk-breathe' : ''}`}>
                {state === 'ok' && <Check size={30} strokeWidth={3} className="text-ink-foreground" />}
                {state === 'lock' && <Lock size={22} className="text-muted-foreground/70" />}
                {isDoing && (
                    <>
                        <svg viewBox="0 0 76 76" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
                            <circle cx="38" cy="38" r={R} fill="none" strokeWidth="6" className="stroke-brand-100" />
                            {!isZero && (
                                <circle
                                    cx="38"
                                    cy="38"
                                    r={R}
                                    fill="none"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={RING}
                                    strokeDashoffset={drawn ? RING * (1 - node.mastery) : RING}
                                    className="stroke-brand-600 transition-[stroke-dashoffset] duration-slow"
                                />
                            )}
                        </svg>
                        <b className={`relative z-[1] font-mono text-[17px] font-extrabold ${isZero ? 'text-muted-foreground' : 'text-brand-ink'}`}>
                            {pct}%
                        </b>
                        {isCurrentDoing && <span aria-hidden className="sk-ping pointer-events-none absolute -inset-1 rounded-full border-2 border-brand-600/35" />}
                    </>
                )}
            </span>
            <span className={`max-w-[150px] text-center text-[13.5px] leading-[1.3] ${state === 'lock' ? 'font-semibold text-muted-foreground/70' : 'font-bold text-strong'}`}>{node.concept.name}</span>
        </>
    )
    const cls = 'sk-pop group absolute flex flex-col items-center gap-2.5 focus-visible:outline-none'
    const style = { left: x, top: y, animationDelay: `${delay}ms` }
    return state === 'lock' ? (
        <span className={cls} style={style} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>{body}</span>
    ) : (
        <Link to={`/lesson/${node.lessonId}?t=${Math.floor(node.concept.segment.start)}`} className={cls} style={style} aria-label={`${node.concept.name}, ${pct}%`} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onFocus={() => onHover(true)} onBlur={() => onHover(false)}>
            {body}
        </Link>
    )
}
