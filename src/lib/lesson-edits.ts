import { useMemo } from 'react'
import { getLesson } from '@/data'
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
