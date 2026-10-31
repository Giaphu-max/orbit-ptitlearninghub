import { useEffect, useRef, useState } from 'react'
import { GripVertical, ImagePlus } from 'lucide-react'
import { CourseCover } from '@/components/courses/course-cover'
import { COVER_ACCENTS, COVER_MOTIFS, deriveCover, MOTIF_LABELS, type CoverAccent, type CoverMotif } from '@/lib/cover-kinds'
import { reorderVideos } from '@/lib/library'
import type { LibraryItem } from '@/lib/library'
import type { KbSource } from '@/lib/kb/types'
import { useCatalog, type CourseCoverOverride, type TeacherCourse } from '@/store/useCatalog'
import { btnGhost, btnPrimary, fieldCls, Modal } from './modal'

const ACCENT_LABEL: Record<CoverAccent, string> = { film: 'Đỏ cam', photo: 'Xanh dương', audio: 'Tím', design: 'Xanh lá', default: 'Xám xanh' }

/** Thu nhỏ ảnh bìa (tối đa 960px) thành JPEG dataURL để lưu localStorage. */
export async function imageToCover(file: File): Promise<string> {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 960 / bmp.width)
    const cv = document.createElement('canvas')
    cv.width = Math.round(bmp.width * k)
    cv.height = Math.round(bmp.height * k)
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
    return cv.toDataURL('image/jpeg', 0.82)
}

/** Chọn bìa: tải ảnh hoặc chọn màu + họa tiết, xem trước ngay. */
function CoverPicker({ subject, value, onChange }: { subject: string; value: CourseCoverOverride; onChange: (v: CourseCoverOverride) => void }) {
    const input = useRef<HTMLInputElement>(null)
    const [err, setErr] = useState('')
    const base = deriveCover(subject)
    const accent = value.accent ?? base.accent
    const motif = value.motif ?? base.motif
    const pick = async (f?: File) => {
        if (!f) return
        if (!f.type.startsWith('image/')) return setErr('Chỉ nhận file ảnh.')
        try {
            setErr('')
            onChange({ ...value, image: await imageToCover(f) })
        } catch {
            setErr('Không đọc được ảnh này. Thầy cô thử ảnh khác nhé.')
        }
    }
    return (
        <div className="mt-4">
            <span className="text-xs font-bold text-muted-foreground">Bìa khóa học</span>
            <div className="mt-1.5 overflow-hidden rounded-2xl border border-border" style={{ aspectRatio: '1280/560' }}>
                {value.image ? <img src={value.image} alt="Xem trước bìa" className="h-full w-full object-cover" /> : <CourseCover course={{ id: 'preview', subject }} seed={value.seed} motif={motif} accent={accent} className="h-full w-full" />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {COVER_ACCENTS.map((a) => (
                    <button key={a} type="button" aria-label={ACCENT_LABEL[a]} title={ACCENT_LABEL[a]} aria-pressed={!value.image && accent === a} onClick={() => onChange({ ...value, image: undefined, accent: a })} className={`h-8 w-8 rounded-full border-2 transition ${!value.image && accent === a ? 'border-strong' : 'border-transparent'}`} style={{ background: `hsl(var(--subject-${a}))` }} />
                ))}
                <select aria-label="Họa tiết" value={motif} onChange={(e) => onChange({ ...value, image: undefined, motif: e.target.value as CoverMotif })} className="h-9 rounded-[10px] border border-border bg-card px-2 text-sm">
                    {COVER_MOTIFS.map((m) => (
                        <option key={m} value={m}>
                            {MOTIF_LABELS[m]}
                        </option>
                    ))}
                </select>
                <button type="button" onClick={() => input.current?.click()} className="ml-auto inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-card px-3 text-sm font-bold text-brand-ink hover:bg-muted">
                    <ImagePlus size={15} aria-hidden /> Tải ảnh lên
                </button>
                <input ref={input} type="file" hidden accept="image/*" onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
            {err && (
                <p role="alert" className="mt-2 text-sm font-semibold text-brand-ink">
                    {err}
                </p>
            )}
        </div>
    )
}

export function NewCourseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('')
    const [cover, setCover] = useState<CourseCoverOverride>({})
    const [err, setErr] = useState('')
    const submit = () => {
        if (!title.trim()) return setErr('Thầy cô nhập tên khóa học trước nhé.')
        const hasCover = cover.image || cover.accent || cover.motif
        onCreated(useCatalog.getState().addCourse({ title, subject, cover: hasCover ? cover : undefined }))
        onClose()
    }
    return (
        <Modal title="Khóa học mới" onClose={onClose} width={620}>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    submit()
                }}
            >
                <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <label className="text-xs font-bold text-muted-foreground">
                        Tên khóa học
                        <input autoFocus value={title} onChange={(e) => (setTitle(e.target.value), setErr(''))} maxLength={120} placeholder="Ví dụ: Thiết kế chuyển động" className={fieldCls} />
                    </label>
                    <label className="text-xs font-bold text-muted-foreground">
                        Môn học
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={60} placeholder="Dựng phim, Nhiếp ảnh, Âm thanh…" className={fieldCls} />
                    </label>
                </div>
                <CoverPicker subject={subject} value={cover} onChange={setCover} />
                <p className="mt-4 rounded-xl bg-muted px-4 py-2.5 text-[13px] text-muted-foreground">Khóa mới ở trạng thái <b className="text-strong">Đang khóa · chỉ thầy cô thấy</b>. Thêm nguồn xong, thầy cô bật công tắc để mở cho sinh viên.</p>
                {err && (
                    <p role="alert" className="mt-2 text-sm font-semibold text-brand-ink">
                        {err}
                    </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={btnGhost}>
                        Hủy
                    </button>
                    <button type="submit" className={btnPrimary}>
                        Tạo khóa học
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export function CoverDialog({ course, onClose }: { course: TeacherCourse; onClose: () => void }) {
    const existing = useCatalog((s) => s.covers[course.id])
    const [cover, setCover] = useState<CourseCoverOverride>(existing ?? {})
    return (
        <Modal title="Đổi bìa" onClose={onClose} width={620}>
            <CoverPicker subject={course.subject} value={cover} onChange={setCover} />
            <div className="mt-5 flex justify-between gap-2">
                <button
                    type="button"
                    onClick={() => (useCatalog.getState().setCover(course.id, null), onClose())}
                    className="text-sm font-bold text-muted-foreground underline-offset-2 hover:underline"
                >
                    Về bìa mặc định
                </button>
                <span className="flex gap-2">
                    <button type="button" onClick={onClose} className={btnGhost}>
                        Hủy
                    </button>
                    <button type="button" onClick={() => (useCatalog.getState().setCover(course.id, cover), onClose())} className={btnPrimary}>
                        Lưu bìa
                    </button>
                </span>
            </div>
        </Modal>
    )
}

/** Hộp nhập một dòng chữ (đổi tên khóa, đổi tên nguồn). */
export function RenameDialog({ title, label, value, onSave, onClose }: { title: string; label: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
    const [v, setV] = useState(value)
    return (
        <Modal title={title} onClose={onClose}>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    if (v.trim()) (onSave(v.trim()), onClose())
                }}
            >
                <label className="mt-4 block text-xs font-bold text-muted-foreground">
                    {label}
                    <input autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={120} className={fieldCls} />
                </label>
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={btnGhost}>
                        Hủy
                    </button>
                    <button type="submit" disabled={!v.trim()} className={btnPrimary}>
                        Lưu
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export function MoveDialog({ source, courses, onMove, onClose }: { source: KbSource; courses: TeacherCourse[]; onMove: (courseId: string) => void; onClose: () => void }) {
    const others = courses.filter((c) => c.id !== source.courseId)
    const [to, setTo] = useState(others[0]?.id ?? '')
    return (
        <Modal title="Chuyển sang khóa khác" onClose={onClose}>
            <p className="mt-3 text-sm text-muted-foreground">
                “{source.title}” {source.kind === 'video' ? 'là một bài giảng nên sẽ chuyển sang học phần mới ở phía sinh viên, xếp cuối khóa đó.' : 'sẽ trở thành tài liệu của khóa mới, trợ giảng AI của khóa cũ không còn dùng nữa.'}
            </p>
            {others.length === 0 ? (
                <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Chưa có khóa nào khác. Tạo khóa mới trước nhé.</p>
            ) : (
                <label className="mt-4 block text-xs font-bold text-muted-foreground">
                    Khóa học đích
                    <select value={to} onChange={(e) => setTo(e.target.value)} className={fieldCls}>
                        {others.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.title}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className={btnGhost}>
                    Hủy
                </button>
                <button type="button" disabled={!to} onClick={() => (onMove(to), onClose())} className={btnPrimary}>
                    Chuyển
                </button>
            </div>
        </Modal>
    )
}

/** Hộp xác nhận xóa: có nút Hủy; `confirmText` thì phải gõ đúng mới xóa được. */
export function ConfirmDeleteDialog({ title, body, confirmText, confirmLabel = 'Xóa', onConfirm, onClose }: { title: string; body: React.ReactNode; confirmText?: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
    const [typed, setTyped] = useState('')
    const ok = !confirmText || typed.trim() === confirmText.trim()
    return (
        <Modal title={title} onClose={onClose}>
            <div className="mt-3 text-sm leading-relaxed text-foreground">{body}</div>
            {confirmText && (
                <label className="mt-4 block text-xs font-bold text-muted-foreground">
                    Gõ tên khóa “{confirmText}” để xác nhận
                    <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className={fieldCls} />
                </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className={btnGhost}>
                    Hủy
                </button>
                <button type="button" disabled={!ok} onClick={() => (onConfirm(), onClose())} className="inline-flex h-11 items-center justify-center rounded-full bg-brand-700 px-6 text-[15px] font-extrabold text-ink-foreground transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50">
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    )
}

/** Sắp xếp thứ tự bài: kéo thả thẻ video hoặc Alt+←/→ khi thẻ đang focus. Thứ tự lưu ngay, phía sinh viên đổi theo. */
export function ReorderDialog({ course, videos, onClose }: { course: TeacherCourse; videos: LibraryItem[]; onClose: () => void }) {
    const [ids, setIds] = useState(videos.map((v) => v.source.lessonId!))
    const [drag, setDrag] = useState<string | null>(null)
    const [focus, setFocus] = useState<string | null>(null)
    const refs = useRef(new Map<string, HTMLElement>())
    const title = (id: string) => videos.find((v) => v.source.lessonId === id)?.source.title ?? id
    const apply = (next: string[]) => {
        setIds(next)
        reorderVideos(course.id, next)
    }
    const move = (id: string, to: number) => {
        const from = ids.indexOf(id)
        if (from < 0 || to < 0 || to >= ids.length || from === to) return
        const next = [...ids]
        next.splice(from, 1)
        next.splice(to, 0, id)
        apply(next)
        setFocus(id)
    }
    useEffect(() => {
        if (focus) refs.current.get(focus)?.focus()
    }, [ids, focus])
    return (
        <Modal title={`Thứ tự bài · ${course.title}`} onClose={onClose} width={640}>
            <p className="mt-2 text-sm text-muted-foreground">Kéo thả thẻ video, hoặc chọn thẻ rồi nhấn Alt + ← / →. Thứ tự này là thứ tự bài ("Bài x/y") sinh viên thấy.</p>
            {ids.length < 2 ? (
                <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Khóa này chưa có từ hai video để sắp xếp.</p>
            ) : (
                <ol className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    {ids.map((id, i) => (
                        <li
                            key={id}
                            ref={(el) => void (el ? refs.current.set(id, el) : refs.current.delete(id))}
                            tabIndex={0}
                            draggable
                            aria-label={`Bài ${i + 1}: ${title(id)}. Alt và mũi tên trái phải để đổi vị trí`}
                            onDragStart={() => setDrag(id)}
                            onDragEnd={() => setDrag(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => drag && (move(drag, i), setDrag(null))}
                            onKeyDown={(e) => {
                                if (e.altKey && e.key === 'ArrowLeft') (e.preventDefault(), move(id, i - 1))
                                if (e.altKey && e.key === 'ArrowRight') (e.preventDefault(), move(id, i + 1))
                            }}
                            className={`flex cursor-grab items-center gap-3 rounded-2xl border bg-card p-3 text-sm font-bold text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${drag === id ? 'border-brand-600 opacity-50' : 'border-border'}`}
                        >
                            <GripVertical size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-mono text-xs text-brand-ink">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate">{title(id)}</span>
                        </li>
                    ))}
                </ol>
            )}
            <div className="mt-5 flex justify-end">
                <button type="button" onClick={onClose} className={btnPrimary}>
                    Xong
                </button>
            </div>
        </Modal>
    )
}
