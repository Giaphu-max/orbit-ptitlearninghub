import { introPlaying, introReady, playRoleIntro } from '@/lib/role-intro'
import { preloadHome } from '@/lib/preload'
import { useOrbitStore, type Role } from '@/store/useOrbitStore'

// Chọn / đổi vai trò có màn intro PTIT (lib/role-intro.ts). Đổi vai và chuyển về trang chủ diễn ra phía sau màn đỏ;
// khi màn mở, trang chủ trồi lên lần lượt (class role-entering, index.css).

export const roleGreeting = (role: Role, name: string) => (role === 'teacher' ? 'Chào thầy/cô' : `Chào ${name}`)

const RISE_MS = 2000

export interface EnterRoleOptions {
    /** Tâm màn đỏ: giữa thẻ/nút vừa bấm */
    origin: { x: number; y: number }
    navigate: (to: string) => void
}

export async function enterRole(role: Role, { origin, navigate }: EnterRoleOptions) {
    const state = useOrbitStore.getState()
    if (introPlaying()) return
    // Cảnh 3D tải song song với intro để lúc màn đỏ mở là đã có hình
    preloadHome()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const swap = () => {
        useOrbitStore.getState().setRole(role)
        navigate('/')
        if (!reduce) {
            const root = document.documentElement
            root.classList.add('role-entering')
            window.setTimeout(() => root.classList.remove('role-entering'), RISE_MS)
        }
    }
    if (!introReady()) {
        swap()
        return
    }
    await playRoleIntro(origin, roleGreeting(role, state.learnerName), { swap })
}

/** Tâm của một phần tử trên màn hình, dùng làm gốc của màn đỏ. */
export const centerOf = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
