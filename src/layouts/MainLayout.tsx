import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { TopNav } from '@/components/top-nav'
import { OrbitRoleSelect } from '@/components/orbit-role-select'
import { RewardOverlay } from '@/components/reward-overlay'
import { useOrbitStore } from '@/store/useOrbitStore'

export function MainLayout() {
    const location = useLocation()

    const role = useOrbitStore((s) => s.role)

    // Trang chủ tự vẽ thanh điều hướng đè lên hero; các trang khác dùng thanh nền thường phía trên
    const isHome = location.pathname === '/'

    if (!role) return <OrbitRoleSelect />

    return (
        <div className="flex h-screen w-full relative z-0 bg-surface font-sans text-foreground overflow-hidden">
            {/* ── Global Premium Ambient Glow Background ── */}
            <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none">
                {/* Soft Rose glow on top right */}
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-brand-200/40 blur-[120px]"></div>

                {/* Soft Red glow on middle left */}
                <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-100/50 blur-[120px]"></div>

                {/* Subtle warm glow on bottom right */}
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-brand-100/40 blur-[100px]"></div>
            </div>

            <div className="flex h-full min-w-0 flex-1 flex-col">
                {!isHome && <TopNav tone="plain" />}
                <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
                <Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Loader2 className="animate-spin" size={32} aria-label="Đang tải trang" />
                        </div>
                    }
                >
                    <Outlet />
                </Suspense>
                </main>
            </div>
            <RewardOverlay />
        </div>
    )
}
