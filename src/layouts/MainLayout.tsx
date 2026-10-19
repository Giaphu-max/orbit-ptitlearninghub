import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { OrbitSidebar, type OrbitTab } from '@/components/orbit-sidebar'

const TAB_PATHS: Record<OrbitTab, string> = {
    home: '/',
    learning: '/learning',
}

export function MainLayout() {
    const navigate = useNavigate()
    const location = useLocation()

    const activeTab: OrbitTab =
        location.pathname === '/learning' || location.pathname === '/lesson' ? 'learning' : 'home'

    return (
        <div className="flex min-h-screen w-full relative z-0 bg-[#FDFBFB] font-sans text-gray-900 overflow-hidden">
            {/* ── Global Premium Ambient Glow Background ── */}
            <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none">
                {/* Soft Rose glow on top right */}
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-rose-200/40 blur-[120px]"></div>

                {/* Soft Red glow on middle left */}
                <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full bg-red-100/50 blur-[120px]"></div>

                {/* Subtle warm glow on bottom right */}
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-orange-50/40 blur-[100px]"></div>
            </div>

            <OrbitSidebar activeTab={activeTab} onTabChange={(tab) => navigate(TAB_PATHS[tab])} />

            <main className="flex-1 flex flex-col overflow-hidden relative bg-transparent pl-[90px]">
                <Outlet />
            </main>
        </div>
    )
}
