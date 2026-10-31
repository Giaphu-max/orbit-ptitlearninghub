import { useMemo } from 'react'
import { courses, lessons } from '@/data'
import { useCatalog } from '@/store/useCatalog'
import type { Lesson, ReviewStatus } from '@/data/types'

// Phía sinh viên: mọi bài đều đã xuất bản, không còn bước duyệt của giảng viên. Các hook gọn này đọc thẳng từ src/data.

// Các hook đăng ký theo store danh mục để dựng lại khi giảng viên đổi khóa/bài (mảng courses/lessons được sửa tại chỗ).
export function useEffectiveLesson(lessonId: string | undefined): Lesson | undefined {
    const v = useCatalog()
    return useMemo(() => lessons.find((l) => l.id === lessonId), [lessonId, v])
}

export const useReviewStatus = (_lesson: Lesson | undefined): ReviewStatus => 'published'

export function useCourseLessons(courseId: string | undefined): Lesson[] {
    const v = useCatalog()
    return useMemo(() => lessons.filter((l) => l.courseId === courseId), [courseId, v])
}

/** Bài của từng khóa (id khóa → danh sách bài theo thứ tự trong khóa) */
export function useAllCourseLessons(): Record<string, Lesson[]> {
    const v = useCatalog()
    return useMemo(() => Object.fromEntries(courses.map((c) => [c.id, lessons.filter((l) => l.courseId === c.id)])), [v])
}
