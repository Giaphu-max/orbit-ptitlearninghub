'use client'

import { Compass, Home, Plus, Brain, Glasses, LogIn, LogOut, type LucideIcon } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

export type OrbitTab = 'home' | 'discover' | 'learning' | 'vr'

interface OrbitSidebarProps { 
    activeTab: OrbitTab; 
    onTabChange: (tab: OrbitTab) => void; 
    onCreate: () => void;
    user?: User | null;
    onAuthClick?: () => void;
    onLogout?: () => void;
}

const navigation: { label: string; tab: OrbitTab; icon: LucideIcon }[] = [
    { label: 'Home', tab: 'home', icon: Home }, 
    { label: 'Explore', tab: 'discover', icon: Compass }, 
    { label: 'Deep learning', tab: 'learning', icon: Brain }
]

export function OrbitSidebar({ activeTab, onTabChange, onCreate, user, onAuthClick, onLogout }: OrbitSidebarProps) { 
    return (
        <aside className="flex w-[90px] shrink-0 flex-col items-center border-r border-[#e2e3e7] bg-[#fbfbfc] py-8">
            <div className="mb-16 flex h-8 items-center justify-center">
                <span className="text-[21px] font-bold tracking-[-0.06em] text-[#1f232b]">Orbit</span>
            </div>
            
            <nav className="flex flex-1 flex-col items-center justify-center gap-7" aria-label="Primary navigation">
                {navigation.map(({ label, tab, icon: Icon }) => { 
                    const active = activeTab === tab; 
                    return (
                        <button key={label} type="button" aria-label={label} aria-current={active ? 'page' : undefined} onClick={() => onTabChange(tab)} className={`flex h-16 w-16 items-center justify-center rounded-[15px] transition-colors ${active ? 'bg-[#ffdeda] text-[#b7131e] shadow-sm' : 'text-[#70747c] hover:bg-[#f0f1f3] hover:text-[#252932]'}`}>
                            <Icon size={32} strokeWidth={active ? 2.5 : 2} />
                        </button> 
                    ) 
                })}
                
                {user && (
                    <button type="button" aria-label="Create" onClick={onCreate} className="flex h-16 w-16 items-center justify-center rounded-[15px] text-[#70747c] transition-colors hover:bg-[#f0f1f3] hover:text-[#252932]">
                        <Plus size={32} />
                    </button>
                )}
                
                <button type="button" aria-label="Visual lessons" aria-current={activeTab === 'vr' ? 'page' : undefined} onClick={() => onTabChange('vr')} className={`flex h-16 w-16 items-center justify-center rounded-[15px] transition-colors ${activeTab === 'vr' ? 'bg-[#ffdeda] text-[#b7131e] shadow-sm' : 'text-[#70747c] hover:bg-[#f0f1f3] hover:text-[#252932]'}`}>
                    <Glasses size={32} strokeWidth={activeTab === 'vr' ? 2.5 : 2} />
                </button>
            </nav>
            
            {user ? (
                <button type="button" aria-label="Log out" onClick={onLogout} className="mt-auto flex h-12 w-12 items-center justify-center rounded-full text-[#70747c] transition-colors hover:bg-red-50 hover:text-red-600" title="Đăng xuất">
                    <LogOut size={24} />
                </button>
            ) : (
                <button type="button" aria-label="Log in" onClick={onAuthClick} className="mt-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f1f3] text-[#252932] transition-colors hover:bg-[#e2e3e7]" title="Đăng nhập">
                    <LogIn size={24} />
                </button>
            )}
        </aside> 
    )
}
