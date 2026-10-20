import { useRewardStore, type RewardEvent, type RewardRow } from '@/store/useRewardStore'
import { badges, lessons } from '@/data'
import type { Badge, Concept, Lesson } from '@/data/types'
import { QUIZ_XP, type QuizOutcome } from '@/lib/quiz'
import type { QuizResult } from '@/store/useOrbitStore'

// Quy tắc gamification dùng chung cho store và giao diện.
// Nguyên tắc: thưởng cho mức nắm vững (đúng, sửa được lỗi, hoàn thành), không thưởng cho thời gian lướt.

// ─── Cấp độ ────────────────────────────────────────────────────────────────

/** XP cần để bắt đầu cấp n: 60·(n−1)² → cấp 2 ở 60 XP, cấp 3 ở 240, cấp 7 ở 2.160… */
export const xpForLevel = (level: number) => 60 * (level - 1) ** 2

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1

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

const LEVEL_TITLES = [
    'Người mới',
    'Học việc',
    'Có nền tảng',
    'Vững vàng',
    'Thành thạo',
    'Người quan sát',
    'Bậc thầy',
    'Nhà dựng phim',
    'Người kể chuyện',
    'Đạo diễn hình ảnh',
    'Bậc thầy nhịp điệu',
    'Huyền thoại PTIT',
]
/** Mỗi cấp một tên riêng; vượt quá danh sách thì dùng tên cuối kèm số cấp. */
export const levelTitle = (level: number) => LEVEL_TITLES[level - 1] ?? `${LEVEL_TITLES[LEVEL_TITLES.length - 1]} ${level - LEVEL_TITLES.length + 1}`

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

/** XP khi đọc xong một bài Orbit Daily (trả lời đúng câu kiểm tra). */
export const DAILY_ARTICLE_XP = 20
/** Trong đó phần thưởng cho việc trả lời đúng câu kiểm tra (đọc xong bài là phần còn lại). */
export const DAILY_CHECK_XP = 5

// ─── Nhiệm vụ hằng ngày ────────────────────────────────────────────────────

export interface DailyState {
    date: string
    /** Số câu quiz làm đúng (đúng ngay hoặc sửa được) trong ngày */
    answered: number
    /** Số câu sửa đúng sau khi sai trong ngày */
    corrected: number
    completedLessons: number
    /** Số bài Orbit Daily đã đọc xong trong ngày */
    readArticles: number
    /** Số lượt test cuối chương đã nộp trong ngày */
    testsTaken: number
    /** id nhiệm vụ đã nhận thưởng */
    claimed: string[]
}

export const emptyDaily = (date = localDate()): DailyState => ({ date, answered: 0, corrected: 0, completedLessons: 0, readArticles: 0, testsTaken: 0, claimed: [] })

/** Trạng thái hôm nay; sang ngày mới thì bắt đầu lại từ 0. */
export const dailyFor = (d: DailyState | undefined, today = localDate()): DailyState =>
    d && d.date === today ? { ...emptyDaily(today), ...d } : emptyDaily(today)

export interface Mission {
    id: string
    title: string
    hint: string
    target: number
    rewardXp: number
    progress: (d: DailyState) => number
}

export const MISSIONS: Mission[] = [
    { id: 'daily', title: 'Đọc một bài Orbit Daily', hint: 'Đọc xong và trả lời đúng câu kiểm tra nhanh', target: 1, rewardXp: 15, progress: (d) => d.readArticles },
    { id: 'fix', title: 'Sửa đúng một câu sau khi sai', hint: 'Xem lại đoạn video rồi làm câu biến thể', target: 1, rewardXp: 30, progress: (d) => d.corrected },
    { id: 'finish', title: 'Hoàn thành một bài giảng', hint: 'Làm hết các câu hỏi trong bài', target: 1, rewardXp: 20, progress: (d) => d.completedLessons },
    { id: 'test', title: 'Làm một bài test cuối chương', hint: 'Nộp bài test để biết khái niệm nào còn hổng', target: 1, rewardXp: 25, progress: (d) => d.testsTaken },
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
    /** Điểm tổng cao nhất ở Virtual Director */
    directorBest: number
    /** Tỉ lệ đúng cao nhất trong các lượt test cuối chương, 0–1 */
    testBest: number
}

/** Tỉ lệ đúng tốt nhất trong mọi khóa (0 nếu chưa làm test). */
export const bestTestRatio = (records: Record<string, { bestCorrect: number; bestTotal: number }>) =>
    Math.max(0, ...Object.values(records).map((r) => (r.bestTotal > 0 ? r.bestCorrect / r.bestTotal : 0)))

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
            return { current: ctx.directorBest >= c.minScore ? 1 : 0, target: 1 }
        case 'test-score':
            return { current: ctx.testBest >= c.minRatio ? 1 : 0, target: 1 }
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
    conceptMastery: Record<string, number>
    streak: { count: number }
}

/** Nội dung riêng của từng tình huống; phần còn lại (cấp, huy hiệu, mở khóa, chuỗi ngày) tính từ trạng thái trước/sau. */
export interface RewardScreen {
    context: string
    headline: string
    rows: RewardRow[]
    /** Khái niệm có mức nắm vững thay đổi, để hiện thẻ "Mức nắm vững" khi không có huy hiệu mới */
    masteryConceptId?: string
    next?: { label: string; to: string }
}

/**
 * So sánh trạng thái trước/sau một hành động và đẩy một màn hình thưởng:
 * có `screen` (và XP tăng) thì là màn nhận XP đầy đủ; không thì chỉ hiện khi lên cấp hoặc có huy hiệu mới.
 */
export function announceRewards(before: Snapshot, after: Snapshot, screen?: RewardScreen) {
    const gained = after.xp - before.xp
    const level = levelFromXp(after.xp)
    const levelUp = level > levelFromXp(before.xp)
    const badge = after.earnedBadgeIds.filter((b) => !before.earnedBadgeIds.includes(b)).map((id) => badges.find((b) => b.id === id)).find(Boolean)
    const full = screen && gained > 0
    if (!full && !levelUp && !badge) return

    const unlockedBefore = new Set(buildSkillTree(before.conceptMastery).filter((n) => n.unlocked).map((n) => n.concept.id))
    const unlocked = buildSkillTree(after.conceptMastery).filter((n) => n.unlocked && !unlockedBefore.has(n.concept.id)).map((n) => n.concept.name)

    let mastery: RewardEvent['mastery']
    if (screen?.masteryConceptId) {
        const from = before.conceptMastery[screen.masteryConceptId] ?? 0
        const to = after.conceptMastery[screen.masteryConceptId] ?? 0
        const name = lessons.flatMap((l) => l.concepts).find((c) => c.id === screen.masteryConceptId)?.name
        if (name) mastery = { name, from, to }
    }

    useRewardStore.getState().push({
        context: full ? screen.context : badge ? 'Huy hiệu mới' : 'Lên cấp',
        headline: full ? screen.headline : badge ? 'Bạn vừa mở một huy hiệu.' : `Cấp ${level}. Học đều là tới.`,
        xp: Math.max(0, gained),
        rows: full ? screen.rows : [],
        xpBefore: before.xp,
        xpAfter: after.xp,
        badge,
        mastery,
        unlocked,
        streak: after.streak.count,
        next: screen?.next ?? { label: 'Học tiếp', to: '/learning' },
    })
}

/** Màn thưởng khi xong bài giảng: dòng chi tiết theo kết quả từng câu, câu chốt theo tình huống. */
export function lessonCompleteScreen(lesson: Lesson, quizResults: Record<string, { outcome: QuizOutcome }>, conceptId: string): RewardScreen {
    const outcomes = lesson.quiz.map((q) => quizResults[q.id]?.outcome).filter((o): o is QuizOutcome => Boolean(o))
    const count = (o: QuizOutcome) => outcomes.filter((x) => x === o).length
    const correct = count('correct')
    const corrected = count('corrected')
    const missed = count('missed')
    const rows: RewardRow[] = []
    if (correct) rows.push({ label: `Trả lời đúng ${correct} câu ngay lần đầu`, xp: correct * QUIZ_XP.correct })
    if (corrected) rows.push({ label: `Sửa đúng sau khi sai · thưởng x2 (${corrected} câu)`, xp: corrected * QUIZ_XP.corrected, highlight: true })
    if (missed) rows.push({ label: `${missed} câu chưa đúng, nên xem lại`, xp: 0 })
    const headline = corrected ? 'Sai một lần, hiểu tận gốc.' : missed ? 'Xong bài. Còn vài chỗ cần xem lại.' : 'Gọn gàng, không sót câu nào.'
    return { context: `Hoàn thành · ${lesson.title}`, headline, rows, masteryConceptId: conceptId, next: { label: 'Học tiếp', to: '/learning' } }
}

/** XP Virtual Director: chỉ thưởng khi đạt từ 70 điểm và vượt kỷ lục cũ, để không cày bằng cách chụp lặp. */
export const DIRECTOR_MIN_SCORE = 70
export const directorXp = (score: number, best: number) =>
    score >= DIRECTOR_MIN_SCORE && score > best ? Math.min(60, 20 + (score - DIRECTOR_MIN_SCORE) * 2) : 0

/** Màn thưởng khi đạt điểm cao ở Virtual Director. */
export function directorScreen(score: number, composition: number, lighting: number): RewardScreen {
    return {
        context: 'Virtual Director · Studio 3D',
        headline: score >= 90 ? 'Khung hình của một đạo diễn thực thụ.' : 'Bố cục và ánh sáng đã vào form.',
        rows: [
            { label: `Bố cục ${composition} · Ánh sáng ${lighting}`, xp: 0 },
            { label: `Kỷ lục mới ${score}/100 · thưởng theo điểm`, xp: directorXp(score, 0), highlight: true },
        ],
        next: { label: 'Chụp tiếp', to: '/studio' },
    }
}
