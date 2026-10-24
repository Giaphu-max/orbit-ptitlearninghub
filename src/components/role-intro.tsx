import { useEffect, useRef } from 'react'
import { LOGO_URL } from '@/lib/brand'
import { bindIntro } from '@/lib/role-intro'
import './role-intro.css'

/** Màn intro sau khi chọn vai trò: mount sẵn, ẩn bằng visibility, điều khiển bởi lib/role-intro.ts (tìm phần tử theo data-ri). */
export function RoleIntro() {
    const root = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!root.current) return
        bindIntro(root.current)
        return () => bindIntro(null)
    }, [])

    return (
        <div ref={root} className="ri" role="dialog" aria-label="Đang vào hệ thống" aria-hidden="true">
            <div data-ri="red" className="ri-red" />
            <canvas data-ri="bg" className="ri-bg" aria-hidden="true" />
            <svg data-ri="rings" className="ri-rings" viewBox="-160 -100 320 200" aria-hidden="true">
                <ellipse data-ri="r1" rx="150" ry="86" strokeWidth="1.6" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ opacity: 0.55 }} />
                <ellipse data-ri="r2" rx="128" ry="72" strokeWidth="0.8" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ opacity: 0.3 }} />
                <ellipse rx="104" ry="58" strokeWidth="0.6" strokeDasharray=".6 3.4" style={{ opacity: 0.35 }} />
            </svg>
            {LOGO_URL && <img data-ri="ghost" className="ri-ghost" src={LOGO_URL} alt="" />}
            <div data-ri="top" className="ri-top">
                <div data-ri="badge" className="ri-badge">
                    {LOGO_URL ? <img src={LOGO_URL} alt="" width={600} height={763} /> : <b className="text-sm font-black text-brand-600">PTIT</b>}
                    <span data-ri="shine" className="ri-shine" />
                </div>
                <div>
                    <div data-ri="w1" className="ri-w1">HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG</div>
                    <div data-ri="w2" className="ri-w2">Posts and Telecommunications Institute of Technology</div>
                </div>
            </div>
            <div className="ri-hero">
                <h2 data-ri="w3" className="ri-w3" />
                <div data-ri="w4" className="ri-w4" />
            </div>
            <div data-ri="load" className="ri-load">
                <i>
                    <span data-ri="bar" className="ri-bar" />
                </i>
                <span data-ri="loadTx" />
            </div>
            <button data-ri="skip" type="button" className="ri-skip" aria-label="Bỏ qua phần mở đầu">
                Bỏ qua ⏎
            </button>
        </div>
    )
}
