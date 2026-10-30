import type { Badge, ClassStats, Course, DailyArticle, Lesson, ReviewStatus } from './types'
import coursesJson from './courses.json'
import lessonsJson from './lessons.json'
import dailyJson from './daily.json'
import badgesJson from './badges.json'
import classStatsJson from './class-stats.json'

// JSON được TS suy ra kiểu rộng (string thay cho union), nên ép về kiểu chuẩn ở đây.
// scripts/generate-content.ts chịu trách nhiệm ghi ra đúng cấu trúc.
/** Toàn bộ nội dung có sẵn trong JSON (kể cả bài chưa xuất bản và khóa đang khóa): chỉ phía giảng viên và kho dữ liệu mẫu dùng. */
export const staticCourses = coursesJson as Course[]
export const staticLessons = lessonsJson as Lesson[]
export const dailyArticles = dailyJson as DailyArticle[]
export const badges = badgesJson as Badge[]
export const classStats = classStatsJson as ClassStats

/**
 * Những gì SINH VIÊN thấy: khóa đang mở và các bài đã xuất bản (gồm cả bài giảng viên nhập từ YouTube sau khi xuất bản).
 * Hai mảng này được sửa tại chỗ bởi `applyCatalog` mỗi khi giảng viên đổi trạng thái (store gọi), nên mọi nơi phía sinh viên
 * dùng `courses`, `lessons`, `getLesson`… đều thấy đúng một nguồn, không phải lọc lại ở từng trang.
 */
export const courses: Course[] = [...staticCourses]
export const lessons: Lesson[] = [...staticLessons]
export const allConcepts = staticLessons.flatMap((l) => l.concepts)

/** Thay đổi của giảng viên trên kho khóa/bài (đổi tên, chuyển khóa, thay video, sắp xếp, xóa mềm); không sửa dữ liệu gốc nên "Đặt lại dữ liệu demo" khôi phục được. */
export type LessonOverride = Partial<Omit<Lesson, 'upload'>> & { upload?: Lesson['upload'] | null }

export interface OverlayInput {
    importedCourses: Course[]
    importedLessons: Lesson[]
    courseTitles?: Record<string, string>
    lessonOverrides?: Record<string, LessonOverride>
    /** Thứ tự bài do giảng viên sắp xếp (id khóa → id bài); chưa có thì theo thứ tự gốc */
    lessonOrder?: Record<string, string[]>
    deletedLessons?: string[]
    deletedCourses?: string[]
}

/** Khóa của giảng viên sau khi áp đổi tên và bỏ khóa đã xóa. */
export function resolveCourses(s: Pick<OverlayInput, 'importedCourses' | 'courseTitles' | 'deletedCourses'>): Course[] {
    const gone = new Set(s.deletedCourses ?? [])
    return [...staticCourses, ...s.importedCourses].filter((c) => !gone.has(c.id)).map((c) => (s.courseTitles?.[c.id] ? { ...c, title: s.courseTitles[c.id] } : c))
}

/** Bài của giảng viên sau khi áp đổi tên/chuyển khóa/thay video, bỏ bài đã xóa, xếp theo thứ tự đã sắp (gom theo khóa). */
export function resolveLessons(s: OverlayInput): Lesson[] {
    const goneLessons = new Set(s.deletedLessons ?? [])
    const goneCourses = new Set(s.deletedCourses ?? [])
    const list = [...staticLessons, ...s.importedLessons].filter((l) => !goneLessons.has(l.id)).map((l) => {
        const ov = s.lessonOverrides?.[l.id]
        if (!ov) return l
        const { upload, ...rest } = ov
        const merged = { ...l, ...rest } as Lesson
        if (upload === null) delete merged.upload
        else if (upload) merged.upload = upload
        return merged
    }).filter((l) => !goneCourses.has(l.courseId))
    const byCourse = new Map<string, Lesson[]>()
    for (const l of list) byCourse.set(l.courseId, [...(byCourse.get(l.courseId) ?? []), l])
    return [...byCourse.entries()].flatMap(([cid, ls]) => {
        const order = s.lessonOrder?.[cid]
        if (!order) return ls
        const rank = (l: Lesson) => { const i = order.indexOf(l.id); return i < 0 ? order.length + ls.indexOf(l) : i }
        return [...ls].sort((a, b) => rank(a) - rank(b))
    })
}

export interface CatalogInput extends OverlayInput {
    /** Trạng thái duyệt do giảng viên đặt; chưa có thì dùng status trong dữ liệu bài */
    lessonReview: Record<string, ReviewStatus>
    /** Khóa đang mở cho sinh viên; chưa có thì coi là mở */
    courseOpen: Record<string, boolean>
    /** Bản đang xuất bản của bài vừa được thay video (bản mới còn chờ duyệt): sinh viên vẫn học bản này */
    liveSnapshots?: Record<string, Lesson>
}

export function applyCatalog(input: CatalogInput) {
    const { lessonReview, courseOpen, liveSnapshots = {} } = input
    const isOpen = (courseId: string) => courseOpen[courseId] !== false
    const nextCourses = resolveCourses(input).filter((c) => isOpen(c.id))
    const nextLessons = resolveLessons(input).flatMap((l): Lesson[] => {
        if (!isOpen(l.courseId)) return []
        if ((lessonReview[l.id] ?? l.status) === 'published') return [l]
        const snap = liveSnapshots[l.id]
        return snap ? [{ ...snap, title: l.title, courseId: l.courseId }] : []
    })
    courses.splice(0, courses.length, ...nextCourses)
    lessons.splice(0, lessons.length, ...nextLessons)
    allConcepts.splice(0, allConcepts.length, ...staticLessons.flatMap((l) => l.concepts), ...nextLessons.filter((l) => l.id.startsWith('imp-')).flatMap((l) => l.concepts))
}

export const getCourse = (id: string) => courses.find((c) => c.id === id)
export const getLesson = (id: string) => lessons.find((l) => l.id === id)
export const getLessonsOfCourse = (courseId: string) => lessons.filter((l) => l.courseId === courseId)

export const getConcept = (id: string) => allConcepts.find((c) => c.id === id)
export const getConceptLesson = (conceptId: string) => lessons.find((l) => l.concepts.some((c) => c.id === conceptId))

export type * from './types'
