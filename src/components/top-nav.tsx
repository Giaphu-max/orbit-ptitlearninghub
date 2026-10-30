import { useNavHidden } from '@/lib/focus-mode'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { RotateCcw, Repeat, Volume2, VolumeX } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { StatsPill } from '@/components/stats-pill'
import { ThemeToggle } from '@/components/theme-toggle'
import { FLAGS } from '@/lib/perf'
import { centerOf, enterRole } from '@/lib/role-switch'
import { getJourneyChapter, subscribeChapter } from '@/lib/scroll'
import { useSoundStore } from '@/lib/sfx'
import { useOrbitStore, type Role } from '@/store/useOrbitStore'

interface NavItem {
    label: string
    to: string
    /** Mục đang chọn khi ở các trang khác trang chủ */
    match: (pathname: string) => boolean
}

const BASE_ITEMS: NavItem[] = [
    { label: 'Trang chủ', to: '/', match: (p) => p === '/' },
    { label: 'Ôn tập', to: '/today', match: (p) => p.startsWith('/today') || p.startsWith('/daily') },
    { label: 'Học phần', to: '/learning', match: (p) => p === '/learning' || p.startsWith('/lesson') || p.startsWith('/test') || p.startsWith('/checkpoint') || p.startsWith('/recap') },
    { label: 'Studio 3D', to: '/studio', match: (p) => p.startsWith('/studio') },
    { label: 'Tiến độ & Kỹ năng', to: '/journey', match: (p) => p.startsWith('/journey') },
]

/** Đã cuộn quá `enter` px thì true; chỉ về false khi dưới `leave` px (độ trễ để thanh không chớp ở ranh giới). Một listener scroll passive + rAF, không đọc layout. */
function useScrolledPast(enabled: boolean, enter: number, leave: number) {
    const [past, setPast] = useState(false)
    useEffect(() => {
        if (!enabled) {
            setPast(false)
            return
        }
        let raf = 0
        const check = () => setPast((was) => (was ? window.scrollY >= leave : window.scrollY > enter))
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
    }, [enabled, enter, leave])
    return enabled && past
}

/** Màn hẹp (<860px): trang chủ luôn dùng viên thuốc; dãy mục cuộn ngang thay vì gom vào menu. */
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
        .toUpperCase() || 'PT'

const linkCls = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'

function NavLinks({ pathname, pill = false, className = '' }: { pathname: string; pill?: boolean; className?: string }) {
    return (
        <nav aria-label="Điều hướng chính" className={`no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto ${className}`}>
            {BASE_ITEMS.map((it) => {
                const active = it.match(pathname)
                return (
                    <Link
                        key={it.label}
                        to={it.to}
                        aria-current={active ? 'page' : undefined}
                        className={`${linkCls} ${pill ? 'px-3.5' : ''} ${active ? `font-extrabold text-brand-ink ${pill ? 'bg-brand-50' : ''}` : 'font-medium text-foreground hover:text-strong'}`}
                    >
                        {it.label}
                    </Link>
                )
            })}
        </nav>
    )
}

/**
 * Thanh điều hướng sinh viên.
 * - Mọi trang trừ trang chủ: một thanh cố định luôn hiện đủ (logo, 5 mục, streak/XP, avatar). Cuộn quá 8px thì thu 84 → 60px
 *   (logo 46 → 36px, ẩn chữ phụ, nền mờ + viền dưới); `--nav-h` cập nhật theo để mọi phần tử sticky bám đúng.
 * - Trang chủ: đầu trang là thanh trong suốt trên hero; từ chương 1 trở đi là viên thuốc nổi căn trái theo lề container, hiện đủ 5 mục.
 */
export function TopNav() {
    const { pathname } = useLocation()
    const role = useOrbitStore((s) => s.role)
    const onHome = pathname === '/'
    const chapter = useSyncExternalStore(subscribeChapter, getJourneyChapter)
    // Trang chủ hành trình: chỉ đọc chương đã chốt (không đọc scrollY); các trang khác và trang chủ giảm chuyển động (chapter = -1) đọc scrollY
    const scrolled = useScrolledPast(!onHome || chapter < 0, onHome ? 60 : 8, onHome ? 40 : 2)
    const narrow = useNarrow()
    const pill = onHome && (narrow || (chapter >= 0 ? chapter >= 1 : scrolled))
    const compactBar = !onHome && scrolled
    const name = useOrbitStore((s) => s.learnerName)
    useOrbitStore((s) => s.lessonProgress)
    const navHidden = useNavHidden()

    // Chiều cao thanh hiện tại cho mọi phần tử sticky (--nav-h); phần chừa chỗ ở đầu trang dùng --nav-full-h (cố định)
    useEffect(() => {
        document.documentElement.style.setProperty('--nav-h', compactBar ? '60px' : '84px')
        return () => {
            document.documentElement.style.removeProperty('--nav-h')
        }
    }, [compactBar])

    const logoCls = compactBar ? '!h-9 !w-9' : '!h-[46px] !w-[46px]'

    if (!onHome) {
        return (
            <header style={{ viewTransitionName: 'site-nav' }} data-nav={compactBar ? 'compact' : 'full'} data-focus-hidden={navHidden} className="lesson-focus-nav own-layer fixed inset-x-0 top-0 z-50 text-foreground">
                <div className="site-bar" data-scrolled={compactBar}>
                    <div className="mx-auto flex h-full w-full max-w-[var(--page-max)] items-center gap-4 px-[var(--page-gutter)] lg:gap-6">
                        <Link to="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70" aria-label="PTIT, trang chủ">
                            <BrandLogo className={`site-bar-logo ${logoCls}`} />
                            <span className="leading-tight">
                                <span className="block text-xl font-black leading-none tracking-tight text-brand-ink">PTIT</span>
                                <span className="site-bar-sub mt-1 hidden whitespace-nowrap text-[11px] text-muted-foreground xl:block">Học viện Công nghệ BCVT</span>
                            </span>
                        </Link>
                        <NavLinks pathname={pathname} />
                        <div className="ml-auto flex shrink-0 items-center gap-2.5">
                            <StatsPill tooltip={!compactBar} />
                            {FLAGS.darkMode && role !== 'teacher' && <ThemeToggle tone="hero" />}
                            <AccountMenu />
                        </div>
                    </div>
                </div>
            </header>
        )
    }

    return (
        <header
            style={{ viewTransitionName: 'site-nav' }}
            data-nav={pill ? 'pill' : 'wide'}
            data-focus-hidden={navHidden}
            className="lesson-focus-nav own-layer nav-over-3d pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center text-foreground"
        >
            <div className="nav-shell" data-state={pill ? 'pill' : 'wide'}>
                {/* Thanh đầy đủ trên hero */}
                <div className="nav-layer nav-layer-wide gap-4 px-[var(--page-gutter)] lg:gap-6">
                    <Link to="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70" aria-label="PTIT, trang chủ">
                        <BrandLogo />
                        <span className="leading-tight">
                            <span className="block text-xl font-black leading-none tracking-tight text-brand-ink">PTIT</span>
                            <span className="mt-1 hidden whitespace-nowrap text-[11px] text-muted-foreground xl:block">Học viện Công nghệ BCVT</span>
                        </span>
                    </Link>
                    <NavLinks pathname={pathname} />
                    <div className="ml-auto flex items-center gap-2.5">
                        <StatsPill tooltip={!pill} />
                        {FLAGS.darkMode && role !== 'teacher' && <ThemeToggle tone="hero" />}
                        <AccountMenu />
                    </div>
                </div>

                {/* Viên thuốc nổi: căn trái theo lề container, logo nhỏ ở đầu, streak/XP + avatar ở cuối */}
                <div className="nav-layer nav-layer-pill px-[var(--page-gutter)]">
                    <div className="ptit-glass-navbar-pill mt-4 flex max-w-full items-center gap-1.5 p-1.5 pl-2">
                        <Link to="/" aria-label="PTIT, trang chủ" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                            <BrandLogo className="!h-7 !w-7 !rounded-lg !p-0.5" />
                        </Link>
                        <NavLinks pathname={pathname} pill />
                        <div className="flex shrink-0 items-center gap-2 pl-1">
                            {role !== 'teacher' && <StatsPill compact tooltip={false} />}
                            <AccountMenu small label={`Tài khoản của ${name}`} />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

/** Avatar + menu tài khoản giả lập (đổi tên, đổi vai trò, đặt lại demo). */
function AccountMenu({ small = false, label }: { small?: boolean; label?: string }) {
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
                aria-label={label ?? `Tài khoản của ${name}`}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={`flex aspect-square ${small ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs'} shrink-0 items-center justify-center rounded-full font-extrabold shadow-card transition duration-fast hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 bg-foreground text-background`}
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
