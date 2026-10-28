import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { courses, lessons } from '@/data'
import { scrollToSection } from '@/lib/scroll'
import { useOrbitStore } from '@/store/useOrbitStore'
import { FACULTY_LOGO_URL, LOGO_URL } from '@/lib/brand'

const REPO_URL = 'https://github.com/Giaphu-max/orbit-ptitlearninghub'
const PTIT_URL = 'https://ptit.edu.vn'

interface FooterLink {
    label: string
    to: string
    external?: boolean
}

/** Footer kiểu LMS PTIT: nền đỏ đậm (token --footer-bg), hàng trên = logo + tên Học viện + logo khoa | nhóm link, hàng dưới căn giữa = thông tin sản phẩm dự thi. Dùng chung cho mọi trang và tấm trượt của trang chủ. */
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

    const linkClass = 'text-sm text-ink-foreground/80 transition hover:text-ink-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70'

    return (
        <footer className="mt-16 bg-footer text-ink-foreground">
            <div className="container-wide py-10 lg:py-12">
                <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-8 border-b border-ink-foreground/[0.18] pb-9">
                    <div className="flex items-center gap-4">
                        <Link to="/" aria-label="PTIT, trang chủ" className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
                            <img src={LOGO_URL} alt="" className="h-[38px] w-[38px] object-contain" />
                        </Link>
                        <div>
                            <b className="block text-[15px] font-extrabold uppercase tracking-[0.02em]">Học viện Công nghệ Bưu chính Viễn thông</b>
                            <span className="mt-1 block text-[12.5px] text-ink-foreground/80">Posts and Telecommunications Institute of Technology</span>
                        </div>
                        <span aria-hidden className="mx-2 hidden h-9 w-px bg-ink-foreground/[0.18] lg:block" />
                        <span className="hidden rounded-xl bg-ink-foreground px-3 py-1.5 lg:block">
                            <img src={FACULTY_LOGO_URL} alt="Khoa Đa phương tiện" className="h-9 w-auto" loading="lazy" />
                        </span>
                    </div>
                    <div className="flex gap-14">
                        {groups.map((g) => (
                            <nav key={g.title} aria-label={g.title}>
                                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-foreground">{g.title}</h2>
                                <ul className="mt-3.5 flex flex-col gap-2.5">
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
                <p className="pt-6 text-center text-sm text-ink-foreground/80">Sản phẩm dự thi Ứng dụng AI trong giảng dạy 2026 · Công đoàn Học viện Công nghệ Bưu chính Viễn thông</p>
            </div>
        </footer>
    )
}
