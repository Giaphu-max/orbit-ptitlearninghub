import { badges, dailyArticles, getConcept, getCourse, getLessonsOfCourse } from '@/data'
import type { Badge, Concept, Course, DailyArticle, Lesson, LessonQuizQuestion, QuizChoiceQuestion } from '@/data/types'
import { badgeProgress, buildSkillTree, UNLOCK_THRESHOLD } from '@/lib/gamification'
import { gapScore, DAILY_LIMIT } from '@/lib/next-step'
import { lessonState } from '@/lib/course-progress'
import { QUIZ_XP } from '@/lib/quiz'
import { bestTestRatio } from '@/lib/gamification'
import { testXp } from '@/lib/final-test'
import { QUICK_RULES } from '@/lib/test-sets'
import type { useOrbitStore } from '@/store/useOrbitStore'

// Số liệu cho màn tổng kết chặng (/recap/:lessonId). Chặng = một bài học trong khóa.
// Mọi con số lấy từ store: mức nắm vững trước/sau (stageStart → conceptMastery), XP chặng, câu trong video, kiểm tra cuối chặng, huy hiệu mới.

type State = ReturnType<typeof useOrbitStore.getState>

export interface RecapConcept {
    id: string
    name: string
    segment: Concept['segment']
    was: number
    now: number
    mastered: boolean
    /** Ghi chú ngắn: sửa được sau khi sai / sai trong kiểm tra cuối chặng */
    note?: string
}

export interface RecapBadgeRow {
    label: string
    value: string
}

export interface RecapBadge {
    badge: Badge
    rows: RecapBadgeRow[]
    current: number
    target: number
}

export interface RecapMistake {
    root: LessonQuizQuestion
    firstWrong?: string
    fixed?: QuizChoiceQuestion
    /** Câu sửa được khác (ngoài câu được kể) */
    others: { conceptName: string; attempts: number }[]
    /** Số câu chưa đúng hoặc từng sai trong video */
    reviewCount: number
}

/** Một câu trong video chưa đúng ngay (sửa được sau khi sai hoặc bỏ lỡ), theo thứ tự trong video. */
export interface RecapMistakeRow {
    root: LessonQuizQuestion
    outcome: 'corrected' | 'missed'
}

export interface RecapReview {
    concept: RecapConcept
    /** Bài Daily sẽ được ưu tiên ngày mai (có khái niệm này); undefined nếu không có bài nào */
    daily?: DailyArticle
    /** Bài Daily có khái niệm này nhưng chưa vào 3 bài đầu của ngày mai */
    dailyQueued?: DailyArticle
}

export interface RecapNext {
    label: string
    to: string
    /** Bài kế tiếp trong khóa (không có = bài cuối khóa, nút chính là kiểm tra cuối khóa) */
    lesson?: Lesson
    unlocked: { name: string; because: string }[]
}

export interface RecapData {
    course: Course
    stages: { lesson: Lesson; state: 'done' | 'open' | 'todo' }[]
    index: number
    lesson: Lesson
    completed: boolean
    concepts: RecapConcept[]
    masteredCount: number
    weakest?: RecapConcept
    checkpoint?: { correct: number; total: number; pct: number; passed: boolean; bestCorrect: number; bestTotal: number }
    xp: { gain: number; correct: number; corrected: number; test: number; other: number }
    video: { correct: number; corrected: number; missed: number; total: number }
    mistake?: RecapMistake
    mistakes: RecapMistakeRow[]
    newBadges: RecapBadge[]
    nearBadge?: RecapBadge
    review?: RecapReview
    next: RecapNext
}

const pct = (n: number) => Math.round(n * 100)

function badgeInfo(b: Badge, s: State): RecapBadge {
    const ctx = { conceptMastery: s.conceptMastery, quizResults: s.quizResults, streak: s.streak, directorBest: s.directorBest, testBest: bestTestRatio(s.testRecords) }
    const { current, target } = badgeProgress(b, ctx)
    const c = b.criterion
    let rows: RecapBadgeRow[]
    switch (c.type) {
        case 'concept-mastery':
            rows = c.conceptIds.map((id) => ({ label: getConcept(id)?.name ?? id, value: `${pct(s.conceptMastery[id] ?? 0)}% / ${pct(c.threshold)}%` }))
            break
        case 'corrected-mistakes':
            rows = [{ label: 'Câu sửa đúng sau khi sai', value: `${current} / ${c.count}` }]
            break
        case 'streak':
            rows = [{ label: 'Chuỗi ngày học', value: `${current} / ${c.days} ngày` }]
            break
        case 'director-score':
            rows = [{ label: 'Điểm Virtual Director', value: `${s.directorBest} / ${c.minScore}` }]
            break
        case 'test-score':
            rows = [{ label: 'Kiểm tra cuối khóa tốt nhất', value: `${pct(ctx.testBest)}% / ${pct(c.minRatio)}%` }]
            break
        case 'hidden-mission':
            rows = []
            break
    }
    return { badge: b, rows, current, target }
}

/** Gom số liệu tổng kết của một chặng; `lessons` là các bài của khóa mà sinh viên thấy (đã áp chỉnh sửa của giảng viên). */
export function buildRecap(lesson: Lesson, visible: Lesson[], s: State): RecapData | null {
    const course = getCourse(lesson.courseId)
    if (!course) return null
    const passRatio = s.testSets?.[`quick:${lesson.id}`]?.rules.passRatio ?? QUICK_RULES.passRatio
    const order = visible.some((l) => l.id === lesson.id) ? visible : getLessonsOfCourse(course.id)
    const index = Math.max(0, order.findIndex((l) => l.id === lesson.id))
    const firstOpen = order.findIndex((l) => lessonState(l, s.lessonProgress) !== 'done')
    const stages = order.map((l, i) => ({ lesson: l, state: (lessonState(l, s.lessonProgress) === 'done' ? 'done' : i === firstOpen ? 'open' : 'todo') as 'done' | 'open' | 'todo' }))

    const start = s.stageStart[lesson.id]
    const quizOf = lesson.quiz.map((q) => ({ q, r: s.quizResults[q.id] })).filter((x): x is { q: LessonQuizQuestion; r: NonNullable<typeof x.r> } => Boolean(x.r))
    const checkRec = s.checkpoints[lesson.id]
    const wrongInCheckpoint = new Set(checkRec?.last.concepts.filter((c) => !c.correct).map((c) => c.conceptId))

    const concepts: RecapConcept[] = lesson.concepts.map((c) => {
        const now = s.conceptMastery[c.id] ?? 0
        const was = start ? (start.mastery[c.id] ?? 0) : now
        const corrected = quizOf.some((x) => x.q.conceptId === c.id && x.r.outcome === 'corrected')
        const note = wrongInCheckpoint.has(c.id) ? 'Sai câu ở bài kiểm tra cuối chặng' : corrected ? 'Sửa được sau khi sai' : undefined
        return { id: c.id, name: c.name, segment: c.segment, was: Math.min(was, now), now, mastered: now >= UNLOCK_THRESHOLD, note }
    })
    const weakest = [...concepts].filter((c) => !c.mastered).sort((a, b) => a.now - b.now)[0]

    const count = (o: string) => quizOf.filter((x) => x.r.outcome === o).length
    const video = { correct: count('correct'), corrected: count('corrected'), missed: count('missed'), total: lesson.quiz.length }
    const testGain = checkRec ? testXp(checkRec.bestCorrect, checkRec.bestTotal, undefined).total : 0
    const gain = Math.max(0, s.xp - (start?.xp ?? s.xp))
    const parts = { correct: video.correct * QUIZ_XP.correct, corrected: video.corrected * QUIZ_XP.corrected, test: testGain }
    const xp = { gain, ...parts, other: Math.max(0, gain - parts.correct - parts.corrected - parts.test) }

    // Học từ lỗi sai: kể lại một câu sửa được (ưu tiên câu có đủ dữ liệu lỗi sai), nhắc thêm các câu còn lại
    const correctedList = quizOf.filter((x) => x.r.outcome === 'corrected')
    const story = correctedList.find((x) => x.r.firstWrongOption) ?? correctedList[0]
    const mistake: RecapMistake | undefined = story
        ? {
              root: story.q,
              firstWrong: story.r.firstWrongOption,
              fixed: story.q.variants.find((v) => v.id === story.r.fixedByVariantId) ?? story.q.variants[story.r.attempts - 2],
              others: correctedList.filter((x) => x !== story).map((x) => ({ conceptName: getConcept(x.q.conceptId)?.name ?? x.q.conceptId, attempts: x.r.attempts })),
              reviewCount: correctedList.length + video.missed,
          }
        : undefined

    const mistakes: RecapMistakeRow[] = quizOf
        .filter((x): x is typeof x & { r: { outcome: 'corrected' | 'missed' } } => x.r.outcome !== 'correct')
        .map((x) => ({ root: x.q, outcome: x.r.outcome }))
        .sort((a, b) => a.root.pauseAt - b.root.pauseAt)

    // Huy hiệu mới trong chặng và huy hiệu gần đạt nhất
    const startBadges = new Set(start?.badgeIds ?? s.earnedBadgeIds)
    const newBadges = s.earnedBadgeIds.filter((id) => !startBadges.has(id)).map((id) => badges.find((b) => b.id === id)).filter((b): b is Badge => Boolean(b)).map((b) => badgeInfo(b, s))
    const nearBadge = badges
        .filter((b) => !s.earnedBadgeIds.includes(b.id) && !b.hidden)
        .map((b) => badgeInfo(b, s))
        .sort((a, b) => b.current / b.target - a.current / a.target)[0]

    // Ôn tiếp: khái niệm yếu nhất; bài Daily ưu tiên ngày mai = trong 3 bài chưa đọc có lỗ hổng lớn nhất
    let review: RecapReview | undefined
    if (weakest) {
        const tomorrow = dailyArticles.filter((a) => !s.dailyRead[a.id]).sort((a, b) => gapScore(b, s.conceptMastery) - gapScore(a, s.conceptMastery))
        const withConcept = tomorrow.filter((a) => a.conceptIds.includes(weakest.id))
        review = { concept: weakest, daily: withConcept.find((a) => tomorrow.indexOf(a) < DAILY_LIMIT), dailyQueued: withConcept.find((a) => tomorrow.indexOf(a) >= DAILY_LIMIT) }
    }

    // Chặng tiếp theo + khái niệm nâng cao vừa mở nhờ chặng này
    const nextLesson = order[index + 1]
    const before = { ...s.conceptMastery }
    for (const [id, v] of Object.entries(start?.mastery ?? {})) {
        if (v === null) delete before[id]
        else before[id] = v
    }
    const wasUnlocked = new Set(buildSkillTree(before).filter((n) => n.unlocked).map((n) => n.concept.id))
    const unlocked = buildSkillTree(s.conceptMastery)
        .filter((n) => n.unlocked && !wasUnlocked.has(n.concept.id) && !lesson.concepts.some((c) => c.id === n.concept.id))
        .map((n) => ({ name: n.concept.name, because: n.concept.prerequisiteIds.map((id) => getConcept(id)?.name).filter(Boolean).join(', ') }))
    const next: RecapNext = nextLesson
        ? { label: `Bắt đầu chặng ${index + 2}`, to: `/lesson/${nextLesson.id}`, lesson: nextLesson, unlocked }
        : { label: 'Làm bài kiểm tra cuối khóa', to: `/test/${course.id}`, unlocked }

    return {
        course,
        stages,
        index,
        lesson,
        completed: s.lessonProgress[lesson.id]?.completed ?? false,
        concepts,
        masteredCount: concepts.filter((c) => c.mastered).length,
        weakest,
        checkpoint: checkRec ? { correct: checkRec.last.correct, total: checkRec.last.total, pct: pct(checkRec.last.correct / checkRec.last.total), passed: checkRec.last.correct / checkRec.last.total >= passRatio, bestCorrect: checkRec.bestCorrect, bestTotal: checkRec.bestTotal } : undefined,
        xp,
        video,
        mistake,
        mistakes,
        newBadges,
        nearBadge,
        review,
        next,
    }
}
