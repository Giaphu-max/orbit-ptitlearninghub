import { getConcept } from '@/data'
import type { DailyArticle } from '@/data/types'
import { DAILY_ARTICLE_XP } from '@/lib/gamification'
import { DAILY_LIMIT, gapScore, todaysDaily } from '@/lib/next-step'
import { useOrbitStore } from '@/store/useOrbitStore'

/** 3 bài Orbit Daily hôm nay + trạng thái; dùng chung cho chương Hôm nay ở trang chủ và trang /today. */
export function useTodayDaily() {
    const read = useOrbitStore((s) => s.dailyRead)
    const mastery = useOrbitStore((s) => s.conceptMastery)

    // 3 bài mỗi ngày (bài đã đọc từ ngày trước không quay lại)
    const articles = todaysDaily(read, mastery)
    const readCount = articles.filter((a) => read[a.id]).length
    const priority = [...articles.filter((a) => !read[a.id])].sort((a, b) => gapScore(b, mastery) - gapScore(a, mastery))[0]
    const allDone = articles.length > 0 && !priority

    /** Dòng ghi chú dưới tiêu đề bài (đã đọc / ưu tiên theo khái niệm yếu nhất / thời lượng) */
    const noteFor = (a: DailyArticle) => {
        if (read[a.id]) return `Đã đọc · +${DAILY_ARTICLE_XP} XP`
        const weakest = [...a.conceptIds].sort((x, y) => (mastery[x] ?? 0.5) - (mastery[y] ?? 0.5))[0]
        const concept = getConcept(weakest)
        const m = mastery[weakest]
        if (a.id === priority?.id && concept) return m === undefined ? `Ưu tiên · bạn chưa làm quiz “${concept.name}”` : `Ưu tiên · “${concept.name}” mới nắm ${Math.round(m * 100)}%`
        return `${a.readingMinutes} phút · +${DAILY_ARTICLE_XP} XP`
    }

    return { articles, read, mastery, readCount, priority, allDone, noteFor, limit: DAILY_LIMIT }
}
