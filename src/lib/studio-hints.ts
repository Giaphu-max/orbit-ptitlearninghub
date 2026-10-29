import { useEffect, useState } from 'react'
import type { CameraSetup } from '@/lib/studio-setup'

// Gợi ý thời gian thực ở tab Đề bài: tính từ thông số cảnh hiện tại, chỉ là tín hiệu mềm, KHÔNG phải điểm chấm.

export type HintLevel = 'unclear' | 'near' | 'good'

export interface StudioHint {
    level: HintLevel
    text: string
}

const ASPECT = 3 / 2
const THIRDS = [1 / 3, 2 / 3] as const

/**
 * Bố cục: chủ thể nằm ở tâm máy (camera nhìn vào chủ thể), dịch khung đưa nó tới (0.5 + shiftX, 0.5 − shiftY) trên màn.
 * Khoảng cách tới giao điểm 1/3 gần nhất, đo theo đơn vị đường chéo khung.
 */
export function compositionHint(setup: Pick<CameraSetup, 'shiftX' | 'shiftY'>): StudioHint {
    const x = 0.5 + setup.shiftX
    const y = 0.5 - setup.shiftY
    let best = Infinity
    for (const tx of THIRDS) for (const ty of THIRDS) best = Math.min(best, Math.hypot((x - tx) * ASPECT, y - ty) / Math.hypot(ASPECT, 1))
    const pct = Math.round(best * 100)
    if (best < 0.06) return { level: 'good', text: 'Chủ thể đang ở sát một giao điểm 1/3.' }
    if (best < 0.18) return { level: 'near', text: `Chủ thể cách giao điểm 1/3 gần nhất khoảng ${pct}% đường chéo khung.` }
    return { level: 'unclear', text: 'Chủ thể đang ở xa các giao điểm 1/3; không bắt buộc, tùy ý đồ của bạn.' }
}

/** Ánh sáng: tỉ lệ đèn chính / đèn phụ và có đèn viền hay không (đọc từ thanh trượt, bỏ qua màu và nền). */
export function lightingHint(setup: Pick<CameraSetup, 'key' | 'fill' | 'rim'>): StudioHint {
    const { key, fill, rim } = setup
    const hasRim = rim >= 20
    const ratio = fill > 0 ? key / fill : Infinity
    const ratioText = Number.isFinite(ratio) ? `đèn chính : đèn phụ ≈ ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)} : 1` : 'chưa có đèn phụ'
    const text = `${ratioText[0].toUpperCase()}${ratioText.slice(1)} · ${hasRim ? 'có đèn viền' : 'không có đèn viền'}.`
    if (key < 25) return { level: 'unclear', text: `Đèn chính còn yếu. ${text}` }
    const balanced = ratio >= 1.2 && ratio <= 6
    if (balanced || (hasRim && key >= 40)) return { level: 'good', text }
    return { level: 'near', text }
}

/** Ý đồ: AI đánh giá khi chấm, không có tín hiệu từ thông số. */
export const intentHint = (): StudioHint => ({ level: 'unclear', text: 'AI sẽ đánh giá khi chấm.' })

/** Gợi ý theo cảnh hiện tại, tính lại sau 150ms kể từ lần đổi thông số cuối (không tính trong useFrame). */
export function useStudioHints(setup: CameraSetup): { composition: StudioHint; lighting: StudioHint } {
    const compute = (s: CameraSetup) => ({ composition: compositionHint(s), lighting: lightingHint(s) })
    const [hints, setHints] = useState(() => compute(setup))
    const { shiftX, shiftY, key, fill, rim } = setup
    useEffect(() => {
        const t = window.setTimeout(() => setHints(compute({ shiftX, shiftY, key, fill, rim } as CameraSetup)), 150)
        return () => window.clearTimeout(t)
    }, [shiftX, shiftY, key, fill, rim])
    return hints
}
