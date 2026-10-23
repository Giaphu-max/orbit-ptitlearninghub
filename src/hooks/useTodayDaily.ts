import { useState } from 'react'
import { dailyArticles, getConcept } from '@/data'
import type { DailyArticle } from '@/data/types'
import { DAILY_ARTICLE_XP, dailyFor, EXTRA_READ_COST, MISSIONS } from '@/lib/gamification'
import { DAILY_LIMIT, extraReadsToday, gapScore, todaysDaily } from '@/lib/next-step'
import { useOrbitStore, xpBalance } from '@/store/useOrbitStore'

/** Bài Orbit Daily hôm nay + trạng thái; dùng chung cho chương Hôm nay ở trang chủ và trang /today. */
export function useTodayDaily() {
    const read = useOrbitStore((s) => s.dailyRead)
    const mastery = useOrbitStore((s) => s.conceptMastery)
    const unlocks = useOrbitStore((s) => s.dailyUnlocks)
    const balance = useOrbitStore((s) => xpBalance(s))
    const unlockExtra = useOrbitStore((s) => s.unlockExtraRead)
    const dailyRaw = useOrbitStore((s) => s.daily)
    useOrbitStore((s) => s.lessonProgress)

    // 3 bài miễn phí mỗi ngày + bài mua thêm (bài đã đọc từ ngày trước không quay lại)
    const extra = extraReadsToday(unlocks)
    const articles = todaysDaily(read, mastery, extra)
    const readCount = articles.filter((a) => read[a.id]).length
    const priority = [...articles.filter((a) => !read[a.id])].sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery))[0]
    // Bài kế tiếp đang khóa: đã đọc hết các bài đang mở mà kho còn bài chưa đọc
    const locked = priority ? undefined : dailyArticles.filter((a) => !read[a.id] && !articles.includes(a)).sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery))[0]
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

    /** Dòng ghi chú dưới tiêu đề thẻ nhỏ */
    const noteFor = (a: DailyArticle) => (read[a.id] ? `Đã đọc · +${DAILY_ARTICLE_XP} XP` : `${a.readingMinutes} phút · +${DAILY_ARTICLE_XP} XP`)

    return { articles, read, mastery, readCount, priority, locked, allDone, canAfford, balance, extra, missionsDone, missionsTotal: MISSIONS.length, reasonFor, noteFor, unlockExtra, limit: DAILY_LIMIT }
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
