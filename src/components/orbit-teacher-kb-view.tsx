import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownUp, ImageIcon, Lock, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { CourseArt } from '@/components/courses/course-cover'
import { ConfirmDeleteDialog, CoverDialog, MoveDialog, NewCourseDialog, RenameDialog, ReorderDialog } from '@/components/kb/course-dialogs'
import { KebabMenu } from '@/components/kb/kebab-menu'
import { glass, SourceCard } from '@/components/kb/source-card'
import { UploadDialog } from '@/components/kb/upload-dialog'
import { VideoViewer } from '@/components/kb/video-viewer'
import { IngestError, ingestDocument, rereadSource } from '@/lib/kb/ingest'
import { chunksOf, useKb } from '@/lib/kb/store'
import type { KbSource } from '@/lib/kb/types'
import { moveSource, removeCourse, removeSource, renameSource, useLibrary, type LibraryCourse, type LibraryItem } from '@/lib/library'
import { filterLibrary, FILTERS, parseFilter } from '@/lib/library-search'
import { learnersOf, useCatalog } from '@/store/useCatalog'

const DocViewer = lazy(() => import('@/components/kb/doc-viewer').then((m) => ({ default: m.DocViewer })))

interface Toast {
    id: number
    msg: string
    undo?: () => void
    commit?: () => void
}

/** Cổng giảng viên: Kho tài liệu. Khóa học (= học phần sinh viên thấy) chứa video (= bài giảng) và tài liệu tham khảo; tất cả là nguồn kiến thức của trợ giảng AI. */
export function OrbitTeacherKbView() {
    const kb = useKb()
    const lib = useLibrary()
    const [upload, setUpload] = useState<{ courseId?: string } | null>(null)
    const [newCourse, setNewCourse] = useState(false)
    const [dialog, setDialog] = useState<
        | { kind: 'rename-course'; course: LibraryCourse['course'] }
        | { kind: 'cover'; course: LibraryCourse['course'] }
        | { kind: 'order'; group: LibraryCourse }
        | { kind: 'delete-course'; group: LibraryCourse }
        | { kind: 'rename-source'; source: KbSource }
        | { kind: 'move-source'; source: KbSource }
        | { kind: 'delete-source'; source: KbSource }
        | null
    >(null)
    const [viewing, setViewing] = useState<LibraryItem | null>(null)
    const [toast, setToast] = useState<Toast | null>(null)
    const toastRef = useRef<Toast | null>(null)
    toastRef.current = toast
    const [params, setParams] = useSearchParams()
    const q = params.get('q') ?? ''
    const f = parseFilter(params.get('f'))
    const searchRef = useRef<HTMLInputElement>(null)
    const setView = (next: { q?: string; f?: string }) =>
        setParams(
            (prev) => {
                const p = new URLSearchParams(prev)
                for (const [k, v] of Object.entries(next)) v && v !== 'all' ? p.set(k, v) : p.delete(k)
                return p
            },
            { replace: true },
        )
    // Phím "/" đưa con trỏ vào ô tìm (trừ khi đang gõ ở ô khác)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement
            if (e.key === '/' && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])
    const chunkMap = useMemo(() => {
        const m = new Map<string, import('@/lib/kb/types').KbChunk[]>()
        if (!q.trim()) return m
        for (const g of lib.groups)
            for (const c of chunksOf(kb, g.course.id)) m.set(c.sourceId, [...(m.get(c.sourceId) ?? []), c])
        return m
    }, [q, lib.groups, kb])
    const view = useMemo(() => filterLibrary(lib.groups, chunkMap, q, f), [lib.groups, chunkMap, q, f])
    const narrowed = Boolean(q.trim()) || f !== 'all'

    useEffect(() => void kb.load(), [kb.load]) // eslint-disable-line react-hooks/exhaustive-deps

    // Một thông báo tại một thời điểm; thông báo có Hoàn tác tồn tại 5 giây rồi chốt (xóa hẳn file đã tải lên)
    const notify = (msg: string, undo?: () => void, commit?: () => void) => {
        toastRef.current?.commit?.()
        setToast({ id: Date.now() + Math.random(), msg, undo, commit })
    }
    useEffect(() => {
        if (!toast) return
        const t = window.setTimeout(
            () => {
                toast.commit?.()
                setToast((cur) => (cur?.id === toast.id ? null : cur))
            },
            toast.undo ? 5000 : 2800,
        )
        return () => window.clearTimeout(t)
    }, [toast])

    const run = (p: Promise<void>, done: string) => {
        p.then(
            () => notify(done),
            (e) => notify(e instanceof IngestError ? e.message : 'Chưa đọc được nguồn này. Thầy cô thử lại nhé.'),
        )
    }
    const deleteSource = (source: KbSource) => {
        const r = removeSource(source)
        notify(`Đã xóa “${source.title}”`, r.undo, r.commit)
    }

    return (
        <div className="mx-auto max-w-[1280px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <h1 className="m-0 text-[32px] font-black tracking-[-0.03em] text-strong">Kho tài liệu của khóa học</h1>
                    <p className="mt-1.5 text-[15.5px] text-muted-foreground">Tài liệu và video ở đây là nguồn kiến thức duy nhất của trợ giảng AI.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setNewCourse(true)} className="inline-flex h-[52px] items-center gap-2 rounded-full border border-border bg-card/80 px-5 text-[15px] font-bold text-strong backdrop-blur transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                        <Plus size={16} aria-hidden /> Khóa học mới
                    </button>
                    <button type="button" onClick={() => setUpload({})} className="surface-red inline-flex h-[52px] shrink-0 items-center gap-3 rounded-full pl-[22px] pr-2 text-[15.5px] font-extrabold text-ink-foreground shadow-brand transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                        Tải lên
                        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-ink-foreground text-brand-600">
                            <Plus size={18} />
                        </span>
                    </button>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <label className="relative block w-[min(380px,100%)]">
                    <span className="sr-only">Tìm khóa học, tài liệu, video</span>
                    <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        value={q}
                        onChange={(e) => setView({ q: e.target.value })}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') (q ? setView({ q: '' }) : e.currentTarget.blur())
                        }}
                        placeholder="Tìm khóa học, tài liệu, video…"
                        className="h-11 w-full rounded-full border border-border bg-card/80 pl-10 pr-16 text-sm text-foreground backdrop-blur placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                    />
                    {q ? (
                        <button type="button" aria-label="Xóa từ khóa" onClick={() => (setView({ q: '' }), searchRef.current?.focus())} className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                            <X size={14} />
                        </button>
                    ) : (
                        <kbd aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">/</kbd>
                    )}
                </label>
                <div role="group" aria-label="Lọc nguồn" className="flex flex-wrap gap-1.5">
                    {FILTERS.map((c) => (
                        <button key={c.id} type="button" aria-pressed={f === c.id} onClick={() => setView({ f: c.id })} className={`h-9 rounded-full border px-3.5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${f === c.id ? 'border-brand-600 bg-brand-50 text-brand-ink' : 'border-border bg-card/70 text-muted-foreground hover:text-strong'}`}>
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={`${glass} mt-6 grid grid-cols-[auto_1fr_auto] items-center gap-[22px] px-6 py-5 max-md:grid-cols-1`}>
                <span className="surface-red flex h-[54px] w-[54px] items-center justify-center rounded-2xl text-ink-foreground shadow-brand">
                    <Sparkles size={24} aria-hidden />
                </span>
                <span>
                    <b className="block text-[17px] text-strong">
                        Trợ giảng AI đã đọc {lib.ready}/{lib.total} nguồn
                    </b>
                    <small className="mt-1 block text-[13.5px] text-muted-foreground">Sinh viên hỏi gì ngoài các nguồn này, AI sẽ trả lời “không có trong tài liệu”.</small>
                </span>
                <span className="flex">
                    <span className="border-l border-border px-[22px] text-[12.5px] text-muted-foreground">
                        <b className="mb-0.5 block font-mono text-[22px] font-extrabold text-strong">{lib.chunks}</b>đoạn kiến thức
                    </span>
                    <span className="border-l border-border pl-[22px] text-[12.5px] text-muted-foreground">
                        <b className="mb-0.5 block font-mono text-[22px] font-extrabold text-strong">{lib.concepts}</b>khái niệm
                    </span>
                </span>
            </div>

            {lib.groups.length > 0 && narrowed && view.length === 0 && (
                <div className={`${glass} mt-8 p-10 text-center`}>
                    <b className="block text-lg text-strong">{q.trim() ? `Không có kết quả cho “${q.trim()}”` : 'Không có nguồn nào ở bộ lọc này'}</b>
                    <button type="button" onClick={() => setParams({}, { replace: true })} className="mt-3 text-sm font-bold text-brand-ink underline-offset-2 hover:underline">
                        Xóa bộ lọc
                    </button>
                </div>
            )}

            {lib.groups.length === 0 && (
                <div className={`${glass} mt-8 p-10 text-center`}>
                    <b className="block text-lg text-strong">Chưa có khóa học nào</b>
                    <p className="mt-1.5 text-sm text-muted-foreground">Tạo khóa học đầu tiên rồi tải tài liệu hoặc video lên.</p>
                </div>
            )}

            {view.map(({ group: g, items, snippets }) => (
                <CourseSection
                    key={g.course.id}
                    group={g}
                    items={items}
                    snippets={snippets}
                    onAdd={() => setUpload({ courseId: g.course.id })}
                    onRename={() => setDialog({ kind: 'rename-course', course: g.course })}
                    onCover={() => setDialog({ kind: 'cover', course: g.course })}
                    onOrder={() => setDialog({ kind: 'order', group: g })}
                    onDelete={() => setDialog({ kind: 'delete-course', group: g })}
                    onOpenItem={setViewing}
                    onRenameSource={(source) => setDialog({ kind: 'rename-source', source })}
                    onMoveSource={(source) => setDialog({ kind: 'move-source', source })}
                    onReplace={(source, file) =>
                        run(source.kind === 'doc' ? ingestDocument({ courseId: source.courseId, title: '', file, replaceId: source.id }) : rereadSource(source), `AI đã đọc lại: ${source.title}`)
                    }
                    onReread={(source) => run(rereadSource(source), `AI đã đọc lại: ${source.title}`)}
                    onDeleteSource={(source) => setDialog({ kind: 'delete-source', source })}
                />
            ))}

            <p className="mt-10 text-xs text-muted-foreground">Đây là bản demo: tài liệu tải lên được đọc ngay trên trình duyệt này và không gửi đi đâu. Video mới dùng nội dung bài giảng mẫu.</p>

            {newCourse && <NewCourseDialog onClose={() => setNewCourse(false)} onCreated={() => notify('Đã tạo khóa học mới (đang khóa)')} />}
            {upload && <UploadDialog courses={lib.courses} defaultCourseId={upload.courseId} onClose={() => setUpload(null)} onNotify={(m) => notify(m)} />}
            {dialog?.kind === 'rename-course' && <RenameDialog title="Đổi tên khóa học" label="Tên khóa học" value={dialog.course.title} onSave={(v) => useCatalog.getState().renameCourse(dialog.course.id, v)} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'cover' && <CoverDialog course={dialog.course} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'order' && <ReorderDialog course={dialog.group.course} videos={dialog.group.items.filter((i) => i.source.kind === 'video' && !i.reading)} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'delete-course' && (
                <ConfirmDeleteDialog
                    title="Xóa khóa học?"
                    confirmText={dialog.group.course.open && learnersOf(dialog.group.course) > 0 ? dialog.group.course.title : undefined}
                    body={
                        <>
                            <p>
                                Khóa “<b>{dialog.group.course.title}</b>” có <b>{dialog.group.items.length} nguồn</b> sẽ bị xóa theo. Sinh viên sẽ không thấy khóa này nữa.
                            </p>
                            {dialog.group.course.open && learnersOf(dialog.group.course) > 0 && <p className="mt-2 font-semibold text-brand-ink">Đang có {learnersOf(dialog.group.course)} sinh viên học khóa này.</p>}
                        </>
                    }
                    onConfirm={() => {
                        const r = removeCourse(dialog.group.course.id)
                        notify(`Đã xóa khóa “${dialog.group.course.title}”`, r.undo)
                    }}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === 'rename-source' && <RenameDialog title="Đổi tên nguồn" label="Tên hiển thị" value={dialog.source.title} onSave={(v) => renameSource(dialog.source, v)} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'move-source' && <MoveDialog source={dialog.source} courses={lib.courses} onMove={(id) => moveSource(dialog.source, id)} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'delete-source' && (
                <ConfirmDeleteDialog
                    title="Xóa nguồn này?"
                    body={
                        <p>
                            “<b>{dialog.source.title}</b>”{' '}
                            {dialog.source.kind === 'video' ? 'là một bài giảng: xóa thì bài này biến mất ở phía sinh viên (tiến độ cũ vẫn được giữ).' : 'sẽ bị gỡ khỏi kho: trợ giảng AI không dùng các đoạn kiến thức của tài liệu này nữa và sinh viên không còn thấy nó ở tab Tài liệu.'}
                        </p>
                    }
                    onConfirm={() => deleteSource(dialog.source)}
                    onClose={() => setDialog(null)}
                />
            )}
            {viewing && viewing.source.kind === 'video' && <VideoViewer source={viewing.source} lesson={viewing.lesson} onClose={() => setViewing(null)} />}
            {viewing && viewing.source.kind === 'doc' && (
                <Suspense fallback={null}>
                    <DocViewer source={viewing.source} chunks={chunksOf(kb, viewing.source.courseId).filter((c) => c.sourceId === viewing.source.id)} note={`AI đã tách ${viewing.source.chunkCount} đoạn kiến thức`} onClose={() => setViewing(null)} />
                </Suspense>
            )}
            {toast && (
                <div role="status" className="fixed bottom-7 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-3 rounded-full bg-strong px-5 py-3 text-sm font-semibold text-ink-foreground shadow-raised">
                    <span className="max-w-[360px] truncate">{toast.msg}</span>
                    {toast.undo && (
                        <button
                            type="button"
                            onClick={() => {
                                toast.undo?.()
                                setToast(null)
                            }}
                            className="font-extrabold underline-offset-2 hover:underline"
                        >
                            Hoàn tác
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

interface SectionProps {
    group: LibraryCourse
    /** Nguồn hiển thị sau khi lọc (group.items là toàn bộ) */
    items: LibraryItem[]
    snippets: Map<string, string>
    onAdd: () => void
    onRename: () => void
    onCover: () => void
    onOrder: () => void
    onDelete: () => void
    onOpenItem: (i: LibraryItem) => void
    onRenameSource: (s: KbSource) => void
    onMoveSource: (s: KbSource) => void
    onReplace: (s: KbSource, f: File) => void
    onReread: (s: KbSource) => void
    onDeleteSource: (s: KbSource) => void
}

function CourseSection({ group, items: shown, snippets, onAdd, onRename, onCover, onOrder, onDelete, onOpenItem, onRenameSource, onMoveSource, onReplace, onReread, onDeleteSource }: SectionProps) {
    const { course, items } = group
    const learners = learnersOf(course)
    const videos = items.filter((i) => i.source.kind === 'video' && !i.reading)
    // Số thứ tự bài tính trên toàn bộ video của khóa, không đổi khi đang lọc
    const numbering = new Map(videos.map((v, i) => [v.source.id, i]))
    return (
        <section className="mt-9" aria-labelledby={`g-${course.id}`}>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border">
                    <CourseArt course={course} className="h-full w-full" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id={`g-${course.id}`} className="m-0 truncate text-xl font-black text-strong">
                        {course.title}
                    </h2>
                    <small className="text-[13px] text-muted-foreground">
                        {items.length} nguồn · {learners} sinh viên đang học
                        {!course.open && (
                            <span className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-ink">
                                <Lock size={11} aria-hidden /> Đang khóa · chỉ thầy cô thấy
                            </span>
                        )}
                    </small>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-bold text-strong">
                    <span>{course.open ? 'Đang mở cho sinh viên' : 'Đang khóa'}</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={course.open}
                        aria-label="Mở khóa học cho sinh viên"
                        onClick={() => useCatalog.getState().setOpen(course.id, !course.open)}
                        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${course.open ? 'bg-brand-600' : 'bg-border'}`}
                    >
                        <span className={`h-5 w-5 rounded-full bg-ink-foreground shadow-card transition-transform ${course.open ? 'translate-x-5' : ''}`} />
                    </button>
                </label>
                <button type="button" onClick={onAdd} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/80 px-4 text-[13px] font-bold text-strong transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    <Plus size={14} aria-hidden /> Thêm nguồn
                </button>
                <KebabMenu
                    label={`Tùy chọn khóa ${course.title}`}
                    items={[
                        { label: 'Đổi tên', icon: <Pencil size={15} aria-hidden />, onSelect: onRename },
                        { label: 'Đổi bìa', icon: <ImageIcon size={15} aria-hidden />, onSelect: onCover },
                        { label: 'Sắp xếp thứ tự bài', icon: <ArrowDownUp size={15} aria-hidden />, onSelect: onOrder, disabled: videos.length < 2 },
                        { label: 'Xóa khóa', icon: <Trash2 size={15} aria-hidden />, onSelect: onDelete, danger: true },
                    ]}
                />
            </div>
            {shown.length === 0 && items.length > 0 ? (
                <p className="rounded-3xl border border-dashed border-border px-6 py-5 text-sm text-muted-foreground">Khóa này khớp với từ khóa nhưng chưa có nguồn nào ở bộ lọc này.</p>
            ) : items.length === 0 ? (
                <button type="button" onClick={onAdd} className="block w-full rounded-3xl border-2 border-dashed border-border px-6 py-9 text-center transition hover:border-brand-300 hover:bg-card/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    <b className="block text-[15px] text-strong">Chưa có nguồn nào</b>
                    <span className="mt-1 block text-sm text-muted-foreground">Tải lên tài liệu hoặc video</span>
                </button>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
                    {shown.map((item) => {
                        return (
                            <SourceCard
                                key={item.source.id}
                                item={item}
                                snippet={snippets.get(item.source.id)}
                                index={numbering.get(item.source.id)}
                                onOpen={() => onOpenItem(item)}
                                onRename={() => onRenameSource(item.source)}
                                onMove={() => onMoveSource(item.source)}
                                onReplace={(f) => onReplace(item.source, f)}
                                onReread={() => onReread(item.source)}
                                onDelete={() => onDeleteSource(item.source)}
                            />
                        )
                    })}
                </div>
            )}
        </section>
    )
}
