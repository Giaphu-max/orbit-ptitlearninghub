import { useMemo } from 'react'
import { useLessonReviews, type LessonReview } from '@/lib/teacher'
import { usePendingTests, type PendingTest } from '@/lib/test-sets'

export type PendingTask = { kind: 'lesson'; review: LessonReview } | { kind: 'test'; test: PendingTest }

/**
 * Việc chờ duyệt của giảng viên, đã sắp xếp: bài đang duyệt dở → bài AI vừa tạo xong → test cuối chương bản nháp (bỏ bài AI đang tạo).
 * Nguồn duy nhất cho Tổng quan, badge "Bài giảng" ở thanh bên và chuông, nên ba con số luôn bằng nhau và cập nhật cùng lúc khi duyệt/xuất bản.
 */
export function usePendingReviewTasks(): PendingTask[] {
    const reviews = useLessonReviews()
    const tests = usePendingTests()
    return useMemo(
        () => [
            ...reviews.filter((r) => r.state === 'editing').map((review): PendingTask => ({ kind: 'lesson', review })),
            ...reviews.filter((r) => r.state === 'wait').map((review): PendingTask => ({ kind: 'lesson', review })),
            ...tests.map((test): PendingTask => ({ kind: 'test', test })),
        ],
        [reviews, tests],
    )
}
