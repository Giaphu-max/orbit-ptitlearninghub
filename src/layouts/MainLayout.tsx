import { Suspense } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { OrbitSidebar, type OrbitTab } from '@/components/orbit-sidebar'
import { OrbitRoleSelect } from '@/components/orbit-role-select'
import { RewardOverlay } from '@/components/reward-overlay'
import { useOrbitStore } from '@/store/useOrbitStore'

const TAB_PATHS: Record<OrbitTab, string> = {
    home: '/',
    learning: '/learning',
    journey: '/journey',
    teacher: '/teacher',
}

export function MainLayout() {
    const navigate = useNavigate()
    const location = useLocation()

    const role = useOrbitStore((s) => s.role)

    const activeTab: OrbitTab = location.pathname.startsWith('/teacher')
        ? 'teacher'
        : location.pathname.startsWith('/journey')
          ? 'journey'
          : location.pathname === '/learning' || location.pathname.startsWith('/lesson')
          ? 'learning'
          : 'home'

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

            <OrbitSidebar activeTab={activeTab} onTabChange={(tab) => navigate(TAB_PATHS[tab])} />

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-transparent pl-[90px]">
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
            <RewardOverlay />
        </div>
    )
}
