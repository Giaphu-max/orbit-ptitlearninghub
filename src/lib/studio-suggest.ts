import type { FixSuggestion, SuggestParam } from '@/lib/api-types'
import type { CameraSetup } from '@/lib/studio-setup'

// Áp một gợi ý khắc phục của AI ("Thử") vào thông số studio, kẹp theo biên độ của thanh trượt tương ứng.

const RANGE: Record<SuggestParam, [number, number]> = {
    key: [0, 100],
    fill: [0, 100],
    rim: [0, 100],
    keyAngleDeg: [-90, 90],
    focalLengthMm: [24, 135],
    azimuthDeg: [-80, 80],
    elevationDeg: [-5, 40],
    shiftX: [-0.4, 0.4],
    shiftY: [-0.4, 0.4],
}

const LABEL: Record<SuggestParam, { name: string; unit: string; scale: number }> = {
    key: { name: 'Đèn chính', unit: '%', scale: 1 },
    fill: { name: 'Đèn phụ', unit: '%', scale: 1 },
    rim: { name: 'Đèn viền', unit: '%', scale: 1 },
    keyAngleDeg: { name: 'Góc đèn chính', unit: '°', scale: 1 },
    focalLengthMm: { name: 'Tiêu cự', unit: 'mm', scale: 1 },
    azimuthDeg: { name: 'Xoay', unit: '°', scale: 1 },
    elevationDeg: { name: 'Độ cao máy', unit: '°', scale: 1 },
    shiftX: { name: 'Dịch khung ngang', unit: '%', scale: 100 },
    shiftY: { name: 'Dịch khung dọc', unit: '%', scale: 100 },
}

export function applyChange(setup: CameraSetup, change: NonNullable<FixSuggestion['change']>): CameraSetup {
    const [min, max] = RANGE[change.param]
    const raw = setup[change.param] + change.delta
    const step = min < 0 && max <= 1 ? 100 : 1
    return { ...setup, [change.param]: Math.round(Math.min(max, Math.max(min, raw)) * step) / step }
}

/** Nhãn ngắn của thay đổi, vd "Đèn phụ +15%". */
export function describeChange(change: NonNullable<FixSuggestion['change']>): string {
    const { name, unit, scale } = LABEL[change.param]
    const v = Math.round(change.delta * scale)
    return `${name} ${v > 0 ? '+' : ''}${v}${unit}`
}
