import { GraduationCap, Presentation, ArrowRight, type LucideIcon } from 'lucide-react'
import { useOrbitStore, type Role } from '@/store/useOrbitStore'

const ROLES: { role: Role; title: string; description: string; icon: LucideIcon }[] = [
    {
        role: 'student',
        title: 'Sinh viên',
        description: 'Học bài giảng có trợ giảng AI, làm quiz củng cố, đọc Orbit Daily và tích XP theo mức độ hiểu bài.',
        icon: GraduationCap,
    },
    {
        role: 'teacher',
        title: 'Giảng viên',
        description: 'Duyệt và chỉnh nội dung AI tạo ra trước khi xuất bản, xem khái niệm nào lớp hay sai.',
        icon: Presentation,
    },
]

// Màn chọn vai trò thay cho đăng nhập (bản demo không có tài khoản thật).
export function OrbitRoleSelect() {
    const setRole = useOrbitStore((s) => s.setRole)

    return (
        <div className="min-h-screen w-full bg-surface px-6 py-16 lg:px-12">
            <div className="mx-auto flex max-w-5xl flex-col">
                <p className="text-eyebrow uppercase text-brand-ink">Orbit · PTIT Learning Hub</p>
                <h1 className="mt-4 max-w-3xl text-display text-foreground">Bạn vào Orbit với vai trò nào?</h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                    Đây là bản demo nên không cần đăng nhập. Tiến độ được lưu ngay trên trình duyệt này, có thể đổi vai trò hoặc đặt lại bất cứ lúc nào.
                </p>

                <div className="mt-12 grid gap-5 md:grid-cols-2">
                    {ROLES.map(({ role, title, description, icon: Icon }) => (
                        <button
                            key={role}
                            type="button"
                            onClick={() => setRole(role)}
                            className="group flex flex-col items-start rounded-panel border border-border bg-card p-8 text-left shadow-card transition duration-base ease-out hover:-translate-y-1 hover:border-brand-200 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                            <span className="flex h-14 w-14 items-center justify-center rounded-card bg-brand-soft text-brand-ink transition duration-base group-hover:bg-brand-600 group-hover:text-ink-foreground">
                                <Icon size={28} strokeWidth={2} />
                            </span>
                            <span className="mt-8 text-title text-foreground">{title}</span>
                            <span className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</span>
                            <span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-ink">
                                Vào với vai trò {title.toLowerCase()}
                                <ArrowRight size={16} className="transition duration-base group-hover:translate-x-1" />
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
