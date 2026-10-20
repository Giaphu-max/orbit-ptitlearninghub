import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useStudioSession } from '@/store/useStudioSession'

/** Xem ảnh toàn màn hình. Phím ←/→ chuyển ảnh; Esc đóng (do view xử lý chung theo thứ tự lightbox → bảng lưới → ngăn phải). */
export function Lightbox() {
    const { shots, selectedId, lightboxOpen } = useStudioSession()
    const closeRef = useRef<HTMLButtonElement>(null)
    const index = shots.findIndex((s) => s.id === selectedId)
    const shot = shots[index]

    const go = (d: number) => {
        const next = useStudioSession.getState().shots[index + d]
        if (next) useStudioSession.getState().select(next.id)
    }

    useEffect(() => {
        if (!lightboxOpen) return
        closeRef.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') go(-1)
            else if (e.key === 'ArrowRight') go(1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lightboxOpen, index])

    if (!lightboxOpen || !shot) return null
    const nav = 'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-foreground/15 text-ink-foreground transition hover:bg-ink-foreground/25 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70'
    return (
        <div role="dialog" aria-modal="true" aria-label="Ảnh toàn màn hình" className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/92 p-4 sm:p-10" onClick={() => useStudioSession.getState().setLightbox(false)}>
            <img src={shot.image} alt={`Ảnh ${index + 1} trong ${shots.length}`} className="max-h-full max-w-full rounded-card object-contain shadow-raised" onClick={(e) => e.stopPropagation()} />
            <button ref={closeRef} type="button" aria-label="Đóng" onClick={() => useStudioSession.getState().setLightbox(false)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink-foreground/15 text-ink-foreground transition hover:bg-ink-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                <X size={18} />
            </button>
            <button type="button" aria-label="Ảnh trước" disabled={index <= 0} onClick={(e) => { e.stopPropagation(); go(-1) }} className={`${nav} left-3`}><ChevronLeft size={22} /></button>
            <button type="button" aria-label="Ảnh sau" disabled={index >= shots.length - 1} onClick={(e) => { e.stopPropagation(); go(1) }} className={`${nav} right-3`}><ChevronRight size={22} /></button>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink-foreground/15 px-3 py-1 font-mono text-xs text-ink-foreground">
                {index + 1}/{shots.length}
                {shot.status === 'done' && ` · ${shot.result?.overall} điểm`}
            </p>
        </div>
    )
}
