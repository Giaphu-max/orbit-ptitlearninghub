import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Hộp thoại kính dùng chung ở cổng giảng viên: nút ✕ góc phải, bấm ra ngoài hoặc Esc để đóng. */
export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
    const id = useId()
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose())
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])
    return (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-strong/40 p-6 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby={id} style={{ width: `min(${width}px,100%)` }} className="rounded-3xl border border-white/90 bg-card/90 p-7 shadow-raised backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                    <h2 id={id} className="text-2xl font-black tracking-[-0.02em] text-strong">
                        {title}
                    </h2>
                    <button type="button" aria-label="Đóng" onClick={onClose} className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-muted">
                        <X size={18} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

export const fieldCls = 'mt-1.5 block h-[42px] w-full rounded-[11px] border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300'
export const btnPrimary = 'surface-red inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-extrabold text-ink-foreground shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50'
export const btnGhost = 'inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-[15px] font-bold text-strong transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'
