import type { Lesson, LessonQuizQuestion, QuizChoiceQuestion } from '../data/types.js'

// Dùng chung cho frontend và api/explain.ts (đuôi .js để chạy được dạng ES module trên Node).

export interface FoundQuestion {
    /** Câu gốc dừng video; kết quả và XP tính theo câu gốc */
    root: LessonQuizQuestion
    question: QuizChoiceQuestion
    /** 0 = câu gốc, 1.. = câu biến thể thứ n */
    attempt: number
}

export function findQuizQuestion(lesson: Lesson, questionId: string): FoundQuestion | null {
    for (const root of lesson.quiz) {
        if (root.id === questionId) return { root, question: root, attempt: 0 }
        const i = root.variants.findIndex((v) => v.id === questionId)
        if (i >= 0) return { root, question: root.variants[i], attempt: i + 1 }
    }
    return null
}

/** Câu hỏi thứ `attempt` của một câu gốc: 0 là câu gốc, sau đó lần lượt các biến thể. */
export function questionAt(root: LessonQuizQuestion, attempt: number): QuizChoiceQuestion | null {
    return attempt === 0 ? root : (root.variants[attempt - 1] ?? null)
}

export type QuizOutcome = 'correct' | 'corrected' | 'missed'

/** XP theo mức độ nắm vững: sửa đúng sau khi sai được gấp đôi để khuyến khích học từ lỗi. */
export const QUIZ_XP: Record<QuizOutcome, number> = {
    correct: 10,
    corrected: 20,
    missed: 0,
}

/** Mức nắm vững một câu đóng góp cho khái niệm. */
export const OUTCOME_MASTERY: Record<QuizOutcome, number> = {
    correct: 1,
    corrected: 0.75,
    missed: 0.25,
}

export const EXPLAIN_LIMITS = { maxChosenIndex: 9 } as const

export interface ExplainRequest {
    lessonId: string
    questionId: string
    chosenIndex: number
}

export interface ExplainResponse {
    /** Giải thích dạng Markdown */
    explanation: string
    /** Đoạn video chứa kiến thức để xem lại */
    review: { start: number; end: number }
}
