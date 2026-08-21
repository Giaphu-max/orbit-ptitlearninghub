'use client'

import { Compass, Home, Plus, Brain, Glasses, type LucideIcon } from 'lucide-react'
export type OrbitTab = 'home' | 'discover' | 'learning' | 'vr'
interface OrbitSidebarProps { activeTab: OrbitTab; onTabChange: (tab: OrbitTab) => void; onCreate: () => void }
const navigation: { label: string; tab: OrbitTab; icon: LucideIcon }[] = [
    { label: 'Home', tab: 'home', icon: Home }, 
    { label: 'Explore', tab: 'discover', icon: Compass }, 
    { label: 'Deep learning', tab: 'learning', icon: Brain }
]

export function OrbitSidebar({ activeTab, onTabChange, onCreate }: OrbitSidebarProps) { 
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
                <button type="button" aria-label="Create" onClick={onCreate} className="flex h-16 w-16 items-center justify-center rounded-[15px] text-[#70747c] transition-colors hover:bg-[#f0f1f3] hover:text-[#252932]">
                    <Plus size={32} />
                </button>
                <button type="button" aria-label="Visual lessons" aria-current={activeTab === 'vr' ? 'page' : undefined} onClick={() => onTabChange('vr')} className={`flex h-16 w-16 items-center justify-center rounded-[15px] transition-colors ${activeTab === 'vr' ? 'bg-[#ffdeda] text-[#b7131e] shadow-sm' : 'text-[#70747c] hover:bg-[#f0f1f3] hover:text-[#252932]'}`}>
                    <Glasses size={32} strokeWidth={activeTab === 'vr' ? 2.5 : 2} />
                </button>
            </nav>
            
            <button type="button" aria-label="Open profile" className="mt-auto h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-[#202328] shadow-sm">
                <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white">AM</span>
            </button>
        </aside> 
    )
}
