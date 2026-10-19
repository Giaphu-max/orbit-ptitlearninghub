import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { Lesson, ReviewStatus, Seconds } from '@/data/types'
import { OUTCOME_MASTERY, QUIZ_XP, type QuizOutcome } from '@/lib/quiz'
import { advanceStreak, dailyFor, emptyDaily, evaluateBadges, localDate, MISSIONS, type DailyState } from '@/lib/gamification'

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
    /** Tên hiển thị trong lời chào và avatar (demo không có tài khoản) */
    learnerName: string
    /** Bài Orbit Daily đã đọc xong: id → ngày (YYYY-MM-DD) */
    dailyRead: Record<string, string>
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
    /** Tiến độ nhiệm vụ trong ngày; sang ngày mới thì tự bắt đầu lại */
    daily: DailyState
    /** Trạng thái duyệt do giảng viên đặt; chưa có thì dùng status trong JSON */
    lessonReview: Record<string, ReviewStatus>
    /** Bản chỉnh sửa của giảng viên theo bài; chưa có thì dùng nội dung AI trong JSON */
    lessonEdits: Record<string, LessonEdits>

    setRole: (role: Role | null) => void
    setLearnerName: (name: string) => void
    /** Hoàn thành một bài Orbit Daily; trả về XP được cộng (0 nếu đã đọc rồi) */
    completeDailyArticle: (articleId: string, xp: number) => number
    addXp: (amount: number) => void
    saveLessonPosition: (lessonId: string, positionSec: Seconds) => void
    setLessonReview: (lessonId: string, status: ReviewStatus) => void
    /** edits = null: bỏ chỉnh sửa, quay về bản AI tạo */
    setLessonEdits: (lessonId: string, edits: LessonEdits | null) => void
    /** Ghi kết quả một câu quiz, cập nhật mức nắm vững; trả về số XP được cộng */
    recordQuizResult: (input: RecordQuizInput) => number
    /** Nhận thưởng một nhiệm vụ đã xong; trả về XP được cộng (0 nếu chưa đủ hoặc đã nhận) */
    claimMission: (missionId: string) => number
    resetDemo: () => void
}

const STORAGE_KEY = 'orbit-demo-state'

export const DEFAULT_LEARNER_NAME = 'Phú'

/**
 * Hồ sơ demo mặc định: như một sinh viên đã học khoảng 2 tuần (chuỗi 12 ngày, cấp 7, 2.480 XP,
 * đọc 1/3 bài Daily hôm nay, 1/3 nhiệm vụ xong, đang xem bài ở 46%). Ngày tính theo hôm nay để
 * chuỗi ngày luôn còn "sống" lúc mở demo. Lần đầu mở và nút "Đặt lại dữ liệu demo" đều trả về hồ sơ này.
 */
export function makeDemoProfile() {
    const today = localDate()
    return {
        role: null as Role | null,
        learnerName: DEFAULT_LEARNER_NAME,
        dailyRead: { 'daily-1-ban-chat-cua-dung-phim-phi-tuyen-va-cach': today } as Record<string, string>,
        xp: 2480,
        streak: { count: 12, lastStudyDate: today as string | null, freezeUsedWeek: null as string | null },
        // 202s / 439s ≈ 46%
        lessonProgress: { 'ban-chat-dung-phi-tuyen': { lastPositionSec: 202, completed: false } } as Record<string, LessonProgress>,
        // Mức nắm vững khác nhau: vững, vững, đang học (62%, 40%, 25%), còn lại bị khóa (chưa học)
        conceptMastery: { 'dung-tuyen-tinh': 0.92, 'dung-phi-tuyen': 0.85, 'tinh-phi-huy-hoai': 0.62, 'tu-duy-dung': 0.4, 'nhip-hinh': 0.25 } as Record<string, number>,
        earnedBadgeIds: ['chuoi-7-ngay'],
        quizResults: {} as Record<string, QuizResult>,
        daily: { ...emptyDaily(today), readArticles: 1, claimed: ['daily'] } as DailyState,
        lessonReview: {} as Record<string, ReviewStatus>,
        lessonEdits: {} as Record<string, LessonEdits>,
    }
}

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
            ...makeDemoProfile(),

            setRole: (role) => set({ role }),

            setLearnerName: (name) => set({ learnerName: name.trim().slice(0, 24) || DEFAULT_LEARNER_NAME }),

            completeDailyArticle: (articleId, xp) => {
                if (get().dailyRead[articleId]) return 0
                set((s) => {
                    const today = dailyFor(s.daily)
                    return {
                        xp: s.xp + xp,
                        dailyRead: { ...s.dailyRead, [articleId]: today.date },
                        daily: { ...today, readArticles: today.readArticles + 1 },
                    }
                })
                return xp
            },

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
                    const justCompleted = done && !progress.completed
                    const conceptMastery = { ...s.conceptMastery, [conceptId]: mastery }
                    // Chuỗi ngày học chỉ tính khi có trả lời quiz, không tính thời gian mở app
                    const { froze: _froze, ...streak } = advanceStreak(s.streak)
                    const today = dailyFor(s.daily)
                    const daily: DailyState = {
                        ...today,
                        answered: today.answered + (outcome === 'missed' ? 0 : 1),
                        corrected: today.corrected + (outcome === 'corrected' ? 1 : 0),
                        completedLessons: today.completedLessons + (justCompleted ? 1 : 0),
                    }
                    return {
                        quizResults,
                        xp: s.xp + xp,
                        conceptMastery,
                        streak,
                        daily,
                        earnedBadgeIds: evaluateBadges({ conceptMastery, quizResults, streak }, s.earnedBadgeIds),
                        lessonProgress: { ...s.lessonProgress, [lessonId]: { ...progress, completed: progress.completed || done } },
                    }
                })
                return xp
            },

            claimMission: (missionId) => {
                const mission = MISSIONS.find((m) => m.id === missionId)
                const today = dailyFor(get().daily)
                if (!mission || today.claimed.includes(missionId) || mission.progress(today) < mission.target) return 0
                set((s) => ({ xp: s.xp + mission.rewardXp, daily: { ...today, claimed: [...today.claimed, missionId] } }))
                return mission.rewardXp
            },

            resetDemo: () => set({ ...makeDemoProfile() }),
        }),
        {
            name: STORAGE_KEY,
            version: 3,
            // Phiên bản cũ chưa có hồ sơ demo: bỏ để dùng hồ sơ mặc định mới
            migrate: () => makeDemoProfile() as unknown as OrbitState,
            storage: createJSONStorage(() => safeLocalStorage),
        },
    ),
)
