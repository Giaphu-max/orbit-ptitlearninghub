import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

export interface MenuItem {
    label: string
    icon?: ReactNode
    onSelect: () => void
    danger?: boolean
    disabled?: boolean
}

/** Nút ⋯ luôn hiện + menu thả xuống (Esc / bấm ra ngoài để đóng). */
export function KebabMenu({ label, items }: { label: string; items: MenuItem[] }) {
    const [open, setOpen] = useState(false)
    const wrap = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])
    return (
        <div ref={wrap} className="relative">
            <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-muted hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                <MoreHorizontal size={18} />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-60 rounded-[14px] border border-border bg-card p-1.5 shadow-raised">
                    {items.map((it) => (
                        <button
                            key={it.label}
                            type="button"
                            role="menuitem"
                            disabled={it.disabled}
                            onClick={() => (setOpen(false), it.onSelect())}
                            className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${it.danger ? 'text-brand-ink' : 'text-foreground'}`}
                        >
                            {it.icon}
                            {it.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
