import { create } from 'zustand'
import { introPlaying } from '@/lib/role-intro'
import { curtainPlaying, curtainReady, playCurtain } from '@/lib/theme-switch'

// Giao diện sáng/tối. Lưu riêng khỏi trạng thái demo để "Đặt lại dữ liệu demo" không đổi giao diện.
// Class `dark` trên <html> do script trong index.html đặt trước khi vẽ; store chỉ đồng bộ và cập nhật.
// Đổi giao diện có màn phủ PTIT (lib/theme-switch.ts); giảm chuyển động thì đổi ngay.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'orbit-theme'

const initialTheme = (): Theme =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'

interface ThemeState {
    theme: Theme
    /** Đang chạy hiệu ứng chuyển: nút bị khóa */
    busy: boolean
    /** Màn đang che kín: cảnh 3D ngừng vẽ và đặt thẳng ánh sáng mới */
    frozen: boolean
    setTheme: (theme: Theme, origin?: { x: number; y: number }) => void
    toggle: (origin?: { x: number; y: number }) => void
}

export const useThemeStore = create<ThemeState>()((set, get) => {
    // Đổi thật sự: tắt transition màu trong lúc đổi, bật lại sau 2 khung hình
    const apply = (theme: Theme) => {
        const root = document.documentElement
        root.classList.add('switching')
        root.classList.toggle('dark', theme === 'dark')
        try {
            window.localStorage.setItem(STORAGE_KEY, theme)
        } catch {
            // Storage bị chặn: vẫn đổi được, chỉ là không nhớ giữa các lần mở
        }
        set({ theme })
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('switching')))
    }

    return {
        theme: initialTheme(),
        busy: false,
        frozen: false,
        setTheme: (theme, origin) => {
            const { busy, theme: cur } = get()
            if (busy || theme === cur || curtainPlaying() || introPlaying()) return
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            if (reduce || !curtainReady()) {
                apply(theme)
                return
            }
            set({ busy: true })
            const o = origin ?? { x: window.innerWidth - 40, y: 40 }
            void playCurtain(o, theme === 'dark', {
                swap: () => apply(theme),
                freeze: (on) => set({ frozen: on }),
            }).finally(() => set({ busy: false, frozen: false }))
        },
        toggle: (origin) => get().setTheme(get().theme === 'dark' ? 'light' : 'dark', origin),
    }
})
