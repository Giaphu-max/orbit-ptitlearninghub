import { QUICK_REACH } from '@/data/class-teaching'
import type { ClassStats, Lesson } from '@/data/types'
import { pct, questionPicks, type LessonReview } from '@/lib/teacher'
import { passCount, QUICK_RULES, quickSetFor, resolveSet, sourcedBank, type TestSet } from '@/lib/test-sets'

// Số liệu trang Lớp học (chỉ để xem), dẫn xuất từ cùng ClassStats với Tổng quan và trang Duyệt.

const hash = (s: string) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
}
/** Độ lệch cố định trong [-1, 1] theo khóa. */
const jit = (key: string) => ((hash(key) % 2001) - 1000) / 1000
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Mức sai: đỏ từ 40%, cam nhạt 20–39%, xám dưới 20%. */
export type Level = 'hot' | 'mid' | 'low'
export const levelOf = (wrongPct: number): Level => (wrongPct >= 40 ? 'hot' : wrongPct >= 20 ? 'mid' : 'low')

export interface PickedQuestion {
    id: string
    prompt: string
    options: string[]
    correctIndex: number
    conceptId: string
    total: number
    picks: number[]
    /** % đúng */
    correct: number
}

export interface QuickLesson {
    review: LessonReview
    index: number
    hasData: boolean
    attempted: number
    avgScore: number
    passed: number
    weakest: { conceptId: string; name: string; wrongPct: number } | null
    questions: PickedQuestion[]
}

function synth(key: string, n: number, total: number, correctShare: number, correctIndex: number): number[] {
    const wrongTotal = Math.round(total * (1 - correctShare))
    const w = Array.from({ length: n }, (_, i) => (i === correctIndex ? 0 : 1 + (hash(`${key}:${i}`) % 5)))
    const sum = w.reduce((a, b) => a + b, 0) || 1
    const picks = w.map((x) => Math.round((x / sum) * wrongTotal))
    picks[correctIndex] = Math.max(0, total - picks.reduce((a, b) => a + b, 0))
    return picks
}

/** Kiểm tra nhanh từng bài của khóa, theo thứ tự bài. Bài chưa xuất bản hoặc chưa có số liệu thì hasData = false. */
export function buildQuick(reviews: LessonReview[], stats: ClassStats, testSets: Record<string, TestSet>): QuickLesson[] {
    return reviews.map((review, index) => {
        const lesson: Lesson = review.lesson
        const rows = lesson.concepts.flatMap((c) => {
            const s = stats.concepts[c.id]
            return s && s.answered > 0 ? [{ id: c.id, name: c.name, answered: s.answered, wrongPct: pct(s.wrongFirstTry, s.answered) }] : []
        })
        if (review.state !== 'published' || rows.length === 0) return { review, index, hasData: false, attempted: 0, avgScore: 0, passed: 0, weakest: null, questions: [] }
        const maxAnswered = Math.max(...rows.map((r) => r.answered))
        const attempted = clamp(Math.round(maxAnswered * (QUICK_REACH[lesson.id] ?? 0.9)), 1, stats.classSize)
        const avg = rows.reduce((s, r) => s + (1 - r.wrongPct / 100), 0) / rows.length
        const passed = clamp(Math.round(attempted * clamp(avg - 0.12 + jit(`${lesson.id}:pass`) * 0.04, 0, 1)), 0, attempted)
        const avgScore = Math.round(clamp(avg * 10 + jit(`${lesson.id}:avg`) * 0.3, 0, 10) * 10) / 10
        const weakest = [...rows].sort((a, b) => b.wrongPct - a.wrongPct)[0]
        const set = quickSetFor(lesson, testSets[`quick:${lesson.id}`])
        const questions = resolveSet(set, sourcedBank([lesson])).map((q): PickedQuestion => {
            const real = questionPicks(stats, q.id)
            const c = rows.find((r) => r.id === q.conceptId)
            const share = clamp((c ? 1 - c.wrongPct / 100 : avg) + jit(`${q.id}:q`) * 0.05, 0.05, 0.98)
            const picks = real ?? synth(q.id, q.options.length, attempted, share, q.correctIndex)
            const total = picks.reduce((a, b) => a + b, 0)
            return { id: q.id, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, conceptId: q.conceptId, total, picks, correct: pct(picks[q.correctIndex] ?? 0, total) }
        })
        return { review, index, hasData: true, attempted, avgScore, passed, weakest: { conceptId: weakest.id, name: weakest.name, wrongPct: weakest.wrongPct }, questions }
    })
}

export const quickPassNeed = () => passCount(QUICK_RULES, QUICK_RULES.count)
