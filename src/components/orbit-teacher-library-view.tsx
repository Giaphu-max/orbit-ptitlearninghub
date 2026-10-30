import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { GripVertical, Search } from 'lucide-react'
import { CourseArt } from '@/components/courses/course-cover'
import type { Course } from '@/data/types'
import { useAddDialog } from '@/components/teacher/add-dialog-state'
import { CoverDialog, NewCourseDialog } from '@/components/teacher/course-cover-dialogs'
import { ConfirmDialog, MoreMenu, MoveDialog, RenameDialog, type MenuItem } from '@/components/teacher/library-ui'
import { usePendingReviewTasks } from '@/components/teacher/use-pending-review-tasks'
import { courseFullyPublished, finalKey, finalSetFor, passCount, resolveSet, sourcedBank, useCourseAllLessons } from '@/lib/test-sets'
import { studentsOfCourse, useLessonReviews, useTeacherCourses, type LessonReview } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const RANK: Record<LessonReview['state'], number> = { editing: 0, wait: 1, generating: 2, published: 3 }

type StatusFilter = 'all' | 'pending' | 'published' | 'generating'
const STATUS_LABEL: Record<StatusFilter, string> = { all: 'Tất cả', pending: 'Chờ duyệt', published: 'Đã xuất bản', generating: 'Đang tạo' }
const isStatus = (v: string | null): v is StatusFilter => v === 'pending' || v === 'published' || v === 'generating'

/** Bỏ dấu + hạ chữ thường để tìm không phân biệt dấu. */
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase()

const matchStatus = (st: StatusFilter, state: LessonReview['state']) => st === 'all' || (st === 'pending' ? state === 'wait' || state === 'editing' : st === state)

type Dlg =
    | { k: 'newCourse' }
    | { k: 'cover'; courseId: string }
    | { k: 'delCourse'; courseId: string }
    | { k: 'rename'; id: string }
    | { k: 'move'; id: string }
    | { k: 'delLesson'; id: string }
    | { k: 'resetFinal'; courseId: string }

interface Toast {
    msg: string
    undo?: () => void
}

/** /teacher/library – kho bài giảng của giảng viên; mỗi khóa mở/khóa cho sinh viên, thẻ video cho biết bài nào cần duyệt. Không giao theo lớp. */
export function OrbitTeacherLibraryView() {
    const role = useOrbitStore((s) => s.role)
    const reviews = useLessonReviews()
    const allCourses = useTeacherCourses()
    const pendingTasks = usePendingReviewTasks()
    const showAdd = useAddDialog((s) => s.show)
    const replaceVideo = useAddDialog((s) => s.replace)
    const store = useOrbitStore()
    const [params, setParams] = useSearchParams()
    const query = params.get('q') ?? ''
    const statusParam = params.get('status')
    const status: StatusFilter = isStatus(statusParam) ? statusParam : 'all'
    const [text, setText] = useState(query)
    const searchRef = useRef<HTMLInputElement>(null)
    const [dlg, setDlg] = useState<Dlg | null>(null)
    const [justCreated, setJustCreated] = useState<string | null>(null)
    const [glow, setGlow] = useState<string | null>(null)
    const [toast, setToast] = useState<Toast | null>(null)
    const toastTimer = useRef<number | undefined>(undefined)
    const purgeTimers = useRef(new Map<string, number>())
    const say = (msg: string, ms = 3200, undo?: () => void) => {
        setToast({ msg, undo })
        window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToast(null), ms)
    }
    useEffect(() => () => window.clearTimeout(toastTimer.current), [])

    const setParam = (key: string, value: string) =>
        setParams(
            (p) => {
                const n = new URLSearchParams(p)
                if (value) n.set(key, value)
                else n.delete(key)
                return n
            },
            { replace: true },
        )
    // Gõ tới đâu lọc tới đó, nhưng chờ 150ms để không ghi URL mỗi phím
    useEffect(() => {
        const t = window.setTimeout(() => text !== query && setParam('q', text.trim() ? text : ''), 150)
        return () => window.clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text])
    useEffect(() => setText(query), [query])
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return
            e.preventDefault()
            searchRef.current?.focus()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    // Báo khi một bài vừa tạo xong nội dung
    const prevGenerating = useRef<Set<string>>(new Set())
    useEffect(() => {
        const now = new Set(reviews.filter((r) => r.state === 'generating').map((r) => r.lesson.id))
        const finished = reviews.filter((r) => prevGenerating.current.has(r.lesson.id) && !now.has(r.lesson.id))
        prevGenerating.current = now
        if (!finished.length) return
        say(finished.length === 1 ? `Đã tạo xong nội dung · ${finished[0].lesson.title} đang chờ thầy cô duyệt` : `Đã tạo xong nội dung cho ${finished.length} video · chờ thầy cô duyệt`)
    }, [reviews])

    const q = norm(query.trim())
    const filtering = q !== '' || status !== 'all'
    const finalPublished = (courseId: string) => store.testSets[finalKey(courseId)]?.published ?? courseFullyPublished(courseId, store)

    const sections = useMemo(
        () =>
            allCourses.map((course) => {
                const manual = !!store.lessonOrder[course.id]
                const items = reviews.filter((r) => r.lesson.courseId === course.id).sort((a, b) => (manual ? 0 : RANK[a.state] - RANK[b.state]) || a.index - b.index)
                return { course, items }
            }),
        [allCourses, reviews, store.lessonOrder],
    )

    // Khóa vừa tạo: cuộn tới, sáng viền khoảng 1,5s, focus vào "+ Thêm video" của khóa
    const createdReady = !!justCreated && allCourses.some((c) => c.id === justCreated)
    useEffect(() => {
        if (!justCreated || !createdReady) return
        const el = document.getElementById(`course-${justCreated}`)
        if (!el) return
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' })
        el.querySelector<HTMLElement>('[data-add-video]')?.focus({ preventScroll: true })
        setGlow(justCreated)
        setJustCreated(null)
        const t = window.setTimeout(() => setGlow(null), 1500)
        return () => window.clearTimeout(t)
    }, [justCreated, createdReady])

    if (role !== 'teacher') return <Navigate to="/" replace />

    const matchCard = (course: Course, r: LessonReview) =>
        matchStatus(status, r.state) && (q === '' || norm([r.lesson.title, r.lesson.shortTitle ?? '', course.title, ...r.lesson.concepts.map((c) => c.name)].join(' ')).includes(q))
    const matchFinal = (course: Course) => {
        const pub = finalPublished(course.id)
        if (!reviews.some((r) => r.lesson.courseId === course.id && r.state === 'published')) return status === 'all' && (q === '' || norm(`${course.title} test cuoi chuong`).includes(q))
        return (status === 'all' || (status === 'pending' && !pub) || (status === 'published' && pub)) && (q === '' || norm(`${course.title} test cuoi chuong`).includes(q))
    }
    const visible = sections
        .map(({ course, items }) => ({ course, items, shown: items.filter((r) => matchCard(course, r)), finalShown: items.length > 0 && matchFinal(course) }))
        .filter((s) => !filtering || s.shown.length > 0 || s.finalShown)

    const toggle = (course: Course, open: boolean) => {
        store.setCourseOpen(course.id, open)
        say(open ? 'Đã mở khóa học: sinh viên thấy các bài đã xuất bản' : 'Đã khóa: sinh viên tạm không thấy khóa này', 2400)
    }
    const clearFilters = () => {
        setText('')
        setParams({}, { replace: true })
    }

    const lessonOf = (id: string) => reviews.find((r) => r.lesson.id === id)
    const courseOf = (id: string) => allCourses.find((c) => c.id === id)
    const removeLesson = (r: LessonReview) => {
        const id = r.lesson.id
        store.deleteLesson(id)
        const timers = purgeTimers.current
        window.clearTimeout(timers.get(id))
        timers.set(id, window.setTimeout(() => (timers.delete(id), useOrbitStore.getState().purgeLesson(id)), 5000))
        say(`Đã xóa ${r.lesson.title}`, 5000, () => {
            window.clearTimeout(timers.get(id))
            timers.delete(id)
            useOrbitStore.getState().restoreLesson(id)
            setToast(null)
        })
    }

    const dCourse = dlg && 'courseId' in dlg ? courseOf(dlg.courseId) : undefined
    const dLesson = dlg && 'id' in dlg ? lessonOf(dlg.id) : undefined

    return (
        <div className="w-full pb-8">
            <header>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">Bài giảng</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-0.03em] text-strong">Khóa học của giảng viên</h1>
            </header>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-[340px]">
                    <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="search"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' && text) {
                                e.preventDefault()
                                setText('')
                                setParam('q', '')
                            }
                        }}
                        placeholder="Tìm bài giảng, khóa học…"
                        aria-label="Tìm bài giảng, khóa học"
                        aria-keyshortcuts="/"
                        className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3.5 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                    />
                </div>
                <div role="group" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-1.5">
                    {(['all', 'pending', 'published', 'generating'] as const).map((id) => (
                        <button
                            key={id}
                            type="button"
                            aria-pressed={status === id}
                            onClick={() => setParam('status', id === 'all' ? '' : id)}
                            className={`rounded-full border px-3.5 py-2 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${status === id ? 'border-brand-600 bg-brand-50 text-brand-ink' : 'border-border bg-card text-muted-foreground hover:text-strong'}`}
                        >
                            {STATUS_LABEL[id]}
                            {id === 'pending' && <span className="ml-1.5 font-mono">{pendingTasks.length}</span>}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={() => setDlg({ k: 'newCourse' })} className="h-11 rounded-xl px-3.5 text-[14px] font-bold text-muted-foreground transition hover:bg-muted hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
                        + Khóa học mới
                    </button>
                    <button type="button" onClick={() => showAdd()} className="surface-red h-11 rounded-xl px-[18px] text-[14.5px] font-extrabold text-ink-foreground shadow-brand">
                        + Thêm video
                    </button>
                </div>
            </div>

            <div className="mt-8 flex flex-col gap-8">
                {sections.length === 0 && <p className="text-sm text-muted-foreground">Chưa có khóa học nào.</p>}
                {filtering && visible.length === 0 && sections.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        Không có bài nào khớp “{query.trim() || STATUS_LABEL[status]}”.{' '}
                        <button type="button" onClick={clearFilters} className="font-bold text-brand-ink underline-offset-2 hover:underline">
                            Xóa bộ lọc
                        </button>
                    </p>
                )}
                {visible.map(({ course, items, shown, finalShown }) => (
                    <CourseSection
                        key={course.id}
                        course={course}
                        open={course.open}
                        items={items}
                        shown={shown}
                        showFinal={!filtering || finalShown}
                        highlight={glow === course.id}
                        filtering={filtering}
                        onAdd={() => showAdd(course.id)}
                        onToggle={(v) => toggle(course, v)}
                        onRename={(t) => store.renameCourse(course.id, t)}
                        onCover={() => setDlg({ k: 'cover', courseId: course.id })}
                        onDelete={() => setDlg({ k: 'delCourse', courseId: course.id })}
                        onReorder={(ids) => store.setLessonOrder(course.id, ids)}
                        onLessonRename={(r) => setDlg({ k: 'rename', id: r.lesson.id })}
                        onLessonMove={(r) => setDlg({ k: 'move', id: r.lesson.id })}
                        onLessonReplace={(r) => replaceVideo(r.lesson.id)}
                        onLessonUnpublish={(r) => (store.setLessonReview(r.lesson.id, 'draft'), say(`Đã gỡ xuất bản ${r.lesson.title}: sinh viên không còn thấy bài này`))}
                        onLessonDelete={(r) => setDlg({ k: 'delLesson', id: r.lesson.id })}
                        onFinalUnpublish={(set) => (store.setTestSet(finalKey(course.id), { ...set, published: false }), say('Đã gỡ xuất bản test cuối chương'))}
                        onFinalReset={() => setDlg({ k: 'resetFinal', courseId: course.id })}
                    />
                ))}
            </div>

            {dlg?.k === 'newCourse' && (
                <NewCourseDialog
                    onCreate={(c, image) => {
                        store.addCourse(c)
                        if (image) store.setCourseCover(c.id, { image })
                        setJustCreated(c.id)
                        say(`Đã tạo khóa “${c.title}” · đang khóa, chỉ thầy cô thấy`)
                    }}
                    onClose={() => setDlg(null)}
                />
            )}
            {dlg?.k === 'cover' && dCourse && <CoverDialog course={dCourse} onClose={() => setDlg(null)} />}
            {dlg?.k === 'delCourse' && dCourse && <DeleteCourse course={dCourse} lessons={reviews.filter((r) => r.lesson.courseId === dCourse.id)} onClose={() => setDlg(null)} onToggleOff={() => toggle(dCourse, false)} onDelete={(ids) => {
                ids.forEach((id) => (store.deleteLesson(id), store.purgeLesson(id)))
                store.deleteCourse(dCourse.id)
                setDlg(null)
                say(`Đã xóa khóa “${dCourse.title}”`)
            }} />}
            {dlg?.k === 'rename' && dLesson && <RenameDialog title="Đổi tên bài" label="Tên bài" initial={dLesson.lesson.title} onSave={(v) => store.renameLesson(dLesson.lesson.id, v)} onClose={() => setDlg(null)} />}
            {dlg?.k === 'move' && dLesson && (
                <MoveDialog
                    lessonTitle={dLesson.lesson.title}
                    currentId={dLesson.lesson.courseId}
                    courses={allCourses}
                    onMove={(cid) => (store.moveLesson(dLesson.lesson.id, cid), say(`Đã chuyển sang “${courseOf(cid)?.title ?? ''}”`))}
                    onClose={() => setDlg(null)}
                />
            )}
            {dlg?.k === 'delLesson' && dLesson && (
                <ConfirmDialog
                    title={`Xóa “${dLesson.lesson.title}”?`}
                    confirmLabel="Xóa"
                    onClose={() => setDlg(null)}
                    onConfirm={() => (removeLesson(dLesson), setDlg(null))}
                >
                    Sinh viên sẽ không thấy bài này nữa. Tiến độ học của bài cũng bị xóa khỏi dữ liệu demo.
                </ConfirmDialog>
            )}
            {dlg?.k === 'resetFinal' && dCourse && <ResetFinal course={dCourse} onClose={() => setDlg(null)} onDone={() => say('Đã soạn lại test cuối chương từ đầu bằng AI')} />}

            <div
                role="status"
                className={`fixed bottom-7 left-1/2 z-[60] flex max-w-[80vw] -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-3 pl-[18px] text-sm font-semibold text-ink-foreground shadow-raised transition duration-slow ${toast?.undo ? 'pr-2' : 'pr-[18px]'} ${toast ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-5 opacity-0'}`}
            >
                {toast?.msg}
                {toast?.undo && (
                    <button type="button" onClick={toast.undo} className="rounded-full bg-ink-foreground/15 px-3.5 py-1.5 text-[13px] font-extrabold transition hover:bg-ink-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground">
                        Hoàn tác
                    </button>
                )}
            </div>
        </div>
    )
}

function DeleteCourse({ course, lessons, onClose, onToggleOff, onDelete }: { course: Course & { open: boolean }; lessons: LessonReview[]; onClose: () => void; onToggleOff: () => void; onDelete: (lessonIds: string[]) => void }) {
    const published = lessons.filter((r) => r.state === 'published').length
    const blocked = course.open && published > 0
    return (
        <ConfirmDialog
            title={`Xóa khóa “${course.title}”?`}
            confirmLabel="Xóa"
            blocked={blocked}
            onClose={onClose}
            onConfirm={() => onDelete(lessons.map((r) => r.lesson.id))}
            extra={
                blocked && (
                    <button type="button" onClick={onToggleOff} className="h-11 rounded-[10px] border border-border px-4 text-sm font-bold text-strong transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
                        Tắt “Đang mở cho sinh viên”
                    </button>
                )
            }
        >
            {blocked ? (
                <>Khóa còn {published} bài đã xuất bản. Tắt “Đang mở cho sinh viên” trước hoặc gỡ xuất bản các bài, rồi xóa khóa.</>
            ) : (
                <>
                    {lessons.length > 0 ? `${lessons.length} bài trong khóa sẽ bị xóa theo.` : 'Khóa này chưa có bài nào.'} Sinh viên sẽ không thấy khóa này nữa; tiến độ học của các bài cũng bị xóa khỏi dữ liệu demo.
                </>
            )}
        </ConfirmDialog>
    )
}

function ResetFinal({ course, onClose, onDone }: { course: Course; onClose: () => void; onDone: () => void }) {
    const lessons = useCourseAllLessons(course.id)
    const setTestSet = useOrbitStore((s) => s.setTestSet)
    return (
        <ConfirmDialog
            title="Soạn lại test cuối chương từ đầu?"
            confirmLabel="Soạn lại"
            onClose={onClose}
            onConfirm={() => {
                setTestSet(finalKey(course.id), { ...finalSetFor(lessons, undefined), published: false })
                onClose()
                onDone()
            }}
        >
            AI sẽ soạn lại đề từ các bài của khóa “{course.title}”. Những chỉnh sửa của thầy cô trên đề hiện tại sẽ mất và đề quay về bản nháp.
        </ConfirmDialog>
    )
}

interface SectionProps {
    course: Course
    open: boolean
    items: LessonReview[]
    shown: LessonReview[]
    showFinal: boolean
    highlight?: boolean
    filtering: boolean
    onAdd: () => void
    onToggle: (open: boolean) => void
    onRename: (title: string) => void
    onCover: () => void
    onDelete: () => void
    onReorder: (ids: string[]) => void
    onLessonRename: (r: LessonReview) => void
    onLessonMove: (r: LessonReview) => void
    onLessonReplace: (r: LessonReview) => void
    onLessonUnpublish: (r: LessonReview) => void
    onLessonDelete: (r: LessonReview) => void
    onFinalUnpublish: (set: ReturnType<typeof finalSetFor>) => void
    onFinalReset: () => void
}

function CourseSection(p: SectionProps) {
    const { course, open, items, shown, showFinal, filtering } = p
    const published = items.filter((r) => r.state === 'published').length
    const students = studentsOfCourse(course.id)
    const [renaming, setRenaming] = useState(false)
    const [sorting, setSorting] = useState(false)
    const [draft, setDraft] = useState(course.title)
    const dragId = useRef<string | null>(null)
    const commitRename = () => {
        setRenaming(false)
        if (draft.trim() && draft.trim() !== course.title) p.onRename(draft.trim())
    }
    const menu: MenuItem[] = [
        {
            label: 'Đổi tên',
            onSelect: () => {
                setDraft(course.title)
                setRenaming(true)
            },
        },
        { label: 'Đổi bìa', onSelect: p.onCover },
        ...(items.length > 1 ? [{ label: 'Sắp xếp thứ tự bài', onSelect: () => setSorting(true) }] : []),
        { label: 'Xóa khóa', onSelect: p.onDelete, danger: true },
    ]
    const move = (id: string, to: number) => {
        const ids = items.map((r) => r.lesson.id)
        const from = ids.indexOf(id)
        if (from < 0 || to < 0 || to >= ids.length || from === to) return
        ids.splice(to, 0, ids.splice(from, 1)[0])
        p.onReorder(ids)
    }
    const cards = sorting ? items : shown
    return (
        <section id={`course-${course.id}`} aria-label={course.title} className={`-m-3 rounded-[20px] p-3 ring-2 transition-shadow duration-slow ${p.highlight ? 'ring-brand-100' : 'ring-transparent'}`}>
            <div className="mb-3 flex flex-wrap items-center gap-3.5">
                <span aria-hidden className="block h-12 w-12 shrink-0 overflow-hidden rounded-[10px]">
                    <CourseArt course={course} />
                </span>
                <div className="min-w-0">
                    {renaming ? (
                        <input
                            autoFocus
                            value={draft}
                            maxLength={120}
                            aria-label="Tên khóa"
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename()
                                if (e.key === 'Escape') setRenaming(false)
                            }}
                            className="h-9 w-[min(420px,70vw)] rounded-lg border border-brand-600 bg-card px-2.5 text-[17px] font-extrabold text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                        />
                    ) : (
                        <h2 className="truncate text-[17px] font-extrabold text-strong">{course.title}</h2>
                    )}
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {items.length} video · {published} đã xuất bản{students > 0 && ` · ${students} sinh viên đang học`}
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={open}
                    onClick={() => p.onToggle(!open)}
                    className={`ml-auto inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[13px] font-bold transition ${open ? 'border-success-soft-border bg-success-soft text-success' : 'border-border bg-card text-muted-foreground'}`}
                >
                    <i aria-hidden className={`relative h-[18px] w-[30px] rounded-full transition ${open ? 'bg-success-bright' : 'bg-border'}`}>
                        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink-foreground transition-all ${open ? 'left-3.5' : 'left-0.5'}`} />
                    </i>
                    {open ? 'Đang mở cho sinh viên' : 'Đang khóa · chỉ thầy cô thấy'}
                </button>
                {sorting ? (
                    <button type="button" onClick={() => setSorting(false)} className="surface-red rounded-lg px-3.5 py-1.5 text-[13px] font-extrabold text-ink-foreground shadow-brand">
                        Xong
                    </button>
                ) : (
                    <button type="button" data-add-video onClick={p.onAdd} className="rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-muted-foreground transition hover:bg-muted hover:text-strong">
                        + Thêm video
                    </button>
                )}
                <MoreMenu label={`Tùy chọn khóa ${course.title}`} items={menu} />
            </div>
            {sorting && <p className="mb-3 text-[13px] text-muted-foreground">Kéo tay nắm để đổi vị trí, hoặc giữ Alt rồi bấm ← → khi đang chọn tay nắm. Bấm “Xong” khi sắp xếp xong.</p>}
            {cards.length === 0 && !filtering && <p className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Khóa này chưa có video. Bấm “+ Thêm video” để bắt đầu.</p>}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[18px]">
                {cards.map((r, i) => (
                    <li
                        key={r.lesson.id}
                        draggable={sorting}
                        onDragStart={() => (dragId.current = r.lesson.id)}
                        onDragOver={(e) => {
                            if (!sorting || !dragId.current) return
                            e.preventDefault()
                            if (dragId.current !== r.lesson.id) move(dragId.current, i)
                        }}
                        onDragEnd={() => (dragId.current = null)}
                        className={sorting ? 'relative cursor-grab' : undefined}
                    >
                        {sorting && (
                            <button
                                type="button"
                                aria-label={`Đổi vị trí: ${r.lesson.title} (vị trí ${i + 1}/${cards.length}). Alt và mũi tên trái phải để di chuyển`}
                                onKeyDown={(e) => {
                                    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
                                    e.preventDefault()
                                    move(r.lesson.id, i + (e.key === 'ArrowLeft' ? -1 : 1))
                                }}
                                className="absolute left-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                            >
                                <GripVertical size={16} aria-hidden />
                            </button>
                        )}
                        <VideoCard review={r} inert={sorting} onRename={() => p.onLessonRename(r)} onMove={() => p.onLessonMove(r)} onReplace={() => p.onLessonReplace(r)} onUnpublish={() => p.onLessonUnpublish(r)} onDelete={() => p.onLessonDelete(r)} />
                    </li>
                ))}
                {showFinal && !sorting && items.length > 0 && (
                    <li>
                        <FinalTestCard courseId={course.id} locked={published === 0} onUnpublish={p.onFinalUnpublish} onReset={p.onFinalReset} />
                    </li>
                )}
            </ul>
        </section>
    )
}

function VideoCard({ review: r, inert, onRename, onMove, onReplace, onUnpublish, onDelete }: { review: LessonReview; inert?: boolean; onRename: () => void; onMove: () => void; onReplace: () => void; onUnpublish: () => void; onDelete: () => void }) {
    const [broken, setBroken] = useState(false)
    const need = r.state === 'wait' || r.state === 'editing'
    const busy = r.state === 'generating'
    const menu: MenuItem[] = [
        { label: 'Đổi tên bài', onSelect: onRename },
        ...(busy ? [] : [{ label: 'Chuyển sang khóa khác', onSelect: onMove }, { label: 'Thay video', onSelect: onReplace }]),
        ...(r.state === 'published' ? [{ label: 'Gỡ xuất bản', onSelect: onUnpublish }] : []),
        { label: 'Xóa', onSelect: onDelete, danger: true },
    ]
    const body = (
        <>
            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-ink via-ink to-brand-950">
                {!broken && !(r.lesson.upload && !r.lesson.upload.thumbnail) && (
                    <img
                        src={r.lesson.upload ? (r.lesson.upload.thumbnail ?? '') : `https://i.ytimg.com/vi/${r.lesson.youtubeId}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        onError={() => setBroken(true)}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                )}
                {r.state === 'generating' && <span aria-hidden className="gen-shimmer absolute inset-0" />}
                {r.hasNewVersion && <span className="absolute bottom-2 left-2 rounded-md bg-ink/80 px-1.5 py-0.5 text-[11.5px] font-bold text-ink-foreground">Có bản mới chờ duyệt</span>}
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
    return (
        <div className="group relative">
            {r.state === 'generating' || inert ? (
                <div aria-busy={r.state === 'generating'} className={cls}>
                    {body}
                </div>
            ) : (
                <Link to={`/teacher/review/${r.lesson.id}`} className={`${cls} hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}>
                    {body}
                </Link>
            )}
            {!inert && <MoreMenu card label={`Tùy chọn cho ${r.lesson.title}`} items={menu} className="absolute right-2 top-2 z-10" />}
        </div>
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

/** Thẻ "Test cuối chương" ở cuối lưới mỗi khóa: bản nháp AI soạn sẵn hoặc đã xuất bản. */
function FinalTestCard({ courseId, locked, onUnpublish, onReset }: { courseId: string; locked: boolean; onUnpublish: (set: ReturnType<typeof finalSetFor>) => void; onReset: () => void }) {
    const lessons = useCourseAllLessons(courseId)
    const stored = useOrbitStore((s) => s.testSets[finalKey(courseId)])
    const fullyPublished = useOrbitStore((s) => courseFullyPublished(courseId, s))
    const set = useMemo(() => finalSetFor(lessons, stored), [lessons, stored])
    const n = useMemo(() => resolveSet(set, sourcedBank(lessons)).length, [set, lessons])
    const published = stored?.published ?? fullyPublished
    if (locked) {
        return (
            <div aria-disabled="true" className="block overflow-hidden rounded-[18px] border border-border bg-card opacity-60">
                <div className="flex aspect-video flex-col items-center justify-center gap-1 bg-muted text-center text-muted-foreground">
                    <span className="text-[15px] font-extrabold">Test cuối chương</span>
                </div>
                <div className="p-3.5">
                    <b className="block min-h-[2.6em] text-sm font-bold leading-snug text-muted-foreground">Mở soạn đề khi có bài đã xuất bản</b>
                </div>
            </div>
        )
    }
    const menu: MenuItem[] = [...(published ? [{ label: 'Gỡ xuất bản', onSelect: () => onUnpublish(set) }] : []), { label: 'Soạn lại từ đầu bằng AI', onSelect: onReset }]
    return (
        <div className="group relative">
        <Link
            to={`/teacher/test/${courseId}`}
            className={`block overflow-hidden rounded-[18px] border bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${published ? 'border-border' : 'border-brand-100'}`}
        >
            <div
                className="flex aspect-video flex-col items-center justify-center gap-1 text-center text-brand-ink"
                style={{ background: 'repeating-linear-gradient(135deg, rgb(var(--brand-50)) 0 10px, rgb(var(--brand-100)) 10px 20px)' }}
            >
                <span className="text-[15px] font-extrabold">Test cuối chương</span>
                <small className="font-mono text-[11.5px] font-bold opacity-80">
                    {n} câu · đạt {Math.round(set.rules.passRatio * 100)}% ({passCount(set.rules, n)}/{n})
                </small>
            </div>
            <div className="p-3.5">
                <b className="block min-h-[2.6em] text-sm font-bold leading-snug text-strong">Đề kiểm tra tổng hợp cả khóa</b>
                <div className="mt-3 flex items-center justify-between gap-2">
                    <Status tone={published ? 'ok' : 'wait'}>{published ? 'Đã xuất bản' : 'Bản nháp · AI soạn sẵn'}</Status>
                    <span className={`whitespace-nowrap text-[13px] font-extrabold ${published ? 'text-muted-foreground' : 'text-brand-ink'}`}>{published ? 'Sửa đề' : 'Soạn đề →'}</span>
                </div>
            </div>
        </Link>
        <MoreMenu card label="Tùy chọn cho Test cuối chương" items={menu} className="absolute right-2 top-2 z-10" />
        </div>
    )
}
