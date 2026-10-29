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

export interface CatalogInput {
    importedCourses: Course[]
    importedLessons: Lesson[]
    /** Trạng thái duyệt do giảng viên đặt; chưa có thì dùng status trong dữ liệu bài */
    lessonReview: Record<string, ReviewStatus>
    /** Khóa đang mở cho sinh viên; chưa có thì coi là mở */
    courseOpen: Record<string, boolean>
}

export function applyCatalog({ importedCourses, importedLessons, lessonReview, courseOpen }: CatalogInput) {
    const isOpen = (courseId: string) => courseOpen[courseId] !== false
    const published = (l: Lesson) => (lessonReview[l.id] ?? l.status) === 'published'
    const nextCourses = [...staticCourses, ...importedCourses].filter((c) => isOpen(c.id))
    const nextLessons = [...staticLessons, ...importedLessons].filter((l) => isOpen(l.courseId) && published(l))
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
