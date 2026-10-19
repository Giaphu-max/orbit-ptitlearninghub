import { Home, Brain, Trophy, GraduationCap, Presentation, ClipboardCheck, Repeat, RotateCcw, type LucideIcon } from 'lucide-react'
import { useOrbitStore } from '@/store/useOrbitStore'

export type OrbitTab = 'home' | 'learning' | 'journey' | 'teacher'

interface OrbitSidebarProps {
    activeTab: OrbitTab;
    onTabChange: (tab: OrbitTab) => void;
}

const navigation: { label: string; tab: OrbitTab; icon: LucideIcon }[] = [
    { label: 'Trang chủ', tab: 'home', icon: Home },
    { label: 'Khóa học', tab: 'learning', icon: Brain },
    { label: 'Hành trình', tab: 'journey', icon: Trophy },
]

const teacherNavigation: { label: string; tab: OrbitTab; icon: LucideIcon }[] = [
    { label: 'Duyệt & thống kê', tab: 'teacher', icon: ClipboardCheck },
]

const labelClass = 'font-bold text-[15px] overflow-hidden whitespace-nowrap transition-all duration-100 group-hover:duration-300 ease-in-out w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:ml-4 text-left'
const itemClass = 'flex items-center p-3 w-full cursor-pointer transition-colors duration-200'

export function OrbitSidebar({ activeTab, onTabChange }: OrbitSidebarProps) {
    const role = useOrbitStore((s) => s.role)
    const setRole = useOrbitStore((s) => s.setRole)
    const resetDemo = useOrbitStore((s) => s.resetDemo)
    const RoleIcon = role === 'teacher' ? Presentation : GraduationCap

    const handleReset = () => {
        if (window.confirm('Xóa toàn bộ XP, tiến độ và nội dung đã duyệt trên trình duyệt này?')) resetDemo()
    }

    return (
        <aside className="group fixed top-0 left-0 h-full flex w-[90px] hover:w-64 shrink-0 flex-col py-8 z-50 transition-all duration-100 group-hover:duration-300 ease-in-out overflow-hidden bg-surface">
            <div className="flex h-8 w-[90px] items-center justify-center shrink-0">
                <span className="text-[21px] font-bold tracking-[-0.06em] text-foreground">Orbit</span>
            </div>

            <nav className="flex-1 flex flex-col justify-center w-full gap-8 px-5" aria-label="Điều hướng chính">
                {(role === 'teacher' ? [...navigation, ...teacherNavigation] : navigation).map(({ label, tab, icon: Icon }) => {
                    const active = activeTab === tab;
                    return (
                        <button key={label} type="button" aria-label={label} aria-current={active ? 'page' : undefined} onClick={() => onTabChange(tab)} className={`${itemClass} ${active ? 'text-brand-ink' : 'text-muted-foreground hover:text-foreground'}`}>
                            <div className="w-7 flex-shrink-0 flex justify-center">
                                <Icon size={28} strokeWidth={active ? 2.5 : 2} />
                            </div>
                            <span className={labelClass}>{label}</span>
                        </button>
                    )
                })}
            </nav>

            <div className="mt-auto flex w-full flex-col gap-1 px-5">
                <div className={`${itemClass} cursor-default text-foreground`} title="Vai trò hiện tại">
                    <div className="w-7 flex-shrink-0 flex justify-center">
                        <RoleIcon size={24} />
                    </div>
                    <span className={labelClass}>{role === 'teacher' ? 'Giảng viên' : 'Sinh viên'}</span>
                </div>
                <button type="button" onClick={() => setRole(null)} className={`${itemClass} text-muted-foreground hover:text-foreground`} aria-label="Đổi vai trò">
                    <div className="w-7 flex-shrink-0 flex justify-center">
                        <Repeat size={20} />
                    </div>
                    <span className={`${labelClass} text-[13px]`}>Đổi vai trò</span>
                </button>
                <button type="button" onClick={handleReset} className={`${itemClass} text-muted-foreground hover:text-brand-ink`} aria-label="Đặt lại dữ liệu demo">
                    <div className="w-7 flex-shrink-0 flex justify-center">
                        <RotateCcw size={20} />
                    </div>
                    <span className={`${labelClass} text-[13px]`}>Đặt lại dữ liệu demo</span>
                </button>
            </div>
        </aside>
    )
}
