import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, X } from 'lucide-react'
import { getConcept, getConceptLesson } from '@/data'
import { formatTime } from '@/lib/youtube'

export interface OpenConcept {
    id: string
    anchor: HTMLElement
}

const WIDTH = 320
const GAP = 10
const MARGIN = 16

/** Popover định nghĩa khái niệm, bám theo từ khóa đang bấm (cập nhật khi cuộn/đổi cỡ màn hình). */
export function ConceptPopover({ open, onClose }: { open: OpenConcept; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState<{ left: number; top: number; arrow: number } | null>(null)
    const concept = getConcept(open.id)
    const lesson = getConceptLesson(open.id)

    useLayoutEffect(() => {
        const place = () => {
            const r = open.anchor.getBoundingClientRect()
            const w = Math.min(WIDTH, window.innerWidth - MARGIN * 2)
            const h = ref.current?.offsetHeight ?? 180
            const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - w / 2), window.innerWidth - w - MARGIN)
            const below = r.bottom + GAP + h <= window.innerHeight - MARGIN || r.top - GAP - h < MARGIN
            setPos({ left, top: below ? r.bottom + GAP : r.top - GAP - h, arrow: Math.min(Math.max(16, r.left + r.width / 2 - left), w - 16) })
        }
        place()
        window.addEventListener('scroll', place, { passive: true })
        window.addEventListener('resize', place)
        return () => {
            window.removeEventListener('scroll', place)
            window.removeEventListener('resize', place)
        }
    }, [open])

    useEffect(() => {
        const key = (e: KeyboardEvent) => e.key === 'Escape' && (onClose(), open.anchor.focus())
        const down = (e: PointerEvent) => {
            const t = e.target as Node
            if (!ref.current?.contains(t) && !open.anchor.contains(t)) onClose()
        }
        document.addEventListener('keydown', key)
        document.addEventListener('pointerdown', down)
        return () => {
            document.removeEventListener('keydown', key)
            document.removeEventListener('pointerdown', down)
        }
    }, [open, onClose])

    if (!concept) return null

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={`Khái niệm: ${concept.name}`}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: Math.min(WIDTH, window.innerWidth - MARGIN * 2), visibility: pos ? 'visible' : 'hidden' }}
            className="fixed z-50 animate-in fade-in rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-card duration-fast"
        >
            <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <X size={14} />
            </button>
            <p className="text-eyebrow uppercase text-brand-ink">Khái niệm</p>
            <p className="mt-1.5 pr-6 text-base font-extrabold leading-snug text-foreground">{concept.name}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{concept.definition}</p>
            {lesson && (
                <Link
                    to={`/lesson/${lesson.id}?t=${concept.segment.start}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-ink-foreground shadow-brand transition hover:bg-brand-700"
                >
                    <Play size={13} fill="currentColor" /> Xem đoạn giảng <span className="font-mono">{formatTime(concept.segment.start)}</span>
                </Link>
            )}
        </div>
    )
}
