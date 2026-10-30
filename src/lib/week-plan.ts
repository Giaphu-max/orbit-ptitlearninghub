import { daysBetween, localDate } from '@/lib/gamification'
import { primaryCourse, type CourseSummary } from '@/lib/course-map'
import type { StreakState } from '@/lib/gamification'
import { formatTime } from '@/lib/youtube'

export interface PlanTask {
    id: string
    title: string
    sub: string
    /** YYYY-MM-DD */
    date: string
    href: string
}
export type DayDot = 'done' | 'soon' | 'late' | null
export interface WeekDay {
    date: string
    label: string
    day: number
    today: boolean
    dot: DayDot
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const weekdayLabel = (d: Date) => WEEKDAY[d.getDay()]
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const fmtShort = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

/**
 * Lộ trình đề xuất (tối đa 3 việc, mỗi việc cách 2 ngày kể từ hôm nay): bài đang học → test cuối chặng của bài đó → chặng kế
 * (hết bài thì test cuối chương). Tính theo ngày hiện tại và tiến độ trong store, không lưu.
 */
export function buildPlan(summaries: CourseSummary[], progress: Record<string, { lastPositionSec: number; completed: boolean }>, now = new Date()): PlanTask[] {
    const main = primaryCourse(summaries)
    if (!main) return []
    const ls = main.lessons
    const idx = main.curIndex >= 0 ? main.curIndex : 0
    const cur = ls[idx]
    if (!cur) return []
    const pos = progress[cur.id]?.lastPositionSec ?? 0
    const resuming = pos > 0 && !progress[cur.id]?.completed
    const tasks: PlanTask[] = [
        {
            id: `lesson-${cur.id}`,
            title: cur.title,
            sub: resuming ? `Học tiếp từ ${formatTime(pos)} · còn ${Math.max(1, Math.ceil((cur.durationSec - pos) / 60))} phút` : `Bắt đầu chặng ${String(idx + 1).padStart(2, '0')} · ${Math.ceil(cur.durationSec / 60)} phút`,
            date: localDate(now),
            href: `/lesson/${cur.id}${resuming ? `?t=${Math.floor(pos)}` : ''}`,
        },
        { id: `checkpoint-${cur.id}`, title: `Test cuối chặng ${String(idx + 1).padStart(2, '0')}`, sub: 'Kiểm tra nhanh cuối bài', date: localDate(addDays(now, 2)), href: `/checkpoint/${cur.id}` },
    ]
    const next = ls[idx + 1]
    tasks.push(
        next
            ? { id: `lesson-${next.id}`, title: next.title, sub: `Chặng ${String(idx + 2).padStart(2, '0')} · ${Math.ceil(next.durationSec / 60)} phút`, date: localDate(addDays(now, 4)), href: `/lesson/${next.id}` }
            : { id: `test-${main.course.id}`, title: 'Test cuối chương', sub: main.course.title, date: localDate(addDays(now, 4)), href: `/test/${main.course.id}` },
    )
    return tasks
}

/**
 * Chậm tiến độ: đang có bài dở dang mà đã ≥ 2 ngày không học (theo ngày học gần nhất của chuỗi). Chưa từng học thì không tính là chậm.
 */
export function isBehind(streak: StreakState, now = new Date()) {
    return Boolean(streak.lastStudyDate) && daysBetween(streak.lastStudyDate as string, localDate(now)) >= 2
}

/** 7 ngày T2–CN của tuần chứa hôm nay. Chấm: xanh = đã học (ngày của chuỗi học), vàng = có việc trong lộ trình, đỏ = quá hạn (các ngày bỏ học khi đang chậm). */
export function buildWeek(plan: PlanTask[], streak: StreakState, now = new Date()): WeekDay[] {
    const today = localDate(now)
    const mondayOffset = (now.getDay() + 6) % 7
    const studied = new Set<string>()
    if (streak.lastStudyDate && streak.count > 0) {
        const [y, m, d] = streak.lastStudyDate.split('-').map(Number)
        for (let i = 0; i < streak.count; i++) studied.add(localDate(new Date(y, m - 1, d - i)))
    }
    const behind = isBehind(streak, now)
    return Array.from({ length: 7 }, (_, i) => {
        const dt = addDays(now, i - mondayOffset)
        const date = localDate(dt)
        let dot: DayDot = null
        if (studied.has(date)) dot = 'done'
        else if (behind && date < today && streak.lastStudyDate && date > streak.lastStudyDate) dot = 'late'
        else if (plan.some((t) => t.date === date)) dot = 'soon'
        return { date, label: weekdayLabel(dt), day: dt.getDate(), today: date === today, dot }
    })
}

/** Nhãn cột ngày của danh sách việc: "Hôm nay" hoặc "T4 29/10". */
export function planDateLabel(date: string, now = new Date()) {
    if (date === localDate(now)) return 'Hôm nay'
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return `${weekdayLabel(dt)} ${fmtShort(dt)}`
}

/** Khoảng ngày của tuần, ví dụ "27/10 – 02/11" */
export function weekRange(week: WeekDay[]) {
    const f = (s: string) => s.slice(8) + '/' + s.slice(5, 7)
    return `${f(week[0].date)} – ${f(week[6].date)}`
}
