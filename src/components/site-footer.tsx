import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { courses, lessons } from '@/data'
import { scrollToSection } from '@/lib/scroll'
import { useOrbitStore } from '@/store/useOrbitStore'
import { BrandLogo } from '@/components/brand-logo'
import { FACULTY_LOGO_URL } from '@/lib/brand'

const PTIT_URL = 'https://ptit.edu.vn'

interface FooterLink {
    label: string
    to: string
    external?: boolean
}

/** Footer đỏ thương hiệu PTIT: logo, mô tả ngắn, nhóm link và thông tin sản phẩm dự thi. Dùng chung cho mọi trang và tấm trượt của trang chủ. */
export function SiteFooter() {
    const role = useOrbitStore((s) => s.role)
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const firstCourse = courses[0]

    const groups: { title: string; links: FooterLink[] }[] = [
        {
            title: 'Học tập',
            links: [
                { label: 'Ôn tập', to: '/today' },
                { label: 'Học phần', to: '/learning' },
                ...(firstCourse ? [{ label: 'Test cuối chương', to: `/test/${firstCourse.id}` }] : []),
                { label: 'Tiến độ & Kỹ năng', to: '/journey' },
            ],
        },
        {
            title: 'Công cụ',
            links: [
                { label: 'Phòng Lab 3D', to: '/studio' },
                { label: 'Trợ giảng AI', to: lessons[0] ? `/lesson/${lessons[0].id}` : '/learning' },
                ...(role === 'teacher' ? [{ label: 'Trang giảng viên', to: '/teacher' }] : []),
            ],
        },
        {
            title: 'Về dự án',
            links: [
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

    const linkClass = 'text-sm text-ink-foreground/85 transition hover:text-ink-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70'

    return (
        <footer className={`bg-footer text-ink-foreground ${pathname === '/' ? 'mt-0' : 'mt-16'}`}>
            <div className="container-wide py-12 lg:py-14">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Link to="/" className="inline-flex items-center gap-3 align-middle rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70" aria-label="PTIT, trang chủ">
                                <BrandLogo />
                                <span className="text-xl font-black tracking-tight text-ink-foreground">PTIT</span>
                            </Link>
                            <span aria-hidden className="mx-1 hidden h-7 w-px bg-ink-foreground/[0.18] sm:inline-block" />
                            <span className="inline-flex items-center rounded-xl bg-ink-foreground px-2.5 py-1.5 shadow-sm">
                                <img src={FACULTY_LOGO_URL} alt="Khoa Đa phương tiện" className="h-8 w-auto object-contain" loading="lazy" />
                            </span>
                        </div>
                        <div className="mt-3.5">
                            <b className="block text-[14px] font-extrabold uppercase tracking-[0.02em] text-ink-foreground">
                                Học viện Công nghệ Bưu chính Viễn thông
                            </b>
                            <span className="mt-0.5 block text-xs text-ink-foreground/80">
                                Posts and Telecommunications Institute of Technology
                            </span>
                        </div>
                        <p className="mt-3.5 max-w-sm text-sm leading-relaxed text-ink-foreground/80">
                            Nền tảng học tập có điểm dừng cho sinh viên PTIT: trợ giảng AI bám bài giảng thật, bài đọc ngắn mỗi ngày và phần thưởng gắn với việc hiểu bài.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:contents">
                        {groups.map((g) => (
                            <nav key={g.title} aria-label={g.title}>
                                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-foreground">{g.title}</h2>
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

                <div className="mt-12 flex flex-col gap-1.5 border-t border-ink-foreground/[0.18] pt-6 text-sm text-ink-foreground/80 text-left">
                    <p className="font-semibold text-ink-foreground">Sản phẩm dự thi Ứng dụng AI trong giảng dạy 2026 · Công đoàn Học viện Công nghệ Bưu chính Viễn thông</p>
                    <p>Giảng viên đứng tên: ThS. Nguyễn Cảnh Châu</p>
                    <p>Nhóm thực hiện: Nguyễn Gia Phú, Trương Thanh Hà, Nguyễn Hoàng Hiếu</p>
                    <p>Nội dung AI được giảng viên duyệt trước khi hiển thị</p>
                </div>
            </div>
        </footer>
    )
}
