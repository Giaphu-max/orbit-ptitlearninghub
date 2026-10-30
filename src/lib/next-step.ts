import { dailyArticles, courses, getCourse, getLessonsOfCourse, lessons } from '@/data'
import type { DailyArticle, Lesson } from '@/data/types'
import { DAILY_LIMIT, localDate } from '@/lib/gamification'
import { useOrbitStore } from '@/store/useOrbitStore'

// "Bước tiếp theo" cho mọi điểm kết thúc (màn thưởng, nhiệm vụ): luôn dẫn người dùng tới việc kế tiếp
// trong đúng ngữ cảnh, không đẩy về danh sách chung. Đọc trạng thái từ store, dùng được ngoài component.

export { DAILY_LIMIT, EXTRA_READ_COST } from '@/lib/gamification'

/** Số bài mua thêm hôm nay (sang ngày mới thì về 0). */
export const extraReadsToday = (unlocks: { date: string; count: number }) => (unlocks.date === localDate() ? unlocks.count : 0)

/** Bài ưu tiên = bài có khái niệm bạn còn yếu nhất (chưa làm quiz thì coi như 50%). */
export function gapScore(a: DailyArticle, mastery: Record<string, number>) {
    return a.conceptIds.reduce((sum, id) => sum + (1 - (mastery[id] ?? 0.5)), 0) / Math.max(1, a.conceptIds.length)
}

/**
 * Kho bài Daily theo thứ tự ưu tiên hôm nay: bài đã đọc hôm nay, bài chưa đọc (lỗ hổng lớn nhất trước),
 * rồi bài ôn lại đã đọc ở ngày trước (lỗ hổng lớn nhất trước, ngang nhau thì bài đọc cũ nhất trước) để kho nhỏ không bao giờ cạn.
 */
export function dailyPool(read: Record<string, string>, mastery: Record<string, number>): DailyArticle[] {
    const today = localDate()
    return [
        ...dailyArticles.filter((a) => read[a.id] === today),
        ...dailyArticles.filter((a) => !read[a.id]).sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery)),
        ...dailyArticles
            .filter((a) => read[a.id] && read[a.id] !== today)
            .sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery) || read[a.id].localeCompare(read[b.id])),
    ]
}

/** Bài mỗi ngày (3 miễn phí + bài mua thêm). */
export function todaysDaily(read: Record<string, string>, mastery: Record<string, number>, extra = 0): DailyArticle[] {
    return dailyPool(read, mastery).slice(0, DAILY_LIMIT + extra)
}

/** Bài Daily chưa đọc ưu tiên nhất trong lượt hôm nay (undefined khi đã đủ lượt hoặc hết bài). */
export function nextDaily(): DailyArticle | undefined {
    const { dailyRead, conceptMastery, dailyUnlocks } = useOrbitStore.getState()
    return todaysDaily(dailyRead, conceptMastery, extraReadsToday(dailyUnlocks))
        .filter((a) => dailyRead[a.id] !== localDate())
        .sort((a, b) => gapScore(b, conceptMastery) - gapScore(a, conceptMastery))[0]
}

/** Bài sinh viên thấy được: bài đã xuất bản (giảng viên thấy cả bản nháp). */
export function visibleLessons(): Lesson[] {
    const { role, lessonReview } = useOrbitStore.getState()
    return lessons.filter((l) => role === 'teacher' || (lessonReview[l.id] ?? l.status) === 'published')
}

/** Bài đang học dở; chưa có thì bài đầu tiên chưa xong. */
export function resumeLesson(): Lesson | undefined {
    const progress = useOrbitStore.getState().lessonProgress
    const visible = visibleLessons()
    return visible.find((l) => progress[l.id] && !progress[l.id].completed && progress[l.id].lastPositionSec > 0) ?? visible.find((l) => !progress[l.id]?.completed) ?? visible[0]
}

export interface NextStep {
    label: string
    to: string
}

/** Sau khi xong một bài: bài kế trong khóa; bài cuối khóa thì làm bài kiểm tra cuối khóa. */
export function afterLesson(lessonId: string): NextStep {
    const lesson = lessons.find((l) => l.id === lessonId)
    const course = lesson && getCourse(lesson.courseId)
    if (!lesson || !course) return { label: 'Về danh sách khóa học', to: '/learning' }
    const visible = new Set(visibleLessons().map((l) => l.id))
    const order = getLessonsOfCourse(course.id).filter((l) => visible.has(l.id))
    const next = order[order.findIndex((l) => l.id === lessonId) + 1]
    return next ? { label: 'Bài tiếp theo', to: `/lesson/${next.id}` } : { label: 'Làm bài kiểm tra cuối khóa', to: `/test/${course.id}` }
}

/** Khóa đang học (theo bài đang học dở), để dẫn tới đúng bài kiểm tra. */
export function activeCourseId(): string | undefined {
    return resumeLesson()?.courseId ?? courses[0]?.id
}

/** Nơi "Làm ngay" của từng nhiệm vụ hằng ngày. */
export function missionTarget(missionId: string): string {
    const lesson = resumeLesson()
    switch (missionId) {
        case 'daily': {
            const next = nextDaily()
            return next ? `/daily/${next.id}` : '/today'
        }
        case 'test':
            return `/test/${activeCourseId()}`
        default:
            return lesson ? `/lesson/${lesson.id}` : '/learning'
    }
}
