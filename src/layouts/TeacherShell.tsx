import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FileText, Repeat, RotateCcw } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { RewardOverlay } from '@/components/reward-overlay'
import { TEACHER_PROFILE } from '@/data/teacher-profile'
import { LOGO_URL } from '@/lib/brand'
import { centerOf, enterRole } from '@/lib/role-switch'
import { useKb } from '@/lib/kb/store'
import { useLibrary } from '@/lib/library'
import { useOrbitStore } from '@/store/useOrbitStore'

const NAV = [{ label: 'Kho tài liệu', to: '/teacher', icon: FileText, match: (p: string) => p.startsWith('/teacher') }]

const navItem = 'flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600'

/**
 * Khung riêng của vai giảng viên (kiểu cổng quản lý đào tạo): thanh trên 64px, thanh bên 248px, không footer, không nav sinh viên.
 * Mọi route của giảng viên ("/" và /teacher/*) nằm trong khung này; route của sinh viên đưa về Tổng quan.
 */
export function TeacherShell() {
    const { pathname } = useLocation()
    const resetDemo = useOrbitStore((s) => s.resetDemo)
    const sourceCount = useLibrary().total
    useEffect(() => void useKb.getState().load(), [])

    // Giảng viên chỉ có một trang: Kho tài liệu. Mọi đường dẫn cũ (kể cả "/") về /teacher
    if (pathname !== '/teacher') return <Navigate to="/teacher" replace />

    return (
        <div className="relative isolate min-h-[100svh] bg-surface font-sans text-foreground">
            {/* Cùng nền với trang sinh viên (MainLayout): nền surface + ba quầng hồng nhạt */}
            <div aria-hidden className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
                <div className="absolute right-[-5%] top-[-10%] h-[600px] w-[600px] rounded-full bg-brand-200/40 blur-[120px]" />
                <div className="absolute left-[-10%] top-[40%] h-[500px] w-[500px] rounded-full bg-brand-100/50 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[10%] h-[400px] w-[400px] rounded-full bg-brand-100/40 blur-[100px]" />
            </div>
            <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-6 border-b border-border/80 bg-card/70 px-6 backdrop-blur-xl">
                <Link to="/teacher" className="flex w-56 items-center gap-3" aria-label="PTIT · Cổng giảng viên">
                    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-border bg-card">
                        {LOGO_URL ? <img src={LOGO_URL} alt="" className="w-[76%]" /> : <b className="text-xs font-black text-brand-ink">PTIT</b>}
                    </span>
                    <span>
                        <b className="block text-lg font-black leading-none text-brand-ink">PTIT</b>
                        <small className="mt-0.5 block text-xs text-muted-foreground">Cổng giảng viên</small>
                    </span>
                </Link>
                <div className="ml-auto flex items-center gap-3">
                    <AccountMenu />
                </div>
            </header>

            <aside className="fixed bottom-0 left-0 top-16 z-20 flex w-[248px] flex-col justify-between border-r border-border/80 bg-card/55 px-3 py-4 backdrop-blur-xl max-lg:hidden">
                <nav aria-label="Điều hướng giảng viên">
                    
                    <ul className="flex flex-col gap-0.5">
                        {NAV.map(({ label, to, icon: Icon, match }) => {
                            const on = match(pathname)
                            return (
                                <li key={to}>
                                    <NavLink to={to} aria-current={on ? 'page' : undefined} className={`${navItem} ${on ? 'bg-brand-50 font-bold text-brand-ink' : 'font-medium text-foreground hover:bg-muted'}`}>
                                        <Icon size={19} aria-hidden />
                                        {label}
                                        <em className="ml-auto font-mono text-[11px] font-bold not-italic text-muted-foreground">{sourceCount}</em>
                                    </NavLink>
                                </li>
                            )
                        })}
                    </ul>
                </nav>
                <div className="border-t border-border pt-2.5">
                    <button
                        type="button"
                        onClick={() => window.confirm('Xóa toàn bộ XP, tiến độ và kho tài liệu đã tải lên trên trình duyệt này?') && resetDemo()}
                        className={`${navItem} text-sm font-medium text-muted-foreground hover:bg-muted`}
                    >
                        <RotateCcw size={18} aria-hidden /> Đặt lại dữ liệu demo
                    </button>
                    <small className="block px-3 pt-1.5 text-[11.5px] leading-snug text-muted-foreground">Trợ giảng AI chỉ trả lời bằng kiến thức có trong tài liệu và video thầy cô tải lên.</small>
                </div>
            </aside>

            <main className="min-h-[100svh] min-w-0 overflow-x-clip pt-16 lg:ml-[248px]">
                <div className="min-w-0 p-7">
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
