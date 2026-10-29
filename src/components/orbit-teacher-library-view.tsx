import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { Course } from '@/data/types'
import { useAddDialog } from '@/components/teacher/add-dialog-state'
import { studentsOfCourse, useLessonReviews, useTeacherCourses, type LessonReview } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const RANK: Record<LessonReview['state'], number> = { editing: 0, wait: 1, generating: 2, published: 3 }

/** /teacher/library – kho bài giảng của giảng viên; mỗi khóa mở/khóa cho sinh viên, thẻ video cho biết bài nào cần duyệt. Không giao theo lớp. */
export function OrbitTeacherLibraryView() {
    const role = useOrbitStore((s) => s.role)
    const reviews = useLessonReviews()
    const allCourses = useTeacherCourses()
    const showAdd = useAddDialog((s) => s.show)
    const setCourseOpen = useOrbitStore((s) => s.setCourseOpen)
    const [toast, setToast] = useState<string | null>(null)
    const toastTimer = useRef<number | undefined>(undefined)
    const say = (msg: string, ms = 3200) => {
        setToast(msg)
        window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToast(null), ms)
    }
    useEffect(() => () => window.clearTimeout(toastTimer.current), [])

    // Báo khi một bài vừa tạo xong nội dung
    const prevGenerating = useRef<Set<string>>(new Set())
    useEffect(() => {
        const now = new Set(reviews.filter((r) => r.state === 'generating').map((r) => r.lesson.id))
        const finished = reviews.filter((r) => prevGenerating.current.has(r.lesson.id) && !now.has(r.lesson.id))
        prevGenerating.current = now
        if (!finished.length) return
        say(finished.length === 1 ? `Đã tạo xong nội dung · ${finished[0].lesson.title} đang chờ thầy cô duyệt` : `Đã tạo xong nội dung cho ${finished.length} video · chờ thầy cô duyệt`)
    }, [reviews])

    const sections = useMemo(
        () =>
            allCourses
                .map((course) => ({ course, items: reviews.filter((r) => r.lesson.courseId === course.id).sort((a, b) => RANK[a.state] - RANK[b.state] || a.index - b.index) }))
                .filter((s) => s.items.length > 0),
        [allCourses, reviews],
    )

    if (role !== 'teacher') return <Navigate to="/" replace />

    const toggle = (course: Course, open: boolean) => {
        setCourseOpen(course.id, open)
        say(open ? 'Đã mở khóa học: sinh viên thấy các bài đã xuất bản' : 'Đã khóa: sinh viên tạm không thấy khóa này', 2400)
    }

    return (
        <div className="w-full pb-8">
            <header className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">Bài giảng</p>
                    <h1 className="mt-2 text-4xl font-black tracking-[-0.03em] text-strong">Khóa học của thầy</h1>
                    <p className="mt-2 max-w-[70ch] text-[15px] text-muted-foreground">
                        Kho bài giảng của thầy. Khóa đang mở thì mọi sinh viên đều học được các bài đã xuất bản, không cần giao cho từng lớp.
                    </p>
                </div>
                <button type="button" onClick={() => showAdd()} className="surface-red h-11 rounded-xl px-[18px] text-[14.5px] font-extrabold text-ink-foreground shadow-brand">
                    + Thêm từ YouTube
                </button>
            </header>

            <div className="mt-8 flex flex-col gap-8">
                {sections.length === 0 && <p className="text-sm text-muted-foreground">Chưa có khóa học nào.</p>}
                {sections.map(({ course, items }) => (
                    <CourseSection key={course.id} course={course} open={course.open} items={items} onAdd={() => showAdd(course.id)} onToggle={(v) => toggle(course, v)} />
                ))}
            </div>
            <div
                role="status"
                className={`pointer-events-none fixed bottom-7 left-1/2 z-[60] max-w-[80vw] -translate-x-1/2 rounded-full bg-ink px-[18px] py-3 text-sm font-semibold text-ink-foreground shadow-raised transition duration-slow ${toast ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
            >
                {toast}
            </div>
        </div>
    )
}

function CourseSection({ course, open, items, onAdd, onToggle }: { course: Course; open: boolean; items: LessonReview[]; onAdd: () => void; onToggle: (open: boolean) => void }) {
    const published = items.filter((r) => r.state === 'published').length
    const students = studentsOfCourse(course.id)
    const accent = course.cover?.accent ?? 'default'
    return (
        <section aria-label={course.title}>
            <div className="mb-3 flex flex-wrap items-center gap-3.5">
                <span aria-hidden className="h-10 w-10 shrink-0 rounded-[10px]" style={{ background: `hsl(var(--subject-${accent}))` }} />
                <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-extrabold text-strong">{course.title}</h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {items.length} video · {published} đã xuất bản{students > 0 && ` · ${students} sinh viên đang học`}
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={open}
                    onClick={() => onToggle(!open)}
                    className={`ml-auto inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[13px] font-bold transition ${open ? 'border-success-soft-border bg-success-soft text-success' : 'border-border bg-card text-muted-foreground'}`}
                >
                    <i aria-hidden className={`relative h-[18px] w-[30px] rounded-full transition ${open ? 'bg-success-bright' : 'bg-border'}`}>
                        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink-foreground transition-all ${open ? 'left-3.5' : 'left-0.5'}`} />
                    </i>
                    {open ? 'Đang mở cho sinh viên' : 'Đang khóa · chỉ thầy cô thấy'}
                </button>
                <button type="button" onClick={onAdd} className="rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-muted-foreground transition hover:bg-muted hover:text-strong">
                    + Thêm video
                </button>
            </div>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[18px]">
                {items.map((r) => (
                    <li key={r.lesson.id}>
                        <VideoCard review={r} />
                    </li>
                ))}
            </ul>
        </section>
    )
}

function VideoCard({ review: r }: { review: LessonReview }) {
    const [broken, setBroken] = useState(false)
    const need = r.state === 'wait' || r.state === 'editing'
    const body = (
        <>
            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-ink via-ink to-brand-950">
                {!broken && (
                    <img
                        src={`https://i.ytimg.com/vi/${r.lesson.youtubeId}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        onError={() => setBroken(true)}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                )}
                {r.state === 'generating' && <span aria-hidden className="gen-shimmer absolute inset-0" />}
                <span className="absolute bottom-2 right-2 rounded-md bg-ink/80 px-1.5 py-0.5 font-mono text-[11.5px] font-bold text-ink-foreground">{formatTime(r.lesson.durationSec)}</span>
            </div>
            <div className="p-3.5">
                <b className="line-clamp-2 min-h-[2.6em] text-sm font-bold leading-snug text-strong">{r.lesson.title}</b>
                <div className="mt-3 flex items-center justify-between gap-2">
                    {r.state === 'wait' && <Status tone="wait">Chờ duyệt · {r.total} mục</Status>}
                    {r.state === 'editing' && <Status tone="edit">Đang duyệt {r.done}/{r.total}</Status>}
                    {r.state === 'published' && <Status tone="ok">Đã xuất bản</Status>}
                    {r.state === 'generating' && (
                        <Status tone="gen">
                            ✦ AI đang tạo · {Math.round((r.progress ?? 0) * 100)}%
                        </Status>
                    )}
                    <span className={`text-[13px] font-extrabold ${need ? 'text-brand-ink' : 'text-muted-foreground'}`}>
                        {r.state === 'wait' ? 'Duyệt →' : r.state === 'editing' ? 'Duyệt tiếp →' : r.state === 'published' ? 'Xem' : ''}
                    </span>
                </div>
                {r.state === 'generating' && (
                    <p className="mt-2 truncate text-xs text-muted-foreground" title="Đọc phụ đề → Transcript có mốc → Khái niệm → Câu hỏi và câu biến thể">
                        {r.step}…
                    </p>
                )}
            </div>
        </>
    )
    const cls = `block overflow-hidden rounded-[18px] border bg-card shadow-card transition ${need ? 'border-brand-100' : 'border-border'} ${r.state === 'published' ? 'opacity-[0.92]' : ''}`
    if (r.state === 'generating') {
        return (
            <div aria-busy="true" className={cls}>
                {body}
            </div>
        )
    }
    return (
        <Link to={`/teacher/review/${r.lesson.id}`} className={`${cls} hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}>
            {body}
        </Link>
    )
}

function Status({ tone, children }: { tone: 'wait' | 'edit' | 'ok' | 'gen'; children: React.ReactNode }) {
    const cls = {
        wait: 'bg-brand-50 text-brand-ink',
        edit: 'bg-mm-orange/15 text-[hsl(var(--subject-photo-ink))]',
        ok: 'bg-success-soft text-success',
        gen: 'bg-muted text-muted-foreground',
    }[tone]
    return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>
}
