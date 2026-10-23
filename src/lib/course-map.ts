import { useMemo } from 'react'
import { courses } from '@/data'
import type { Course, Lesson } from '@/data/types'
import { lessonPercent, lessonState } from '@/lib/course-progress'
import { deriveCover, type CoverAccent } from '@/lib/cover-kinds'
import { useAllCourseLessons } from '@/lib/lesson-edits'
import { useOrbitStore, type TestRecord } from '@/store/useOrbitStore'

// Dữ liệu tổng hợp cho trang Khóa học dạng bản đồ chặng và mục Khóa học ở trang chủ.

export type CourseStatus = 'doing' | 'new' | 'done'
/** Mức nắm vững tính là "vững" */
export const STRONG_MASTERY = 0.8

export interface CourseSummary {
    course: Course
    lessons: Lesson[]
    status: CourseStatus
    /** Tiến độ cả khóa, 0–100 */
    pct: number
    /** Tiến độ từng bài, 0–100 */
    pcts: number[]
    /** Bài đang ở chặng hiện tại: bài đang dở hoặc bài chưa xong đầu tiên; -1 nếu đã xong cả khóa */
    curIndex: number
    /** Phần đỏ của đường nối, 0–1: (bài hiện tại + tiến độ bài) / số bài */
    fill: number
    minutes: number
    conceptCount: number
    strongCount: number
    doneCount: number
    record: TestRecord | undefined
}

export function summarize(course: Course, lessons: Lesson[], progress: ReturnType<typeof useOrbitStore.getState>['lessonProgress'], mastery: Record<string, number>, record: TestRecord | undefined): CourseSummary {
    const n = lessons.length
    const pcts = lessons.map((l) => lessonPercent(l, progress))
    const pct = n ? Math.round(pcts.reduce((a, b) => a + b, 0) / n) : 0
    const doing = lessons.findIndex((l) => lessonState(l, progress) === 'doing')
    const curIndex = doing >= 0 ? doing : lessons.findIndex((l) => lessonState(l, progress) !== 'done')
    const status: CourseStatus = n > 0 && curIndex < 0 ? 'done' : pct > 0 || doing >= 0 ? 'doing' : 'new'
    const fill = curIndex < 0 ? 1 : n ? (curIndex + pcts[curIndex] / 100) / n : 0
    const concepts = lessons.flatMap((l) => l.concepts)
    return {
        course,
        lessons,
        status,
        pct,
        pcts,
        curIndex,
        fill,
        minutes: Math.round(lessons.reduce((a, l) => a + l.durationSec, 0) / 60),
        conceptCount: concepts.length,
        strongCount: concepts.filter((c) => (mastery[c.id] ?? 0) >= STRONG_MASTERY).length,
        doneCount: lessons.filter((l) => lessonState(l, progress) === 'done').length,
        record,
    }
}

/** Mọi khóa còn bài để học (sinh viên không thấy khóa chưa có bài xuất bản). */
export function useCourseSummaries(): CourseSummary[] {
    const byCourse = useAllCourseLessons()
    const progress = useOrbitStore((s) => s.lessonProgress)
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const records = useOrbitStore((s) => s.testRecords)
    return useMemo(
        () => courses.filter((c) => byCourse[c.id]?.length).map((c) => summarize(c, byCourse[c.id], progress, mastery, records[c.id])),
        [byCourse, progress, mastery, records],
    )
}

/** Khóa nổi bật mặc định: khóa đang học, không có thì khóa chưa bắt đầu đầu tiên, rồi khóa đầu tiên. */
export const defaultCourse = (list: CourseSummary[]) => list.find((c) => c.status === 'doing') ?? list.find((c) => c.status === 'new') ?? list[0]

export const STATUS_ORDER: Record<CourseStatus, number> = { doing: 0, new: 1, done: 2 }

/** Nhãn thời lượng dạng m:ss */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`

export const thumbUrl = (youtubeId: string) => `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`

/** Biến CSS màu nhấn (token --subject-*) cho chip môn và đường chặng mini: theo accent của bìa khóa, thiếu thì suy từ môn. */
export function subjectVars(subject: string, accent?: CoverAccent): React.CSSProperties {
    const key = accent ?? deriveCover(subject).accent
    return { ['--subject' as string]: `var(--subject-${key})`, ['--subject-ink' as string]: `var(--subject-${key}-ink)` }
}

/** Nhãn "DỰNG PHIM · CHẶNG 1/3" của một khóa (dùng chung với cột chữ). */
export function courseKicker(summary: CourseSummary) {
    const { course, lessons: ls, status, curIndex } = summary
    const sub = status === 'doing' ? `Chặng ${curIndex + 1}/${ls.length}` : status === 'done' ? 'Đã xong' : `${ls.length} bài`
    return `${course.subject} · ${sub}`
}

/** Khóa đang học (không có thì khóa đầu theo STATUS_ORDER). */
export function primaryCourse(list: CourseSummary[]) {
    return list.find((c) => c.status === 'doing') ?? list[0]
}
