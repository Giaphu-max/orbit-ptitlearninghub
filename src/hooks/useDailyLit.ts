import { useEffect, useRef } from 'react'
import { dailyArticles } from '@/data'
import { A2_TIERS, FINALE_STEP_MS, type DailyLit } from '@/lib/daily-lit'
import { announceRewards, LIGHTS_XP, localDate } from '@/lib/gamification'
import { tower } from '@/lib/tower'
import { useOrbitStore } from '@/store/useOrbitStore'

/** Trang Ôn tập (trang 3, p = 2): nhiệm vụ ẩn "Tòa A2 sáng đèn" chỉ phát khi trang này đang ở trên màn */
const DAILY_PAGE = 2

/**
 * Trạng thái đèn tầng tòa A2 cho cảnh 3D: số bài Daily đã đọc hôm nay = số tầng sáng từ dưới lên. Ghi ref, không render lại cảnh.
 * Cũng lo nhiệm vụ ẩn: đọc hết mọi bài Daily trong ngày (lần đầu) thì khi trang Ôn tập hiện ra, các tầng còn lại sáng nối tiếp,
 * đồng hồ phát sáng, ~1s sau hiện màn thưởng +100 XP kèm huy hiệu. Không báo trước ở đâu.
 */
export function useDailyLit(reduce: boolean) {
    const read = useOrbitStore((s) => s.dailyRead)
    const lightsDay = useOrbitStore((s) => s.lightsDay)
    const ref = useRef<DailyLit>({ read: 0, finale: false, finaleAt: 0 })
    const playing = useRef(false)
    const today = localDate()
    const readToday = dailyArticles.filter((a) => read[a.id] === today).length
    const claimed = lightsDay === today
    const pending = !claimed && readToday > 0 && dailyArticles.every((a) => read[a.id] === today)
    // Ghi trong render (đồng bộ) để cảnh vừa dựng đã có giá trị đúng; ref không gây render
    ref.current.read = readToday
    if (!playing.current) {
        ref.current.finale = claimed
        ref.current.finaleAt = 0
    }

    useEffect(() => {
        if (!pending) return
        const lit = ref.current
        let timer = 0
        const poll = window.setInterval(() => {
            if (playing.current || Math.abs(tower.p - DAILY_PAGE) > 0.2) return
            window.clearInterval(poll)
            playing.current = true
            lit.finale = true
            lit.finaleAt = reduce ? 0 : performance.now()
            const rows = Math.max(0, A2_TIERS - readToday)
            const wait = (reduce ? 0 : rows * FINALE_STEP_MS + 700) + 1000
            timer = window.setTimeout(() => {
                const before = useOrbitStore.getState()
                if (before.claimLights() === 0) {
                    playing.current = false
                    return
                }
                const after = useOrbitStore.getState()
                announceRewards(
                    before,
                    after,
                    { context: 'NHIỆM VỤ ẨN', headline: 'Tòa A2 sáng đèn', rows: [{ label: 'Thắp sáng mọi tầng của tòa A2', xp: LIGHTS_XP }] },
                    { source: 'mission', next: { label: 'Tuyệt', to: '/' } },
                )
                playing.current = false
            }, wait)
        }, 250)
        return () => {
            window.clearInterval(poll)
            window.clearTimeout(timer)
            // Rời trang giữa chừng: lần sau vào lại sẽ phát lại từ đầu
            if (playing.current) {
                playing.current = false
                lit.finale = false
                lit.finaleAt = 0
            }
        }
    }, [pending, readToday, reduce])
    return ref
}
