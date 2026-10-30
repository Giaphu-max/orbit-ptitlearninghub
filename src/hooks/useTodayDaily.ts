import { useState } from 'react'
import { getConcept } from '@/data'
import type { DailyArticle } from '@/data/types'
import { dailyFor, dailyXp, EXTRA_READ_COST, localDate, MISSIONS } from '@/lib/gamification'
import { DAILY_LIMIT, dailyPool, extraReadsToday, gapScore, todaysDaily } from '@/lib/next-step'
import { useOrbitStore, xpBalance } from '@/store/useOrbitStore'

/** Bài ôn tập hôm nay + trạng thái; dùng chung cho chương Hôm nay ở trang chủ và trang /today. */
export function useTodayDaily() {
    const lastRead = useOrbitStore((s) => s.dailyRead)
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const unlocks = useOrbitStore((s) => s.dailyUnlocks)
    const balance = useOrbitStore((s) => xpBalance(s))
    const unlockExtra = useOrbitStore((s) => s.unlockExtraRead)
    const dailyRaw = useOrbitStore((s) => s.daily)
    useOrbitStore((s) => s.lessonProgress)

    // 3 bài miễn phí mỗi ngày + bài mua thêm; hết bài chưa đọc thì bổ sung bài ôn lại (đã đọc ở ngày trước)
    const today = localDate()
    const extra = extraReadsToday(unlocks)
    const articles = todaysDaily(lastRead, mastery, extra)
    // read = chỉ các bài đã hoàn thành HÔM NAY; lastRead giữ ngày đọc gần nhất (để gắn nhãn Ôn lại)
    const read = Object.fromEntries(Object.entries(lastRead).filter(([, d]) => d === today))
    const isReview = (a: DailyArticle) => Boolean(lastRead[a.id]) && lastRead[a.id] !== today
    const readCount = articles.filter((a) => read[a.id]).length
    const priority = [...articles.filter((a) => !read[a.id])].sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery))[0]
    // Bài kế tiếp đang khóa: đã đọc hết các bài đang mở mà kho còn bài chưa đọc
    const pool = dailyPool(lastRead, mastery)
    const locked = priority ? undefined : pool[articles.length]
    // Số bài còn có thể mở thêm bằng XP hôm nay
    const remaining = Math.max(0, pool.length - articles.length)
    const allDone = articles.length > 0 && !priority && !locked
    const canAfford = balance >= EXTRA_READ_COST

    const daily = dailyFor(dailyRaw)
    const missionsDone = MISSIONS.filter((m) => m.progress(daily) >= m.target).length

    /** Lý do gợi ý bài: khái niệm còn yếu nhất của bài */
    const reasonFor = (a: DailyArticle, lead: string) => {
        const weakest = [...a.conceptIds].sort((x, y) => (mastery[x] ?? 0.5) - (mastery[y] ?? 0.5))[0]
        const name = getConcept(weakest)?.name
        const m = mastery[weakest]
        if (!name) return lead
        return m === undefined ? `${lead} · bạn chưa làm quiz “${name}”` : `${lead} · bạn mới nắm ${Math.round(m * 100)}% “${name}”`
    }

    /** "Ôn lại · đọc lần trước dd/mm" cho bài đã đọc ở ngày trước */
    const reviewLabel = (a: DailyArticle) => {
        const [, m, d] = (lastRead[a.id] ?? '').split('-')
        return `Ôn lại · đọc lần trước ${d}/${m}`
    }
    /** Số XP của một bài: ôn lại chỉ một nửa */
    const xpFor = (a: DailyArticle) => dailyXp(lastRead[a.id] === today ? undefined : lastRead[a.id])

    /** Dòng ghi chú dưới tiêu đề thẻ nhỏ */
    const noteFor = (a: DailyArticle) => {
        const xp = xpFor(a)
        if (read[a.id]) return 'Đã đọc'
        return isReview(a) ? `${reviewLabel(a)} · +${xp} XP` : `${a.readingMinutes} phút · +${xp} XP`
    }

    return { articles, read, mastery, readCount, priority, locked, allDone, canAfford, balance, extra, remaining, poolSize: pool.length, missionsDone, missionsTotal: MISSIONS.length, reasonFor, noteFor, isReview, reviewLabel, xpFor, unlockExtra, limit: Math.min(DAILY_LIMIT, pool.length) }
}

/**
 * Mở khóa bài thêm với hiệu ứng: XP trừ ngay lúc bấm (pill nhả "−60"), thẻ khóa giữ nguyên bài cũ,
 * ổ khóa mở và thẻ mờ đi ~0,6s rồi mới chuyển sang thẻ đỏ. Giảm chuyển động: đổi ngay.
 */
export function useUnlockAnimation(locked: DailyArticle | undefined, unlock: () => boolean) {
    const [frozen, setFrozen] = useState<DailyArticle | null>(null)
    const run = () => {
        if (frozen || !locked) return
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (!unlock() || calm) return
        setFrozen(locked)
        window.setTimeout(() => setFrozen(null), 600)
    }
    return { opening: frozen, run }
}
