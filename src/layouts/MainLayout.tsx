import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { TopNav } from '@/components/top-nav'
import { OrbitRoleSelect } from '@/components/orbit-role-select'
import { RewardOverlay } from '@/components/reward-overlay'
import { SiteFooter } from '@/components/site-footer'
import { useOrbitStore } from '@/store/useOrbitStore'

// Các route toàn màn hình hoặc có footer riêng không hiển thị layout footer
const HIDE_FOOTER_PREFIXES = ['/lesson', '/test', '/checkpoint', '/studio']

function shouldShowFooter(pathname: string): boolean {
    if (pathname === '/') return false
    return !HIDE_FOOTER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export function MainLayout() {
    const location = useLocation()

    const role = useOrbitStore((s) => s.role)

    // Thanh điều hướng cố định ở đầu mọi trang; trên trang chủ nó đè lên hero, các trang khác chừa chỗ bằng --nav-h
    const isHome = location.pathname === '/'
    const showFooter = shouldShowFooter(location.pathname)

    if (!role) return <OrbitRoleSelect />

    return (
        <div className="relative isolate flex min-h-[100svh] w-full flex-col bg-surface font-sans text-foreground">
            {/* ── Global Premium Ambient Glow Background ── */}
            <div aria-hidden className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
                {/* Soft Rose glow on top right */}
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-brand-200/40 blur-[120px]"></div>

                {/* Soft Red glow on middle left */}
                <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-100/50 blur-[120px]"></div>

                {/* Subtle warm glow on bottom right */}
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-brand-100/40 blur-[100px]"></div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                <TopNav />
                <main className={`relative flex min-w-0 flex-1 flex-col ${isHome ? '' : 'pt-[var(--nav-h)]'}`}>
                    <Suspense
                        fallback={
                            <div className="flex flex-1 items-center justify-center py-32 text-muted-foreground">
                                <Loader2 className="animate-spin" size={32} aria-label="Đang tải trang" />
                            </div>
                        }
                    >
                        <Outlet />
                        {showFooter && <SiteFooter />}
                    </Suspense>
                </main>
            </div>
            <RewardOverlay />
        </div>
    )
}
