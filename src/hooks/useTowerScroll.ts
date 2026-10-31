import { useEffect, type RefObject } from 'react'
import { addFrame } from '@/lib/frame-loop'
import { setChapterScroller, setJourneyChapter } from '@/lib/scroll'
import { setTowerDusk, tower, TOWER_PAGES } from '@/lib/tower'

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Chương cũ (top, daily, courses, studio) → trang mới: Ôn tập là trang 3, Học phần là trang 2 */
const CHAPTER_TO_PAGE = [0, 2, 1, 3]
/** Tốc độ làm mượt p (mũ, /giây): 1 - exp(-5/60) ≈ 0.08 mỗi khung ở 60fps */
const SMOOTH = 5

/**
 * Trang chủ 5 trang: cuộn tài liệu bắt dính từng trang (scroll-snap trên <html>), p = scrollY / innerHeight làm mượt theo thời gian.
 * Mỗi khi trang đổi chỉ ghi data-page lên gốc (CSS lo hiện/ẩn chữ và thẻ), không setState. Giảm chuyển động: p nhảy thẳng tới trang,
 * cảnh đổi bằng một lớp phủ mờ dần.
 * `?p=0..4` (dev): cuộn tới trang đó khi mở.
 */
export function useTowerScroll(rootRef: RefObject<HTMLElement | null>, veilRef: RefObject<HTMLElement | null>, reduce: boolean) {
    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        const html = document.documentElement
        html.classList.add('tower-home')
        setJourneyChapter(0)

        const read = () => {
            tower.tp = clamp(window.scrollY / tower.vh, 0, TOWER_PAGES - 1)
        }
        const size = () => {
            tower.vh = window.innerHeight || 1
            read()
        }
        const move = (e: PointerEvent) => {
            tower.mx = e.clientX / window.innerWidth - 0.5
            tower.my = e.clientY / tower.vh - 0.5
        }
        size()
        const start = Number(new URLSearchParams(window.location.search).get('p'))
        if (Number.isFinite(start) && start > 0) window.scrollTo(0, clamp(Math.round(start), 0, TOWER_PAGES - 1) * tower.vh)
        read()
        tower.p = tower.tp
        tower.page = -1

        let prev = 0
        const stop = addFrame((t) => {
            const dt = Math.min(prev ? (t - prev) / 1000 : 0.016, 0.1)
            prev = t
            if (reduce) tower.p = Math.round(tower.tp)
            else {
                tower.p += (tower.tp - tower.p) * (1 - Math.exp(-dt * SMOOTH))
                if (Math.abs(tower.tp - tower.p) < 0.0005) tower.p = tower.tp
            }
            const page = Math.round(tower.p)
            if (page === tower.page) return
            const first = tower.page < 0
            tower.page = page
            root.dataset.page = String(page)
            setTowerDusk(page === 3)
            if (reduce && !first) veilRef.current?.animate([{ opacity: 0.92 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' })
        }, 0)

        setChapterScroller((index) => {
            const page = CHAPTER_TO_PAGE[index] ?? 0
            window.scrollTo({ top: page * tower.vh, behavior: reduce ? 'auto' : 'smooth' })
        })
        window.addEventListener('scroll', read, { passive: true })
        window.addEventListener('resize', size)
        window.addEventListener('pointermove', move, { passive: true })
        return () => {
            stop()
            window.removeEventListener('scroll', read)
            window.removeEventListener('resize', size)
            window.removeEventListener('pointermove', move)
            setChapterScroller(null)
            setJourneyChapter(-1)
            setTowerDusk(false)
            html.classList.remove('tower-home')
        }
    }, [rootRef, veilRef, reduce])
}
