import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Presentation, type LucideIcon } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { LOCKUP_URL, LOGO_URL } from '@/lib/brand'
import { centerOf, enterRole } from '@/lib/role-switch'
import type { Role } from '@/store/useOrbitStore'
import './role-select.css'

const ROLES: { role: Role; title: string; description: string; icon: LucideIcon }[] = [
    {
        role: 'student',
        title: 'Sinh viên',
        description: 'Học bài có trợ giảng AI, làm quiz củng cố, đọc bài ngắn mỗi ngày và tích XP theo mức hiểu bài.',
        icon: GraduationCap,
    },
    {
        role: 'teacher',
        title: 'Giảng viên',
        description: 'Duyệt và chỉnh nội dung AI tạo ra trước khi xuất bản, xem khái niệm nào lớp hay sai.',
        icon: Presentation,
    },
]

/** Lưỡi liềm = elip ngoài trừ elip trong lệch tâm: dày một bên, mỏng như sợi chỉ bên kia, giống vầng quỹ đạo của logo. */
function crescent(rx: number, ry: number, t: number, dx: number, dy: number) {
    const ir = rx - t
    const iry = ry - t * 0.55
    const ell = (a: number, b: number, cx: number, cy: number) => `M${cx + a} ${cy}A${a} ${b} 0 1 1 ${cx - a} ${cy}A${a} ${b} 0 1 1 ${cx + a} ${cy}Z`
    return ell(rx, ry, 0, 0) + ell(ir, iry, dx, dy)
}
const CRESCENT_D = crescent(88, 58, 20, 7, -5)

/** Vân giấy: vẽ một lần ở 256px rồi co giãn, không vẽ lại mỗi khung. */
function drawGrain(c: HTMLCanvasElement) {
    const size = 256
    c.width = size
    c.height = size
    const g = c.getContext('2d')
    if (!g) return
    const img = g.createImageData(size, size)
    for (let i = 0; i < img.data.length; i += 4) {
        const v = 225 + Math.random() * 30
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v
        img.data[i + 3] = 255
    }
    g.putImageData(img, 0, 0)
}

// Màn chọn vai trò thay cho đăng nhập (bản demo không có tài khoản thật).
export function OrbitRoleSelect() {
    const navigate = useNavigate()
    // Thẻ vừa bấm phóng nhẹ, các thẻ khác mờ đi trong lúc màn đỏ lan ra từ thẻ đó
    const [picked, setPicked] = useState<Role | null>(null)
    const grain = useRef<HTMLCanvasElement>(null)
    const c1 = useRef<HTMLDivElement>(null)
    const c2 = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (grain.current) drawGrain(grain.current)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        // Parallax theo chuột, tối đa ±14px, một lần ghi transform mỗi khung
        let raf = 0
        let x = 0
        let y = 0
        const apply = () => {
            raf = 0
            if (c1.current) c1.current.style.transform = `translate3d(${x * -14}px, ${y * -10}px, 0)`
            if (c2.current) c2.current.style.transform = `translate3d(${x * 14}px, ${y * 10}px, 0)`
        }
        const onMove = (e: PointerEvent) => {
            x = (e.clientX / window.innerWidth - 0.5) * 2
            y = (e.clientY / window.innerHeight - 0.5) * 2
            if (!raf) raf = requestAnimationFrame(apply)
        }
        window.addEventListener('pointermove', onMove, { passive: true })
        return () => {
            window.removeEventListener('pointermove', onMove)
            cancelAnimationFrame(raf)
        }
    }, [])

    return (
        <div className="rs">
            <div className="rs-paper" />
            <canvas ref={grain} className="rs-grain" aria-hidden="true" />
            <div ref={c1} className="rs-cres rs-c1" aria-hidden="true">
                <svg viewBox="-100 -100 200 200">
                    <path d={CRESCENT_D} fillRule="evenodd" transform="rotate(62)" />
                </svg>
            </div>
            <div ref={c2} className="rs-cres rs-c2" aria-hidden="true">
                <svg viewBox="-100 -100 200 200">
                    <path d={CRESCENT_D} fillRule="evenodd" transform="rotate(-118)" />
                </svg>
            </div>

            <header className="rs-top">
                <img src={LOCKUP_URL} alt="Học viện Công nghệ Bưu chính Viễn thông" />
                <div className="rs-top-end">
                    <span className="rs-demo">Bản trình diễn · không cần đăng nhập</span>
                    <ThemeToggle className="relative origin-right scale-90" />
                </div>
            </header>

            <div className="rs-layout">
                <div className="rs-copy">
                    <p className="rs-eb">Khoa Đa phương tiện · Học tập có trợ giảng AI</p>
                    <h1 className="rs-h1">
                        Học tập trung.
                        <br />
                        <em>Hiểu bài thật.</em>
                    </h1>
                    <p className="rs-lead">Bài giảng, trợ giảng AI và lộ trình ôn tập của Học viện trong một nơi. Chọn vai trò để bắt đầu.</p>
                    <div className={`rs-roles ${picked ? 'dim' : ''}`}>
                        {ROLES.map(({ role, title, description, icon: Icon }) => (
                            <button
                                key={role}
                                type="button"
                                disabled={picked !== null}
                                onClick={(e) => {
                                    setPicked(role)
                                    void enterRole(role, { origin: centerOf(e.currentTarget), navigate })
                                }}
                                className={`rs-role ${picked === role ? 'picked' : ''}`}
                            >
                                <span className="rs-ic">
                                    <Icon size={24} strokeWidth={2} />
                                </span>
                                <b>{title}</b>
                                <p>{description}</p>
                                <span className="rs-go">
                                    Vào với vai trò {title.toLowerCase()}
                                    <ArrowRight size={16} />
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="rs-foot">Cuộc thi Ứng dụng AI trong giảng dạy 2026 · Công đoàn PTIT</p>
                </div>

                <div className="rs-stage" aria-hidden="true">
                    <svg className="rs-orbits" viewBox="-100 -100 200 200">
                        <g transform="rotate(-24)">
                            <g className="rs-spin">
                                <ellipse className="rs-orb a" rx="92" ry="58" />
                            </g>
                            <g className="rs-spin rev">
                                <ellipse className="rs-orb b" rx="80" ry="48" />
                            </g>
                            <ellipse className="rs-orb b" rx="98" ry="64" style={{ opacity: 0.14 }} />
                            <path id="rs-orbit-path" d="M92 0A92 58 0 1 1-92 0A92 58 0 1 1 92 0" fill="none" />
                            <polygon className="rs-sat" points="0,-6 1.8,-1.8 6,0 1.8,1.8 0,6 -1.8,1.8 -6,0 -1.8,-1.8">
                                <animateMotion dur="14s" repeatCount="indefinite" rotate="auto">
                                    <mpath href="#rs-orbit-path" />
                                </animateMotion>
                            </polygon>
                        </g>
                    </svg>
                    <div className="rs-halo" />
                    {LOGO_URL && <img className="rs-logo" src={LOGO_URL} alt="" width={600} height={763} />}
                    <span className="rs-glint" />
                </div>
            </div>
        </div>
    )
}
