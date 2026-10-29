import { classStats } from '@/data'
import { TEACHER_CLASSES } from '@/data/classes'
import type { ClassStats } from '@/data/types'

// Số liệu mẫu của từng lớp. Lớp đầu tiên dùng đúng class-stats.json (32 sinh viên);
// các lớp còn lại co giãn theo sĩ số kèm độ lệch cố định theo mã lớp, để đổi lớp thì số liệu đổi nhưng không ngẫu nhiên giữa các lần mở.

const hash = (s: string) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** Độ lệch cố định trong [-spread, spread] theo khóa. */
const jitter = (key: string, spread: number) => (hash(key) % (2 * spread + 1)) - spread

function derive(id: string, size: number): ClassStats {
    const r = size / classStats.classSize
    const concepts: ClassStats['concepts'] = {}
    for (const [k, c] of Object.entries(classStats.concepts)) {
        const answered = clamp(Math.round(c.answered * r), 1, size)
        const wrongFirstTry = clamp(Math.round(c.wrongFirstTry * r) + jitter(`${id}:${k}`, 1), 0, answered)
        concepts[k] = { answered, wrongFirstTry, corrected: clamp(Math.round(c.corrected * r), 0, wrongFirstTry) }
    }
    const questions: ClassStats['questions'] = {}
    for (const [k, q] of Object.entries(classStats.questions)) {
        questions[k] = { picks: q.picks.map((p, i) => Math.max(0, Math.round(p * r) + jitter(`${id}:${k}:${i}`, 1))) }
    }
    const tests: ClassStats['tests'] = {}
    for (const [k, t] of Object.entries(classStats.tests)) {
        const attempted = clamp(Math.round(t.attempted * r), 1, size)
        tests[k] = {
            attempted,
            attempts: Math.round(t.attempts * r),
            avgCorrectPct: clamp(t.avgCorrectPct + jitter(`${id}:${k}:avg`, 4), 0, 100),
            passed: clamp(Math.round(t.passed * r) + jitter(`${id}:${k}:pass`, 1), 0, attempted),
            avgDurationSec: t.avgDurationSec + jitter(`${id}:${k}:dur`, 25),
            timedOut: Math.round(t.timedOut * r),
            scoreBuckets: t.scoreBuckets.map((b) => ({ label: b.label, count: Math.max(0, Math.round(b.count * r)) })),
            concepts: Object.fromEntries(Object.entries(t.concepts).map(([ck, c]) => [ck, { asked: Math.round(c.asked * r), correct: clamp(Math.round(c.correct * r) + jitter(`${id}:${ck}`, 1), 0, Math.round(c.asked * r)) }])),
        }
    }
    return { note: classStats.note, classSize: size, concepts, questions, tests }
}

const cache = new Map<string, ClassStats>()

/** Số liệu của một lớp (lớp lạ thì dùng lớp đầu tiên). */
export function getClassStats(classId: string): ClassStats {
    const cls = TEACHER_CLASSES.find((c) => c.id === classId) ?? TEACHER_CLASSES[0]
    let s = cache.get(cls.id)
    if (!s) {
        s = cls.size === classStats.classSize ? classStats : derive(cls.id, cls.size)
        cache.set(cls.id, s)
    }
    return s
}

/** Số liệu gộp mọi lớp mẫu: cộng số sinh viên, số lượt trả lời và lượt chọn từng đáp án (phần test để nguyên của lớp đầu tiên, Tổng quan không dùng). */
export function getAllStats(): ClassStats {
    const all = TEACHER_CLASSES.map((c) => getClassStats(c.id))
    const base = all[0]
    const concepts: ClassStats['concepts'] = {}
    const questions: ClassStats['questions'] = {}
    for (const s of all) {
        for (const [k, c] of Object.entries(s.concepts)) {
            const cur = concepts[k] ?? { answered: 0, wrongFirstTry: 0, corrected: 0 }
            concepts[k] = { answered: cur.answered + c.answered, wrongFirstTry: cur.wrongFirstTry + c.wrongFirstTry, corrected: cur.corrected + c.corrected }
        }
        for (const [k, q] of Object.entries(s.questions)) {
            const cur = questions[k]?.picks ?? q.picks.map(() => 0)
            questions[k] = { picks: q.picks.map((p, i) => p + (cur[i] ?? 0)) }
        }
    }
    return { note: base.note, classSize: all.reduce((n, s) => n + s.classSize, 0), concepts, questions, tests: base.tests }
}
