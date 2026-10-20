import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Flame, Menu, RotateCcw, Repeat, Volume2, VolumeX, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { XpChip } from '@/components/xp-chip'
import { visibleStreak } from '@/lib/gamification'
import { centerOf, enterRole } from '@/lib/role-switch'
import { scrollToSection } from '@/lib/scroll'
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
    { label: 'Trang chủ', to: '/', section: 'top', match: () => false },
    { label: 'Orbit Daily', to: '/#daily', section: 'daily', match: (p) => p.startsWith('/daily') },
    { label: 'Khóa học', to: '/#courses', section: 'courses', match: (p) => p === '/learning' || p.startsWith('/lesson') || p.startsWith('/test') },
    { label: 'Studio 3D', to: '/#studio', section: 'studio', match: (p) => p.startsWith('/studio') },
]

// Giảng viên: nav dẫn tới các mục của trang giảng viên (?tab=) thay cho các phần học tập của sinh viên
const teacherTab = (tab: string | null, id: 'review' | 'stats' | 'tests') => (id === 'review' ? tab !== 'stats' && tab !== 'tests' : tab === id)
const TEACHER_ITEMS: NavItem[] = [
    { label: 'Trang chủ', to: '/', section: 'top', match: () => false },
    { label: 'Duyệt nội dung', to: '/teacher', match: () => false, tab: 'review' },
    { label: 'Thống kê lớp', to: '/teacher?tab=stats', match: () => false, tab: 'stats' },
    { label: 'Kết quả test', to: '/teacher?tab=tests', match: () => false, tab: 'tests' },
    { label: 'Khóa học', to: '/learning', match: (p) => p === '/learning' },
]

/** Các phần trên trang chủ theo thứ tự từ trên xuống; phần cuối (progress) không có mục nav. */
const HOME_SECTIONS = ['top', 'daily', 'courses', 'studio', 'progress']

/**
 * Phần trang chủ đang nằm ở khoảng 40% chiều cao màn hình (IntersectionObserver).
 * Giữa hai phần (khoảng trống) giữ phần trước đó. Trang chủ tải lười nên chờ các phần xuất hiện.
 */
function useActiveSection(enabled: boolean) {
    const [active, setActive] = useState('top')
    useEffect(() => {
        if (!enabled) return
        let observer: IntersectionObserver | undefined
        let raf = 0
        let tries = 0
        const live = new Set<string>()
        const connect = () => {
            const els = HOME_SECTIONS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e))
            if (els.length < HOME_SECTIONS.length) {
                if (tries++ < 180) raf = requestAnimationFrame(connect)
                return
            }
            observer = new IntersectionObserver(
                (entries) => {
                    for (const e of entries) {
                        if (e.isIntersecting) live.add(e.target.id)
                        else live.delete(e.target.id)
                    }
                    const current = HOME_SECTIONS.filter((id) => live.has(id)).pop()
                    if (current) setActive(current)
                },
                { rootMargin: '-40% 0px -59% 0px' },
            )
            els.forEach((el) => observer!.observe(el))
        }
        connect()
        return () => {
            cancelAnimationFrame(raf)
            observer?.disconnect()
        }
    }, [enabled])
    return active
}

/**
 * Trạng thái cuộn của nav trên trang chủ (một listener scroll passive + rAF):
 * scrolled = đã cuộn quá 8px (nav hero chuyển từ trong suốt sang kính tối); past = đã qua hết hero (nav chuyển sang tone plain).
 */
function useNavScroll(enabled: boolean) {
    const [state, setState] = useState({ scrolled: false, past: false })
    useEffect(() => {
        if (!enabled) return
        let raf = 0
        const check = () => {
            const heroH = document.getElementById('top')?.offsetHeight ?? 600
            const navH = document.querySelector('header')?.getBoundingClientRect().height ?? 80
            const next = { scrolled: window.scrollY > 8, past: window.scrollY > heroH - navH }
            setState((s) => (s.scrolled === next.scrolled && s.past === next.past ? s : next))
        }
        const onScroll = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(check)
        }
        check()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
        }
    }, [enabled])
    return enabled ? state : { scrolled: false, past: false }
}

const initials = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'OR'

// Lớp màu theo nền: hero là nền tối cố định (chữ trắng), plain theo giao diện sáng/tối
const TONE = {
    hero: {
        text: 'text-ink-foreground',
        link: 'text-ink-foreground/75 hover:text-ink-foreground',
        active: 'bg-ink-foreground/15 text-ink-foreground',
        sub: 'text-ink-foreground/70',
        chip: 'border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20',
        logo: 'logo-mark',
        avatar: 'bg-ink-foreground text-ink',
        burger: 'border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground',
    },
    plain: {
        text: 'text-foreground',
        link: 'text-muted-foreground hover:text-foreground',
        active: 'bg-muted text-foreground',
        sub: 'text-muted-foreground',
        chip: 'border-border bg-card text-foreground hover:border-brand-300',
        logo: 'logo-mark',
        avatar: 'bg-foreground text-background',
        burger: 'border-border bg-card text-foreground',
    },
} as const

/** Thanh điều hướng ngang: logo, mục có chữ, chip streak, chip cấp độ + XP, avatar, nút sáng/tối. Mobile thu thành menu. */
export function TopNav() {
    const { pathname, hash } = useLocation()
    const navigate = useNavigate()
    const [menuOpen, setMenuOpen] = useState(false)
    const onHome = pathname === '/'
    const { scrolled, past: pastHero } = useNavScroll(onHome)
    const activeSection = useActiveSection(onHome)
    const tone: NavTone = onHome && !pastHero ? 'hero' : 'plain'
    const t = TONE[tone]
    const tabParam = new URLSearchParams(useLocation().search).get('tab')
    const isActive = (it: NavItem) => (it.tab ? pathname === '/teacher' && teacherTab(tabParam, it.tab) : onHome ? it.section === activeSection : it.match(pathname))
    const goTo = (e: ReactMouseEvent, it: NavItem) => {
        setMenuOpen(false)
        if (!onHome || !it.section) return
        e.preventDefault()
        scrollToSection(it.section)
        navigate(it.to, { replace: true, preventScrollReset: true })
    }
    const role = useOrbitStore((s) => s.role)
    const streakState = useOrbitStore((s) => s.streak)

    const items = role === 'teacher' ? TEACHER_ITEMS : BASE_ITEMS
    const streak = visibleStreak(streakState).count

    // Đóng menu khi đổi trang
    useEffect(() => setMenuOpen(false), [pathname, hash])

    // Giảng viên không có chuỗi ngày/XP
    const chips = role === 'teacher' ? null : (
        <>
            <Link to="/journey" className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-semibold transition duration-fast ${t.chip}`}>
                <Flame size={14} className={streak > 0 ? 'fill-current' : ''} />
                Chuỗi {streak} ngày
            </Link>
            <XpChip className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors duration-fast ${t.chip}`} />
        </>
    )

    return (
        <header
            style={{ viewTransitionName: 'site-nav' }}
            data-nav={tone === 'plain' ? 'plain' : scrolled ? 'glass' : 'clear'}
            className={`nav-bar fixed inset-x-0 top-0 z-50 h-[var(--nav-h)] ${t.text}`}
        >
            <div className="container-page flex h-full items-center gap-4 lg:gap-6">
                <Link to="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap" aria-label="Orbit, trang chủ">
                    <BrandLogo />
                    <span className="leading-tight">
                        <span className="block text-[17px] font-extrabold tracking-tight">Orbit</span>
                        <span className={`hidden whitespace-nowrap text-[11px] xl:block ${t.sub}`}>Học viện Công nghệ BCVT</span>
                    </span>
                </Link>

                <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
                    {items.map((it) => (
                        <Link
                            key={it.label}
                            to={it.to}
                            onClick={(e) => goTo(e, it)}
                            aria-current={isActive(it) ? (onHome ? 'location' : 'page') : undefined}
                            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition duration-fast xl:px-4 ${isActive(it) ? t.active : t.link}`}
                        >
                            {it.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto hidden items-center gap-2.5 lg:flex">
                    {chips}
                    <ThemeToggle tone={tone} />
                    <AccountMenu tone={tone} />
                </div>

                <div className="ml-auto flex items-center gap-2 lg:hidden">
                    <ThemeToggle tone={tone} />
                    <button
                        type="button"
                        aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((v) => !v)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border ${t.burger}`}
                    >
                        {menuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="absolute inset-x-3 top-full z-50 -mt-2 rounded-card border border-border bg-card p-4 text-foreground shadow-raised lg:hidden">
                    <nav aria-label="Điều hướng chính (menu)" className="flex flex-col">
                        {items.map((it) => (
                            <Link
                                key={it.label}
                                to={it.to}
                                onClick={(e) => goTo(e, it)}
                                aria-current={isActive(it) ? (onHome ? 'location' : 'page') : undefined}
                                className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${isActive(it) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                            >
                                {it.label}
                            </Link>
                        ))}
                    </nav>
                    {chips && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 [&_a]:border-border [&_a]:bg-card [&_a]:text-foreground">{chips}</div>}
                    <div className="mt-3 border-t border-border pt-3">
                        <AccountPanel onClose={() => setMenuOpen(false)} />
                    </div>
                </div>
            )}
        </header>
    )
}

/** Avatar + menu tài khoản giả lập (đổi tên, đổi vai trò, đặt lại demo). */
function AccountMenu({ tone }: { tone: NavTone }) {
    const t = TONE[tone]
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
                className={`flex aspect-square h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold shadow-card transition duration-fast hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${t.avatar}`}
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
