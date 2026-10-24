import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Play, RotateCcw, Repeat, Volume2, VolumeX, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { StreakFlame } from '@/components/streak-flame'
import { ThemeToggle } from '@/components/theme-toggle'
import { XpChip } from '@/components/xp-chip'
import { FLAGS } from '@/lib/perf'
import { visibleStreak } from '@/lib/gamification'
import { resumeLesson } from '@/lib/next-step'
import { centerOf, enterRole } from '@/lib/role-switch'
import { getJourneyChapter, scrollToSection, subscribeChapter } from '@/lib/scroll'
import { useSoundStore } from '@/lib/sfx'
import { useOrbitStore, type Role } from '@/store/useOrbitStore'

export type NavTone = 'hero' | 'plain'

interface NavItem {
    label: string
    to: string
    /** id phần trên trang chủ mà mục này cuộn tới */
    section?: string
    /** Mục đang chọn khi ở các trang khác trang chủ */
    match: (pathname: string) => boolean
    /** Mục của trang giảng viên (?tab=) */
    tab?: 'review' | 'stats' | 'tests'
}

const BASE_ITEMS: NavItem[] = [
    { label: 'Trang chủ', to: '/', section: 'top', match: (p) => p === '/' },
    { label: 'Hôm nay', to: '/today', match: (p) => p.startsWith('/today') || p.startsWith('/daily') },
    { label: 'Khóa học', to: '/learning', match: (p) => p === '/learning' || p.startsWith('/lesson') || p.startsWith('/test') || p.startsWith('/checkpoint') || p.startsWith('/recap') },
    { label: 'Studio 3D', to: '/studio', match: (p) => p.startsWith('/studio') },
]

// Giảng viên: nav dẫn tới các mục của trang giảng viên (?tab=) thay cho các phần học tập của sinh viên
const teacherTab = (tab: string | null, id: 'review' | 'stats' | 'tests') => (id === 'review' ? tab !== 'stats' && tab !== 'tests' : tab === id)
const TEACHER_ITEMS: NavItem[] = [
    { label: 'Trang chủ', to: '/', section: 'top', match: (p) => p === '/' },
    { label: 'Duyệt nội dung', to: '/teacher', match: () => false, tab: 'review' },
    { label: 'Thống kê lớp', to: '/teacher?tab=stats', match: () => false, tab: 'stats' },
    { label: 'Kết quả test', to: '/teacher?tab=tests', match: () => false, tab: 'tests' },
    { label: 'Khóa học', to: '/learning', match: (p) => p === '/learning' },
]

/** Trang thường: đã cuộn quá 60px (một listener scroll passive + rAF, không đọc layout). */
function useScrolledPast(enabled: boolean, px: number) {
    const [past, setPast] = useState(false)
    useEffect(() => {
        if (!enabled) {
            setPast(false)
            return
        }
        let raf = 0
        const check = () => setPast(window.scrollY > px)
        const onScroll = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(check)
        }
        check()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('scroll', onScroll)
        }
    }, [enabled, px])
    return enabled && past
}

/** Màn hẹp (<860px): nav luôn là viên kính thu gọn. */
function useNarrow() {
    const query = '(max-width: 859px)'
    return useSyncExternalStore(
        (cb) => {
            const m = window.matchMedia(query)
            m.addEventListener('change', cb)
            return () => m.removeEventListener('change', cb)
        },
        () => window.matchMedia(query).matches,
        () => false,
    )
}

const initials = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'OR'

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'

/**
 * Thanh điều hướng biến hình. Đầu trang: full-width trong suốt (logo, mục ngang, chip streak/XP, theme, avatar).
 * Thu gọn: viên kính giữa trên cùng (Học tiếp · logo PTIT · Menu + avatar) và panel kính xổ xuống.
 * Điều kiện thu gọn: trang thường cuộn >60px; trang chủ paged (không cuộn tài liệu) khi chương ≥ 1; màn <860px luôn thu gọn.
 */
export function TopNav() {
    const { pathname, hash, search } = useLocation()
    const [menuOpen, setMenuOpen] = useState(false)
    const onHome = pathname === '/'
    const chapter = useSyncExternalStore(subscribeChapter, getJourneyChapter)
    // Trang chủ hành trình: chỉ đọc chương đã chốt (không đọc scrollY); các trang khác và trang chủ giảm chuyển động (chapter = -1) đọc scrollY
    const scrolled = useScrolledPast(!onHome || chapter < 0, 60)
    const narrow = useNarrow()
    const collapsed = narrow || (onHome && chapter >= 0 ? chapter >= 1 : scrolled)
    const tabParam = new URLSearchParams(search).get('tab')
    const isActive = (it: NavItem) => (it.tab ? pathname === '/teacher' && teacherTab(tabParam, it.tab) : it.match(pathname))
    const goTo = (e: ReactMouseEvent, it: NavItem) => {
        setMenuOpen(false)
        if (!onHome || !it.section) return
        e.preventDefault()
        scrollToSection(it.section)
    }
    // Logo luôn về chương 0 của trang chủ: đang ở trang chủ thì nhảy chương (kiểu cắt khi cách ≥2 chương, do useScrollStage lo), trang khác thì navigate('/')
    const goHome = (e: ReactMouseEvent) => {
        setMenuOpen(false)
        if (!onHome) return
        e.preventDefault()
        scrollToSection('top')
    }
    const role = useOrbitStore((s) => s.role)
    const streakState = useOrbitStore((s) => s.streak)
    useOrbitStore((s) => s.lessonProgress)
    const resume = role === 'teacher' ? undefined : resumeLesson()

    const items = role === 'teacher' ? TEACHER_ITEMS : BASE_ITEMS
    const streak = visibleStreak(streakState).count

    const rootRef = useRef<HTMLDivElement>(null)
    const menuBtn = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    const closeMenu = useCallback((refocus = false) => {
        setMenuOpen(false)
        if (refocus) menuBtn.current?.focus()
    }, [])

    // Đóng menu khi đổi trang hoặc khi nav trở về dạng rộng
    useEffect(() => setMenuOpen(false), [pathname, hash])
    useEffect(() => {
        if (!collapsed) setMenuOpen(false)
    }, [collapsed])

    // Menu mở: Esc / bấm ra ngoài đóng; Tab xoay vòng trong panel; vào panel thì focus mục đầu tiên
    useEffect(() => {
        if (!menuOpen) return
        const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && closeMenu()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') return closeMenu(true)
            if (e.key !== 'Tab' || !panelRef.current) return
            const els = [menuBtn.current, ...Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))].filter((el): el is HTMLElement => !!el)
            const first = els[0]
            const last = els[els.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus()
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [menuOpen, closeMenu])

    // Giảng viên không có chuỗi ngày/XP
    const chips = role === 'teacher' ? null : (
        <>
            <Link
                to="/journey"
                title={`Chuỗi ${streak} ngày học`}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold transition duration-fast hover:border-brand-300 ${
                    streak > 0 ? 'ptit-streak-chip' : 'border border-border bg-card text-foreground'
                }`}
            >
                <StreakFlame lit={streak > 0} />
                Chuỗi {streak} ngày
            </Link>
            <XpChip className="ptit-xp-badge inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold transition-colors duration-fast" />
        </>
    )

    const state = collapsed ? 'pill' : 'wide'
    const linkCls = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'
    const name = useOrbitStore((s) => s.learnerName)

    return (
        <header
            style={{ viewTransitionName: 'site-nav' }}
            data-nav={state}
            className={`own-layer pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center text-foreground ${onHome ? 'nav-over-3d' : ''}`}
        >
            <div ref={rootRef} className="nav-shell pointer-events-auto" data-state={state}>
                {/* Đường ribbon mảnh 2px (bộ màu logo khoa) dưới viên kính thu gọn: điểm nhấn chữ ký */}
                <div aria-hidden className={`mm-ribbon-bg pointer-events-none absolute inset-x-8 -bottom-[3px] h-[2px] rounded-full transition-opacity duration-300 ${collapsed ? 'opacity-100' : 'opacity-0'}`} />
                {/* Nền kính của viên thu gọn: mờ vào/ra theo trạng thái */}
                <div aria-hidden className={`ptit-glass-navbar-pill absolute inset-0 transition-opacity duration-300 ${collapsed ? 'opacity-100' : 'opacity-0'}`} />

                {/* Dạng rộng */}
                <div className="nav-layer nav-layer-wide gap-4 px-10 lg:gap-6">
                    <Link to="/" onClick={goHome} className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70" aria-label="PTIT, trang chủ" tabIndex={collapsed ? -1 : 0}>
                        <BrandLogo />
                        <span className="leading-tight">
                            <span className="block text-xl font-black leading-none tracking-tight text-brand-ink">PTIT</span>
                            <span className="mt-1 hidden whitespace-nowrap text-[11px] text-muted-foreground xl:block">Học viện Công nghệ BCVT</span>
                        </span>
                    </Link>
                    <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
                        {items.map((it) => (
                            <Link
                                key={it.label}
                                to={it.to}
                                tabIndex={collapsed ? -1 : 0}
                                onClick={(e) => goTo(e, it)}
                                aria-current={isActive(it) ? (onHome ? 'location' : 'page') : undefined}
                                className={`${linkCls} ${isActive(it) ? 'bg-brand-50 font-semibold text-brand-ink' : 'font-medium text-muted-foreground hover:text-foreground'}`}
                            >
                                {it.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="ml-auto flex items-center gap-2.5">
                        {chips}
                        {FLAGS.darkMode && <ThemeToggle tone="hero" />}
                        <AccountMenu />
                    </div>
                </div>

                {/* Dạng viên kính thu gọn */}
                <div className="nav-layer nav-layer-pill justify-between gap-2 px-3 pl-3.5">
                    {resume ? (
                        <Link
                            to={`/lesson/${resume.id}`}
                            tabIndex={collapsed ? 0 : -1}
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-50 px-3.5 py-2 text-[13px] font-semibold text-brand-ink transition duration-fast hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                        >
                            <Play size={13} className="fill-current" aria-hidden /> Học tiếp
                        </Link>
                    ) : (
                        <span className="w-2 shrink-0" />
                    )}
                    <Link to="/" onClick={goHome} tabIndex={collapsed ? 0 : -1} aria-label="PTIT, trang chủ" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                        <BrandLogo className="!h-8 !w-8 !rounded-lg" />
                        <span className="text-lg font-black leading-none tracking-tight text-brand-ink">PTIT</span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            ref={menuBtn}
                            type="button"
                            tabIndex={collapsed ? 0 : -1}
                            aria-expanded={menuOpen}
                            aria-haspopup="true"
                            aria-controls="nav-menu-panel"
                            onClick={() => setMenuOpen((v) => !v)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold text-foreground transition duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                        >
                            Menu {menuOpen ? <X size={15} aria-hidden /> : <Menu size={15} aria-hidden />}
                        </button>
                        <span aria-hidden className="flex aspect-square h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-extrabold text-background">
                            {initials(name)}
                        </span>
                    </div>
                </div>

                {/* Panel kính xổ xuống ngay dưới viên kính */}
                {collapsed && menuOpen && (
                    <div
                        ref={panelRef}
                        id="nav-menu-panel"
                        role="dialog"
                        aria-label="Menu điều hướng"
                        className="nav-menu-panel ptit-glass-card absolute inset-x-0 top-full mt-2 max-h-[calc(100svh-96px)] overflow-y-auto p-4 text-foreground"
                    >
                        <nav aria-label="Điều hướng chính (menu)" className="flex flex-col">
                            {items.map((it) => (
                                <Link
                                    key={it.label}
                                    to={it.to}
                                    onClick={(e) => goTo(e, it)}
                                    aria-current={isActive(it) ? (onHome ? 'location' : 'page') : undefined}
                                    className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${isActive(it) ? 'bg-brand-50 text-brand-ink' : 'text-foreground hover:bg-muted'}`}
                                >
                                    {it.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                            {chips}
                            {FLAGS.darkMode && <ThemeToggle tone="plain" className="relative ml-auto" />}
                        </div>
                        <div className="mt-3 border-t border-border pt-3">
                            <AccountPanel onClose={() => closeMenu()} />
                        </div>
                    </div>
                )}
            </div>
        </header>
    )
}

/** Avatar + menu tài khoản giả lập (đổi tên, đổi vai trò, đặt lại demo). */
function AccountMenu() {
    const name = useOrbitStore((s) => s.learnerName)
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                aria-label={`Tài khoản của ${name}`}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={`flex aspect-square h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold shadow-card transition duration-fast hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 bg-foreground text-background`}
            >
                {initials(name)}
            </button>
            {open && (
                <div className="absolute right-0 top-full z-50 mt-3 w-72 rounded-card border border-border bg-card p-4 text-foreground shadow-raised">
                    <AccountPanel onClose={() => setOpen(false)} />
                </div>
            )}
        </div>
    )
}

function AccountPanel({ onClose }: { onClose?: () => void }) {
    const role = useOrbitStore((s) => s.role)
    const name = useOrbitStore((s) => s.learnerName)
    const setName = useOrbitStore((s) => s.setLearnerName)
    const resetDemo = useOrbitStore((s) => s.resetDemo)
    const soundOn = useSoundStore((s) => s.enabled)
    const setSoundOn = useSoundStore((s) => s.setEnabled)
    const navigate = useNavigate()
    const [draft, setDraft] = useState(name)
    const other: Role = role === 'teacher' ? 'student' : 'teacher'

    return (
        <div className="flex flex-col gap-3">
            <div>
                <label htmlFor="learner-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tên hiển thị
                </label>
                <input
                    id="learner-name"
                    value={draft}
                    maxLength={24}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => setName(draft)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), setName(draft))}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
            </div>
            <p className="text-sm text-muted-foreground">
                Vai trò: <span className="font-semibold text-foreground">{role === 'teacher' ? 'Giảng viên' : 'Sinh viên'}</span>
            </p>
            <button
                type="button"
                role="switch"
                aria-checked={soundOn}
                onClick={() => setSoundOn(!soundOn)}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted"
            >
                {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />} Âm thanh
                <span aria-hidden className={`ml-auto flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-fast ${soundOn ? 'bg-brand-600' : 'bg-border'}`}>
                    <span className={`h-4 w-4 rounded-full bg-ink-foreground shadow-card transition-transform duration-fast ${soundOn ? 'translate-x-4' : ''}`} />
                </span>
            </button>
            <button
                type="button"
                onClick={(e) => {
                    const origin = centerOf(e.currentTarget)
                    onClose?.()
                    void enterRole(other, { origin, navigate })
                }}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted"
            >
                <Repeat size={16} /> Chuyển sang vai {other === 'teacher' ? 'giảng viên' : 'sinh viên'}
            </button>
            <button
                type="button"
                onClick={() => window.confirm('Xóa toàn bộ XP, tiến độ và nội dung đã duyệt trên trình duyệt này?') && resetDemo()}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-brand-ink transition hover:bg-muted"
            >
                <RotateCcw size={16} /> Đặt lại dữ liệu demo
            </button>
        </div>
    )
}
