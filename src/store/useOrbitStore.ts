import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { Lesson, ReviewStatus, Seconds } from '@/data/types'
import { OUTCOME_MASTERY, QUIZ_XP, type QuizOutcome } from '@/lib/quiz'

// Toàn bộ trạng thái người dùng của bản demo (không có backend).
// Lưu localStorage; mọi thao tác storage bọc try/catch để chế độ ẩn danh
// hoặc trình duyệt chặn storage vẫn chạy được, chỉ là không nhớ giữa các lần mở.

export type Role = 'student' | 'teacher'

export interface LessonProgress {
    lastPositionSec: Seconds
    completed: boolean
}

export interface QuizResult {
    lessonId: string
    conceptId: string
    outcome: QuizOutcome
    /** Số câu đã trả lời (gốc + biến thể) tới khi xong */
    attempts: number
    answeredAt: string
}

export interface RecordQuizInput {
    lessonId: string
    conceptId: string
    /** id câu gốc */
    questionId: string
    outcome: QuizOutcome
    attempts: number
    /** id mọi câu gốc trong bài, để biết đã làm hết chưa */
    lessonQuestionIds: string[]
}

/** Phần nội dung AI tạo mà giảng viên được sửa; lưu cả khối để thay thế bản gốc. */
export type LessonEdits = Pick<Lesson, 'summary' | 'concepts' | 'quiz'>

interface OrbitState {
    role: Role | null
    xp: number
    streak: {
        count: number
        /** Ngày học gần nhất, dạng YYYY-MM-DD theo giờ máy */
        lastStudyDate: string | null
        /** Tuần (YYYY-Www) đã dùng lần đóng băng streak */
        freezeUsedWeek: string | null
    }
    lessonProgress: Record<string, LessonProgress>
    /** Mức nắm vững từng khái niệm, 0–1 */
    conceptMastery: Record<string, number>
    earnedBadgeIds: string[]
    /** Kết quả từng câu gốc; chỉ ghi lần đầu nên làm lại không được cộng XP thêm */
    quizResults: Record<string, QuizResult>
    /** Trạng thái duyệt do giảng viên đặt; chưa có thì dùng status trong JSON */
    lessonReview: Record<string, ReviewStatus>
    /** Bản chỉnh sửa của giảng viên theo bài; chưa có thì dùng nội dung AI trong JSON */
    lessonEdits: Record<string, LessonEdits>

    setRole: (role: Role | null) => void
    addXp: (amount: number) => void
    saveLessonPosition: (lessonId: string, positionSec: Seconds) => void
    setLessonReview: (lessonId: string, status: ReviewStatus) => void
    /** edits = null: bỏ chỉnh sửa, quay về bản AI tạo */
    setLessonEdits: (lessonId: string, edits: LessonEdits | null) => void
    /** Ghi kết quả một câu quiz, cập nhật mức nắm vững; trả về số XP được cộng */
    recordQuizResult: (input: RecordQuizInput) => number
    resetDemo: () => void
}

const STORAGE_KEY = 'orbit-demo-state'

const initialData = {
    role: null,
    xp: 0,
    streak: { count: 0, lastStudyDate: null, freezeUsedWeek: null },
    lessonProgress: {},
    conceptMastery: {},
    earnedBadgeIds: [],
    quizResults: {},
    lessonReview: {},
    lessonEdits: {},
} satisfies Partial<OrbitState>

const safeLocalStorage: StateStorage = {
    getItem: (name) => {
        try {
            return window.localStorage.getItem(name)
        } catch {
            return null
        }
    },
    setItem: (name, value) => {
        try {
            window.localStorage.setItem(name, value)
        } catch {
            // Hết dung lượng hoặc bị chặn: bỏ qua, trạng thái vẫn còn trong bộ nhớ
        }
    },
    removeItem: (name) => {
        try {
            window.localStorage.removeItem(name)
        } catch {
            // bỏ qua
        }
    },
}

export const useOrbitStore = create<OrbitState>()(
    persist(
        (set, get) => ({
            ...initialData,

            setRole: (role) => set({ role }),

            addXp: (amount) => set((s) => ({ xp: Math.max(0, s.xp + amount) })),

            saveLessonPosition: (lessonId, positionSec) =>
                set((s) => ({
                    lessonProgress: {
                        ...s.lessonProgress,
                        [lessonId]: {
                            completed: s.lessonProgress[lessonId]?.completed ?? false,
                            lastPositionSec: positionSec,
                        },
                    },
                })),

            setLessonReview: (lessonId, status) =>
                set((s) => ({ lessonReview: { ...s.lessonReview, [lessonId]: status } })),

            setLessonEdits: (lessonId, edits) =>
                set((s) => {
                    const { [lessonId]: _old, ...rest } = s.lessonEdits
                    return { lessonEdits: edits ? { ...rest, [lessonId]: edits } : rest }
                }),

            recordQuizResult: ({ lessonId, conceptId, questionId, outcome, attempts, lessonQuestionIds }) => {
                if (get().quizResults[questionId]) return 0
                const xp = QUIZ_XP[outcome]
                set((s) => {
                    const quizResults = {
                        ...s.quizResults,
                        [questionId]: { lessonId, conceptId, outcome, attempts, answeredAt: new Date().toISOString() },
                    }
                    // Mức nắm vững khái niệm = trung bình các câu đã làm của khái niệm đó
                    const ofConcept = Object.values(quizResults).filter((r) => r.conceptId === conceptId)
                    const mastery = ofConcept.reduce((sum, r) => sum + OUTCOME_MASTERY[r.outcome], 0) / ofConcept.length
                    const done = lessonQuestionIds.every((id) => quizResults[id])
                    const progress = s.lessonProgress[lessonId] ?? { lastPositionSec: 0, completed: false }
                    return {
                        quizResults,
                        xp: s.xp + xp,
                        conceptMastery: { ...s.conceptMastery, [conceptId]: mastery },
                        lessonProgress: { ...s.lessonProgress, [lessonId]: { ...progress, completed: progress.completed || done } },
                    }
                })
                return xp
            },

            resetDemo: () => set({ ...initialData }),
        }),
        {
            name: STORAGE_KEY,
            version: 1,
            storage: createJSONStorage(() => safeLocalStorage),
        },
    ),
)
