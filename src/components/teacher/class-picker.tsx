import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { TEACHER_CLASSES } from '@/data/classes'
import { useOrbitStore } from '@/store/useOrbitStore'

/** Chọn lớp để xem thống kê: đọc/ghi lớp đang chọn trong store. Chỉ có ở trang Lớp học. */
export function ClassPicker() {
    const current = useOrbitStore((s) => s.teacherClassId)
    const setStored = useOrbitStore((s) => s.setTeacherClass)
    const cls = TEACHER_CLASSES.find((c) => c.id === current) ?? TEACHER_CLASSES[0]
    const pick = (id: string) => setStored(id)
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const item = 'grid w-full grid-cols-[1fr_auto_16px] items-center gap-2 rounded-[10px] p-2.5 text-left text-sm transition'
    return (
        <div ref={ref} className="relative inline-block">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13.5px] font-bold text-strong shadow-card transition hover:border-muted-foreground/40"
            >
                Lớp <span className="font-mono">{cls.id}</span>
                <span className="font-medium text-muted-foreground">· {cls.size} SV</span>
                <ChevronDown size={13} className={`transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && (
                <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-30 w-[340px] rounded-[14px] border border-border bg-card p-1.5 shadow-raised">
                    {TEACHER_CLASSES.map((c) => (
                        <button key={c.id} type="button" role="menuitemradio" aria-checked={c.id === cls.id} onClick={() => (pick(c.id), setOpen(false))} className={`${item} ${c.id === cls.id ? 'bg-brand-50' : 'hover:bg-muted'}`}>
                            <span className="min-w-0">
                                <b className={`block font-mono font-bold ${c.id === cls.id ? 'text-brand-ink' : 'text-strong'}`}>{c.id}</b>
                                <small className="text-xs text-muted-foreground">{c.subject}</small>
                            </span>
                            <small className="font-mono text-xs text-muted-foreground">{c.size} SV</small>
                            {c.id === cls.id ? <Check size={14} className="text-brand-ink" /> : <span />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
