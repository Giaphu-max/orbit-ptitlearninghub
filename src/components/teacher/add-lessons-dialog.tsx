import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildImportedCourse, buildImportedLesson, parseYoutubeLink, sampleItems, SAMPLE_PLAYLIST } from '@/data/demo-import'
import type { Lesson } from '@/data/types'
import { useTeacherCourses } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const NEW_COURSE = '__new'
const VIDEO_EXT = /\.(mp4|mov|webm)$/i
const UPLOAD_MS = 2600
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Hộp "Thêm video" với hai tab: tải lên từ máy (mặc định) và từ YouTube. GIẢ LẬP cho bản demo: nhận diện link bằng regex ở trình duyệt, nội dung lấy từ dữ liệu đã tạo sẵn
 * (src/data/demo-import.ts), không gọi Gemini; file tải lên không rời khỏi máy và không được lưu, chỉ lưu tên/thời lượng. Bấm tạo thì sang trang Bài giảng xem thẻ "AI đang tạo".
 */
export function AddLessonsDialog({ onClose, courseId }: { onClose: () => void; courseId?: string }) {
    const navigate = useNavigate()
    const addImport = useOrbitStore((s) => s.addImport)
    const allCourses = useTeacherCourses()
    const items = useMemo(() => sampleItems(), [])
    const [link, setLink] = useState('')
    const [picked, setPicked] = useState<Set<string>>(() => new Set(items.map((i) => i.key)))
    const [target, setTarget] = useState(courseId ?? NEW_COURSE)
    const [tab, setTab] = useState<'upload' | 'yt'>('upload')
    const [file, setFile] = useState<{ name: string; size: number; durationSec: number | null; thumbnail?: string } | null>(null)
    const [title, setTitle] = useState('')
    const [fileError, setFileError] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [uploadPct, setUploadPct] = useState<number | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)
    const uploadTimer = useRef<number | undefined>(undefined)
    const rootRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const parsed = useMemo(() => (link.trim() ? parseYoutubeLink(link) : null), [link])
    const invalid = link.trim() !== '' && !parsed
    const isSample = parsed ? (parsed.kind === 'playlist' ? parsed.listId === SAMPLE_PLAYLIST.listId : items.some((i) => i.videoId === parsed.videoId)) : false
    const existing = target !== NEW_COURSE ? allCourses.find((c) => c.id === target) : undefined
    const targetOpen = existing ? existing.open : true

    // Focus trap + Esc, trả focus về nút đã mở hộp
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null
        inputRef.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') return onClose()
            if (e.key !== 'Tab' || !rootRef.current) return
            const els = [...rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
            if (!els.length) return
            const first = els[0]
            const last = els[els.length - 1]
            if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus())
            else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus())
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
            prev?.focus?.()
        }
    }, [onClose])

    const create = () => {
        const newCourse = target === NEW_COURSE ? buildImportedCourse() : undefined
        const cid = newCourse?.id ?? target
        const lessons = items.filter((i) => picked.has(i.key)).flatMap((i) => buildImportedLesson(i, cid) ?? []) as Lesson[]
        if (!lessons.length) return
        addImport({ course: newCourse, lessons })
        onClose()
        navigate('/teacher/library')
    }

    const pickFile = (f: File | undefined) => {
        if (!f) return
        if (!VIDEO_EXT.test(f.name)) return setFileError('Chỉ nhận video mp4, mov hoặc webm.')
        setFileError('')
        setFile({ name: f.name, size: f.size, durationSec: null })
        setTitle(f.name.replace(/\.[^.]+$/, ''))
        // Chỉ đọc metadata (thời lượng) bằng thẻ video; file không được gửi đi đâu
        const url = URL.createObjectURL(f)
        const v = document.createElement('video')
        v.preload = 'metadata'
        v.muted = true
        v.onloadedmetadata = () => {
            setFile((cur) => (cur && cur.name === f.name ? { ...cur, durationSec: Number.isFinite(v.duration) ? Math.round(v.duration) : null } : cur))
            // Chụp khung hình đầu làm thumbnail (tua nhẹ để có hình)
            v.currentTime = Math.min(0.5, (v.duration || 1) / 2)
        }
        v.onseeked = () => {
            try {
                const cv = document.createElement('canvas')
                cv.width = 320
                cv.height = 180
                cv.getContext('2d')?.drawImage(v, 0, 0, 320, 180)
                const thumbnail = cv.toDataURL('image/jpeg', 0.7)
                setFile((cur) => (cur && cur.name === f.name ? { ...cur, thumbnail } : cur))
            } catch {
                // Không chụp được: thẻ dùng gradient
            }
            URL.revokeObjectURL(url)
        }
        v.onerror = () => URL.revokeObjectURL(url)
        v.src = url
    }
    useEffect(() => () => window.clearInterval(uploadTimer.current), [])

    const createUpload = () => {
        if (!file || uploadPct !== null) return
        const started = Date.now()
        setUploadPct(0)
        uploadTimer.current = window.setInterval(() => {
            const p = Math.min(100, Math.round(((Date.now() - started) / UPLOAD_MS) * 100))
            setUploadPct(p)
            if (p < 100) return
            window.clearInterval(uploadTimer.current)
            const newCourse = target === NEW_COURSE ? buildImportedCourse() : undefined
            const cid = newCourse?.id ?? target
            // Nội dung mẫu đã tạo sẵn, luân phiên theo số bài đã tải lên để các bài không trùng nhau
            const used = useOrbitStore.getState().importedLessons.filter((l) => l.id.startsWith('imp-up-')).length
            const tpl = items[used % items.length]
            const uid = `up${Date.now().toString(36)}`
            const built = buildImportedLesson(tpl, cid, uid)
            if (!built) return
            const lesson: Lesson = { ...built, id: `imp-up-${uid}`, title: title.trim() || file.name, shortTitle: undefined, durationSec: file.durationSec ?? built.durationSec, upload: { fileName: file.name, thumbnail: file.thumbnail } }
            addImport({ course: newCourse, lessons: [lesson] })
            onClose()
            navigate('/teacher/library')
        }, 120)
    }

    const count = picked.size
    return (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-auto bg-ink/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="add-lessons-title" className="mt-[6vh] w-full max-w-[640px] rounded-[20px] border border-border bg-card p-6 shadow-raised">
                <h2 id="add-lessons-title" className="text-xl font-black text-strong">
                    Thêm video
                </h2>
                <div role="tablist" aria-label="Nguồn video" className="mt-4 flex gap-1 rounded-[14px] bg-muted p-1.5">
                    {(
                        [
                            ['upload', 'Tải lên từ máy'],
                            ['yt', 'Từ YouTube'],
                        ] as const
                    ).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            disabled={uploadPct !== null}
                            onClick={() => setTab(id)}
                            className={`flex-1 rounded-[10px] px-3 py-2 text-[13.5px] font-bold transition ${tab === id ? 'bg-card text-strong shadow-card' : 'text-muted-foreground hover:text-strong'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'upload' && (
                    <div role="tabpanel" className="mt-5">
                        <input ref={fileRef} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.target.files?.[0])} />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => (e.preventDefault(), setDragOver(false), pickFile(e.dataTransfer.files?.[0]))}
                            className={`flex w-full flex-col items-center gap-1 rounded-[14px] border-2 border-dashed px-4 py-7 text-center transition ${dragOver ? 'border-brand-600 bg-brand-50' : 'border-border hover:bg-muted'}`}
                        >
                            <b className="text-sm font-bold text-strong">Kéo thả video vào đây hoặc bấm để chọn</b>
                            <small className="text-xs text-muted-foreground">mp4, mov, webm</small>
                        </button>
                        {fileError && (
                            <p role="alert" className="mt-2 text-[13px] font-semibold text-destructive">
                                {fileError}
                            </p>
                        )}
                        {file && (
                            <>
                                <p className="mt-3 rounded-[10px] bg-muted px-3.5 py-2.5 text-sm">
                                    <b className="font-semibold text-strong">{file.name}</b>
                                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                                        {fmtSize(file.size)} · {file.durationSec === null ? 'đang đọc thời lượng…' : formatTime(file.durationSec)}
                                    </span>
                                </p>
                                <label htmlFor="up-title" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                    Tên bài
                                </label>
                                <input
                                    id="up-title"
                                    value={title}
                                    maxLength={120}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="h-11 w-full rounded-[10px] border border-border bg-card px-3.5 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                                />
                                <CourseSelect newLabel="Tạo khóa học mới" id="up-course" target={target} setTarget={setTarget} courses={allCourses} open={targetOpen} />
                                <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                                    AI sẽ tạo transcript, tóm tắt, khái niệm và câu hỏi để thầy cô duyệt.
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">Bản demo: video không rời khỏi máy, nội dung dùng mẫu đã tạo sẵn.</p>
                            </>
                        )}
                        {uploadPct !== null && (
                            <div className="mt-4" role="status">
                                <p className="flex justify-between text-[13px] font-semibold text-strong">
                                    <span>{uploadPct < 100 ? 'Đang tải lên' : '✦ AI đang tạo nội dung'}</span>
                                    <span className="font-mono">{uploadPct}%</span>
                                </p>
                                <i className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                                    <u className="block h-full bg-brand-600 no-underline transition-[width] duration-fast" style={{ width: `${uploadPct}%` }} />
                                </i>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'yt' && (
                    <>
                <p className="mt-4 text-sm text-muted-foreground">Dán link video hoặc danh sách phát. AI sẽ tạo transcript, tóm tắt, khái niệm và câu hỏi để thầy cô duyệt.</p>

                <label htmlFor="yt-link" className="mb-1.5 mt-5 block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Link YouTube
                </label>
                <div className="flex gap-2">
                    <input
                        id="yt-link"
                        ref={inputRef}
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://www.youtube.com/playlist?list=…"
                        aria-invalid={invalid}
                        className="h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-card px-3.5 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                    />
                    <button type="button" onClick={() => setLink(SAMPLE_PLAYLIST.url)} className="h-11 shrink-0 rounded-[10px] border border-border px-4 text-sm font-bold text-strong transition hover:bg-muted">
                        Dán link mẫu
                    </button>
                </div>
                {invalid && (
                    <p role="alert" className="mt-2 text-[13px] font-semibold text-destructive">
                        Link này chưa đúng. Hãy dán link video (youtube.com/watch?v=… hoặc youtu.be/…) hoặc link danh sách phát có list=….
                    </p>
                )}

                {parsed && (
                    <div className="mt-5">
                        {!isSample && <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Bản demo: dùng nội dung mẫu đã tạo sẵn.</p>}
                        <p className="text-sm font-bold text-strong">{SAMPLE_PLAYLIST.title}</p>
                        <ul className="mt-2 divide-y divide-border rounded-[14px] border border-border">
                            {items.map((it) => (
                                <li key={it.key}>
                                    <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={picked.has(it.key)}
                                            onChange={() => setPicked((p) => (p.has(it.key) ? new Set([...p].filter((k) => k !== it.key)) : new Set(p).add(it.key)))}
                                            className="h-4 w-4 accent-brand-600"
                                        />
                                        <span className="min-w-0 flex-1 font-semibold leading-snug text-strong">{it.title}</span>
                                        <span className="font-mono text-xs text-muted-foreground">{formatTime(it.durationSec)}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>

                        <CourseSelect id="yt-course" target={target} setTarget={setTarget} courses={allCourses} open={targetOpen} />

                        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                            AI sẽ đọc phụ đề, tạo transcript có mốc thời gian, tóm tắt, khái niệm và câu hỏi kèm câu biến thể. Mọi thứ ở trạng thái chờ duyệt, sinh viên chưa thấy cho tới khi thầy cô xuất bản.
                        </p>
                    </div>
                )}
                    </>
                )}

                <div className="mt-6 flex items-center justify-end gap-2.5">
                    <button type="button" onClick={onClose} className="h-11 rounded-[10px] px-4 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-strong">
                        Hủy
                    </button>
                    {tab === 'yt' ? (
                        <button
                            type="button"
                            onClick={create}
                            disabled={!parsed || count === 0}
                            className="surface-red h-11 rounded-[10px] px-5 text-sm font-extrabold text-ink-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            ✦ Tạo nội dung cho {count} video
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={createUpload}
                            disabled={!file || uploadPct !== null}
                            className="surface-red h-11 rounded-[10px] px-5 text-sm font-extrabold text-ink-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            ✦ Tạo nội dung
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function CourseSelect({ id, target, setTarget, courses, open, newLabel = 'Tạo khóa học mới từ danh sách phát này' }: { newLabel?: string; id: string; target: string; setTarget: (v: string) => void; courses: { id: string; title: string }[]; open: boolean }) {
    return (
        <>
            <label htmlFor={id} className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Thêm vào khóa học
            </label>
            <select
                id={id}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
                <option value={NEW_COURSE}>{newLabel}</option>
                {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.title}
                    </option>
                ))}
            </select>

            <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Ai thấy bài này</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
                {open ? 'Sinh viên của khóa đang mở, sau khi thầy cô duyệt và xuất bản.' : 'Khóa này đang khóa: sinh viên chưa thấy bài nào cho tới khi thầy cô mở khóa ở trang Bài giảng.'}
            </p>
        </>
    )
}
