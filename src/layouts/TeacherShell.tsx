import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, Home, PlayCircle, Plus, Repeat, RotateCcw } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { AddLessonsDialog } from '@/components/teacher/add-lessons-dialog'
import { useAddDialog } from '@/components/teacher/add-dialog-state'
import { RewardOverlay } from '@/components/reward-overlay'
import { TEACHER_PROFILE } from '@/data/teacher-notes'
import { LOGO_URL } from '@/lib/brand'
import { centerOf, enterRole } from '@/lib/role-switch'
import { useLessonReviews } from '@/lib/teacher'
import { useOrbitStore } from '@/store/useOrbitStore'

const NAV = [
    { label: 'Tổng quan', to: '/', icon: Home, match: (p: string) => p === '/' },
    { label: 'Bài giảng', to: '/teacher/library', icon: PlayCircle, match: (p: string) => p.startsWith('/teacher/library') || p.startsWith('/teacher/review') },
    { label: 'Lớp học', to: '/teacher/class', icon: BarChart3, match: (p: string) => p.startsWith('/teacher/class') },
]

const navItem = 'flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600'

/**
 * Khung riêng của vai giảng viên (kiểu cổng quản lý đào tạo): thanh trên 64px, thanh bên 248px, không footer, không nav sinh viên.
 * Mọi route của giảng viên ("/" và /teacher/*) nằm trong khung này; route của sinh viên đưa về Tổng quan.
 */
export function TeacherShell() {
    const { pathname } = useLocation()
    const showAdd = useAddDialog((s) => s.show)
    const addOpen = useAddDialog((s) => s.open)
    const hideAdd = useAddDialog((s) => s.hide)
    const resetDemo = useOrbitStore((s) => s.resetDemo)
    const reviews = useLessonReviews()
    const pending = reviews.filter((r) => r.state === 'wait' || r.state === 'editing').length

    if (pathname !== '/' && !pathname.startsWith('/teacher')) return <Navigate to="/" replace />

    return (
        <div className="relative min-h-[100svh] bg-muted font-sans text-foreground">
            <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-6 border-b border-border bg-card px-6">
                <Link to="/" className="flex w-56 items-center gap-3" aria-label="PTIT · Cổng giảng viên">
                    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-border bg-card">
                        {LOGO_URL ? <img src={LOGO_URL} alt="" className="w-[76%]" /> : <b className="text-xs font-black text-brand-ink">PTIT</b>}
                    </span>
                    <span>
                        <b className="block text-lg font-black leading-none text-brand-ink">PTIT</b>
                        <small className="mt-0.5 block text-xs text-muted-foreground">Cổng giảng viên · Orbit</small>
                    </span>
                </Link>
                <div className="ml-auto flex items-center gap-3">
                    <Link to="/teacher/library" title="Thông báo" aria-label={`Thông báo: ${pending} bài chờ duyệt`} className="relative flex h-10 w-10 items-center justify-center rounded-[10px] text-foreground transition hover:bg-muted">
                        <Bell size={20} aria-hidden />
                        {pending > 0 && (
                            <i className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 font-mono text-[10px] font-bold not-italic text-ink-foreground">{pending}</i>
                        )}
                    </Link>
                    <AccountMenu />
                </div>
            </header>

            <aside className="fixed bottom-0 left-0 top-16 z-20 flex w-[248px] flex-col justify-between border-r border-border bg-card px-3 py-4 max-lg:hidden">
                <nav aria-label="Điều hướng giảng viên">
                    <p className="mx-3 mb-1.5 mt-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Giảng dạy</p>
                    <ul className="flex flex-col gap-0.5">
                        {NAV.map(({ label, to, icon: Icon, match }) => {
                            const on = match(pathname)
                            return (
                                <li key={to}>
                                    <NavLink to={to} aria-current={on ? 'page' : undefined} className={`${navItem} ${on ? 'bg-brand-50 font-bold text-brand-ink' : 'font-medium text-foreground hover:bg-muted'}`}>
                                        <Icon size={19} aria-hidden />
                                        {label}
                                        {label === 'Bài giảng' && pending > 0 && (
                                            <em className="ml-auto rounded-full bg-brand-600 px-[7px] py-0.5 font-mono text-[11px] font-bold not-italic text-ink-foreground">{pending}</em>
                                        )}
                                    </NavLink>
                                </li>
                            )
                        })}
                    </ul>
                    <p className="mx-3 mb-1.5 mt-5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Công cụ</p>
                    <button type="button" onClick={() => showAdd()} className={`${navItem} font-medium text-foreground hover:bg-muted`}>
                        <Plus size={19} aria-hidden /> Thêm từ YouTube
                    </button>
                </nav>
                <div className="border-t border-border pt-2.5">
                    <button
                        type="button"
                        onClick={() => window.confirm('Xóa toàn bộ XP, tiến độ, bài vừa thêm và nội dung đã duyệt trên trình duyệt này?') && resetDemo()}
                        className={`${navItem} text-sm font-medium text-muted-foreground hover:bg-muted`}
                    >
                        <RotateCcw size={18} aria-hidden /> Đặt lại dữ liệu demo
                    </button>
                    <small className="block px-3 pt-1.5 text-[11.5px] leading-snug text-muted-foreground">Sản phẩm dự thi Ứng dụng AI trong giảng dạy 2026</small>
                </div>
            </aside>

            <main className="min-h-[100svh] pt-16 lg:ml-[248px]">
                <div className="p-7">
                    <Suspense
                        fallback={
                            <div className="flex items-center justify-center py-32 text-muted-foreground">
                                <Loader2 className="animate-spin" size={32} aria-label="Đang tải trang" />
                            </div>
                        }
                    >
                        <Outlet />
                    </Suspense>
                </div>
            </main>
            {addOpen && <AddLessonsDialog courseId={addOpen.courseId} onClose={hideAdd} />}
            <RewardOverlay />
        </div>
    )
}

function AccountMenu() {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])
    return (
        <div ref={ref} className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex items-center gap-2.5 rounded-[10px] py-1 pl-1.5 pr-2 text-left transition hover:bg-muted">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-strong font-extrabold text-background">{TEACHER_PROFILE.name[0]}</span>
                <span className="max-md:hidden">
                    <b className="block text-sm text-strong">{TEACHER_PROFILE.fullName}</b>
                    <small className="block text-xs text-muted-foreground">Giảng viên · Khoa Đa phương tiện</small>
                </span>
            </button>
            {open && (
                <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 w-64 rounded-[14px] border border-border bg-card p-1.5 shadow-raised">
                    <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                            const origin = centerOf(e.currentTarget)
                            setOpen(false)
                            void enterRole('student', { origin, navigate })
                        }}
                        className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted"
                    >
                        <Repeat size={16} aria-hidden /> Chuyển sang vai sinh viên
                    </button>
                </div>
            )}
        </div>
    )
}
