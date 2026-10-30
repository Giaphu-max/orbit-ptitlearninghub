import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, X } from 'lucide-react'
import type { Course } from '@/data/types'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
export const field = 'h-11 w-full rounded-[10px] border border-border bg-card px-3.5 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200'
export const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground'

export interface MenuItem {
    label: string
    onSelect: () => void
    danger?: boolean
}

/** Nút "⋯" mở menu (portal, neo dưới nút, căn phải nên không bị cắt bởi overflow của thẻ); Esc / bấm ngoài đóng, ↑↓ di chuyển, trả focus về nút.
 *  `card` = nút tròn 28px nổi trên thumbnail; mặc định = ô vuông 32px ở hàng tiêu đề khóa. */
export function MoreMenu({ label, items, className = 'relative', card }: { label: string; items: MenuItem[]; className?: string; card?: boolean }) {
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
    const open = pos !== null
    const menuRef = useRef<HTMLDivElement>(null)
    const btn = useRef<HTMLButtonElement>(null)
    const close = (refocus = true) => {
        setPos(null)
        if (refocus) btn.current?.focus()
    }
    useEffect(() => {
        if (!open) return
        menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
        const onDown = (e: PointerEvent) => {
            const t = e.target as Node
            if (!menuRef.current?.contains(t) && !btn.current?.contains(t)) setPos(null)
        }
        const hide = () => setPos(null)
        document.addEventListener('pointerdown', onDown)
        window.addEventListener('resize', hide)
        window.addEventListener('scroll', hide, true)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            window.removeEventListener('resize', hide)
            window.removeEventListener('scroll', hide, true)
        }
    }, [open])
    const toggle = () => {
        if (open) return close()
        const r = btn.current?.getBoundingClientRect()
        if (r) setPos({ top: r.bottom + 6, right: document.documentElement.clientWidth - r.right })
    }
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && open) return (e.stopPropagation(), close())
        if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
        e.preventDefault()
        const els = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
        const i = els.indexOf(document.activeElement as HTMLElement)
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus()
    }
    return (
        <div className={className} onKeyDown={onKey} onClick={(e) => e.stopPropagation()}>
            <button
                ref={btn}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggle}
                className={
                    card
                        ? 'grid h-7 w-7 place-items-center rounded-full border border-border bg-card/90 text-strong shadow-card backdrop-blur-sm transition hover:bg-card focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 group-focus-within:bg-card group-hover:bg-card'
                        : 'grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-card transition hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600'
                }
            >
                <MoreHorizontal size={card ? 16 : 18} aria-hidden />
            </button>
            {open &&
                createPortal(
                    <div ref={menuRef} role="menu" aria-label={label} style={{ top: pos.top, right: pos.right }} className="fixed z-[70] w-60 rounded-[14px] border border-border bg-card p-1.5 shadow-raised">
                        {items.map((it) => (
                            <button
                                key={it.label}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    close(false)
                                    it.onSelect()
                                }}
                                className={`block w-full rounded-[10px] px-3 py-2 text-left text-[13.5px] font-semibold transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${it.danger ? 'text-destructive' : 'text-strong'}`}
                            >
                                {it.label}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </div>
    )
}

/** Hộp thoại nhỏ: focus trap, Esc đóng, bấm nền đóng, trả focus về nút đã mở. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    const root = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') return onClose()
            if (e.key !== 'Tab' || !root.current) return
            const els = [...root.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
            if (!els.length) return
            if (e.shiftKey && document.activeElement === els[0]) (e.preventDefault(), els[els.length - 1].focus())
            else if (!e.shiftKey && document.activeElement === els[els.length - 1]) (e.preventDefault(), els[0].focus())
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
            prev?.focus?.()
        }
    }, [onClose])
    return (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-auto bg-ink/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div ref={root} role="dialog" aria-modal="true" aria-label={title} className="m-auto w-[min(640px,calc(100vw-48px))] rounded-[20px] border border-border bg-card p-8 shadow-raised">
                <div className="flex items-start justify-between gap-3">
                    <h2 className="text-2xl font-black leading-tight text-strong">{title}</h2>
                    <button
                        type="button"
                        aria-label="Đóng"
                        onClick={onClose}
                        className="-mr-2 -mt-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                        <X size={18} aria-hidden />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

export const ghost = 'h-11 rounded-[10px] px-4 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600'
export const primary = 'surface-red h-11 rounded-[10px] px-5 text-sm font-extrabold text-ink-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50'

/** Xác nhận: "Hủy" nhận focus mặc định; nút chính đỏ. `extra` là nút phụ (ví dụ tắt nhanh), `blocked` thì không cho xác nhận. */
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, blocked, extra }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; blocked?: boolean; extra?: ReactNode }) {
    const cancel = useRef<HTMLButtonElement>(null)
    useEffect(() => cancel.current?.focus(), [])
    return (
        <Modal title={title} onClose={onClose}>
            <div className="mt-3 text-base leading-[1.6] text-muted-foreground">{children}</div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
                {extra}
                <button ref={cancel} type="button" onClick={onClose} className={ghost}>
                    Hủy
                </button>
                {!blocked && (
                    <button type="button" onClick={onConfirm} className={primary}>
                        {confirmLabel}
                    </button>
                )}
            </div>
        </Modal>
    )
}

export function RenameDialog({ title, label, initial, onSave, onClose }: { title: string; label: string; initial: string; onSave: (v: string) => void; onClose: () => void }) {
    const [v, setV] = useState(initial)
    const ref = useRef<HTMLInputElement>(null)
    useEffect(() => ref.current?.select(), [])
    const ok = v.trim() !== '' && v.trim() !== initial
    const submit = () => {
        if (!ok) return
        onSave(v.trim())
        onClose()
    }
    return (
        <Modal title={title} onClose={onClose}>
            <label htmlFor="rename-input" className={`${labelCls} mt-4`}>
                {label}
            </label>
            <input id="rename-input" ref={ref} value={v} maxLength={160} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className={field} />
            <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className={ghost}>
                    Hủy
                </button>
                <button type="button" onClick={submit} disabled={!ok} className={primary}>
                    Lưu
                </button>
            </div>
        </Modal>
    )
}

export function MoveDialog({ lessonTitle, currentId, courses, onMove, onClose }: { lessonTitle: string; currentId: string; courses: Pick<Course, 'id' | 'title'>[]; onMove: (courseId: string) => void; onClose: () => void }) {
    const [target, setTarget] = useState(currentId)
    return (
        <Modal title={`Chuyển “${lessonTitle}” sang khóa khác`} onClose={onClose}>
            <label htmlFor="move-course" className={`${labelCls} mt-4`}>
                Khóa học
            </label>
            <select id="move-course" value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
                {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.title}
                    </option>
                ))}
            </select>
            <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className={ghost}>
                    Hủy
                </button>
                <button
                    type="button"
                    onClick={() => {
                        onMove(target)
                        onClose()
                    }}
                    disabled={target === currentId}
                    className={primary}
                >
                    Chuyển
                </button>
            </div>
        </Modal>
    )
}
