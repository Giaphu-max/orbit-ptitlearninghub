import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { courses, lessons } from '@/data'
import { scrollToSection } from '@/lib/scroll'
import { useOrbitStore } from '@/store/useOrbitStore'
import { BrandLogo } from '@/components/brand-logo'

const REPO_URL = 'https://github.com/Giaphu-max/orbit-ptitlearninghub'
const PTIT_URL = 'https://ptit.edu.vn'

interface FooterLink {
    label: string
    to: string
    external?: boolean
}

/** Footer: logo, mô tả ngắn, nhóm link và thông tin sản phẩm dự thi. Chỉ dùng token màu nên đúng cả sáng và tối. */
export function SiteFooter() {
    const role = useOrbitStore((s) => s.role)
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const firstCourse = courses[0]

    const groups: { title: string; links: FooterLink[] }[] = [
        {
            title: 'Học tập',
            links: [
                { label: 'Bài đọc hôm nay', to: '/today' },
                { label: 'Khóa học', to: '/learning' },
                ...(firstCourse ? [{ label: 'Test cuối chương', to: `/test/${firstCourse.id}` }] : []),
                { label: 'Hành trình', to: '/journey' },
            ],
        },
        {
            title: 'Công cụ',
            links: [
                { label: 'Studio 3D', to: '/studio' },
                { label: 'Trợ giảng AI', to: lessons[0] ? `/lesson/${lessons[0].id}` : '/learning' },
                ...(role === 'teacher' ? [{ label: 'Trang giảng viên', to: '/teacher' }] : []),
            ],
        },
        {
            title: 'Về dự án',
            links: [
                { label: 'Mã nguồn', to: REPO_URL, external: true },
                { label: 'Học viện PTIT', to: PTIT_URL, external: true },
            ],
        },
    ]

    // Đang ở trang chủ thì bấm link phần trên trang chủ cuộn mượt, không tải lại
    const onLink = (e: MouseEvent, to: string) => {
        if (pathname !== '/' || !to.startsWith('/#')) return
        e.preventDefault()
        scrollToSection(to.slice(2))
        navigate(to, { replace: true, preventScrollReset: true })
    }

    const linkClass = 'text-sm text-muted-foreground transition hover:text-foreground hover:underline underline-offset-4'

    return (
        <footer className="mt-8 border-t border-border bg-card">
            <div className="container-page py-12 lg:py-14">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                    <div>
                        <Link to="/" className="inline-flex items-center gap-3" aria-label="PTIT, trang chủ">
                            <BrandLogo />
                            <span className="text-xl font-black tracking-tight text-brand-ink">PTIT</span>
                        </Link>
                        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                            Nền tảng học tập có điểm dừng cho sinh viên PTIT: trợ giảng AI bám bài giảng thật, bài đọc ngắn mỗi ngày và phần thưởng gắn với việc hiểu bài.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:contents">
                    {groups.map((g) => (
                        <nav key={g.title} aria-label={g.title}>
                            <h2 className="text-eyebrow uppercase text-foreground">{g.title}</h2>
                            <ul className="mt-4 flex flex-col gap-2.5">
                                {g.links.map((l) => (
                                    <li key={l.label}>
                                        {l.external ? (
                                            <a href={l.to} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                                {l.label}
                                            </a>
                                        ) : (
                                            <Link to={l.to} onClick={(e) => onLink(e, l.to)} className={linkClass}>
                                                {l.label}
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}
                    </div>
                </div>

                <div className="mt-12 flex flex-col gap-1.5 border-t border-border pt-6 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Sản phẩm dự thi Ứng dụng AI trong giảng dạy 2026 · Công đoàn Học viện Công nghệ Bưu chính Viễn thông</p>
                    <p>Giảng viên đứng tên: ThS. Nguyễn Cảnh Châu</p>
                    <p>Nhóm thực hiện: Nguyễn Gia Phú, Trương Thanh Hà, Nguyễn Hoàng Hiếu</p>
                    <p>Nội dung AI được giảng viên duyệt trước khi hiển thị</p>
                </div>
            </div>
        </footer>
    )
}
