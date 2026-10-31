import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { loadPdfjs } from '@/lib/kb/parsers'
import { getUploadedFile } from '@/lib/kb/store'
import type { KbChunk, KbSource } from '@/lib/kb/types'

interface Props {
    source: KbSource
    /** Các đoạn của nguồn (để tô đoạn trích và để hiện chữ cho file không render được) */
    chunks: KbChunk[]
    page?: number
    /** Đoạn trích cần tô trên trang */
    highlight?: KbChunk
    onClose: () => void
}

type Rect = { x: number; y: number; w: number; h: number }
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/**
 * Popup xem file nguồn. PDF: render bằng pdf.js, chọn trang, tô đoạn trích (khớp tuần tự các mẩu chữ của trang với văn bản đoạn).
 * DOCX / PPTX: hiện chữ đã đọc theo trang hoặc slide (không dựng lại bố cục).
 */
export function DocViewer({ source, chunks, page: startPage = 1, highlight, onClose }: Props) {
    const total = source.pages ?? Math.max(1, ...chunks.map((c) => c.page ?? 1))
    const [page, setPage] = useState(Math.min(Math.max(1, startPage), total))
    const isPdf = source.format === 'pdf'

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        document.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-strong/40 p-4 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
            <div role="dialog" aria-modal="true" aria-label={source.title} className="flex max-h-[92svh] w-[min(860px,100%)] flex-col overflow-hidden rounded-[24px] border border-white/90 bg-card/95 shadow-raised">
                <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                    <b className="min-w-0 flex-1 truncate text-[15px] text-strong">{source.title}</b>
                    {total > 1 && (
                        <span className="flex items-center gap-1 font-mono text-[13px] text-muted-foreground">
                            <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-30">
                                <ChevronLeft size={16} />
                            </button>
                            {source.format === 'pptx' ? 'Slide' : 'Trang'} {page}/{total}
                            <button type="button" aria-label="Trang sau" disabled={page >= total} onClick={() => setPage(page + 1)} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-30">
                                <ChevronRight size={16} />
                            </button>
                        </span>
                    )}
                    <button type="button" aria-label="Đóng" onClick={onClose} className="rounded-[10px] p-2 text-muted-foreground hover:bg-muted">
                        <X size={18} />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/50 p-4">
                    {isPdf ? <PdfPage source={source} page={page} highlight={highlight && highlight.page === page ? highlight : undefined} /> : <TextPage chunks={chunks.filter((c) => (c.page ?? 1) === page)} highlight={highlight} />}
                </div>
            </div>
        </div>
    )
}

function TextPage({ chunks, highlight }: { chunks: KbChunk[]; highlight?: KbChunk }) {
    if (!chunks.length) return <p className="py-10 text-center text-sm text-muted-foreground">Trang này không có chữ.</p>
    return (
        <div className="space-y-3">
            {chunks.map((c) => (
                <p key={c.id} className={`whitespace-pre-line rounded-xl bg-card p-4 text-[14.5px] leading-relaxed text-foreground ${highlight?.id === c.id ? 'ring-2 ring-brand-600' : ''}`}>
                    {c.kind === 'video' && <b className="mr-2 font-mono text-[12px] text-brand-ink">{`${String(Math.floor((c.start ?? 0) / 60)).padStart(2, '0')}:${String(Math.floor((c.start ?? 0) % 60)).padStart(2, '0')}`}</b>}
                    {c.text}
                </p>
            ))}
        </div>
    )
}

function PdfPage({ source, page, highlight }: { source: KbSource; page: number; highlight?: KbChunk }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const boxRef = useRef<HTMLDivElement>(null)
    const [rects, setRects] = useState<Rect[]>([])
    const [size, setSize] = useState<{ w: number; h: number } | null>(null)
    const [error, setError] = useState(false)
    const docRef = useRef<{ id: string; doc: Promise<import('pdfjs-dist').PDFDocumentProxy> } | null>(null)

    useEffect(() => {
        let alive = true
        let task: { cancel(): void } | null = null
        setError(false)
        void (async () => {
            try {
                const pdfjs = await loadPdfjs()
                if (docRef.current?.id !== source.id) {
                    docRef.current = {
                        id: source.id,
                        doc: (async () => {
                            if (source.url) return pdfjs.getDocument({ url: source.url }).promise
                            const blob = await getUploadedFile(source.id)
                            if (!blob) throw new Error('no file')
                            return pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
                        })(),
                    }
                }
                const doc = await docRef.current.doc
                const pg = await doc.getPage(page)
                const width = boxRef.current?.clientWidth ?? 760
                const base = pg.getViewport({ scale: 1 })
                const scale = Math.min(2, (width / base.width) * (window.devicePixelRatio > 1 ? 1.5 : 1))
                const vp = pg.getViewport({ scale })
                const canvas = canvasRef.current
                if (!canvas || !alive) return
                canvas.width = vp.width
                canvas.height = vp.height
                task = pg.render({ canvas, viewport: vp })
                await (task as unknown as { promise: Promise<void> }).promise
                if (!alive) return
                setSize({ w: vp.width, h: vp.height })
                // Tô đoạn trích: duyệt mẩu chữ theo thứ tự, khớp tuần tự vào văn bản đoạn
                const out: Rect[] = []
                if (highlight) {
                    const target = squash(highlight.text)
                    const content = await pg.getTextContent()
                    let ptr = 0
                    for (const it of content.items as { str?: string; transform?: number[]; width?: number; height?: number }[]) {
                        const s = squash(it.str ?? '')
                        if (!s || !it.transform) continue
                        const idx = target.indexOf(s, ptr)
                        if (idx < 0 || idx - ptr > 60) continue
                        ptr = idx + s.length
                        const tx = pdfjs.Util.transform(vp.transform, it.transform)
                        const h = (it.height || Math.abs(tx[3])) * scale
                        out.push({ x: tx[4], y: tx[5] - h, w: (it.width ?? 0) * scale, h: h * 1.25 })
                    }
                }
                setRects(out)
            } catch (e) {
                if (alive && !(e instanceof Error && e.name === 'RenderingCancelledException')) setError(true)
            }
        })()
        return () => {
            alive = false
            task?.cancel()
        }
    }, [source.id, source.url, page, highlight])

    if (error) return <p className="py-10 text-center text-sm text-muted-foreground">Không mở được file này. Bạn thử tải lại trang nhé.</p>
    return (
        <div ref={boxRef} className="mx-auto w-full max-w-[760px]">
            <div className="relative overflow-hidden rounded-xl border border-border bg-card" style={size ? { aspectRatio: `${size.w}/${size.h}` } : { minHeight: 320 }}>
                <canvas ref={canvasRef} className="block h-auto w-full" />
                {size &&
                    rects.map((r, i) => (
                        <span
                            key={i}
                            aria-hidden
                            className="pointer-events-none absolute rounded bg-brand-600/15 shadow-[inset_3px_0_0_rgb(var(--brand-600))]"
                            style={{ left: `${(r.x / size.w) * 100}%`, top: `${(r.y / size.h) * 100}%`, width: `${(r.w / size.w) * 100}%`, height: `${(r.h / size.h) * 100}%` }}
                        />
                    ))}
            </div>
        </div>
    )
}
