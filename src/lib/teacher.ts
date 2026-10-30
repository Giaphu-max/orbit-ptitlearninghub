import { useEffect, useMemo, useState } from 'react'
import { staticCourses, staticLessons } from '@/data'
import { TEACHER_CLASSES, type TeacherClass } from '@/data/classes'
import type { ClassStats, Course, Lesson, LessonQuizQuestion, QuizChoiceQuestion } from '@/data/types'
import { getAllStats, getClassStats } from '@/lib/class-stats'
import { lessonItemKeys, useOrbitStore, type LessonEdits } from '@/store/useOrbitStore'

// Số liệu và việc cần làm cho vai giảng viên, tính từ dữ liệu bài + store (không gọi AI lúc xem).

export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

/** Ngưỡng tô đỏ % lớp sai lần đầu. */
export const HOT_RATE = 40

export type LessonState = 'generating' | 'wait' | 'editing' | 'published'

export interface LessonReview {
    lesson: Lesson
    course?: Course
    /** Thứ tự bài trong khóa, từ 0 */
    index: number
    published: boolean
    keys: string[]
    reviewed: Set<string>
    done: number
    total: number
    state: LessonState
    /** Đang giả lập AI tạo nội dung: 0..1 và bước hiện tại */
    progress?: number
    step?: string
    imported?: boolean
}

export const itemKey = {
    summary: 'sum',
    concept: (id: string) => `c:${id}`,
    question: (id: string) => `q:${id}`,
}

/** Các bước giả lập AI tạo nội dung, theo tiến độ. */
const GEN_STEPS = ['Đọc phụ đề', 'Transcript có mốc thời gian', 'Khái niệm', 'Câu hỏi và câu biến thể']
export const genStep = (p: number) => GEN_STEPS[Math.min(GEN_STEPS.length - 1, Math.floor(p * GEN_STEPS.length))]

/** Bài sau khi áp chỉnh sửa, kèm trạng thái duyệt từng mục. Bài đã xuất bản mà chưa có bản ghi duyệt coi như duyệt hết. */
export function useLessonReviews(): LessonReview[] {
    const edits = useOrbitStore((s) => s.lessonEdits)
    const review = useOrbitStore((s) => s.lessonReview)
    const items = useOrbitStore((s) => s.reviewedItems)
    const imported = useOrbitStore((s) => s.importedLessons)
    const importedCourses = useOrbitStore((s) => s.importedCourses)
    const jobs = useOrbitStore((s) => s.importJobs)

    // Còn bài đang giả lập thì tick để tiến độ chạy; xong hết thì dừng
    const [now, setNow] = useState(() => Date.now())
    const running = Object.values(jobs).some((j) => now < j.startedAt + j.durationMs)
    useEffect(() => {
        if (!running) return
        const t = window.setInterval(() => setNow(Date.now()), 300)
        return () => window.clearInterval(t)
    }, [running])

    return useMemo(() => {
        const seen: Record<string, number> = {}
        return [...staticLessons, ...imported].map((base) => {
            const isImported = base.id.startsWith('imp-')
            const lesson = edits[base.id] ? { ...base, ...edits[base.id] } : base
            const published = (review[base.id] ?? base.status) === 'published'
            const keys = lessonItemKeys(lesson)
            const entry = items[base.id]
            const reviewed = new Set(entry ? entry.filter((k) => keys.includes(k)) : published ? keys : [])
            const done = reviewed.size
            const index = (seen[base.courseId] = (seen[base.courseId] ?? -1) + 1)
            const job = jobs[base.id]
            const progress = job ? Math.min(1, (now - job.startedAt) / job.durationMs) : 1
            const generating = isImported && progress < 1
            const state: LessonState = generating ? 'generating' : published ? 'published' : done > 0 ? 'editing' : 'wait'
            const course = [...staticCourses, ...importedCourses].find((c) => c.id === base.courseId)
            return { lesson, course, index, published, keys, reviewed, done, total: keys.length, state, progress: generating ? progress : undefined, step: generating ? genStep(progress) : undefined, imported: isImported }
        })
    }, [edits, review, items, imported, importedCourses, jobs, now])
}

/** Số liệu gộp toàn bộ sinh viên đã học, không theo lớp (Tổng quan). */
export function useAllStats(): ClassStats {
    return useMemo(() => getAllStats(), [])
}

/** Kho khóa học của giảng viên: khóa có sẵn và khóa tạo từ danh sách phát YouTube, kèm trạng thái mở cho sinh viên. */
export function useTeacherCourses(): (Course & { open: boolean })[] {
    const importedCourses = useOrbitStore((s) => s.importedCourses)
    const open = useOrbitStore((s) => s.courseOpen)
    return useMemo(() => [...staticCourses, ...importedCourses].map((c) => ({ ...c, open: open[c.id] !== false })), [importedCourses, open])
}

/** Số sinh viên đang học một khóa (tổng sĩ số các lớp mẫu học khóa đó). */
export const studentsOfCourse = (courseId: string) => TEACHER_CLASSES.filter((c) => c.courseIds.includes(courseId)).reduce((n, c) => n + c.size, 0)

/** Số liệu cho một khóa học: lớp đang chọn nếu có khóa đó, không thì lớp đầu tiên có khóa đó. */
export function statsForCourse(courseId: string, selected: TeacherClass): ClassStats {
    const cls = selected.courseIds.includes(courseId) ? selected : (TEACHER_CLASSES.find((c) => c.courseIds.includes(courseId)) ?? selected)
    return getClassStats(cls.id)
}

/** Bài mở mặc định ở Duyệt nội dung: đang duyệt dở, rồi bài chờ duyệt, rồi bài đầu tiên. */
export function defaultReviewId(reviews: LessonReview[]): string | undefined {
    return (reviews.find((r) => r.state === 'editing') ?? reviews.find((r) => r.state === 'wait') ?? reviews[0])?.lesson.id
}

/** % lớp sai ngay lần đầu của một khái niệm (null nếu chưa có dữ liệu). */
export function conceptRate(stats: ClassStats, conceptId: string): number | null {
    const s = stats.concepts[conceptId]
    return s && s.answered > 0 ? pct(s.wrongFirstTry, s.answered) : null
}

/** Số lượt chọn từng đáp án của một câu gốc (null nếu chưa có dữ liệu). */
export function questionPicks(stats: ClassStats, questionId: string): number[] | null {
    const picks = stats.questions[questionId]?.picks
    return picks && picks.reduce((a, b) => a + b, 0) > 0 ? picks : null
}

/** Đáp án sai được chọn nhiều nhất của một câu, theo % lớp. */
export function topTrap(stats: ClassStats, q: QuizChoiceQuestion & { id: string }): { index: number; share: number } | null {
    const picks = questionPicks(stats, q.id)
    if (!picks) return null
    const total = picks.reduce((a, b) => a + b, 0)
    let best: { index: number; share: number } | null = null
    picks.forEach((n, i) => {
        if (i === q.correctIndex) return
        const share = pct(n, total)
        if (!best || share > best.share) best = { index: i, share }
    })
    return best
}

/** Ngưỡng "Cần sửa ngay": từ mức này trở lên số sinh viên sai ngay lần đầu thì câu hỏi cần được xem lại. */
export const URGENT_SHARE = 0.4

export interface Urgent {
    review: LessonReview
    question: LessonQuizQuestion
    wrong: number
    total: number
    share: number
    /** Đáp án sai được chọn nhiều nhất */
    trap: { text: string; count: number } | null
}

/** Câu hỏi đã xuất bản (và thầy cô chưa duyệt lại) có tỉ lệ sinh viên sai lần đầu cao nhất, từ 40% trở lên; không có thì null. */
export function findUrgent(reviews: LessonReview[], stats: ClassStats): Urgent | null {
    let best: Urgent | null = null
    for (const r of reviews) {
        if (r.state !== 'published') continue
        for (const q of r.lesson.quiz) {
            if (r.reviewed.has(itemKey.question(q.id))) continue
            const picks = questionPicks(stats, q.id)
            if (!picks) continue
            const total = picks.reduce((a, b) => a + b, 0)
            const wrong = total - (picks[q.correctIndex] ?? 0)
            const share = wrong / total
            if (share < URGENT_SHARE || (best && share <= best.share)) continue
            const trap = topTrap(stats, q)
            best = { review: r, question: q, wrong, total, share, trap: trap ? { text: q.options[trap.index], count: picks[trap.index] } : null }
        }
    }
    return best
}

export const courseTest = (stats: ClassStats, courseId: string) => stats.tests[courseId]

export function lessonsOriginal(id: string) {
    return staticLessons.find((l) => l.id === id)
}

export function validate(d: LessonEdits): string[] {
    const errors: string[] = []
    if (!d.summary.trim()) errors.push('Tóm tắt không được để trống.')
    for (const c of d.concepts) {
        if (!c.name.trim() || !c.definition.trim()) errors.push(`Khái niệm "${c.name || c.id}" thiếu tên hoặc định nghĩa.`)
    }
    const checkQ = (q: QuizChoiceQuestion) => {
        if (!q.prompt.trim()) errors.push(`Câu hỏi ${q.id} đang trống.`)
        else if (q.options.some((o) => !o.trim())) errors.push(`Câu hỏi "${q.prompt}" có đáp án để trống.`)
        else if (new Set(q.options.map((o) => o.trim())).size !== q.options.length) errors.push(`Câu hỏi "${q.prompt}" có hai đáp án giống nhau.`)
    }
    for (const q of d.quiz) {
        checkQ(q)
        q.variants.forEach(checkQ)
    }
    return errors
}
