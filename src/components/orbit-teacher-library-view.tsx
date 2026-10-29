import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { courses } from '@/data'
import type { Course } from '@/data/types'
import { AddLessonsDialog } from '@/components/teacher/add-lessons-dialog'
import { ClassPicker } from '@/components/teacher/class-picker'
import { TEACHER_CLASSES } from '@/data/classes'
import { useLessonReviews, useTeacherClass, type LessonReview } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const RANK: Record<LessonReview['state'], number> = { editing: 0, wait: 1, generating: 2, published: 3 }

/** /teacher/library – mỗi khóa là một danh sách phát YouTube; thẻ video cho biết bài nào cần duyệt. */
export function OrbitTeacherLibraryView() {
    const role = useOrbitStore((s) => s.role)
    const importedCourses = useOrbitStore((s) => s.importedCourses)
    const reviews = useLessonReviews()
    const { courseIdsOf } = useTeacherClass()
    const [classFilter, setClassFilter] = useState<string | null>(null)
    const [adding, setAdding] = useState<{ courseId?: string } | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    // Báo khi một bài vừa tạo xong nội dung
    const prevGenerating = useRef<Set<string>>(new Set())
    useEffect(() => {
        const now = new Set(reviews.filter((r) => r.state === 'generating').map((r) => r.lesson.id))
        const finished = reviews.filter((r) => prevGenerating.current.has(r.lesson.id) && !now.has(r.lesson.id))
        prevGenerating.current = now
        if (!finished.length) return
        setToast(finished.length === 1 ? `Đã tạo xong nội dung · ${finished[0].lesson.title} đang chờ thầy cô duyệt` : `Đã tạo xong nội dung cho ${finished.length} video · chờ thầy cô duyệt`)
        const t = window.setTimeout(() => setToast(null), 3200)
        return () => window.clearTimeout(t)
    }, [reviews])

    const sections = useMemo(() => {
        const allowed = classFilter ? courseIdsOf(TEACHER_CLASSES.find((c) => c.id === classFilter)!) : null
        return [...courses, ...importedCourses]
            .filter((c) => !allowed || allowed.includes(c.id))
            .map((course) => ({ course, items: reviews.filter((r) => r.lesson.courseId === course.id).sort((a, b) => RANK[a.state] - RANK[b.state] || a.index - b.index) }))
            .filter((s) => s.items.length > 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classFilter, reviews, importedCourses])

    if (role !== 'teacher') return <Navigate to="/" replace />

    return (
        <div className="w-full">
            <div className="container-wide pb-10 pt-6">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">Bài giảng</p>
                        <h1 className="mt-2.5 text-[clamp(30px,2.6vw,40px)] font-black leading-tight tracking-[-0.03em] text-strong">Khóa học của thầy</h1>
                        <p className="mt-2 text-[15px] text-muted-foreground">Mỗi khóa là một danh sách phát YouTube; AI tạo nội dung, thầy cô duyệt rồi xuất bản.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ClassPicker allowAll value={classFilter} onChange={setClassFilter} />
                        <button type="button" onClick={() => setAdding({})} className="surface-red h-10 rounded-full px-5 text-sm font-extrabold text-ink-foreground shadow-brand">
                            + Thêm từ YouTube
                        </button>
                    </div>
                </header>

                <div className="mt-8 flex flex-col gap-10">
                    {sections.length === 0 && <p className="text-sm text-muted-foreground">Chưa có khóa học nào cho lớp này.</p>}
                    {sections.map(({ course, items }) => (
                        <CourseSection key={course.id} course={course} items={items} onAdd={() => setAdding({ courseId: course.id })} />
                    ))}
                </div>
            </div>
            <div
                role="status"
                className={`pointer-events-none fixed bottom-7 left-1/2 z-[60] max-w-[80vw] -translate-x-1/2 rounded-full bg-ink px-[18px] py-3 text-sm font-semibold text-ink-foreground shadow-raised transition duration-slow ${toast ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
            >
                {toast}
            </div>
            {adding && <AddLessonsDialog courseId={adding.courseId} onClose={() => setAdding(null)} />}
        </div>
    )
}

function CourseSection({ course, items, onAdd }: { course: Course; items: LessonReview[]; onAdd: () => void }) {
    const importedClasses = useOrbitStore((s) => s.importedCourseClasses)
    const published = items.filter((r) => r.state === 'published').length
    const classes = [...TEACHER_CLASSES.filter((c) => c.courseIds.includes(course.id)).map((c) => c.id), ...(importedClasses[course.id] ?? [])]
    const accent = course.cover?.accent ?? 'default'
    // Khóa mẫu chưa lưu id danh sách phát thật: mở video đầu tiên trên YouTube
    const playlistHref = `https://www.youtube.com/watch?v=${items[0].lesson.youtubeId}`
    return (
        <section aria-label={course.title}>
            <div className="flex flex-wrap items-center gap-4">
                <span aria-hidden className="h-11 w-11 shrink-0 rounded-xl" style={{ background: `hsl(var(--subject-${accent}))` }} />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-extrabold text-strong">{course.title}</h2>
                    <p className="text-[13px] text-muted-foreground">
                        {items.length} video · {published} đã xuất bản · lớp {classes.join(', ') || 'chưa gắn lớp'}
                    </p>
                </div>
                <a href={playlistHref} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground transition hover:text-strong">
                    Danh sách phát ↗
                </a>
                <button type="button" onClick={onAdd} className="h-9 rounded-full border border-border bg-card px-4 text-sm font-bold text-strong transition hover:bg-muted">
                    + Thêm video
                </button>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
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
