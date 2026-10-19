import type { Badge, ClassStats, Course, DailyArticle, Lesson } from './types'
import coursesJson from './courses.json'
import lessonsJson from './lessons.json'
import dailyJson from './daily.json'
import badgesJson from './badges.json'
import classStatsJson from './class-stats.json'

// JSON được TS suy ra kiểu rộng (string thay cho union), nên ép về kiểu chuẩn ở đây.
// scripts/generate-content.ts chịu trách nhiệm ghi ra đúng cấu trúc.
export const courses = coursesJson as Course[]
export const lessons = lessonsJson as Lesson[]
export const dailyArticles = dailyJson as DailyArticle[]
export const badges = badgesJson as Badge[]
export const classStats = classStatsJson as ClassStats

export const getCourse = (id: string) => courses.find((c) => c.id === id)
export const getLesson = (id: string) => lessons.find((l) => l.id === id)
export const getLessonsOfCourse = (courseId: string) => lessons.filter((l) => l.courseId === courseId)

export const allConcepts = lessons.flatMap((l) => l.concepts)
export const getConcept = (id: string) => allConcepts.find((c) => c.id === id)

export type * from './types'
