import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { applyCatalog, staticCourses, staticLessons } from '@/data'
import type { Course, Lesson } from '@/data/types'
import type { CourseCoverSpec } from '@/lib/cover-kinds'

// Danh mục khóa học và bài giảng do giảng viên quản lý: MỘT nguồn sự thật. Phía sinh viên đọc qua applyCatalog (data/index.ts) nên đổi ở đây
// là phía sinh viên đổi theo. Không có backend: lưu localStorage, "Đặt lại dữ liệu demo" xóa sạch.

/** Bìa do giảng viên chọn: màu/họa tiết tự sinh, hoặc ảnh tải lên (dataURL JPEG đã thu nhỏ, ưu tiên hơn bìa tự sinh) */
export interface CourseCoverOverride extends CourseCoverSpec {
    image?: string
}

export interface CourseOverride {
    title?: string
    subject?: string
    open?: boolean
}
export interface LessonOverride {
    title?: string
    courseId?: string
}

interface CatalogData {
    /** Khóa giảng viên tạo mới (mới nhất đứng đầu) */
    customCourses: Course[]
    courseOver: Record<string, CourseOverride>
    deletedCourses: string[]
    covers: Record<string, CourseCoverOverride>
    /** Bài từ video giảng viên tải lên (xuất hiện cho sinh viên khi AI đọc xong) */
    customLessons: Lesson[]
    lessonOver: Record<string, LessonOverride>
    deletedLessons: string[]
    /** Thứ tự bài trong khóa (id khóa → id bài); chưa có thì theo thứ tự gốc */
    lessonOrder: Record<string, string[]>
}

interface CatalogState extends CatalogData {
    addCourse: (c: { title: string; subject: string; cover?: CourseCoverOverride }) => string
    renameCourse: (id: string, title: string) => void
    setSubject: (id: string, subject: string) => void
    setOpen: (id: string, open: boolean) => void
    setCover: (id: string, cover: CourseCoverOverride | null) => void
    deleteCourse: (id: string) => void
    restoreCourse: (id: string) => void
    addLesson: (l: Lesson) => void
    renameLesson: (id: string, title: string) => void
    moveLesson: (id: string, courseId: string) => void
    deleteLesson: (id: string) => void
    restoreLesson: (id: string, courseId?: string) => void
    setOrder: (courseId: string, lessonIds: string[]) => void
    reset: () => void
}

const empty = (): CatalogData => ({ customCourses: [], courseOver: {}, deletedCourses: [], covers: {}, customLessons: [], lessonOver: {}, deletedLessons: [], lessonOrder: {} })

const safeStorage: StateStorage = {
    getItem: (n) => {
        try {
            return localStorage.getItem(n)
        } catch {
            return null
        }
    },
    setItem: (n, v) => {
        try {
            localStorage.setItem(n, v)
        } catch {
            /* không lưu được thì thôi */
        }
    },
    removeItem: (n) => {
        try {
            localStorage.removeItem(n)
        } catch {
            /* bỏ qua */
        }
    },
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const norm = (s: string) => s.trim().slice(0, 160)

export const useCatalog = create<CatalogState>()(
    persist(
        (set) => ({
            ...empty(),
            addCourse: ({ title, subject, cover }) => {
                const id = newId('kh')
                const course: Course = { id, title: norm(title), subject: norm(subject) || 'Khác', instructor: 'ThS. Nguyễn Cảnh Châu', description: '', lessonIds: [], createdAt: Date.now() }
                set((s) => ({ customCourses: [course, ...s.customCourses], courseOver: { ...s.courseOver, [id]: { open: false } }, covers: cover ? { ...s.covers, [id]: cover } : s.covers }))
                return id
            },
            renameCourse: (id, title) => set((s) => ({ courseOver: { ...s.courseOver, [id]: { ...s.courseOver[id], title: norm(title) } } })),
            setSubject: (id, subject) => set((s) => ({ courseOver: { ...s.courseOver, [id]: { ...s.courseOver[id], subject: norm(subject) } } })),
            setOpen: (id, open) => set((s) => ({ courseOver: { ...s.courseOver, [id]: { ...s.courseOver[id], open } } })),
            setCover: (id, cover) =>
                set((s) => {
                    const { [id]: _old, ...rest } = s.covers
                    void _old
                    return { covers: cover ? { ...rest, [id]: cover } : rest }
                }),
            deleteCourse: (id) => set((s) => ({ deletedCourses: [...s.deletedCourses.filter((x) => x !== id), id] })),
            restoreCourse: (id) => set((s) => ({ deletedCourses: s.deletedCourses.filter((x) => x !== id) })),
            addLesson: (l) => set((s) => ({ customLessons: [...s.customLessons.filter((x) => x.id !== l.id), l], deletedLessons: s.deletedLessons.filter((x) => x !== l.id) })),
            renameLesson: (id, title) => set((s) => ({ lessonOver: { ...s.lessonOver, [id]: { ...s.lessonOver[id], title: norm(title) } } })),
            moveLesson: (id, courseId) =>
                set((s) => {
                    const order = Object.fromEntries(Object.entries(s.lessonOrder).map(([k, v]) => [k, v.filter((x) => x !== id)]))
                    return { lessonOver: { ...s.lessonOver, [id]: { ...s.lessonOver[id], courseId } }, lessonOrder: order }
                }),
            deleteLesson: (id) => set((s) => ({ deletedLessons: [...s.deletedLessons.filter((x) => x !== id), id] })),
            restoreLesson: (id, courseId) =>
                set((s) => ({
                    deletedLessons: s.deletedLessons.filter((x) => x !== id),
                    lessonOver: courseId ? { ...s.lessonOver, [id]: { ...s.lessonOver[id], courseId } } : s.lessonOver,
                })),
            setOrder: (courseId, lessonIds) => set((s) => ({ lessonOrder: { ...s.lessonOrder, [courseId]: lessonIds } })),
            reset: () => set(empty()),
        }),
        {
            name: 'orbit-catalog',
            version: 1,
            storage: createJSONStorage(() => safeStorage),
        },
    ),
)

// ─── Dẫn xuất ──────────────────────────────────────────────────────────────

export interface TeacherCourse extends Course {
    open: boolean
    createdAt: number
    builtin: boolean
}

/** Khóa của giảng viên: khóa mới trên cùng, đã áp đổi tên/môn, bỏ khóa đã xóa; lessonIds theo thứ tự hiện tại. */
export function resolveCourses(s: CatalogData): TeacherCourse[] {
    const gone = new Set(s.deletedCourses)
    const lessons = resolveLessons(s)
    const base = [...s.customCourses.map((c) => ({ c, builtin: false })), ...staticCourses.map((c, i) => ({ c: { ...c, createdAt: c.createdAt ?? Date.UTC(2024, 0, 1) - i * 86_400_000 }, builtin: true }))]
    return base
        .filter(({ c }) => !gone.has(c.id))
        .map(({ c, builtin }) => {
            const o = s.courseOver[c.id] ?? {}
            return { ...c, title: o.title ?? c.title, subject: o.subject ?? c.subject, open: o.open ?? builtin, createdAt: c.createdAt ?? 0, builtin, lessonIds: lessons.filter((l) => l.courseId === c.id).map((l) => l.id) }
        })
}

/** Bài còn tồn tại (đã áp đổi tên/chuyển khóa/thứ tự), kể cả bài của khóa đang khóa. */
export function resolveLessons(s: CatalogData): Lesson[] {
    const gone = new Set(s.deletedLessons)
    const goneCourses = new Set(s.deletedCourses)
    const list = [...staticLessons, ...s.customLessons]
        .filter((l) => !gone.has(l.id))
        .map((l) => {
            const o = s.lessonOver[l.id]
            return o ? { ...l, title: o.title ?? l.title, courseId: o.courseId ?? l.courseId } : l
        })
        .filter((l) => !goneCourses.has(l.courseId))
    const byCourse = new Map<string, Lesson[]>()
    for (const l of list) byCourse.set(l.courseId, [...(byCourse.get(l.courseId) ?? []), l])
    return [...byCourse.entries()].flatMap(([cid, ls]) => {
        const order = s.lessonOrder[cid]
        if (!order) return ls
        const rank = (l: Lesson) => {
            const i = order.indexOf(l.id)
            return i < 0 ? order.length + ls.indexOf(l) : i
        }
        return [...ls].sort((a, b) => rank(a) - rank(b))
    })
}

/** Đẩy danh mục sang phía sinh viên: chỉ khóa đang mở và bài của các khóa đó. */
export function syncCatalog(s: CatalogData = useCatalog.getState()) {
    const open = resolveCourses(s).filter((c) => c.open)
    const ids = new Set(open.map((c) => c.id))
    const lessons = resolveLessons(s).filter((l) => ids.has(l.courseId))
    applyCatalog({ courses: open.map(({ open: _o, builtin: _b, ...c }) => (void _o, void _b, c)), lessons })
}

syncCatalog()
useCatalog.subscribe((s, prev) => {
    if (s !== prev) syncCatalog(s)
})

/** Số sinh viên đang học (dữ liệu mẫu cho bản demo): khóa có sẵn có số cố định, khóa mới chưa có ai. */
const DEMO_LEARNERS: Record<string, number> = { 'dung-audio-video-phi-tuyen': 28, 'nhiep-anh-va-anh-sang': 24 }
export const learnersOf = (course: { id: string; open: boolean }) => (course.open ? (DEMO_LEARNERS[course.id] ?? 0) : 0)
