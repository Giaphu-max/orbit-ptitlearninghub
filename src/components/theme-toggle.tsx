import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'

type Tone = 'hero' | 'plain'

/**
 * Nút chuyển sáng/tối: chỉ có icon, kèm aria-label và tooltip.
 * Cả hai tone đều theo token giao diện (trang chủ không còn nền tối cố định); giữ prop để nơi gọi không phải đổi.
 */
export function ThemeToggle({ tone = 'plain', className = 'relative' }: { tone?: Tone; className?: string }) {
    const theme = useThemeStore((s) => s.theme)
    const toggle = useThemeStore((s) => s.toggle)
    const busy = useThemeStore((s) => s.busy)
    const dark = theme === 'dark'
    const label = dark ? 'Chuyển sang giao diện sáng (hoàng hôn)' : 'Chuyển sang giao diện tối (buổi tối)'

    return (
        <div className={`group ${className}`}>
            <button
                type="button"
                onClick={(e) => {
                    const b = e.currentTarget.getBoundingClientRect()
                    toggle({ x: b.left + b.width / 2, y: b.top + b.height / 2 })
                }}
                aria-disabled={busy}
                aria-label={label}
                data-tone={tone}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition duration-fast hover:scale-105 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
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
                        {dark ? <Moon size={18} /> : <Sun size={18} />}
                    </motion.span>
                </AnimatePresence>
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-ink-foreground opacity-0 shadow-raised transition duration-fast group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {label}
            </span>
        </div>
    )
}
