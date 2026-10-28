import { useEffect, useState } from 'react'
import { getJourneyChapter } from '@/lib/scroll'
import { CENTER, GAP, MIN_COL } from '@/lib/hero-balance'
import { page } from '@/lib/page-metrics'

/**
 * `?balance`: đường gióng kiểm tra cân bố cục bằng mắt (mockup ptit-hero-layout, phương án C): mép trên/dưới nhóm chữ,
 * hai lề đối xứng, trục giữa, tâm thị giác (48% vùng tự do), khung đích của vật thể và khoảng cách tối thiểu tới chữ. Mặc định tắt.
 */
export function BalanceGuides() {
    const [, tick] = useState(0)
    useEffect(() => {
        const id = window.setInterval(() => tick((n) => n + 1), 250)
        return () => window.clearInterval(id)
    }, [])
    const i = Math.min(3, getJourneyChapter())
    const t = page.text[i]
    const b = page.body[i]
    const vw = window.innerWidth
    const { top, bottom } = page.safe
    const cy = top + CENTER * (bottom - top)
    const line = 'absolute bg-brand-600/60'
    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] font-mono text-[10px] text-brand-ink">
            <div className={`${line} left-0 h-px w-full opacity-40`} style={{ top }} />
            <div className={`${line} left-0 h-px w-full opacity-40`} style={{ top: bottom }} />
            <div className={`${line} top-0 h-full w-px opacity-40`} style={{ left: vw / 2 }} />
            <div className="absolute left-0 h-px w-full border-t border-dashed border-brand-600" style={{ top: cy }} />
            <span className="absolute left-2" style={{ top: cy - 14 }}>tâm thị giác {Math.round(CENTER * 100)}%</span>
            {t && b && (
                <>
                    <div className="absolute border border-dashed border-brand-600" style={{ left: t.x0, top: t.y0, width: t.x1 - t.x0, height: t.y1 - t.y0 }} />
                    <div className={`${line} top-0 h-full w-px`} style={{ left: t.x0 }} />
                    <div className={`${line} top-0 h-full w-px`} style={{ left: vw - t.x0 }} />
                    <div className={`${line} left-0 h-px w-full`} style={{ top: t.y0 }} />
                    <div className={`${line} left-0 h-px w-full`} style={{ top: t.y1 }} />
                    <div className="absolute border-2 border-brand-600" style={{ left: b.x0, top: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 }} />
                    <div className="absolute h-px bg-brand-600" style={{ left: t.x1, top: cy + 20, width: b.x0 - t.x1 }} />
                    <span className="absolute" style={{ left: t.x1 + 4, top: cy + 24 }}>
                        {Math.round(b.x0 - t.x1)}px (≥ {MIN_COL})
                    </span>
                    <span className="absolute" style={{ left: b.x0 + 4, top: b.y0 + 4 }}>
                        thân · cách chữ {GAP}px mỗi đầu
                    </span>
                </>
            )}
        </div>
    )
}
