import type { Lesson } from '@/data/types'
import { buildQuestionBank, type BankQuestion, type TestQuestion } from '@/lib/final-test'

// Đề kiểm tra tự sinh từ kho câu hỏi của bài: Kiểm tra nhanh (một bài) và Kiểm tra cuối khóa (cả khóa).
// Đề cố định (chọn đều theo khái niệm, ưu tiên câu trong video) cùng luật làm bài mặc định; giảng viên không soạn đề.

export interface TestRules {
    count: number
    secondsPerQuestion: number
    /** Tỉ lệ đúng để đạt (0–1) */
    passRatio: number
    /** Khi nào sinh viên được làm: xong cả khóa / xong còn 1 bài / mở ngay (chỉ kiểm tra cuối khóa) */
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
    /** Chỉ dùng cho kiểm tra cuối khóa: đã xuất bản chưa. Chưa đặt thì theo việc cả khóa đã xuất bản hay chưa */
    published?: boolean
    /** Id các bài đã xuất bản được tính khi soạn đề; bài xuất bản sau đó không tự vào đề mà hiện thông báo "Thêm vào đề" */
    basis?: string[]
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

/** Đề Kiểm tra nhanh của một bài: đã lưu thì dùng, chưa thì đề AI soạn sẵn. */
export function quickSetFor(lesson: Lesson, stored?: TestSet): TestSet {
    return stored ?? defaultSet(sourcedBank([lesson]), QUICK_RULES)
}

/** Đề Kiểm tra cuối khóa của một khóa. */
export function finalSetFor(lessons: Lesson[], stored?: TestSet): TestSet {
    return stored ?? defaultSet(sourcedBank(lessons), FINAL_RULES)
}

/** Số câu đạt tối thiểu để vượt ngưỡng. */
export const passCount = (rules: TestRules, n: number) => Math.min(n, Math.max(1, Math.ceil(rules.passRatio * n - 1e-9)))

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
