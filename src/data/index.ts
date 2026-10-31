import type { Badge, Course, DailyArticle, Lesson } from './types'
import coursesJson from './courses.json'
import lessonsJson from './lessons.json'
import dailyJson from './daily.json'
import badgesJson from './badges.json'

// JSON được TS suy ra kiểu rộng (string thay cho union), nên ép về kiểu chuẩn ở đây.
// scripts/generate-content.ts chịu trách nhiệm ghi ra đúng cấu trúc.
/** Toàn bộ nội dung mẫu có sẵn (kể cả khóa đang khóa): chỉ cổng giảng viên và store danh mục dùng. */
export const staticCourses = coursesJson as Course[]
export const staticLessons = lessonsJson as Lesson[]
export const staticDaily = dailyJson as DailyArticle[]
export const badges = badgesJson as Badge[]

/**
 * Những gì SINH VIÊN thấy: khóa đang mở, bài còn tồn tại, bài Daily thuộc các bài đó. Các mảng này được sửa tại chỗ bởi `applyCatalog`
 * (store danh mục gọi khi nạp và mỗi khi giảng viên đổi khóa/bài), nên mọi nơi phía sinh viên dùng `courses`, `lessons`, `getLesson`…
 * đều thấy đúng một nguồn mà không phải lọc lại ở từng trang. Lúc nạp đầu tiên là toàn bộ nội dung mẫu.
 */
export const courses: Course[] = [...staticCourses]
export const lessons: Lesson[] = [...staticLessons]
export const dailyArticles: DailyArticle[] = [...staticDaily]
export const allConcepts = staticLessons.flatMap((l) => l.concepts)

export function applyCatalog(next: { courses: Course[]; lessons: Lesson[] }) {
    courses.splice(0, courses.length, ...next.courses)
    lessons.splice(0, lessons.length, ...next.lessons)
    const live = new Set(next.lessons.flatMap((l) => l.concepts.map((c) => c.id)))
    allConcepts.splice(0, allConcepts.length, ...next.lessons.flatMap((l) => l.concepts))
    dailyArticles.splice(0, dailyArticles.length, ...staticDaily.filter((a) => a.conceptIds.every((id) => live.has(id))))
}

export const getCourse = (id: string) => courses.find((c) => c.id === id)
export const getLesson = (id: string) => lessons.find((l) => l.id === id)
export const getLessonsOfCourse = (courseId: string) => lessons.filter((l) => l.courseId === courseId)

export const getConcept = (id: string) => allConcepts.find((c) => c.id === id)
export const getConceptLesson = (conceptId: string) => lessons.find((l) => l.concepts.some((c) => c.id === conceptId))

export type * from './types'
