'use client'

import { Compass, Home, Plus, Brain, Glasses, LogIn, LogOut, CircleUser, type LucideIcon } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
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
    const [showProfileMenu, setShowProfileMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <aside className="group fixed top-0 left-0 h-full flex w-[90px] hover:w-64 shrink-0 flex-col py-8 z-50 transition-all duration-100 group-hover:duration-300 ease-in-out overflow-hidden bg-[#f8f9fa]">
            <div className="flex h-8 w-[90px] items-center justify-center shrink-0">
                <span className="text-[21px] font-bold tracking-[-0.06em] text-[#1f232b]">Orbit</span>
            </div>
            
            <nav className="flex-1 flex flex-col justify-center w-full gap-8 px-5" aria-label="Primary navigation">
                {navigation.map(({ label, tab, icon: Icon }) => { 
                    const active = activeTab === tab; 
                    return (
                        <button key={label} type="button" aria-label={label} aria-current={active ? 'page' : undefined} onClick={() => onTabChange(tab)} className={`flex items-center p-3 w-full cursor-pointer transition-colors duration-200 ${active ? 'text-[#b7131e]' : 'text-[#70747c] hover:text-[#252932]'}`}>
                            <div className="w-7 flex-shrink-0 flex justify-center">
                                <Icon size={28} strokeWidth={active ? 2.5 : 2} />
                            </div>
                            <span className="font-bold text-[15px] overflow-hidden whitespace-nowrap transition-all duration-100 group-hover:duration-300 ease-in-out w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:ml-4 text-left">
                                {label}
                            </span>
                        </button> 
                    ) 
                })}
                
                <button 
                    type="button" 
                    aria-label="Create" 
                    onClick={onCreate} 
                    className="flex items-center p-3 w-full cursor-pointer transition-colors duration-200 text-[#70747c] hover:text-[#252932]"
                >
                    <div className="w-7 flex-shrink-0 flex justify-center">
                        <Plus size={28} />
                    </div>
                    <span className="font-bold text-[15px] overflow-hidden whitespace-nowrap transition-all duration-300 w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:ml-4 text-left">
                        Tạo mới
                    </span>
                </button>
                
                <button type="button" aria-label="Visual lessons" aria-current={activeTab === 'vr' ? 'page' : undefined} onClick={() => onTabChange('vr')} className={`flex items-center p-3 w-full cursor-pointer transition-colors duration-200 ${activeTab === 'vr' ? 'text-[#b7131e]' : 'text-[#70747c] hover:text-[#252932]'}`}>
                    <div className="w-7 flex-shrink-0 flex justify-center">
                        <Glasses size={28} strokeWidth={activeTab === 'vr' ? 2.5 : 2} />
                    </div>
                    <span className="font-bold text-[15px] overflow-hidden whitespace-nowrap transition-all duration-300 w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:ml-4 text-left">
                        VR Studio
                    </span>
                </button>
            </nav>
            
            {user ? (
                <div className="mt-auto relative w-full px-5" ref={menuRef}>
                    <button 
                        type="button" 
                        aria-label="Profile menu" 
                        onClick={() => setShowProfileMenu(!showProfileMenu)} 
                        className="flex items-center p-3 w-full cursor-pointer transition-colors duration-200 text-[#70747c] hover:text-[#252932]"
                    >
                        <div className="w-7 flex-shrink-0 flex justify-center">
                            {user.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                                <CircleUser size={28} />
                            )}
                        </div>
                        <div className="flex flex-col text-left overflow-hidden whitespace-nowrap transition-all duration-100 group-hover:duration-300 ease-in-out w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:ml-4">
                            <p className="text-[13px] font-bold text-gray-900 truncate max-w-[120px]">
                                {user.user_metadata?.username || 'Người dùng'}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate max-w-[120px]">{user.email}</p>
                        </div>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute bottom-16 left-14 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden py-2 animate-in fade-in slide-in-from-left-2 z-[100]">
                            <div className="px-4 py-3 border-b border-gray-100 mb-1">
                                <p className="text-sm font-bold text-gray-900 truncate">
                                    {user.user_metadata?.username || 'Người dùng'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            <button 
                                onClick={() => setShowProfileMenu(false)}
                                className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2"
                            >
                                <CircleUser size={16} /> Hồ sơ cá nhân
                            </button>
                            <button 
                                onClick={() => {
                                    setShowProfileMenu(false)
                                    onLogout?.()
                                }} 
                                className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                            >
                                <LogOut size={16} /> Đăng xuất
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mt-auto w-full px-5">
                    <button type="button" aria-label="Log in" onClick={onAuthClick} className="flex items-center p-3 w-full cursor-pointer transition-colors duration-200 text-[#70747c] hover:text-[#252932]" title="Đăng nhập">
                        <div className="w-7 flex-shrink-0 flex justify-center">
                            <LogIn size={28} />
                        </div>
                        <span className="font-bold text-[15px] overflow-hidden whitespace-nowrap transition-all duration-100 group-hover:duration-300 ease-in-out w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:ml-4 text-left">
                            Đăng nhập
                        </span>
                    </button>
                </div>
            )}
        </aside> 
    )
}
