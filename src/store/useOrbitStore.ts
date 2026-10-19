import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { ReviewStatus, Seconds } from '@/data/types'

// Toàn bộ trạng thái người dùng của bản demo (không có backend).
// Lưu localStorage; mọi thao tác storage bọc try/catch để chế độ ẩn danh
// hoặc trình duyệt chặn storage vẫn chạy được, chỉ là không nhớ giữa các lần mở.

export type Role = 'student' | 'teacher'

export interface LessonProgress {
    lastPositionSec: Seconds
    completed: boolean
}

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
    /** Trạng thái duyệt do giảng viên đặt; chưa có thì dùng status trong JSON */
    lessonReview: Record<string, ReviewStatus>

    setRole: (role: Role | null) => void
    addXp: (amount: number) => void
    saveLessonPosition: (lessonId: string, positionSec: Seconds) => void
    setLessonReview: (lessonId: string, status: ReviewStatus) => void
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
    lessonReview: {},
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
        (set) => ({
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

            resetDemo: () => set({ ...initialData }),
        }),
        {
            name: STORAGE_KEY,
            version: 1,
            storage: createJSONStorage(() => safeLocalStorage),
        },
    ),
)
