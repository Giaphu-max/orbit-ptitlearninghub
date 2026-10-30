import { dailyArticles, lessons } from '@/data'
import { checkBlocks } from '@/lib/daily-text'
import type { DailyArticle, Lesson, QuizChoiceQuestion } from '@/data/types'
import { UNLOCK_THRESHOLD } from '@/lib/gamification'
import { OUTCOME_MASTERY } from '@/lib/quiz'

// Test tổng hợp cuối chương: lấy câu từ ngân hàng câu hỏi của khóa (câu quiz trong video,
// câu biến thể, câu kiểm tra của bài Orbit Daily), trộn thứ tự, có giới hạn thời gian. Đề thật do giảng viên duyệt nằm ở lib/test-sets.ts; hàm bốc ngẫu nhiên ở đây chỉ còn là nền cho đề AI soạn sẵn.

export const TEST_QUESTION_COUNT = 10
export const TEST_SECONDS_PER_QUESTION = 60
/** Đạt từ mức này thì được thưởng thêm. */
export const TEST_PASS_RATIO = 0.8
/** Dưới mức này thì không cộng XP (tránh bấm bừa lấy điểm). */
export const TEST_MIN_XP_RATIO = 0.5
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

/** Câu hỏi dựa vào khoảnh khắc đang xem ("đoạn video vừa rồi", "ở trên"…) thì mất nghĩa khi đứng riêng trong test. */
const DEICTIC = /vừa (xem|nghe|thấy|rồi)|bạn (vừa|đã) (xem|nghe|thấy)|đoạn (video|clip|phim) (này|vừa|trên|đó)|(video|clip) (này|vừa|trên)|ở trên|phía trên|như (đã|vừa) (nói|nêu|thấy)/i

/**
 * Chuẩn bị câu hỏi để đứng riêng trong test: loại câu có ngữ cảnh khoảnh khắc xem video,
 * và bỏ các cụm "theo bài giảng/bài học" vì test gom cả khóa, không có bài cụ thể làm mốc.
 * Trả về null nếu không cứu được.
 */
export function standaloneQuestion<T extends QuizChoiceQuestion>(q: T): T | null {
    if (DEICTIC.test(q.prompt) || q.options.some((o) => DEICTIC.test(o))) return null
    let prompt = q.prompt
        .replace(/^(theo|trong) (nội dung )?bài (giảng|học),?\s*/i, '')
        .replace(/,?\s+(theo|trong) (nội dung )?bài (giảng|học)(?=[\s,?.])/gi, '')
    prompt = prompt.charAt(0).toUpperCase() + prompt.slice(1)
    return prompt === q.prompt ? q : { ...q, prompt }
}

/** Ngân hàng câu hỏi của một khóa: mọi câu gốc, câu biến thể và câu kiểm tra Daily có khái niệm thuộc khóa. */
export function buildQuestionBank(lessons: Lesson[], daily: DailyArticle[] = dailyArticles): BankQuestion[] {
    const conceptLesson = new Map(lessons.flatMap((l) => l.concepts.map((c) => [c.id, l.id] as const)))
    const bank: BankQuestion[] = []
    for (const l of lessons) {
        for (const q of l.quiz) {
            const { variants, pauseAt: _p, answerSegment: _a, ...root } = q
            for (const item of [root, ...variants]) {
                const ok = standaloneQuestion(item)
                if (ok) bank.push({ ...ok, lessonId: l.id })
            }
        }
    }
    for (const a of daily) {
        for (const { question: c } of checkBlocks(a)) {
            const lessonId = conceptLesson.get(c.conceptId)
            const ok = standaloneQuestion(c)
            if (lessonId && ok) bank.push({ ...ok, lessonId })
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

export const CHECKPOINT_QUESTION_COUNT = 6

/** Câu sinh viên đã gặp trong video của bài: câu gốc đã làm, cùng các biến thể đã hỏi tới (attempts − 1 biến thể đầu). */
export function seenQuestionIds(lesson: Lesson, results: Record<string, { attempts: number }>): Set<string> {
    const seen = new Set<string>()
    for (const q of lesson.quiz) {
        const r = results[q.id]
        if (!r) continue
        seen.add(q.id)
        q.variants.slice(0, Math.max(0, r.attempts - 1)).forEach((v) => seen.add(v.id))
    }
    return seen
}

const withShuffledOptions = (q: BankQuestion): TestQuestion => {
    const order = shuffle(q.options.map((_, i) => i))
    return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) }
}

/**
 * Test cuối chặng: 6 câu từ ngân hàng của một bài. Mỗi khái niệm ít nhất một câu (khái niệm nhiều hơn số câu thì bốc ngẫu nhiên),
 * câu còn lại bù thêm; luôn ưu tiên câu sinh viên chưa gặp (đặc biệt biến thể), không trùng đề.
 */
export function pickCheckpointQuestions(bank: BankQuestion[], seen: Set<string>, count = CHECKPOINT_QUESTION_COUNT): TestQuestion[] {
    // Chưa gặp xếp trước; trong cùng nhóm thì ngẫu nhiên
    const fresh = (qs: BankQuestion[]) => [...shuffle(qs.filter((q) => !seen.has(q.id))), ...shuffle(qs.filter((q) => seen.has(q.id)))]
    const byConcept = new Map<string, BankQuestion[]>()
    for (const q of bank) byConcept.set(q.conceptId, [...(byConcept.get(q.conceptId) ?? []), q])
    const chosen: BankQuestion[] = []
    const prompts = new Set<string>()
    const take = (q: BankQuestion | undefined) => {
        if (!q || chosen.includes(q) || prompts.has(q.prompt)) return false
        chosen.push(q)
        prompts.add(q.prompt)
        return true
    }
    for (const qs of shuffle([...byConcept.values()]).slice(0, count)) take(fresh(qs).find((q) => !prompts.has(q.prompt)))
    for (const q of fresh(bank.filter((x) => !chosen.includes(x)))) {
        if (chosen.length >= count) break
        take(q)
    }
    return shuffle(chosen).map(withShuffledOptions)
}

export const testTimeLimit = (questionCount: number, secondsPerQuestion = TEST_SECONDS_PER_QUESTION) => questionCount * secondsPerQuestion

/** XP: dưới 50% số câu đúng thì không có; còn lại mỗi câu đúng vượt kỷ lục cũ + thưởng một lần khi lần đầu đạt mức cao. Làm lại không đạt kỷ lục thì không có XP. */
export function testXp(correct: number, total: number, best: { correct: number; total: number } | undefined, passRatio = TEST_PASS_RATIO) {
    if (total === 0 || correct / total < TEST_MIN_XP_RATIO) return { base: 0, bonus: 0, total: 0 }
    const bestCorrect = best?.correct ?? 0
    const base = Math.max(0, correct - bestCorrect) * TEST_XP_PER_CORRECT
    const passedBefore = best ? best.correct / best.total >= passRatio : false
    const bonus = total > 0 && correct / total >= passRatio && !passedBefore ? TEST_PASS_BONUS_XP : 0
    return { base, bonus, total: base + bonus }
}

export const MASTERED_RATIO = UNLOCK_THRESHOLD

export interface TestAnswerInput {
    conceptId: string
    correct: boolean
    /** Câu bỏ trống hoặc hết giờ chưa kịp trả lời: trừ nhẹ hơn câu trả lời sai */
    blank?: boolean
}

/** Trọng số của mức cũ khi gộp với kết quả test; mỗi khái niệm chỉ có 1 câu nên test chỉ được xê dịch mức nắm vững. */
export const TEST_MASTERY_KEEP = 0.7

/**
 * Mức nắm vững mới sau test = 70% mức cũ + 30% kết quả (đúng = 1, sai = mức "chưa đúng" của quiz).
 * Câu bỏ trống không phải bằng chứng hiểu sai nên chỉ trừ một nửa mức trừ của câu sai.
 * Khái niệm đã đạt ngưỡng mở khóa thì không tụt dưới ngưỡng vì một câu test, để không khóa lại khái niệm nâng cao.
 */
export function masteryAfterTest(before: number | undefined, answer: { correct: boolean; blank?: boolean }) {
    const target = answer.correct ? 1 : OUTCOME_MASTERY.missed
    if (before === undefined) return answer.blank ? 0 : target
    let after = TEST_MASTERY_KEEP * before + (1 - TEST_MASTERY_KEEP) * target
    if (answer.blank) after = (after + before) / 2
    return before >= UNLOCK_THRESHOLD ? Math.max(after, UNLOCK_THRESHOLD) : after
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
        const viaSource = dailyArticles.filter((a) => !direct.includes(a) && a.blocks.some((p) => p.sources.some((s) => s.lessonId === lesson.id && s.start >= concept.segment.start - 5 && s.start < concept.segment.end)))
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
