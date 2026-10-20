import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Flame, Menu, RotateCcw, Repeat, X, Zap } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { levelFromXp, visibleStreak } from '@/lib/gamification'
import { useOrbitStore } from '@/store/useOrbitStore'

// Logo thật: đặt file src/assets/brand/logo.(svg|png|webp) là tự dùng; không có thì dùng khối chữ PTIT
const logoFiles = import.meta.glob('/src/assets/brand/logo.{svg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const LOGO_URL = Object.values(logoFiles)[0]

export type NavTone = 'hero' | 'plain'

interface NavItem {
    label: string
    to: string
    /** Đường dẫn bắt đầu bằng các tiền tố này thì mục đang được chọn */
    match: (pathname: string, hash: string) => boolean
}

const BASE_ITEMS: NavItem[] = [
    { label: 'Trang chủ', to: '/', match: (p, h) => p === '/' && h !== '#daily' },
    { label: 'Orbit Daily', to: '/#daily', match: (p, h) => p.startsWith('/daily') || (p === '/' && h === '#daily') },
    { label: 'Khóa học', to: '/learning', match: (p) => p === '/learning' || p.startsWith('/lesson') },
    { label: 'Studio 3D', to: '/studio', match: (p) => p.startsWith('/studio') },
]

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
export function TopNav({ tone }: { tone: NavTone }) {
    const t = TONE[tone]
    const { pathname, hash } = useLocation()
    const role = useOrbitStore((s) => s.role)
    const xp = useOrbitStore((s) => s.xp)
    const streakState = useOrbitStore((s) => s.streak)
    const [menuOpen, setMenuOpen] = useState(false)

    const items = role === 'teacher' ? [...BASE_ITEMS, { label: 'Giảng viên', to: '/teacher', match: (p: string) => p.startsWith('/teacher') }] : BASE_ITEMS
    const streak = visibleStreak(streakState).count

    // Đóng menu khi đổi trang
    useEffect(() => setMenuOpen(false), [pathname, hash])

    const chips = (
        <>
            <Link to="/journey" className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-semibold transition duration-fast ${t.chip}`}>
                <Flame size={14} className={streak > 0 ? 'fill-current' : ''} />
                Chuỗi {streak} ngày
            </Link>
            <Link to="/journey" className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-semibold transition duration-fast ${t.chip}`}>
                <Zap size={14} className="fill-current" />
                Cấp {levelFromXp(xp)} · <span className="font-mono">{xp.toLocaleString('vi-VN')}</span> XP
            </Link>
        </>
    )

    return (
        <header className={`relative z-50 ${t.text}`}>
            <div className="container-page flex items-center gap-4 py-5 lg:gap-6">
                <Link to="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap" aria-label="Orbit, trang chủ">
                    {LOGO_URL ? (
                        <img src={LOGO_URL} alt="PTIT" className="logo-mark h-10 w-10 shrink-0 rounded-xl object-contain p-1" />
                    ) : (
                        // Khối vuông trắng bo góc, chữ PTIT đỏ: nổi trên nền tối của hero
                        <span className={`flex aspect-square h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black tracking-tight ${t.logo}`}>PTIT</span>
                    )}
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
                            aria-current={it.match(pathname, hash) ? 'page' : undefined}
                            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition duration-fast xl:px-4 ${it.match(pathname, hash) ? t.active : t.link}`}
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
                                aria-current={it.match(pathname, hash) ? 'page' : undefined}
                                className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${it.match(pathname, hash) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                            >
                                {it.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 [&_a]:border-border [&_a]:bg-card [&_a]:text-foreground">{chips}</div>
                    <div className="mt-3 border-t border-border pt-3">
                        <AccountPanel />
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
                    <AccountPanel />
                </div>
            )}
        </div>
    )
}

function AccountPanel() {
    const role = useOrbitStore((s) => s.role)
    const name = useOrbitStore((s) => s.learnerName)
    const setName = useOrbitStore((s) => s.setLearnerName)
    const setRole = useOrbitStore((s) => s.setRole)
    const resetDemo = useOrbitStore((s) => s.resetDemo)
    const navigate = useNavigate()
    const [draft, setDraft] = useState(name)

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
            <button type="button" onClick={() => { setRole(null); navigate('/') }} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted">
                <Repeat size={16} /> Đổi vai trò
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
