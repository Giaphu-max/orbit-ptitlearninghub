import type { Lesson } from '@/data/types'
import type { LessonProgress } from '@/store/useOrbitStore'

export type LessonState = 'done' | 'doing' | 'todo'

/** Phần trăm đã học của một bài: xong = 100, đang dở theo vị trí video, chưa học = 0. */
export function lessonPercent(lesson: Lesson, progress: Record<string, LessonProgress>) {
    const p = progress[lesson.id]
    if (!p) return 0
    if (p.completed) return 100
    return Math.min(99, Math.round((p.lastPositionSec / Math.max(1, lesson.durationSec)) * 100))
}

export function lessonState(lesson: Lesson, progress: Record<string, LessonProgress>): LessonState {
    const p = progress[lesson.id]
    if (p?.completed) return 'done'
    return p && p.lastPositionSec > 0 ? 'doing' : 'todo'
}

/** Tiến độ cả khóa = trung bình tiến độ các bài. */
export function coursePercent(lessons: Lesson[], progress: Record<string, LessonProgress>) {
    if (!lessons.length) return 0
    return Math.round(lessons.reduce((sum, l) => sum + lessonPercent(l, progress), 0) / lessons.length)
}

/** Bài nên vào tiếp theo: bài đang dở, rồi bài chưa xong đầu tiên, cuối cùng bài đầu. */
export function nextLesson(lessons: Lesson[], progress: Record<string, LessonProgress>) {
    return lessons.find((l) => lessonState(l, progress) === 'doing') ?? lessons.find((l) => lessonState(l, progress) !== 'done') ?? lessons[0]
}

export const formatDuration = (sec: number) => `${Math.max(1, Math.round(sec / 60))} phút`
