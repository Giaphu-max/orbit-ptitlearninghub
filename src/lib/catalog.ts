import { useMemo } from 'react'
import { courses, lessons } from '@/data'
import type { Lesson, ReviewStatus } from '@/data/types'

// Phía sinh viên: mọi bài đều đã xuất bản, không còn bước duyệt của giảng viên. Các hook gọn này đọc thẳng từ src/data.

export function useEffectiveLesson(lessonId: string | undefined): Lesson | undefined {
    return useMemo(() => lessons.find((l) => l.id === lessonId), [lessonId])
}

export const useReviewStatus = (_lesson: Lesson | undefined): ReviewStatus => 'published'

export function useCourseLessons(courseId: string | undefined): Lesson[] {
    return useMemo(() => lessons.filter((l) => l.courseId === courseId), [courseId])
}

/** Bài của từng khóa (id khóa → danh sách bài theo thứ tự trong khóa) */
export function useAllCourseLessons(): Record<string, Lesson[]> {
    return useMemo(() => Object.fromEntries(courses.map((c) => [c.id, lessons.filter((l) => l.courseId === c.id)])), [])
}
