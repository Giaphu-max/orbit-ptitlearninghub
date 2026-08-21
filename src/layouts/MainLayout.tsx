import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { OrbitSidebar, type OrbitTab } from '@/components/orbit-sidebar'
import { OrbitUploadModal } from '@/components/orbit-upload-modal'

export function MainLayout() {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    // Determine active tab based on current path
    const getActiveTab = (): OrbitTab => {
        if (location.pathname === '/discover') return 'discover'
        if (location.pathname === '/learning' || location.pathname === '/lesson') return 'learning'
        if (location.pathname === '/vr') return 'vr'
        return 'home'
    }

    const handleTabChange = (tab: OrbitTab) => {
        if (tab === 'home') navigate('/')
        else if (tab === 'discover') navigate('/discover')
        else if (tab === 'learning') navigate('/learning')
        else if (tab === 'vr') navigate('/vr')
    }

    return (
        <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
            <OrbitSidebar
                activeTab={getActiveTab()}
                onTabChange={handleTabChange}
                onCreate={() => setIsUploadModalOpen(true)}
            />
            
            <main className="flex-1 flex flex-col overflow-hidden relative bg-[#f8f9fa]">
                <Outlet />
            </main>

            {isUploadModalOpen && (
                <OrbitUploadModal onClose={() => setIsUploadModalOpen(false)} />
            )}
        </div>
    )
}
