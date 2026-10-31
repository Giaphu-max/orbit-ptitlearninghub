import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, MoreHorizontal, Pencil, Play, Plus, Presentation, Sparkles, Trash2, FileType2, Undo2 } from 'lucide-react'
import { staticCourses } from '@/data'
import { chunksOf, selectSources, useKb, type Reading } from '@/lib/kb/store'
import type { KbFormat, KbSource } from '@/lib/kb/types'
import { UploadDialog } from '@/components/kb/upload-dialog'

const DocViewer = lazy(() => import('@/components/kb/doc-viewer').then((m) => ({ default: m.DocViewer })))

const glass = 'rounded-3xl border border-white/90 bg-card/80 shadow-[0_24px_50px_-32px_hsl(var(--foreground-strong)/0.45)] backdrop-blur-xl'
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const ICON: Record<KbFormat, { label: string; cls: string; icon: typeof FileText }> = {
    pdf: { label: 'PDF', cls: 'from-brand-500 to-brand-800', icon: FileText },
    docx: { label: 'DOC', cls: 'from-info to-strong', icon: FileType2 },
    pptx: { label: 'PPT', cls: 'from-mm-pink to-brand-800', icon: Presentation },
    video: { label: '', cls: 'from-strong to-ink', icon: Play },
}

function meta(s: KbSource) {
    if (s.kind === 'video') return `Video ${mmss(s.durationSec ?? 0)} · ${s.chunkCount} đoạn`
    const unit = s.format === 'pptx' ? 'slide' : 'trang'
    return [s.pages ? `${s.pages} ${unit}` : null, `${s.chunkCount} đoạn`].filter(Boolean).join(' · ')
}

/** Cổng giảng viên: Kho tài liệu. Giảng viên chỉ tải tài liệu/video lên làm nguồn kiến thức duy nhất của trợ giảng AI. */
export function OrbitTeacherKbView() {
    const kb = useKb()
    const [upload, setUpload] = useState(false)
    const [viewing, setViewing] = useState<KbSource | null>(null)
    const [toast, setToast] = useState('')

    useEffect(() => void kb.load(), [kb.load]) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!toast) return
        const t = window.setTimeout(() => setToast(''), 2800)
        return () => window.clearTimeout(t)
    }, [toast])
    // Hoàn tác 5 giây sau khi xóa, hết giờ thì xóa hẳn
    useEffect(() => {
        if (!kb.undo) return
        const t = window.setTimeout(() => useKb.getState().dismissUndo(), 5000)
        return () => window.clearTimeout(t)
    }, [kb.undo])

    const sources = selectSources(kb)
    const reading = Object.values(kb.reading)
    const readyCount = sources.length
    const total = readyCount + reading.length
    const chunkTotal = sources.reduce((a, s) => a + s.chunkCount, 0)
    const sectionTotal = sources.reduce((a, s) => a + s.sectionCount, 0)

    const groups = useMemo(
        () =>
            staticCourses
                .map((c) => ({
                    course: c,
                    items: [...reading.filter((r) => r.source.courseId === c.id).map((r) => ({ source: r.source, reading: r })), ...sources.filter((s) => s.courseId === c.id).map((s) => ({ source: s, reading: undefined as Reading | undefined }))],
                }))
                .filter((g) => g.items.length > 0),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [kb.reading, kb.uploads, kb.removed, kb.renames],
    )

    return (
        <div className="mx-auto max-w-[1280px]">
            <div className="flex items-end justify-between gap-6">
                <div>
                    <h1 className="m-0 text-[32px] font-black tracking-[-0.03em] text-strong">Kho tài liệu của khóa học</h1>
                    <p className="mt-1.5 text-[15.5px] text-muted-foreground">Tài liệu và video ở đây là nguồn kiến thức duy nhất của trợ giảng AI.</p>
                </div>
                <button type="button" onClick={() => setUpload(true)} className="surface-red inline-flex h-[52px] shrink-0 items-center gap-3 rounded-full pl-[22px] pr-2 text-[15.5px] font-extrabold text-ink-foreground shadow-brand transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    Tải lên
                    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-ink-foreground text-brand-600">
                        <Plus size={18} />
                    </span>
                </button>
            </div>

            <div className={`${glass} mt-6 grid grid-cols-[auto_1fr_auto] items-center gap-[22px] px-6 py-5 max-md:grid-cols-1`}>
                <span className="surface-red flex h-[54px] w-[54px] items-center justify-center rounded-2xl text-ink-foreground shadow-brand">
                    <Sparkles size={24} aria-hidden />
                </span>
                <span>
                    <b className="block text-[17px] text-strong">
                        Trợ giảng AI đã đọc {readyCount}/{total} nguồn
                    </b>
                    <small className="mt-1 block text-[13.5px] text-muted-foreground">Sinh viên hỏi gì ngoài các nguồn này, AI sẽ trả lời “không có trong tài liệu”.</small>
                </span>
                <span className="flex">
                    <span className="border-l border-border px-[22px] text-[12.5px] text-muted-foreground">
                        <b className="mb-0.5 block font-mono text-[22px] font-extrabold text-strong">{chunkTotal}</b>đoạn kiến thức
                    </span>
                    <span className="border-l border-border pl-[22px] text-[12.5px] text-muted-foreground">
                        <b className="mb-0.5 block font-mono text-[22px] font-extrabold text-strong">{sectionTotal}</b>khái niệm
                    </span>
                </span>
            </div>

            {total === 0 && (
                <div className={`${glass} mt-8 p-10 text-center`}>
                    <b className="block text-lg text-strong">Kho đang trống</b>
                    <p className="mt-1.5 text-sm text-muted-foreground">Tải một tài liệu hoặc video lên để trợ giảng AI bắt đầu đọc.</p>
                </div>
            )}

            {groups.map(({ course, items }) => (
                <section key={course.id} className="mt-8" aria-labelledby={`g-${course.id}`}>
                    <div className="mb-3 flex items-baseline gap-3">
                        <h2 id={`g-${course.id}`} className="m-0 text-xl font-black text-strong">
                            {course.title}
                        </h2>
                        <small className="text-[13px] text-muted-foreground">{items.length} nguồn</small>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
                        {items.map(({ source, reading: r }) => (
                            <SourceCard key={source.id} source={source} reading={r} onOpen={() => setViewing(source)} />
                        ))}
                    </div>
                </section>
            ))}

            <p className="mt-10 text-xs text-muted-foreground">
                Đây là bản demo: tài liệu tải lên được đọc ngay trên trình duyệt này và không gửi đi đâu.
            </p>

            {upload && <UploadDialog onClose={() => setUpload(false)} onNotify={setToast} />}
            {viewing && (
                <Suspense fallback={null}>
                    <DocViewer source={viewing} chunks={chunksOf(kb, viewing.courseId).filter((c) => c.sourceId === viewing.id)} onClose={() => setViewing(null)} />
                </Suspense>
            )}
            {(toast || kb.undo) && (
                <div role="status" className="fixed bottom-7 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-3 rounded-full bg-strong px-5 py-3 text-sm font-semibold text-ink-foreground shadow-raised">
                    {kb.undo ? (
                        <>
                            <span className="max-w-[320px] truncate">Đã xóa “{kb.undo.title}”</span>
                            <button type="button" onClick={() => useKb.getState().restore()} className="inline-flex items-center gap-1.5 font-extrabold underline-offset-2 hover:underline">
                                <Undo2 size={14} aria-hidden /> Hoàn tác
                            </button>
                        </>
                    ) : (
                        toast
                    )}
                </div>
            )}
        </div>
    )
}

function SourceCard({ source, reading, onOpen }: { source: KbSource; reading?: Reading; onOpen: () => void }) {
    const rename = useKb((s) => s.rename)
    const remove = useKb((s) => s.remove)
    const [menu, setMenu] = useState(false)
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(source.title)
    const wrap = useRef<HTMLDivElement>(null)
    const ic = ICON[source.format]
    const pct = reading ? Math.round(reading.progress * 100) : 100

    useEffect(() => {
        if (!menu) return
        const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setMenu(false)
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [menu])

    const commit = () => {
        const t = draft.trim()
        if (t && t !== source.title) rename(source.id, t.slice(0, 120))
        setEditing(false)
    }

    return (
        <div ref={wrap} className={`${glass} group relative p-4 transition duration-base hover:-translate-y-[3px] hover:shadow-raised`}>
            <button type="button" onClick={onOpen} disabled={Boolean(reading)} aria-label={`Xem ${source.title}`} className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-default" />
            <div className="pointer-events-none relative flex items-start gap-3.5">
                <span className={`flex h-[52px] w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-mono text-[11px] font-extrabold text-ink-foreground ${ic.cls}`}>{ic.label || <Play size={16} className="fill-current" aria-hidden />}</span>
                <span className="min-w-0 flex-1">
                    {editing ? (
                        <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commit()
                                if (e.key === 'Escape') setEditing(false)
                            }}
                            aria-label="Tên hiển thị"
                            className="pointer-events-auto relative z-10 w-full rounded-lg border border-brand-300 bg-card px-2 py-1 text-[15px] font-bold text-strong focus-visible:outline-none"
                        />
                    ) : (
                        <b className="block text-[15px] leading-snug text-strong">{source.title}</b>
                    )}
                    <small className="mt-1 block text-[12.5px] text-muted-foreground">{reading ? (source.kind === 'video' ? 'Đang lấy phụ đề…' : 'Đang tách trang…') : meta(source)}</small>
                </span>
            </div>
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
            {!reading && (
                <div className="absolute right-2.5 top-2.5 z-10">
                    <button type="button" aria-label={`Tùy chọn cho ${source.title}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-[10px] text-muted-foreground opacity-0 transition hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100">
                        <MoreHorizontal size={18} />
                    </button>
                    {menu && (
                        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-[14px] border border-border bg-card p-1.5 shadow-raised">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenu(false)
                                    setDraft(source.title)
                                    setEditing(true)
                                }}
                                className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-muted"
                            >
                                <Pencil size={15} aria-hidden /> Đổi tên
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenu(false)
                                    remove(source.id)
                                }}
                                className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-brand-ink hover:bg-muted"
                            >
                                <Trash2 size={15} aria-hidden /> Xóa
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
