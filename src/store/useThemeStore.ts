import { create } from 'zustand'
import { runThemeTransition } from '@/lib/theme-transition'

// Giao diện sáng/tối. Lưu riêng khỏi trạng thái demo để "Đặt lại dữ liệu demo" không đổi giao diện.
// Class `dark` trên <html> do script trong index.html đặt trước khi vẽ; store chỉ đồng bộ và cập nhật.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'orbit-theme'

const initialTheme = (): Theme =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'

interface ThemeState {
    theme: Theme
    setTheme: (theme: Theme) => void
    toggle: () => void
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
    theme: initialTheme(),
    setTheme: (theme) => {
        // Store cập nhật ngay (bấm liên tiếp vẫn đảo đúng); callback của View Transition chạy bất đồng bộ nên chỉ đổi class ở đó
        set({ theme })
        runThemeTransition(() => document.documentElement.classList.toggle('dark', get().theme === 'dark'))
        try {
            window.localStorage.setItem(STORAGE_KEY, theme)
        } catch {
            // Storage bị chặn: vẫn đổi được, chỉ là không nhớ giữa các lần mở
        }
    },
    toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))
