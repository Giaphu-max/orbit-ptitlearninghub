import { Home, Brain, type LucideIcon } from 'lucide-react'

export type OrbitTab = 'home' | 'learning'

interface OrbitSidebarProps {
    activeTab: OrbitTab;
    onTabChange: (tab: OrbitTab) => void;
}

const navigation: { label: string; tab: OrbitTab; icon: LucideIcon }[] = [
    { label: 'Trang chủ', tab: 'home', icon: Home },
    { label: 'Khóa học', tab: 'learning', icon: Brain },
]

export function OrbitSidebar({ activeTab, onTabChange }: OrbitSidebarProps) {
    return (
        <aside className="group fixed top-0 left-0 h-full flex w-[90px] hover:w-64 shrink-0 flex-col py-8 z-50 transition-all duration-100 group-hover:duration-300 ease-in-out overflow-hidden bg-surface">
            <div className="flex h-8 w-[90px] items-center justify-center shrink-0">
                <span className="text-[21px] font-bold tracking-[-0.06em] text-gray-900">Orbit</span>
            </div>

            <nav className="flex-1 flex flex-col justify-center w-full gap-8 px-5" aria-label="Điều hướng chính">
                {navigation.map(({ label, tab, icon: Icon }) => {
                    const active = activeTab === tab;
                    return (
                        <button key={label} type="button" aria-label={label} aria-current={active ? 'page' : undefined} onClick={() => onTabChange(tab)} className={`flex items-center p-3 w-full cursor-pointer transition-colors duration-200 ${active ? 'text-brand-700' : 'text-gray-500 hover:text-gray-800'}`}>
                            <div className="w-7 flex-shrink-0 flex justify-center">
                                <Icon size={28} strokeWidth={active ? 2.5 : 2} />
                            </div>
                            <span className="font-bold text-[15px] overflow-hidden whitespace-nowrap transition-all duration-100 group-hover:duration-300 ease-in-out w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:ml-4 text-left">
                                {label}
                            </span>
                        </button>
                    )
                })}
            </nav>
        </aside>
    )
}
