import { useEffect, useRef } from 'react'
import { LOGO_URL } from '@/lib/brand'
import { bindIntro } from '@/lib/role-intro'
import './role-intro.css'

/** Màn intro sau khi chọn vai trò: mount sẵn, ẩn bằng visibility, điều khiển bởi lib/role-intro.ts. */
export function RoleIntro() {
    const root = useRef<HTMLDivElement>(null)
    const red = useRef<HTMLDivElement>(null)
    const rings = useRef<SVGSVGElement>(null)
    const r1 = useRef<SVGEllipseElement>(null)
    const r2 = useRef<SVGEllipseElement>(null)
    const badge = useRef<HTMLDivElement>(null)
    const shine = useRef<HTMLSpanElement>(null)
    const glint = useRef<HTMLSpanElement>(null)
    const w1 = useRef<HTMLDivElement>(null)
    const w2 = useRef<HTMLDivElement>(null)
    const w3 = useRef<HTMLDivElement>(null)
    const skip = useRef<HTMLButtonElement>(null)
    const bar = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const e = { root, red, rings, r1, r2, badge, shine, glint, w1, w2, w3, skip, bar }
        const cur = Object.values(e).map((r) => r.current)
        if (cur.some((x) => !x)) return
        bindIntro({
            root: root.current!,
            red: red.current!,
            rings: rings.current!,
            r1: r1.current!,
            r2: r2.current!,
            badge: badge.current!,
            shine: shine.current!,
            glint: glint.current!,
            w1: w1.current!,
            w2: w2.current!,
            w3: w3.current!,
            skip: skip.current!,
            bar: bar.current!,
        })
        return () => bindIntro(null)
    }, [])

    return (
        <div ref={root} className="ri" role="dialog" aria-label="Đang vào hệ thống" aria-hidden="true">
            <div ref={red} className="ri-red" />
            <svg ref={rings} className="ri-rings" viewBox="-160 -100 320 200" aria-hidden="true">
                <ellipse ref={r1} rx="150" ry="86" strokeWidth="2.2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" />
                <ellipse ref={r2} rx="128" ry="72" strokeWidth="1" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ opacity: 0.5 }} />
            </svg>
            <div ref={badge} className="ri-badge">
                {LOGO_URL ? <img src={LOGO_URL} alt="" width={600} height={763} /> : <b className="text-2xl font-black text-brand-600">PTIT</b>}
                <span ref={shine} className="ri-shine" />
                <span ref={glint} className="ri-glint" />
            </div>
            <div className="ri-words">
                <div ref={w1} className="ri-w1">HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG</div>
                <div ref={w2} className="ri-w2">Posts and Telecommunications Institute of Technology</div>
                <div ref={w3} className="ri-w3" />
            </div>
            <button ref={skip} type="button" className="ri-skip" aria-label="Bỏ qua phần mở đầu">
                Bỏ qua ⏎
            </button>
            <div ref={bar} className="ri-bar" />
        </div>
    )
}
