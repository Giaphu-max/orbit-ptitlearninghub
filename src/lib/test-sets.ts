import { useMemo } from 'react'
import { resolveLessons, staticCourses, type OverlayInput } from '@/data'
import type { Lesson } from '@/data/types'
import { getAllStats } from '@/lib/class-stats'
import { buildQuestionBank, type BankQuestion, type TestQuestion } from '@/lib/final-test'
import { useTeacherCourses } from '@/lib/teacher'
import { useOrbitStore } from '@/store/useOrbitStore'

// Đề kiểm tra do giảng viên soạn và duyệt: Kiểm tra nhanh cuối bài (khóa `quick:<lessonId>`) và Test cuối chương (khóa `final:<courseId>`).
// Phía sinh viên đọc đúng đề và luật ở đây thay cho việc bốc ngẫu nhiên. Chưa chỉnh gì thì dùng đề AI soạn sẵn (chọn đều theo khái niệm, cố định).

export interface TestRules {
    count: number
    secondsPerQuestion: number
    /** Tỉ lệ đúng để đạt (0–1) */
    passRatio: number
    /** Khi nào sinh viên được làm: xong cả khóa / xong còn 1 bài / mở ngay (chỉ test cuối chương) */
    opens: 'all' | 'almost' | 'now'
    /** Số lần làm tối đa; null = không giới hạn */
    attempts: number | null
    shuffleQuestions: boolean
    shuffleOptions: boolean
    explainWrong: boolean
}

export const QUICK_RULES: TestRules = { count: 6, secondsPerQuestion: 60, passRatio: 5 / 6, opens: 'now', attempts: null, shuffleQuestions: true, shuffleOptions: true, explainWrong: true }
export const FINAL_RULES: TestRules = { count: 10, secondsPerQuestion: 60, passRatio: 0.8, opens: 'all', attempts: null, shuffleQuestions: true, shuffleOptions: true, explainWrong: true }

export type QuestionSource = 'video' | 'variant' | 'daily' | 'teacher' | 'ai'
export const SOURCE_LABEL: Record<QuestionSource, string> = { video: 'Câu trong video', variant: 'Câu biến thể', daily: 'Câu bài đọc', teacher: 'Thầy cô viết', ai: 'AI gợi ý' }

/** Câu trong kho kèm nguồn gốc. */
export interface SourcedQuestion extends BankQuestion {
    source: QuestionSource
}

export interface TestSet {
    /** Thứ tự các câu trong đề (id câu trong kho hoặc câu thầy cô tự viết) */
    ids: string[]
    /** Câu thầy cô tự viết */
    custom: SourcedQuestion[]
    /** Câu lấy từ kho nhưng do AI gợi ý (hiện nguồn "AI gợi ý") */
    ai: string[]
    rules: TestRules
    /** Chỉ dùng cho test cuối chương: đã xuất bản chưa. Chưa đặt thì theo việc cả khóa đã xuất bản hay chưa */
    published?: boolean
}

/** Kho câu hỏi của các bài, kèm nguồn: câu gốc trong video, câu biến thể, câu kiểm tra của bài đọc. */
export function sourcedBank(lessons: Lesson[]): SourcedQuestion[] {
    const roots = new Set(lessons.flatMap((l) => l.quiz.map((q) => q.id)))
    const variants = new Set(lessons.flatMap((l) => l.quiz.flatMap((q) => q.variants.map((v) => v.id))))
    return buildQuestionBank(lessons).map((q) => ({ ...q, source: roots.has(q.id) ? 'video' : variants.has(q.id) ? 'variant' : 'daily' }))
}

const ORDER: Record<QuestionSource, number> = { video: 0, variant: 1, daily: 2, teacher: 3, ai: 4 }

/** Đề AI soạn sẵn: mỗi khái niệm một câu (ưu tiên câu trong video), rồi bù thêm câu biến thể; cố định, không ngẫu nhiên. */
export function defaultSet(bank: SourcedQuestion[], rules: TestRules): TestSet {
    const sorted = [...bank].sort((a, b) => ORDER[a.source] - ORDER[b.source])
    const chosen: SourcedQuestion[] = []
    const prompts = new Set<string>()
    const take = (q: SourcedQuestion | undefined) => {
        if (!q || chosen.length >= rules.count || prompts.has(q.prompt)) return
        chosen.push(q)
        prompts.add(q.prompt)
    }
    const concepts = [...new Set(sorted.map((q) => q.conceptId))]
    for (const c of concepts) take(sorted.find((q) => q.conceptId === c))
    for (const q of sorted) take(q)
    // Theo thứ tự khái niệm trong bài để đề đọc xuôi
    const rank = new Map(concepts.map((c, i) => [c, i]))
    chosen.sort((a, b) => (rank.get(a.conceptId) ?? 0) - (rank.get(b.conceptId) ?? 0))
    return { ids: chosen.map((q) => q.id), custom: [], ai: [], rules }
}

/** Các câu của đề theo thứ tự, kèm nguồn; bỏ qua id không còn trong kho. */
export function resolveSet(set: TestSet, bank: SourcedQuestion[]): SourcedQuestion[] {
    const byId = new Map<string, SourcedQuestion>([...bank, ...set.custom].map((q) => [q.id, q]))
    return set.ids.flatMap((id) => {
        const q = byId.get(id)
        return q ? [set.ai.includes(id) ? { ...q, source: 'ai' as const } : q] : []
    })
}

/** % sinh viên trả lời đúng một câu (null nếu chưa có dữ liệu). Chỉ câu gốc trong video có số lượt chọn đáp án. */
export function correctRate(q: { id: string; correctIndex: number }): number | null {
    const picks = getAllStats().questions[q.id]?.picks
    const total = picks?.reduce((a, b) => a + b, 0) ?? 0
    return picks && total > 0 ? Math.round(((picks[q.correctIndex] ?? 0) / total) * 100) : null
}

/** Đề Kiểm tra nhanh của một bài: đã lưu thì dùng, chưa thì đề AI soạn sẵn. */
export function quickSetFor(lesson: Lesson, stored?: TestSet): TestSet {
    return stored ?? defaultSet(sourcedBank([lesson]), QUICK_RULES)
}

/** Đề Test cuối chương của một khóa. */
export function finalSetFor(lessons: Lesson[], stored?: TestSet): TestSet {
    return stored ?? defaultSet(sourcedBank(lessons), FINAL_RULES)
}

/** Số câu đạt tối thiểu để vượt ngưỡng. */
export const passCount = (rules: TestRules, n: number) => Math.min(n, Math.max(1, Math.ceil(rules.passRatio * n - 1e-9)))

export const quickKey = (lessonId: string) => `quick:${lessonId}`
export const finalKey = (courseId: string) => `final:${courseId}`

/** Mọi bài (có sẵn + nhập từ YouTube) của một khóa, đã áp chỉnh sửa của giảng viên, kể cả bài chưa xuất bản. */
export function useCourseAllLessons(courseId: string | undefined): Lesson[] {
    const imported = useOrbitStore((s) => s.importedLessons)
    const overrides = useOrbitStore((s) => s.lessonOverrides)
    const order = useOrbitStore((s) => s.lessonOrder)
    const deleted = useOrbitStore((s) => s.deletedLessons)
    const deletedCourses = useOrbitStore((s) => s.deletedCourses)
    const edits = useOrbitStore((s) => s.lessonEdits)
    return useMemo(
        () =>
            resolveLessons({ importedCourses: [], importedLessons: imported, lessonOverrides: overrides, lessonOrder: order, deletedLessons: deleted, deletedCourses })
                .filter((l) => l.courseId === courseId)
                .map((l) => (edits[l.id] ? { ...l, ...edits[l.id] } : l)),
        [imported, overrides, order, deleted, deletedCourses, edits, courseId],
    )
}

/** Khóa đã xuất bản hết bài chưa (mặc định cho trạng thái đề cuối chương khi giảng viên chưa đụng tới). */
export function courseFullyPublished(courseId: string, s: OverlayInput & { lessonReview: Record<string, 'draft' | 'published'> }): boolean {
    const list = resolveLessons(s).filter((l) => l.courseId === courseId)
    return list.length > 0 && list.every((l) => (s.lessonReview[l.id] ?? l.status) === 'published')
}

export const courseExists = (id: string, imported: { id: string }[]) => staticCourses.some((c) => c.id === id) || imported.some((c) => c.id === id)

const shuffled = <T,>(items: T[]): T[] => {
    const a = [...items]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/** Câu của một lượt làm bài: trộn thứ tự câu / đáp án nếu luật bật, trên đúng đề đã duyệt (không bốc thêm câu khác). */
export function prepareQuestions(questions: SourcedQuestion[], rules: TestRules): TestQuestion[] {
    const ordered = rules.shuffleQuestions ? shuffled(questions) : questions
    return ordered.map((q) => {
        if (!rules.shuffleOptions) return { ...q }
        const order = shuffled(q.options.map((_, i) => i))
        return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) }
    })
}

/** Đề Kiểm tra nhanh đã được thầy cô duyệt (mục 'qt') thì sinh viên mới làm được. Bài xuất bản từ trước chưa có bản ghi duyệt coi như đã duyệt. */
export const quickApproved = (reviewed: string[] | undefined) => (reviewed ? reviewed.includes('qt') : true)

// ─── Chỉnh đề (hàm thuần, trả về đề mới) ───────────────────────────────────

export const removeFromSet = (set: TestSet, id: string): TestSet => ({ ...set, ids: set.ids.filter((x) => x !== id), ai: set.ai.filter((x) => x !== id), custom: set.custom.filter((q) => q.id !== id || false) })

export const addToSet = (set: TestSet, id: string): TestSet => (set.ids.includes(id) ? set : { ...set, ids: [...set.ids, id] })

export function moveInSet(set: TestSet, from: number, to: number): TestSet {
    if (from === to || from < 0 || to < 0 || from >= set.ids.length || to >= set.ids.length) return set
    const ids = [...set.ids]
    const [x] = ids.splice(from, 1)
    ids.splice(to, 0, x)
    return { ...set, ids }
}

let seq = 0
export const newCustomId = () => `tq-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** Lưu câu thầy cô viết/sửa. Câu lấy từ kho mà bị sửa thì thành bản riêng của đề (không đụng vào bài giảng gốc), giữ nguyên vị trí. */
export function upsertCustom(set: TestSet, q: SourcedQuestion, replacesId?: string): TestSet {
    const exists = set.custom.some((c) => c.id === q.id)
    const custom = exists ? set.custom.map((c) => (c.id === q.id ? q : c)) : [...set.custom, q]
    let ids = set.ids
    if (replacesId && replacesId !== q.id) ids = ids.map((x) => (x === replacesId ? q.id : x))
    else if (!ids.includes(q.id)) ids = [...ids, q.id]
    return { ...set, custom, ids, ai: set.ai.filter((x) => x !== replacesId) }
}

/** AI gợi ý (giả lập): thêm tối đa n câu có sẵn trong kho, ưu tiên khái niệm chưa có câu nào. Trả về đề mới và số câu đã thêm. */
export function suggestInto(set: TestSet, bank: SourcedQuestion[], conceptIds: string[], n: number): { set: TestSet; added: SourcedQuestion[] } {
    const inSet = new Set(set.ids)
    const covered = new Set(resolveSet(set, bank).map((q) => q.conceptId))
    const pool = bank.filter((q) => !inSet.has(q.id))
    const picked: SourcedQuestion[] = []
    for (const c of conceptIds.filter((c) => !covered.has(c))) {
        const q = pool.find((x) => x.conceptId === c && !picked.includes(x))
        if (q && picked.length < n) picked.push(q)
    }
    for (const q of pool) if (picked.length < n && !picked.includes(q) && !picked.some((p) => p.prompt === q.prompt)) picked.push(q)
    return { set: { ...set, ids: [...set.ids, ...picked.map((q) => q.id)], ai: [...set.ai, ...picked.map((q) => q.id)] }, added: picked }
}

/** Số câu theo khái niệm trong đề. */
export function coverage(questions: SourcedQuestion[]): Map<string, number> {
    const m = new Map<string, number>()
    for (const q of questions) m.set(q.conceptId, (m.get(q.conceptId) ?? 0) + 1)
    return m
}

export interface PendingTest {
    courseId: string
    courseTitle: string
    /** Số câu trong đề nháp */
    count: number
    /** Số khái niệm chưa có câu nào */
    missing: number
}

/** Test cuối chương của các khóa còn ở bản nháp (chưa xuất bản). */
export function usePendingTests(): PendingTest[] {
    const courses = useTeacherCourses()
    const imported = useOrbitStore((s) => s.importedLessons)
    const importedCourses = useOrbitStore((s) => s.importedCourses)
    const overrides = useOrbitStore((s) => s.lessonOverrides)
    const order = useOrbitStore((s) => s.lessonOrder)
    const deleted = useOrbitStore((s) => s.deletedLessons)
    const deletedCourses = useOrbitStore((s) => s.deletedCourses)
    const titles = useOrbitStore((s) => s.courseTitles)
    const edits = useOrbitStore((s) => s.lessonEdits)
    const review = useOrbitStore((s) => s.lessonReview)
    const sets = useOrbitStore((s) => s.testSets)
    return useMemo(() => {
        const out: PendingTest[] = []
        const overlay = { importedCourses, importedLessons: imported, lessonOverrides: overrides, lessonOrder: order, deletedLessons: deleted, deletedCourses, courseTitles: titles }
        const all = resolveLessons(overlay)
        for (const c of courses) {
            const lessons = all.filter((l) => l.courseId === c.id).map((l) => (edits[l.id] ? { ...l, ...edits[l.id] } : l))
            // Chưa có bài nào xuất bản thì thẻ test cuối chương còn khóa, chưa có gì để duyệt
            if (!lessons.some((l) => (review[l.id] ?? l.status) === 'published')) continue
            const stored = sets[finalKey(c.id)]
            if (stored?.published ?? courseFullyPublished(c.id, { ...overlay, lessonReview: review })) continue
            const qs = resolveSet(finalSetFor(lessons, stored), sourcedBank(lessons))
            const cover = coverage(qs)
            out.push({ courseId: c.id, courseTitle: c.title, count: qs.length, missing: lessons.flatMap((l) => l.concepts).filter((k) => !cover.get(k.id)).length })
        }
        return out
    }, [courses, imported, importedCourses, overrides, order, deleted, deletedCourses, titles, edits, review, sets])
}
