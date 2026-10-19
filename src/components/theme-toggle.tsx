import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'

/** Nút chuyển sáng/tối ở góc trên bên phải: chỉ có icon, kèm aria-label và tooltip. */
export function ThemeToggle() {
    const theme = useThemeStore((s) => s.theme)
    const toggle = useThemeStore((s) => s.toggle)
    const dark = theme === 'dark'
    const label = dark ? 'Chuyển sang giao diện sáng (hoàng hôn)' : 'Chuyển sang giao diện tối (buổi tối)'

    return (
        <div className="group fixed right-4 top-4 z-40 lg:right-6 lg:top-5">
            <button
                type="button"
                onClick={toggle}
                aria-label={label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/85 text-foreground shadow-card backdrop-blur-md transition duration-fast hover:scale-105 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={theme}
                        initial={{ rotate: -70, opacity: 0, scale: 0.6 }}
                        animate={{ rotate: 0, opacity: 1, scale: 1 }}
                        exit={{ rotate: 70, opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.2 }}
                        className="flex"
                    >
                        {dark ? <Moon size={20} /> : <Sun size={20} />}
                    </motion.span>
                </AnimatePresence>
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-raised transition duration-fast group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {label}
            </span>
        </div>
    )
}
