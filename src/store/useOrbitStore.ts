import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { dailyArticles, getLesson } from '@/data'
import type { Lesson, ReviewStatus, Seconds } from '@/data/types'
import type { CourseCoverSpec } from '@/lib/cover-kinds'
import { OUTCOME_MASTERY, QUIZ_XP, type QuizOutcome } from '@/lib/quiz'
import { masteryAfterTest, testXp, type TestAnswerInput, type TestQuestion } from '@/lib/final-test'
import { advanceStreak, bestTestRatio, dailyFor, DAILY_LIMIT, directorXp, emptyDaily, evaluateBadges, EXTRA_READ_COST, LIGHTS_BADGE_ID, LIGHTS_XP, localDate, MISSIONS, type DailyState } from '@/lib/gamification'

/** Phiên làm bài test dở dang để tự động lưu và khôi phục khi tải lại trang/đóng tab */
export interface ActiveTestSession {
    courseId: string
    questionIds: string[]
    questions: TestQuestion[]
    currentIndex: number
    answers: Record<string, number>
    remainingSec: number
    updatedAt: number
}

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
    /** Phương án sai sinh viên chọn ở lần đầu (chỉ khi outcome là corrected/missed) */
    firstWrongOption?: string
    /** Id câu biến thể mà sinh viên sửa đúng (outcome corrected) */
    fixedByVariantId?: string
}

/** Ảnh chụp trạng thái lúc bắt đầu một chặng (ghi một lần khi trả lời câu quiz đầu tiên của bài) để màn tổng kết so trước/sau. */
export interface StageStart {
    at: string
    /** Mức nắm vững từng khái niệm của bài lúc bắt đầu; null = chưa có dữ liệu */
    mastery: Record<string, number | null>
    badgeIds: string[]
    xp: number
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
    firstWrongOption?: string
    fixedByVariantId?: string
}

/** Kết quả một lượt test cuối chương. */
export interface TestAttempt {
    at: string
    correct: number
    total: number
    durationSec: number
    timedOut: boolean
    /** Từng khái niệm được hỏi: đúng/sai và mức nắm vững trước/sau test */
    concepts: { conceptId: string; correct: boolean; blank?: boolean; before: number | null; after: number }[]
}

/** Kỷ lục + lượt gần nhất của một khóa. */
export interface TestRecord {
    bestCorrect: number
    bestTotal: number
    attempts: number
    last: TestAttempt
}

/** Phần nội dung AI tạo mà giảng viên được sửa; lưu cả khối để thay thế bản gốc. */
export type LessonEdits = Pick<Lesson, 'summary' | 'concepts' | 'quiz'>

/** Bìa khóa học do giảng viên chọn: kiểu/họa tiết/seed tự sinh, hoặc ảnh tải lên (dataURL JPEG, ưu tiên hơn bìa tự sinh) */
export interface CourseCoverOverride extends CourseCoverSpec {
    image?: string
}

interface OrbitState {
    role: Role | null
    /** Tên hiển thị trong lời chào và avatar (demo không có tài khoản) */
    learnerName: string
    /** Bài Orbit Daily đã đọc xong: id → ngày (YYYY-MM-DD) */
    dailyRead: Record<string, string>
    /** Tổng XP đã kiếm (tính cấp độ); không giảm khi tiêu XP */
    xp: number
    /** XP đã tiêu (mở bài Daily thêm). XP tiêu được = xp − xpSpent, xem `xpBalance` */
    xpSpent: number
    /** Bài Daily mua thêm theo ngày; sang ngày mới thì tính lại từ 0 */
    dailyUnlocks: { date: string; count: number }
    /** Ngày đã nhận nhiệm vụ ẩn "Tòa A2 sáng đèn" (các tầng giữ sáng trong ngày đó) */
    lightsDay: string | null
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
    /** Điểm tổng cao nhất ở Virtual Director (0 = chưa chụp) */
    directorBest: number
    /** Test cuối chương theo khóa (id khóa → kết quả) */
    testRecords: Record<string, TestRecord>
    /** Trạng thái lúc bắt đầu từng chặng (id bài → ảnh chụp), để tổng kết chặng so trước/sau */
    stageStart: Record<string, StageStart>
    /** Test cuối chặng 6 câu theo bài (id bài → kết quả), giữ lượt tốt nhất và gần nhất như test cuối chương */
    checkpoints: Record<string, TestRecord>
    /** Chặng đã mở màn tổng kết (hiệu ứng chỉ chạy lần đầu) */
    recapSeen: Record<string, boolean>
    /** Tiến độ nhiệm vụ trong ngày; sang ngày mới thì tự bắt đầu lại */
    daily: DailyState
    /** Trạng thái duyệt do giảng viên đặt; chưa có thì dùng status trong JSON */
    lessonReview: Record<string, ReviewStatus>
    /** Bản chỉnh sửa của giảng viên theo bài; chưa có thì dùng nội dung AI trong JSON */
    lessonEdits: Record<string, LessonEdits>
    /** Bìa khóa học do giảng viên chỉnh (id khóa → lựa chọn); chưa có thì dùng cover trong courses.json */
    courseCovers: Record<string, CourseCoverOverride>
    /** Phiên làm test cuối chương dở dang theo khóa (id khóa → phiên) */
    activeTestSessions: Record<string, ActiveTestSession>

    setRole: (role: Role | null) => void
    setLearnerName: (name: string) => void
    /** Hoàn thành một bài Orbit Daily; trả về XP được cộng (0 nếu đã đọc rồi) */
    completeDailyArticle: (articleId: string, xp: number) => number
    addXp: (amount: number) => void
    /** Mở thêm một bài Daily bằng XP; false nếu không đủ XP hoặc hết bài */
    unlockExtraRead: () => boolean
    /** Nhận nhiệm vụ ẩn khi đã đọc hết mọi bài Daily; trả về XP được cộng (0 nếu chưa đủ điều kiện hoặc hôm nay đã nhận) */
    claimLights: () => number
    saveLessonPosition: (lessonId: string, positionSec: Seconds) => void
    setLessonReview: (lessonId: string, status: ReviewStatus) => void
    /** patch = null: bỏ chỉnh sửa bìa, quay về bìa mặc định */
    setCourseCover: (courseId: string, patch: CourseCoverOverride | null) => void
    /** edits = null: bỏ chỉnh sửa, quay về bản AI tạo */
    setLessonEdits: (lessonId: string, edits: LessonEdits | null) => void
    /** Ghi kết quả một câu quiz, cập nhật mức nắm vững; trả về số XP được cộng */
    recordQuizResult: (input: RecordQuizInput) => number
    /** Nhận thưởng một nhiệm vụ đã xong; trả về XP được cộng (0 nếu chưa đủ hoặc đã nhận) */
    claimMission: (missionId: string) => number
    /** Ghi điểm một lần chụp ở Virtual Director; trả về XP được cộng (0 nếu chưa vượt kỷ lục hoặc dưới 70 điểm) */
    recordDirectorScore: (score: number) => number
    /** Ghi kết quả test cuối chương, cập nhật mức nắm vững (bản đồ kỹ năng) và XP; trả về số XP được cộng */
    recordTestResult: (input: { courseId: string; answers: TestAnswerInput[]; durationSec: number; timedOut: boolean }) => number
    /** Ghi kết quả test cuối chặng của một bài (cùng cách cập nhật mức nắm vững và XP như test cuối chương); trả về XP được cộng */
    recordCheckpointResult: (input: { lessonId: string; answers: TestAnswerInput[]; durationSec: number; timedOut: boolean }) => number
    markRecapSeen: (lessonId: string) => void
    saveTestSession: (courseId: string, session: ActiveTestSession) => void
    clearTestSession: (courseId: string) => void
    resetDemo: () => void
}

const STORAGE_KEY = 'orbit-demo-state'

/** XP tiêu được: tổng đã kiếm trừ phần đã tiêu. */
export const xpBalance = (s: Pick<OrbitState, 'xp' | 'xpSpent'>) => s.xp - s.xpSpent

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
        // Bài Daily đầu tiên (id đổi mỗi lần tạo lại nội dung nên lấy từ dữ liệu)
        dailyRead: Object.fromEntries(dailyArticles.slice(0, 1).map((a) => [a.id, today])) as Record<string, string>,
        xp: 2480,
        xpSpent: 0,
        dailyUnlocks: { date: '', count: 0 },
        lightsDay: null as string | null,
        streak: { count: 12, lastStudyDate: today as string | null, freezeUsedWeek: null as string | null },
        // 202s / 439s ≈ 46%
        lessonProgress: { 'ban-chat-dung-phi-tuyen': { lastPositionSec: 202, completed: false } } as Record<string, LessonProgress>,
        // Mức nắm vững khác nhau: vững, vững, đang học (62%, 40%, 25%), còn lại bị khóa (chưa học)
        conceptMastery: { 'dung-tuyen-tinh': 0.92, 'dung-phi-tuyen': 0.85, 'tinh-phi-huy-hoai': 0.62, 'tu-duy-dung': 0.4, 'nhip-hinh': 0.25 } as Record<string, number>,
        earnedBadgeIds: ['chuoi-7-ngay'],
        quizResults: {} as Record<string, QuizResult>,
        directorBest: 0,
        testRecords: {} as Record<string, TestRecord>,
        // Đầu chặng 1: mức nắm vững thấp hơn hiện tại để tổng kết có số trước/sau; XP bằng hiện tại vì demo chưa có câu quiz nào được ghi
        stageStart: {
            'ban-chat-dung-phi-tuyen': {
                at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
                mastery: { 'dung-tuyen-tinh': 0.4, 'dung-phi-tuyen': 0.35, 'tinh-phi-huy-hoai': 0.2, 'quy-trinh-dung-bon-giai-doan': null },
                badgeIds: ['chuoi-7-ngay'],
                xp: 2480,
            },
        } as Record<string, StageStart>,
        checkpoints: {} as Record<string, TestRecord>,
        recapSeen: {} as Record<string, boolean>,
        daily: { ...emptyDaily(today), readArticles: 1, claimed: ['daily'] } as DailyState,
        lessonReview: {} as Record<string, ReviewStatus>,
        lessonEdits: {} as Record<string, LessonEdits>,
        courseCovers: {} as Record<string, CourseCoverOverride>,
        activeTestSessions: {} as Record<string, ActiveTestSession>,
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

/** Phần dùng chung của test cuối chương và test cuối chặng: mức nắm vững mới, chuỗi ngày, bản ghi tốt nhất/gần nhất. */
function applyTest(s: OrbitState, prev: TestRecord | undefined, answers: TestAnswerInput[], durationSec: number, timedOut: boolean) {
    const conceptMastery = { ...s.conceptMastery }
    const concepts: TestAttempt['concepts'] = answers.map((a) => {
        const before = s.conceptMastery[a.conceptId]
        // Test cuối chặng có thể hỏi hai câu cùng khái niệm: câu sau tính tiếp trên mức vừa cập nhật
        const after = masteryAfterTest(conceptMastery[a.conceptId], a)
        // Chưa có dữ liệu về khái niệm và bỏ trống: không có bằng chứng gì để ghi vào bản đồ kỹ năng
        if (before !== undefined || !a.blank) conceptMastery[a.conceptId] = after
        return { conceptId: a.conceptId, correct: a.correct, blank: a.blank, before: before ?? null, after }
    })
    const { froze: _froze, ...streak } = advanceStreak(s.streak)
    const correct = answers.filter((a) => a.correct).length
    const last: TestAttempt = { at: new Date().toISOString(), correct, total: answers.length, durationSec, timedOut, concepts }
    const bestBetter = !prev || correct / answers.length > prev.bestCorrect / prev.bestTotal
    const record: TestRecord = {
        bestCorrect: bestBetter ? correct : prev.bestCorrect,
        bestTotal: bestBetter ? answers.length : prev.bestTotal,
        attempts: (prev?.attempts ?? 0) + 1,
        last,
    }
    return { conceptMastery, streak, today: dailyFor(s.daily), correct, record }
}

export const useOrbitStore = create<OrbitState>()(
    persist(
        (set, get) => ({
            ...makeDemoProfile(),

            setRole: (role) => set({ role }),

            setLearnerName: (name) => set({ learnerName: name.trim().slice(0, 24) || DEFAULT_LEARNER_NAME }),

            completeDailyArticle: (articleId, xp) => {
                if (get().dailyRead[articleId] === localDate()) return 0
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

            setCourseCover: (courseId, patch) =>
                set((s) => {
                    const { [courseId]: old, ...rest } = s.courseCovers
                    return { courseCovers: patch ? { ...rest, [courseId]: { ...old, ...patch } } : rest }
                }),

            unlockExtraRead: () => {
                const s = get()
                const bought = s.dailyUnlocks.date === localDate() ? s.dailyUnlocks.count : 0
                if (xpBalance(s) < EXTRA_READ_COST || DAILY_LIMIT + bought >= dailyArticles.length) return false
                // Báo chip XP trên nav đây là trả XP (khác với đặt lại demo): chip "−n" rơi xuống
                window.dispatchEvent(new CustomEvent('orbit:xp-spend', { detail: { amount: EXTRA_READ_COST } }))
                set((st) => ({ xpSpent: st.xpSpent + EXTRA_READ_COST, dailyUnlocks: { date: localDate(), count: bought + 1 } }))
                return true
            },

            claimLights: () => {
                const s = get()
                const today = localDate()
                const readToday = dailyArticles.filter((a) => s.dailyRead[a.id] === today).length
                if (s.lightsDay === today || readToday === 0 || !dailyArticles.every((a) => s.dailyRead[a.id] === today)) return 0
                set((st) => ({ xp: st.xp + LIGHTS_XP, lightsDay: today, earnedBadgeIds: st.earnedBadgeIds.includes(LIGHTS_BADGE_ID) ? st.earnedBadgeIds : [...st.earnedBadgeIds, LIGHTS_BADGE_ID] }))
                return LIGHTS_XP
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

            recordQuizResult: ({ lessonId, conceptId, questionId, outcome, attempts, lessonQuestionIds, firstWrongOption, fixedByVariantId }) => {
                // Câu đã làm không cộng lại; riêng câu bỏ lỡ (missed) mà nay sửa đúng ở câu biến thể thì được nâng lên 'corrected' và nhận XP sửa lỗi
                const existing = get().quizResults[questionId]
                if (existing && !(existing.outcome === 'missed' && outcome === 'corrected')) return 0
                const xp = QUIZ_XP[outcome]
                set((s) => {
                    const quizResults = {
                        ...s.quizResults,
                        [questionId]: { lessonId, conceptId, outcome, attempts, answeredAt: new Date().toISOString(), firstWrongOption, fixedByVariantId },
                    }
                    // Câu quiz đầu tiên của bài: chụp trạng thái trước khi câu này được tính (mức nắm vững, huy hiệu, XP)
                    const stageStart = s.stageStart[lessonId]
                        ? s.stageStart
                        : {
                              ...s.stageStart,
                              [lessonId]: {
                                  at: new Date().toISOString(),
                                  mastery: Object.fromEntries((getLesson(lessonId)?.concepts ?? []).map((c) => [c.id, s.conceptMastery[c.id] ?? null])),
                                  badgeIds: s.earnedBadgeIds,
                                  xp: s.xp,
                              },
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
                        stageStart,
                        xp: s.xp + xp,
                        conceptMastery,
                        streak,
                        daily,
                        earnedBadgeIds: evaluateBadges({ conceptMastery, quizResults, streak, directorBest: s.directorBest, testBest: bestTestRatio(s.testRecords) }, s.earnedBadgeIds),
                        lessonProgress: { ...s.lessonProgress, [lessonId]: { ...progress, completed: progress.completed || done } },
                    }
                })
                return xp
            },

            recordDirectorScore: (score) => {
                const s0 = get()
                const xp = directorXp(score, s0.directorBest)
                if (score <= s0.directorBest) return 0
                set((s) => ({
                    xp: s.xp + xp,
                    directorBest: score,
                    earnedBadgeIds: evaluateBadges({ conceptMastery: s.conceptMastery, quizResults: s.quizResults, streak: s.streak, directorBest: score, testBest: bestTestRatio(s.testRecords) }, s.earnedBadgeIds),
                }))
                return xp
            },

            recordTestResult: ({ courseId, answers, durationSec, timedOut }) => {
                const prev = get().testRecords[courseId]
                const xp = testXp(answers.filter((a) => a.correct).length, answers.length, prev && { correct: prev.bestCorrect, total: prev.bestTotal }).total
                set((s) => {
                    const done = applyTest(s, s.testRecords[courseId], answers, durationSec, timedOut)
                    const testRecords = { ...s.testRecords, [courseId]: done.record }
                    return {
                        xp: s.xp + xp,
                        conceptMastery: done.conceptMastery,
                        streak: done.streak,
                        daily: { ...done.today, answered: done.today.answered + done.correct, testsTaken: done.today.testsTaken + 1 },
                        earnedBadgeIds: evaluateBadges({ conceptMastery: done.conceptMastery, quizResults: s.quizResults, streak: done.streak, directorBest: s.directorBest, testBest: bestTestRatio(testRecords) }, s.earnedBadgeIds),
                        testRecords,
                    }
                })
                return xp
            },

            recordCheckpointResult: ({ lessonId, answers, durationSec, timedOut }) => {
                const prev = get().checkpoints[lessonId]
                const xp = testXp(answers.filter((a) => a.correct).length, answers.length, prev && { correct: prev.bestCorrect, total: prev.bestTotal }).total
                set((s) => {
                    const done = applyTest(s, s.checkpoints[lessonId], answers, durationSec, timedOut)
                    // Test cuối chặng không tính cho huy hiệu "Vượt ải cuối chương" (chỉ test cuối chương), nhưng mức nắm vững vẫn đổi nên huy hiệu theo khái niệm vẫn xét lại
                    return {
                        xp: s.xp + xp,
                        conceptMastery: done.conceptMastery,
                        streak: done.streak,
                        daily: { ...done.today, answered: done.today.answered + done.correct },
                        earnedBadgeIds: evaluateBadges({ conceptMastery: done.conceptMastery, quizResults: s.quizResults, streak: done.streak, directorBest: s.directorBest, testBest: bestTestRatio(s.testRecords) }, s.earnedBadgeIds),
                        checkpoints: { ...s.checkpoints, [lessonId]: done.record },
                    }
                })
                return xp
            },

            markRecapSeen: (lessonId) => set((s) => (s.recapSeen[lessonId] ? s : { recapSeen: { ...s.recapSeen, [lessonId]: true } })),

            saveTestSession: (courseId, session) =>
                set((s) => ({
                    activeTestSessions: { ...(s.activeTestSessions ?? {}), [courseId]: session },
                })),

            clearTestSession: (courseId) =>
                set((s) => {
                    const current = s.activeTestSessions ?? {}
                    if (!current[courseId]) return s
                    const { [courseId]: _removed, ...rest } = current
                    return { activeTestSessions: rest }
                }),

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
            version: 7,
            // Trước v4 chưa có hồ sơ demo: dùng hồ sơ mặc định mới. Từ v4 giữ dữ liệu: v5 thêm tổng kết chặng; v6 thêm XP tiêu được, bài Daily mua thêm, nhiệm vụ ẩn; v7 thêm activeTestSessions.
            migrate: (persisted, version) => {
                const demo = makeDemoProfile() as unknown as OrbitState
                if (version < 4 || !persisted || typeof persisted !== 'object') return demo
                const old = persisted as Partial<OrbitState>
                return { ...old, xpSpent: old.xpSpent ?? 0, dailyUnlocks: old.dailyUnlocks ?? demo.dailyUnlocks, lightsDay: old.lightsDay ?? null, stageStart: old.stageStart ?? demo.stageStart, checkpoints: old.checkpoints ?? {}, recapSeen: old.recapSeen ?? {}, activeTestSessions: old.activeTestSessions ?? {} } as OrbitState
            },
            storage: createJSONStorage(() => safeLocalStorage),
        },
    ),
)
