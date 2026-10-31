import { useRef } from 'react'
import { ArrowRightLeft, FileText, FileType2, Pencil, Play, Presentation, RefreshCw, Replace, Trash2 } from 'lucide-react'
import type { LibraryItem } from '@/lib/library'
import type { KbFormat } from '@/lib/kb/types'
import { DOC_ACCEPT } from '@/lib/kb/parsers'
import { KebabMenu } from './kebab-menu'

export const glass = 'rounded-3xl border border-white/90 bg-card/80 shadow-[0_24px_50px_-32px_hsl(var(--foreground-strong)/0.45)] backdrop-blur-xl'
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const ICON: Record<KbFormat, { label: string; cls: string; icon: typeof FileText }> = {
    pdf: { label: 'PDF', cls: 'from-brand-500 to-brand-800', icon: FileText },
    docx: { label: 'DOC', cls: 'from-info to-strong', icon: FileType2 },
    pptx: { label: 'PPT', cls: 'from-mm-pink to-brand-800', icon: Presentation },
    video: { label: '', cls: 'from-strong to-ink', icon: Play },
}

function meta({ source: s, lesson }: LibraryItem) {
    if (s.kind === 'video') return `Video ${mmss(s.durationSec ?? 0)} · ${lesson ? `${lesson.concepts.length} khái niệm · ` : ''}${s.chunkCount} đoạn`
    const unit = s.format === 'pptx' ? 'slide' : 'trang'
    return [s.pages ? `${s.pages} ${unit}` : null, `${s.chunkCount} đoạn`].filter(Boolean).join(' · ')
}

interface Props {
    item: LibraryItem
    /** Số thứ tự bài (video) trong khóa */
    index?: number
    /** Trích một dòng khi khớp tìm kiếm trong nội dung */
    snippet?: string
    onOpen: () => void
    onRename: () => void
    onMove: () => void
    onReplace: (file: File) => void
    onReread: () => void
    onDelete: () => void
}

export function SourceCard({ item, index, snippet, onOpen, onRename, onMove, onReplace, onReread, onDelete }: Props) {
    const { source, reading } = item
    const ic = ICON[source.format]
    const pct = reading ? Math.round(reading.progress * 100) : 100
    const file = useRef<HTMLInputElement>(null)
    const isVideo = source.kind === 'video'

    return (
        <div className={`${glass} group relative p-4 transition duration-base hover:-translate-y-[3px] hover:shadow-raised`}>
            <button type="button" onClick={onOpen} disabled={Boolean(reading)} aria-label={`Xem ${source.title}`} className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-default" />
            <div className="pointer-events-none relative flex items-start gap-3.5 pr-8">
                <span className={`flex h-[52px] w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-mono text-[11px] font-extrabold text-ink-foreground ${ic.cls}`}>{ic.label || <Play size={16} className="fill-current" aria-hidden />}</span>
                <span className="min-w-0 flex-1">
                    {isVideo && index !== undefined && <span className="mb-0.5 block font-mono text-[11px] font-bold text-brand-ink">Bài {index + 1}</span>}
                    <b className="block text-[15px] leading-snug text-strong">{source.title}</b>
                    <small className="mt-1 block text-[12.5px] text-muted-foreground">{reading ? (isVideo ? 'Đang lấy phụ đề…' : 'Đang tách trang…') : meta(item)}</small>
                </span>
            </div>
            {snippet && (
                <p className="pointer-events-none relative mt-2.5 line-clamp-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs text-brand-ink">
                    <b>Khớp trong nội dung:</b> {snippet}
                </p>
            )}
            {reading ? (
                <>
                    <span className="pointer-events-none relative mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-ink">
                        <i className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
                        AI đang đọc · {pct}%
                    </span>
                    <span className="pointer-events-none relative mt-2.5 block h-1 overflow-hidden rounded-sm bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ AI đọc">
                        <i className="block h-full bg-brand-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
                    </span>
                </>
            ) : (
                <span className="pointer-events-none relative mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">✓ AI đã đọc</span>
            )}
            <div className="absolute right-2.5 top-2.5 z-10">
                <KebabMenu
                    label={`Tùy chọn cho ${source.title}`}
                    items={[
                        { label: 'Đổi tên', icon: <Pencil size={15} aria-hidden />, onSelect: onRename },
                        { label: 'Chuyển sang khóa khác', icon: <ArrowRightLeft size={15} aria-hidden />, onSelect: onMove },
                        { label: 'Thay file', icon: <Replace size={15} aria-hidden />, onSelect: () => file.current?.click(), disabled: Boolean(reading) },
                        { label: 'Cho AI đọc lại', icon: <RefreshCw size={15} aria-hidden />, onSelect: onReread, disabled: Boolean(reading) },
                        { label: 'Xóa', icon: <Trash2 size={15} aria-hidden />, onSelect: onDelete, danger: true },
                    ]}
                />
                <input ref={file} type="file" hidden accept={isVideo ? 'video/mp4,video/quicktime,.mp4,.mov' : DOC_ACCEPT} onChange={(e) => (e.target.files?.[0] && onReplace(e.target.files[0]), (e.target.value = ''))} />
            </div>
        </div>
    )
}
