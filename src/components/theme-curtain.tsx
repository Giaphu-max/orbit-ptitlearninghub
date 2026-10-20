import { useEffect, useMemo, useRef } from 'react'
import { bindCurtain } from '@/lib/theme-switch'

// Logo PTIT (nếu có SVG/PNG/WebP trong src/assets/brand) thay cho chữ PTIT trong vòng quỹ đạo
const logoUrls = import.meta.glob('/src/assets/brand/logo.{svg,png,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
}) as Record<string, string>
const logoUrl = Object.values(logoUrls)[0]

const LETTERS: { ch: string; x: number }[] = [
    { ch: 'P', x: -62 },
    { ch: 'T', x: -24 },
    { ch: 'I', x: 14 },
    { ch: 'T', x: 34 },
]

/** Màn phủ chuyển giao diện: mount sẵn, ẩn bằng visibility, điều khiển bởi lib/theme-switch.ts. */
export function ThemeCurtain() {
    const curtain = useRef<HTMLDivElement>(null)
    const emblem = useRef<HTMLDivElement>(null)
    const ring = useRef<SVGCircleElement>(null)
    const sat = useRef<SVGGElement>(null)
    const stars = useRef<HTMLDivElement>(null)
    const greeting = useRef<HTMLDivElement>(null)
    const marks = useRef<(SVGElement | null)[]>([])

    const starPos = useMemo(
        () =>
            Array.from({ length: 26 }, (_, i) => {
                const a = (i * 137.5 * Math.PI) / 180
                const r = 30 + ((i * 53) % 40)
                return { left: `${50 + Math.cos(a) * r * 0.9}%`, top: `${50 + Math.sin(a) * r * 0.6}%` }
            }),
        [],
    )

    useEffect(() => {
        if (!curtain.current || !emblem.current || !ring.current || !sat.current || !stars.current || !greeting.current) return
        bindCurtain({
            curtain: curtain.current,
            emblem: emblem.current,
            ring: ring.current,
            sat: sat.current,
            marks: marks.current.filter((m): m is SVGElement => m !== null),
            stars: stars.current,
            greeting: greeting.current,
        })
        return () => bindCurtain(null)
    }, [])

    return (
        <div ref={curtain} className="theme-curtain" aria-hidden="true">
            <div ref={stars} className="absolute inset-0">
                {starPos.map((p, i) => (
                    <span key={i} className="theme-curtain-star" style={p} />
                ))}
            </div>
            <div ref={emblem} className="theme-curtain-emblem">
                <svg viewBox="-130 -130 260 260" className="h-full w-full overflow-visible">
                    <defs>
                        <linearGradient id="tc-ring" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="hsl(var(--ink-foreground))" />
                            <stop offset="1" stopColor="hsl(var(--brand-light))" />
                        </linearGradient>
                        <filter id="tc-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="b" />
                            <feMerge>
                                <feMergeNode in="b" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    <circle
                        ref={ring}
                        r="112"
                        fill="none"
                        stroke="url(#tc-ring)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        pathLength={1}
                        strokeDasharray="1"
                        strokeDashoffset="1"
                    />
                    <g ref={sat}>
                        <circle cx="112" cy="0" r="7" className="fill-ink-foreground" filter="url(#tc-glow)" />
                    </g>
                    {logoUrl ? (
                        <image
                            ref={(el) => {
                                marks.current[0] = el
                            }}
                            href={logoUrl}
                            x="-60"
                            y="-66"
                            width="120"
                            height="120"
                            preserveAspectRatio="xMidYMid meet"
                        />
                    ) : (
                        LETTERS.map((l, i) => (
                            <text
                                key={i}
                                ref={(el) => {
                                    marks.current[i] = el
                                }}
                                x={l.x}
                                y="20"
                                className="fill-ink-foreground"
                                style={{ fontWeight: 900, fontSize: 58, letterSpacing: '0.02em' }}
                            >
                                {l.ch}
                            </text>
                        ))
                    )}
                    <text
                        ref={(el) => {
                            marks.current[logoUrl ? 1 : LETTERS.length] = el
                        }}
                        x="0"
                        y="52"
                        textAnchor="middle"
                        className="fill-ink-foreground/75"
                        style={{ fontWeight: 600, fontSize: 11, letterSpacing: '0.3em' }}
                    >
                        ORBIT
                    </text>
                </svg>
            </div>
            {/* Lời chào khi chọn/đổi vai trò (nội dung do lib/role-switch.ts đặt) */}
            <div ref={greeting} className="theme-curtain-greeting" />
        </div>
    )
}
