import { useMemo } from 'react'
import { getCourse, getLesson, getLessonsOfCourse } from '@/data'
import type { Lesson, ReviewStatus } from '@/data/types'
import { useOrbitStore } from '@/store/useOrbitStore'

/** Bài học sau khi áp bản chỉnh sửa của giảng viên (nếu có). */
export function useEffectiveLesson(lessonId: string | undefined): Lesson | undefined {
    const base = lessonId ? getLesson(lessonId) : undefined
    const edits = useOrbitStore((s) => (lessonId ? s.lessonEdits[lessonId] : undefined))
    return useMemo(() => (base && edits ? { ...base, ...edits } : base), [base, edits])
}

/** Trạng thái duyệt hiện tại: giảng viên đặt trong store, chưa đặt thì dùng mặc định trong JSON. */
export function useReviewStatus(lesson: Lesson | undefined): ReviewStatus {
    const override = useOrbitStore((s) => (lesson ? s.lessonReview[lesson.id] : undefined))
    return override ?? lesson?.status ?? 'draft'
}

/** Bài học của khóa sau khi áp chỉnh sửa của giảng viên, chỉ gồm bài đã xuất bản (giảng viên thấy cả bản nháp). */
export function useCourseLessons(courseId: string | undefined): Lesson[] {
    const edits = useOrbitStore((s) => s.lessonEdits)
    const review = useOrbitStore((s) => s.lessonReview)
    const role = useOrbitStore((s) => s.role)
    return useMemo(() => {
        if (!courseId || !getCourse(courseId)) return []
        return getLessonsOfCourse(courseId)
            .map((l) => (edits[l.id] ? { ...l, ...edits[l.id] } : l))
            .filter((l) => role === 'teacher' || (review[l.id] ?? getLesson(l.id)?.status) === 'published')
    }, [courseId, edits, review, role])
}
