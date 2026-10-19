import { create } from 'zustand'

// Giao diện sáng/tối. Lưu riêng khỏi trạng thái demo để "Đặt lại dữ liệu demo" không đổi giao diện.
// Class `dark` trên <html> do script trong index.html đặt trước khi vẽ; store chỉ đồng bộ và cập nhật.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'orbit-theme'
const FADE_MS = 750

const initialTheme = (): Theme =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'

interface ThemeState {
    theme: Theme
    setTheme: (theme: Theme) => void
    toggle: () => void
}

let fadeTimer = 0

export const useThemeStore = create<ThemeState>()((set, get) => ({
    theme: initialTheme(),
    setTheme: (theme) => {
        const root = document.documentElement
        // Chuyển mượt bằng class tạm (CSS tự tắt khi người dùng chọn giảm chuyển động)
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            root.classList.add('theme-fade')
            window.clearTimeout(fadeTimer)
            fadeTimer = window.setTimeout(() => root.classList.remove('theme-fade'), FADE_MS)
        }
        root.classList.toggle('dark', theme === 'dark')
        try {
            window.localStorage.setItem(STORAGE_KEY, theme)
        } catch {
            // Storage bị chặn: vẫn đổi được, chỉ là không nhớ giữa các lần mở
        }
        set({ theme })
    },
    toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))
