import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { courses, lessons } from '@/data'
import { scrollToSection } from '@/lib/scroll'
import { useOrbitStore } from '@/store/useOrbitStore'
import { LOCKUP_URL } from '@/lib/brand'

const PTIT_URL = 'https://ptit.edu.vn'

interface FooterLink {
    label: string
    to: string
    external?: boolean
}

/** Footer đỏ thương hiệu PTIT: lockup chính thức đơn sắc trắng, mô tả ngắn, nhóm link và thông tin sản phẩm dự thi. Dùng chung cho mọi trang và tấm trượt của trang chủ. */
export function SiteFooter() {
    const role = useOrbitStore((s) => s.role)
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const firstCourse = courses[0]

    const teacherGroup: { title: string; links: FooterLink[] }[] = [
        {
            title: 'Giảng viên',
            links: [
                { label: 'Tổng quan', to: '/' },
                { label: 'Duyệt nội dung', to: '/teacher/review' },
                { label: 'Lớp học', to: '/teacher/class' },
            ],
        },
    ]
    const studentGroups: { title: string; links: FooterLink[] }[] = [
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
                { label: 'Studio 3D', to: '/studio' },
                { label: 'Trợ giảng AI', to: lessons[0] ? `/lesson/${lessons[0].id}` : '/learning' },
            ],
        },
    ]
    const aboutGroup: { title: string; links: FooterLink[] }[] = [
        {
            title: 'Về dự án',
            links: [
                { label: 'Học viện PTIT', to: PTIT_URL, external: true },
            ],
        },
    ]
    const groups = [...(role === 'teacher' ? teacherGroup : studentGroups), ...aboutGroup]

    // Đang ở trang chủ thì bấm link phần trên trang chủ cuộn mượt, không tải lại
    const onLink = (e: MouseEvent, to: string) => {
        if (pathname !== '/' || !to.startsWith('/#')) return
        e.preventDefault()
        scrollToSection(to.slice(2))
        navigate(to, { replace: true, preventScrollReset: true })
    }

    const linkClass = 'text-sm text-ink-foreground/85 transition hover:text-ink-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70'

    return (
        <footer className={`bg-footer text-ink-foreground ${pathname === '/' && role !== 'teacher' ? 'mt-0' : 'mt-16'}`}>
            <div className="container-wide py-12 lg:py-14">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                    <div>
                        <Link
                            to="/"
                            className="inline-block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70"
                            aria-label="Học viện Công nghệ Bưu chính Viễn thông"
                        >
                            <img
                                src={LOCKUP_URL}
                                alt="Học viện Công nghệ Bưu chính Viễn thông"
                                className="h-[56px] w-auto object-contain [filter:brightness(0)_invert(1)]"
                            />
                        </Link>
                        <p className="mt-5 max-w-[44ch] text-[14px] leading-relaxed text-ink-foreground/85">
                            Học theo đúng bài giảng của thầy cô, hỏi trợ giảng AI ngay khi chưa hiểu và ôn lại phần còn hổng mỗi ngày.
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
                    <p>Nhóm thực hiện: Nguyễn Gia Phú, Trương Thanh Hà</p>
                    <p>
                        Liên hệ:{' '}
                        <a href="tel:0941836219" className="hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-foreground/70">
                            0941 836 219
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    )
}
