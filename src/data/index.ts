import type { Badge, Course, DailyArticle, Lesson } from './types'
import coursesJson from './courses.json'
import lessonsJson from './lessons.json'
import dailyJson from './daily.json'
import badgesJson from './badges.json'

// JSON được TS suy ra kiểu rộng (string thay cho union), nên ép về kiểu chuẩn ở đây.
// scripts/generate-content.ts chịu trách nhiệm ghi ra đúng cấu trúc.
/** Nội dung học có sẵn: mọi khóa và bài đều đã xuất bản, sinh viên thấy tất cả (giảng viên chỉ quản lý kho tài liệu của trợ giảng AI). */
export const courses = coursesJson as Course[]
export const lessons = lessonsJson as Lesson[]
export const staticCourses = courses
export const staticLessons = lessons
export const dailyArticles = dailyJson as DailyArticle[]
export const badges = badgesJson as Badge[]
export const allConcepts = lessons.flatMap((l) => l.concepts)

export const getCourse = (id: string) => courses.find((c) => c.id === id)
export const getLesson = (id: string) => lessons.find((l) => l.id === id)
export const getLessonsOfCourse = (courseId: string) => lessons.filter((l) => l.courseId === courseId)

export const getConcept = (id: string) => allConcepts.find((c) => c.id === id)
export const getConceptLesson = (conceptId: string) => lessons.find((l) => l.concepts.some((c) => c.id === conceptId))

export type * from './types'
