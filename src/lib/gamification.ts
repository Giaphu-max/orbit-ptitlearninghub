import { useRewardStore } from '@/store/useRewardStore'
import { badges, lessons } from '@/data'
import type { Badge, Concept } from '@/data/types'
import type { QuizResult } from '@/store/useOrbitStore'

// Quy tắc gamification dùng chung cho store và giao diện.
// Nguyên tắc: thưởng cho mức nắm vững (đúng, sửa được lỗi, hoàn thành), không thưởng cho thời gian lướt.

// ─── Cấp độ ────────────────────────────────────────────────────────────────

/** XP cần để bắt đầu cấp n: 50·(n−1)² → cấp 2 ở 50 XP, cấp 3 ở 200, cấp 4 ở 450… */
export const xpForLevel = (level: number) => 50 * (level - 1) ** 2

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1

export interface LevelProgress {
    level: number
    /** XP đã có trong cấp hiện tại */
    into: number
    /** XP cần cho cả cấp hiện tại */
    span: number
    /** 0–1 */
    ratio: number
    toNext: number
}

export function levelProgress(xp: number): LevelProgress {
    const level = levelFromXp(xp)
    const start = xpForLevel(level)
    const span = xpForLevel(level + 1) - start
    const into = xp - start
    return { level, into, span, ratio: span > 0 ? into / span : 0, toNext: span - into }
}

const LEVEL_TITLES = ['Người mới', 'Học việc', 'Có nền tảng', 'Vững vàng', 'Thành thạo', 'Bậc thầy']
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1]

// ─── Ngày và tuần (giờ máy) ────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Số ngày chênh giữa hai chuỗi YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string) {
    const toUtc = (s: string) => {
        const [y, m, d] = s.split('-').map(Number)
        return Date.UTC(y, m - 1, d)
    }
    return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

/** Tuần ISO dạng YYYY-Www. */
export function weekId(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - day)
    const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1)
    const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7)
    return `${t.getUTCFullYear()}-W${pad(week)}`
}

export interface StreakState {
    count: number
    lastStudyDate: string | null
    freezeUsedWeek: string | null
}

/**
 * Ghi nhận một ngày có học (trả lời quiz). Bỏ lỡ đúng một ngày thì tự dùng "đóng băng"
 * (1 lần mỗi tuần) để giữ chuỗi; bỏ lỡ nhiều hơn thì chuỗi về 1.
 */
export function advanceStreak(s: StreakState, now = new Date()): StreakState & { froze: boolean } {
    const today = localDate(now)
    if (s.lastStudyDate === today) return { ...s, froze: false }
    const gap = s.lastStudyDate ? daysBetween(s.lastStudyDate, today) : null
    if (gap === 1) return { ...s, count: s.count + 1, lastStudyDate: today, froze: false }
    const week = weekId(now)
    if (gap === 2 && s.freezeUsedWeek !== week) {
        return { count: s.count + 1, lastStudyDate: today, freezeUsedWeek: week, froze: true }
    }
    return { ...s, count: 1, lastStudyDate: today, froze: false }
}

/** Chuỗi hiển thị: nếu đã bỏ lỡ quá hạn thì coi như đã đứt (chưa ghi vào store tới lần học tiếp theo). */
export function visibleStreak(s: StreakState, now = new Date()) {
    if (!s.lastStudyDate || s.count === 0) return { count: 0, studiedToday: false, atRisk: false }
    const gap = daysBetween(s.lastStudyDate, localDate(now))
    const canFreeze = s.freezeUsedWeek !== weekId(now)
    const alive = gap <= 1 || (gap === 2 && canFreeze)
    return { count: alive ? s.count : 0, studiedToday: gap === 0, atRisk: alive && gap >= 1 }
}

export const freezeAvailable = (s: StreakState, now = new Date()) => s.freezeUsedWeek !== weekId(now)

// ─── Nhiệm vụ hằng ngày ────────────────────────────────────────────────────

export interface DailyState {
    date: string
    /** Số câu quiz làm đúng (đúng ngay hoặc sửa được) trong ngày */
    answered: number
    /** Số câu sửa đúng sau khi sai trong ngày */
    corrected: number
    completedLessons: number
    /** id nhiệm vụ đã nhận thưởng */
    claimed: string[]
}

export const emptyDaily = (date = localDate()): DailyState => ({ date, answered: 0, corrected: 0, completedLessons: 0, claimed: [] })

/** Trạng thái hôm nay; sang ngày mới thì bắt đầu lại từ 0. */
export const dailyFor = (d: DailyState | undefined, today = localDate()) => (d && d.date === today ? d : emptyDaily(today))

export interface Mission {
    id: string
    title: string
    hint: string
    target: number
    rewardXp: number
    progress: (d: DailyState) => number
}

export const MISSIONS: Mission[] = [
    { id: 'answer', title: 'Trả lời đúng một câu hỏi trong video', hint: 'Dừng ở mốc quiz và chọn đáp án đúng', target: 1, rewardXp: 10, progress: (d) => d.answered },
    { id: 'fix', title: 'Sửa đúng một câu sau khi sai', hint: 'Xem lại đoạn video rồi làm câu biến thể', target: 1, rewardXp: 15, progress: (d) => d.corrected },
    { id: 'finish', title: 'Hoàn thành một bài giảng', hint: 'Làm hết các câu hỏi trong bài', target: 1, rewardXp: 20, progress: (d) => d.completedLessons },
]

// ─── Cây kỹ năng ───────────────────────────────────────────────────────────

/** Khái niệm nâng cao mở khi mọi khái niệm nền đạt mức này. */
export const UNLOCK_THRESHOLD = 0.8

export interface SkillNode {
    concept: Concept
    lessonId: string
    /** Số bước tính từ khái niệm nền (0 = nền) */
    depth: number
    mastery: number
    unlocked: boolean
    /** Khái niệm nền còn thiếu */
    missing: Concept[]
}

export function buildSkillTree(mastery: Record<string, number>): SkillNode[] {
    const all = lessons.flatMap((l) => l.concepts.map((c) => ({ concept: c, lessonId: l.id })))
    const byId = new Map(all.map((n) => [n.concept.id, n.concept]))
    const depthOf = (id: string, seen = new Set<string>()): number => {
        const c = byId.get(id)
        if (!c || seen.has(id)) return 0
        seen.add(id)
        return c.prerequisiteIds.length ? 1 + Math.max(...c.prerequisiteIds.map((p) => depthOf(p, seen))) : 0
    }
    return all.map(({ concept, lessonId }) => {
        const missing = concept.prerequisiteIds
            .filter((p) => (mastery[p] ?? 0) < UNLOCK_THRESHOLD)
            .map((p) => byId.get(p))
            .filter((c): c is Concept => Boolean(c))
        return { concept, lessonId, depth: depthOf(concept.id), mastery: mastery[concept.id] ?? 0, unlocked: missing.length === 0, missing }
    })
}

// ─── Huy hiệu ──────────────────────────────────────────────────────────────

export interface BadgeContext {
    conceptMastery: Record<string, number>
    quizResults: Record<string, QuizResult>
    streak: StreakState
}

export function badgeProgress(badge: Badge, ctx: BadgeContext): { current: number; target: number } {
    const c = badge.criterion
    switch (c.type) {
        case 'concept-mastery': {
            const done = c.conceptIds.filter((id) => (ctx.conceptMastery[id] ?? 0) >= c.threshold).length
            return { current: done, target: c.conceptIds.length }
        }
        case 'corrected-mistakes':
            return { current: Math.min(c.count, Object.values(ctx.quizResults).filter((r) => r.outcome === 'corrected').length), target: c.count }
        case 'streak':
            return { current: Math.min(c.days, ctx.streak.count), target: c.days }
        case 'director-score':
            // Virtual Director chưa có: chưa thể đạt
            return { current: 0, target: 1 }
    }
}

export const isBadgeEarned = (badge: Badge, ctx: BadgeContext) => {
    const { current, target } = badgeProgress(badge, ctx)
    return current >= target
}

/** Id mọi huy hiệu đạt điều kiện (gộp với những cái đã có: huy hiệu đã nhận không bị thu hồi). */
export function evaluateBadges(ctx: BadgeContext, already: string[]) {
    const earned = new Set(already)
    for (const b of badges) if (isBadgeEarned(b, ctx)) earned.add(b.id)
    return [...earned]
}

// ─── Thông báo thưởng ──────────────────────────────────────────────────────

interface Snapshot {
    xp: number
    earnedBadgeIds: string[]
}

/**
 * So sánh trạng thái trước/sau một hành động và đẩy màn hình thưởng tương ứng:
 * XP (khi có tiêu đề riêng) → lên cấp → huy hiệu mới.
 */
export function announceRewards(before: Snapshot, after: Snapshot, xpScreen?: { title: string; subtitle: string }) {
    const events: Parameters<ReturnType<typeof useRewardStore.getState>['push']> = []
    const gained = after.xp - before.xp
    if (xpScreen && gained > 0) events.push({ kind: 'xp', xp: gained, ...xpScreen })
    const level = levelFromXp(after.xp)
    if (level > levelFromXp(before.xp)) events.push({ kind: 'level-up', level })
    for (const id of after.earnedBadgeIds.filter((b) => !before.earnedBadgeIds.includes(b))) {
        const badge = badges.find((b) => b.id === id)
        if (badge) events.push({ kind: 'badge', badge })
    }
    if (events.length) useRewardStore.getState().push(...events)
}
