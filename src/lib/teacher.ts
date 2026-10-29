import { useEffect, useMemo, useState } from 'react'
import { staticCourses, staticLessons } from '@/data'
import { TEACHER_CLASSES, type TeacherClass } from '@/data/classes'
import type { ClassStats, Concept, Course, Lesson, LessonQuizQuestion, QuizChoiceQuestion } from '@/data/types'
import { getAllStats, getClassStats } from '@/lib/class-stats'
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

/** Các lớp mẫu và lớp đang chọn (chỉ dùng cho thống kê ở trang Lớp học). */
export function useTeacherClass() {
    const id = useOrbitStore((s) => s.teacherClassId)
    const cls = TEACHER_CLASSES.find((c) => c.id === id) ?? TEACHER_CLASSES[0]
    return useMemo(() => ({ classes: TEACHER_CLASSES, cls, courseIds: cls.courseIds, stats: getClassStats(cls.id) }), [cls])
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

export type TeacherTask =
    | { kind: 'resume'; review: LessonReview; left: number; minutes: number }
    | { kind: 'new'; review: LessonReview; minutes: number }
    | { kind: 'fix'; review: LessonReview; question: LessonQuizQuestion; share: number; minutes: number }

/** Tối đa 3 việc, theo ưu tiên: duyệt tiếp bài dở, duyệt bài mới, sửa câu gây nhầm. */
export function buildTasks(reviews: LessonReview[], stats: ClassStats): TeacherTask[] {
    const tasks: TeacherTask[] = []
    const resume = reviews.find((r) => r.state === 'editing')
    if (resume) tasks.push({ kind: 'resume', review: resume, left: resume.total - resume.done, minutes: (resume.total - resume.done) * MIN_PER_ITEM })
    const fresh = reviews.find((r) => r.state === 'wait')
    if (fresh) tasks.push({ kind: 'new', review: fresh, minutes: fresh.total * MIN_PER_ITEM })
    let fix: Extract<TeacherTask, { kind: 'fix' }> | null = null
    // Bài chưa xuất bản đã nằm trong việc duyệt, nên chỉ xét câu của bài đã xuất bản
    for (const r of reviews.filter((x) => x.state === 'published')) {
        for (const q of r.lesson.quiz) {
            if (r.reviewed.has(itemKey.question(q.id))) continue
            const trap = topTrap(stats, q)
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
export function buildAttention(pool: LessonReview[], stats: ClassStats): Attention | null {
    let best: Attention | null = null
    for (const r of pool) {
        for (const c of r.lesson.concepts) {
            const s = stats.concepts[c.id]
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
