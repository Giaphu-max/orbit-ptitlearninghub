import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildImportedCourse, buildImportedLesson, parseYoutubeLink, sampleItems, SAMPLE_PLAYLIST } from '@/data/demo-import'
import type { Lesson } from '@/data/types'
import { useTeacherCourses } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const NEW_COURSE = '__new'
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Hộp "Thêm bài giảng từ YouTube". GIẢ LẬP cho bản demo: nhận diện link bằng regex ở trình duyệt, nội dung lấy từ dữ liệu đã tạo sẵn
 * (src/data/demo-import.ts), không gọi Gemini. Bấm tạo thì sang trang Bài giảng xem thẻ "AI đang tạo".
 */
export function AddLessonsDialog({ onClose, courseId }: { onClose: () => void; courseId?: string }) {
    const navigate = useNavigate()
    const addImport = useOrbitStore((s) => s.addImport)
    const allCourses = useTeacherCourses()
    const items = useMemo(() => sampleItems(), [])
    const [link, setLink] = useState('')
    const [picked, setPicked] = useState<Set<string>>(() => new Set(items.map((i) => i.key)))
    const [target, setTarget] = useState(courseId ?? NEW_COURSE)
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

    const count = picked.size
    return (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-auto bg-ink/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="add-lessons-title" className="mt-[6vh] w-full max-w-[640px] rounded-[20px] border border-border bg-card p-6 shadow-raised">
                <h2 id="add-lessons-title" className="text-xl font-black text-strong">
                    Thêm bài giảng từ YouTube
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Dán link video hoặc danh sách phát. AI sẽ tạo transcript, tóm tắt, khái niệm và câu hỏi để thầy cô duyệt.</p>

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

                        <label htmlFor="yt-course" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            Thêm vào khóa học
                        </label>
                        <select
                            id="yt-course"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            className="h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                        >
                            <option value={NEW_COURSE}>Tạo khóa học mới từ danh sách phát này</option>
                            {allCourses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.title}
                                </option>
                            ))}
                        </select>

                        <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Ai thấy bài này</p>
                        <p className="text-[13px] leading-relaxed text-muted-foreground">
                            {targetOpen
                                ? 'Sinh viên của khóa đang mở, sau khi thầy cô duyệt và xuất bản.'
                                : 'Khóa này đang khóa: sinh viên chưa thấy bài nào cho tới khi thầy cô mở khóa ở trang Bài giảng.'}
                        </p>

                        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                            AI sẽ đọc phụ đề, tạo transcript có mốc thời gian, tóm tắt, khái niệm và câu hỏi kèm câu biến thể. Mọi thứ ở trạng thái chờ duyệt, sinh viên chưa thấy cho tới khi thầy cô xuất bản.
                        </p>
                    </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-2.5">
                    <button type="button" onClick={onClose} className="h-11 rounded-[10px] px-4 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-strong">
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={create}
                        disabled={!parsed || count === 0}
                        className="surface-red h-11 rounded-[10px] px-5 text-sm font-extrabold text-ink-foreground shadow-brand disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        ✦ Tạo nội dung cho {count} video
                    </button>
                </div>
            </div>
        </div>
    )
}
