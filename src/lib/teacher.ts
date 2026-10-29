import { useMemo } from 'react'
import { classStats, courses, getCourse, lessons } from '@/data'
import type { Concept, Course, Lesson, LessonQuizQuestion, QuizChoiceQuestion } from '@/data/types'
import { WHY_WRONG } from '@/data/teacher-notes'
import { lessonItemKeys, useOrbitStore, type LessonEdits } from '@/store/useOrbitStore'

// Số liệu và việc cần làm cho vai giảng viên, tính từ dữ liệu bài + store (không gọi AI lúc xem).

export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

/** Ước tính thời gian duyệt một mục (phút). */
const MIN_PER_ITEM = 2
/** Ngưỡng: đáp án nhiễu bị chọn từ mức này trở lên thì coi là câu gây nhầm. */
export const TRAP_SHARE = 25
/** Ngưỡng tô đỏ % lớp sai lần đầu. */
export const HOT_RATE = 40

export type LessonState = 'wait' | 'editing' | 'published'

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
}

export const itemKey = {
    summary: 'sum',
    concept: (id: string) => `c:${id}`,
    question: (id: string) => `q:${id}`,
}

/** Bài sau khi áp chỉnh sửa, kèm trạng thái duyệt từng mục. Bài đã xuất bản mà chưa có bản ghi duyệt coi như duyệt hết. */
export function useLessonReviews(): LessonReview[] {
    const edits = useOrbitStore((s) => s.lessonEdits)
    const review = useOrbitStore((s) => s.lessonReview)
    const items = useOrbitStore((s) => s.reviewedItems)
    return useMemo(() => {
        const seen: Record<string, number> = {}
        return lessons.map((base) => {
            const lesson = edits[base.id] ? { ...base, ...edits[base.id] } : base
            const published = (review[base.id] ?? base.status) === 'published'
            const keys = lessonItemKeys(lesson)
            const entry = items[base.id]
            const reviewed = new Set(entry ? entry.filter((k) => keys.includes(k)) : published ? keys : [])
            const done = reviewed.size
            const index = (seen[base.courseId] = (seen[base.courseId] ?? -1) + 1)
            const state: LessonState = published ? 'published' : done > 0 ? 'editing' : 'wait'
            return { lesson, course: getCourse(base.courseId), index, published, keys, reviewed, done, total: keys.length, state }
        })
    }, [edits, review, items])
}

/** Bài mở mặc định ở Duyệt nội dung: đang duyệt dở, rồi bài chờ duyệt, rồi bài đầu tiên. */
export function defaultReviewId(reviews: LessonReview[]): string | undefined {
    return (reviews.find((r) => r.state === 'editing') ?? reviews.find((r) => r.state === 'wait') ?? reviews[0])?.lesson.id
}

/** % lớp sai ngay lần đầu của một khái niệm (null nếu chưa có dữ liệu). */
export function conceptRate(conceptId: string): number | null {
    const s = classStats.concepts[conceptId]
    return s && s.answered > 0 ? pct(s.wrongFirstTry, s.answered) : null
}

/** Số lượt chọn từng đáp án của một câu gốc (null nếu chưa có dữ liệu). */
export function questionPicks(questionId: string): number[] | null {
    const picks = classStats.questions[questionId]?.picks
    return picks && picks.reduce((a, b) => a + b, 0) > 0 ? picks : null
}

/** Đáp án sai được chọn nhiều nhất của một câu, theo % lớp. */
export function topTrap(q: QuizChoiceQuestion & { id: string }): { index: number; share: number } | null {
    const picks = questionPicks(q.id)
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

export type TeacherTask =
    | { kind: 'resume'; review: LessonReview; left: number; minutes: number }
    | { kind: 'new'; review: LessonReview; minutes: number }
    | { kind: 'fix'; review: LessonReview; question: LessonQuizQuestion; share: number; minutes: number }

/** Tối đa 3 việc, theo ưu tiên: duyệt tiếp bài dở, duyệt bài mới, sửa câu gây nhầm. */
export function buildTasks(reviews: LessonReview[]): TeacherTask[] {
    const tasks: TeacherTask[] = []
    const resume = reviews.find((r) => r.state === 'editing')
    if (resume) tasks.push({ kind: 'resume', review: resume, left: resume.total - resume.done, minutes: (resume.total - resume.done) * MIN_PER_ITEM })
    const fresh = reviews.find((r) => r.state === 'wait')
    if (fresh) tasks.push({ kind: 'new', review: fresh, minutes: fresh.total * MIN_PER_ITEM })
    let fix: Extract<TeacherTask, { kind: 'fix' }> | null = null
    for (const r of reviews) {
        for (const q of r.lesson.quiz) {
            if (r.reviewed.has(itemKey.question(q.id))) continue
            const trap = topTrap(q)
            if (trap && trap.share >= TRAP_SHARE && (!fix || trap.share > fix.share)) fix = { kind: 'fix', review: r, question: q, share: trap.share, minutes: 3 }
        }
    }
    if (fix) tasks.push(fix)
    return tasks.slice(0, 3)
}

export interface Attention {
    concept: Concept
    review: LessonReview
    question?: LessonQuizQuestion
    rate: number
    wrong: number
    answered: number
    why?: string
}

/** Khái niệm lớp sai nhiều nhất lần đầu (trong các bài `pool`), kèm câu hỏi tương ứng. */
export function buildAttention(pool: LessonReview[]): Attention | null {
    let best: Attention | null = null
    for (const r of pool) {
        for (const c of r.lesson.concepts) {
            const s = classStats.concepts[c.id]
            if (!s || s.answered === 0) continue
            const rate = pct(s.wrongFirstTry, s.answered)
            if (!best || rate > best.rate) {
                const question = r.lesson.quiz.find((q) => q.conceptId === c.id)
                best = { concept: c, review: r, question, rate, wrong: s.wrongFirstTry, answered: s.answered, why: WHY_WRONG[c.id] }
            }
        }
    }
    return best
}

/** Các khái niệm khác lớp cũng đang sai nhiều (≥ HOT_RATE), trừ khái niệm đang nêu. */
export function otherWatch(pool: LessonReview[], exceptId: string) {
    return pool
        .flatMap((r) => r.lesson.concepts.map((c) => ({ id: c.id, name: c.name, rate: conceptRate(c.id) })))
        .filter((c): c is { id: string; name: string; rate: number } => c.id !== exceptId && c.rate !== null && c.rate >= HOT_RATE)
        .sort((a, b) => b.rate - a.rate)
}

export const courseTest = (courseId: string) => classStats.tests[courseId]

export const allCourses = courses

export function lessonsOriginal(id: string) {
    return lessons.find((l) => l.id === id)
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
