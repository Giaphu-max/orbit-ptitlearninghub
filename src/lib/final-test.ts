import { dailyArticles, lessons } from '@/data'
import type { DailyArticle, Lesson, QuizChoiceQuestion } from '@/data/types'
import { OUTCOME_MASTERY } from '@/lib/quiz'

// Test tổng hợp cuối chương: lấy câu từ ngân hàng câu hỏi của khóa (câu quiz trong video,
// câu biến thể, câu kiểm tra của bài Orbit Daily), trộn thứ tự, có giới hạn thời gian.

export const TEST_QUESTION_COUNT = 10
export const TEST_SECONDS_PER_QUESTION = 60
/** Đạt từ mức này thì được thưởng thêm. */
export const TEST_PASS_RATIO = 0.8
export const TEST_XP_PER_CORRECT = 10
export const TEST_PASS_BONUS_XP = 30

export interface BankQuestion extends QuizChoiceQuestion {
    lessonId: string
}

export interface TestQuestion extends BankQuestion {
    /** Thứ tự phương án đã trộn; correctIndex trỏ theo thứ tự mới */
    options: string[]
    correctIndex: number
}

/** Ngân hàng câu hỏi của một khóa: mọi câu gốc, câu biến thể và câu kiểm tra Daily có khái niệm thuộc khóa. */
export function buildQuestionBank(lessons: Lesson[], daily: DailyArticle[] = dailyArticles): BankQuestion[] {
    const conceptLesson = new Map(lessons.flatMap((l) => l.concepts.map((c) => [c.id, l.id] as const)))
    const bank: BankQuestion[] = []
    for (const l of lessons) {
        for (const q of l.quiz) {
            const { variants, pauseAt: _p, answerSegment: _a, ...root } = q
            bank.push({ ...root, lessonId: l.id })
            for (const v of variants) bank.push({ ...v, lessonId: l.id })
        }
    }
    for (const a of daily) {
        for (const c of a.checks) {
            const lessonId = conceptLesson.get(c.conceptId)
            if (lessonId) bank.push({ ...c, lessonId })
        }
    }
    return bank
}

const shuffle = <T,>(items: T[]): T[] => {
    const a = [...items]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/**
 * Chọn câu cho một lượt test: mỗi khái niệm tối đa một câu (ưu tiên phủ nhiều khái niệm nhất),
 * rồi trộn thứ tự câu và thứ tự phương án. Mỗi lần làm lại ra bộ câu khác nhau.
 */
export function pickTestQuestions(bank: BankQuestion[], count = TEST_QUESTION_COUNT): TestQuestion[] {
    const byConcept = new Map<string, BankQuestion[]>()
    for (const q of bank) byConcept.set(q.conceptId, [...(byConcept.get(q.conceptId) ?? []), q])
    const pool = shuffle([...byConcept.values()]).flatMap((qs) => [shuffle(qs)[0]])
    // Ngân hàng ít khái niệm hơn số câu cần: bù bằng câu khác của cùng khái niệm
    const rest = shuffle(bank.filter((q) => !pool.includes(q)))
    const chosen = [...pool, ...rest].slice(0, count)
    return shuffle(chosen).map((q) => {
        const order = shuffle(q.options.map((_, i) => i))
        return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) }
    })
}

export const testTimeLimit = (questionCount: number) => questionCount * TEST_SECONDS_PER_QUESTION

/** XP: mỗi câu đúng vượt kỷ lục cũ + thưởng một lần khi lần đầu đạt mức cao. Làm lại không đạt kỷ lục thì không có XP. */
export function testXp(correct: number, total: number, best: { correct: number; total: number } | undefined) {
    const bestCorrect = best?.correct ?? 0
    const base = Math.max(0, correct - bestCorrect) * TEST_XP_PER_CORRECT
    const passedBefore = best ? best.correct / best.total >= TEST_PASS_RATIO : false
    const bonus = total > 0 && correct / total >= TEST_PASS_RATIO && !passedBefore ? TEST_PASS_BONUS_XP : 0
    return { base, bonus, total: base + bonus }
}

export interface TestAnswerInput {
    conceptId: string
    correct: boolean
}

/** Mức nắm vững mới của khái niệm sau test: trung bình giữa mức cũ (nếu có) và điểm trong test. */
export function masteryAfterTest(before: number | undefined, correct: boolean) {
    const test = correct ? 1 : OUTCOME_MASTERY.missed
    return before === undefined ? test : (before + test) / 2
}

export interface ReviewStep {
    conceptId: string
    conceptName: string
    lessonId: string
    lessonTitle: string
    /** Mốc video đúng đoạn giảng khái niệm */
    start: number
    end: number
    daily: DailyArticle[]
}

/** Lộ trình ôn cho một khái niệm hổng: tua đúng đoạn giảng + bài Daily nhắc tới khái niệm (hoặc dẫn nguồn từ bài đó). */
export function reviewStepFor(conceptId: string): ReviewStep | null {
    for (const lesson of lessons) {
        const concept = lesson.concepts.find((c) => c.id === conceptId)
        if (!concept) continue
        const direct = dailyArticles.filter((a) => a.conceptIds.includes(conceptId))
        const viaSource = dailyArticles.filter((a) => !direct.includes(a) && a.paragraphs.some((p) => p.sources.some((s) => s.lessonId === lesson.id && s.start >= concept.segment.start - 5 && s.start < concept.segment.end)))
        return {
            conceptId,
            conceptName: concept.name,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            start: concept.segment.start,
            end: concept.segment.end,
            daily: [...direct, ...viaSource].slice(0, 2),
        }
    }
    return null
}
