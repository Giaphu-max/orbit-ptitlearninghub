import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { OrbitSidebar, type OrbitTab } from '@/components/orbit-sidebar'
import { OrbitUploadModal } from '@/components/orbit-upload-modal'
import { OrbitAuthModal } from '@/components/orbit-auth-modal'
import { OrbitGuestOnboardingModal } from '@/components/orbit-guest-onboarding-modal'
import { OrbitProfileSetupModal } from '@/components/orbit-profile-setup-modal'
import { useAuth } from '@/contexts/AuthContext'

export function MainLayout() {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
    const [showGuestOnboarding, setShowGuestOnboarding] = useState(false)
    const [showProfileSetup, setShowProfileSetup] = useState(false)
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const navigate = useNavigate()
    const location = useLocation()
    const { user, signOut, isLoading } = useAuth()

    useEffect(() => {
        if (user && pendingAction === 'upload') {
            setIsUploadModalOpen(true)
            setPendingAction(null)
            setIsAuthModalOpen(false)
        }
    }, [user, pendingAction])

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                // Check guest onboarding
                const guestOnboarded = localStorage.getItem('orbit_guest_onboarded')
                if (!guestOnboarded) {
                    setShowGuestOnboarding(true)
                }
                setShowProfileSetup(false)
            } else {
                // Check profile setup
                setShowGuestOnboarding(false)
                if (!user.user_metadata?.username) {
                    setShowProfileSetup(true)
                } else {
                    setShowProfileSetup(false)
                }
            }
        }
    }, [user, isLoading])

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

    const handleCreateClick = () => {
        if (!user) {
            setPendingAction('upload')
            setIsAuthModalOpen(true)
        } else {
            setIsUploadModalOpen(true)
        }
    }

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

            <OrbitSidebar
                activeTab={getActiveTab()}
                onTabChange={handleTabChange}
                onCreate={handleCreateClick}
                user={user}
                onAuthClick={() => setIsAuthModalOpen(true)}
                onLogout={signOut}
            />

            <main className="flex-1 flex flex-col overflow-hidden relative bg-transparent pl-[90px]">
                <Outlet />
            </main>

            {isUploadModalOpen && (
                <OrbitUploadModal onClose={() => setIsUploadModalOpen(false)} />
            )}

            {isAuthModalOpen && (
                <OrbitAuthModal onClose={() => setIsAuthModalOpen(false)} />
            )}

            {showGuestOnboarding && (
                <OrbitGuestOnboardingModal onClose={() => setShowGuestOnboarding(false)} />
            )}

            {showProfileSetup && (
                <OrbitProfileSetupModal onComplete={() => setShowProfileSetup(false)} />
            )}
        </div>
    )
}
