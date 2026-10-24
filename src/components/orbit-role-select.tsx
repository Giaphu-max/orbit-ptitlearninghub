import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Presentation, type LucideIcon } from 'lucide-react'
import { GhostLogo } from '@/components/role/ghost-logo'
import { RoleArt } from '@/components/role/role-art'
import { LOCKUP_URL } from '@/lib/brand'
import { centerOf, enterRole } from '@/lib/role-switch'
import type { Role } from '@/store/useOrbitStore'
import './role-select.css'

const ROLES: { role: Role; title: string; description: string; icon: LucideIcon }[] = [
    {
        role: 'student',
        title: 'Sinh viên',
        description: 'Học có trợ giảng AI, quiz củng cố, tích XP theo mức hiểu bài.',
        icon: GraduationCap,
    },
    {
        role: 'teacher',
        title: 'Giảng viên',
        description: 'Duyệt nội dung AI tạo, xem lớp hay sai khái niệm nào.',
        icon: Presentation,
    },
]

// Màn chọn vai trò thay cho đăng nhập (bản demo không có tài khoản thật). Bố cục chia đôi theo docs/mockup/ptit-login/ptit-role-select.html.
export function OrbitRoleSelect() {
    const navigate = useNavigate()
    // Thẻ vừa bấm được nhấn mạnh, thẻ còn lại mờ đi trong lúc màn đỏ lan ra từ thẻ đó
    const [picked, setPicked] = useState<Role | null>(null)

    return (
        <section className="rs" aria-labelledby="rs-h1">
            <header className="rs-top">
                <img src={LOCKUP_URL} alt="Học viện Công nghệ Bưu chính Viễn thông" />
            </header>
            <div className="rs-left">
                <h1 id="rs-h1" className="rs-h1">
                    Nền tảng học tập <em>thông minh</em>
                </h1>
                <p className="rs-lead">Bài giảng, trợ giảng AI, quiz củng cố, bài đọc mỗi ngày và studio thực hành của Học viện trong một nơi.</p>
                <div className={`rs-roles ${picked ? 'dim' : ''}`}>
                    {ROLES.map(({ role, title, description, icon: Icon }) => (
                        <button
                            key={role}
                            type="button"
                            data-role={role}
                            disabled={picked !== null}
                            onClick={(e) => {
                                setPicked(role)
                                void enterRole(role, { origin: centerOf(e.currentTarget), navigate })
                            }}
                            className={`rs-role ${picked === role ? 'picked' : ''}`}
                        >
                            <span className="rs-row1">
                                <span className="rs-ic">
                                    <Icon size={26} strokeWidth={2} />
                                </span>
                                <span className="rs-arr" aria-hidden="true">
                                    <ArrowRight size={20} strokeWidth={2.4} />
                                </span>
                            </span>
                            <b>{title}</b>
                            <p>{description}</p>
                        </button>
                    ))}
                </div>
            </div>
            <RoleArt />
            <GhostLogo />
        </section>
    )
}
