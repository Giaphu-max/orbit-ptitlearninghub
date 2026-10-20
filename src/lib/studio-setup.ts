import type { DirectorSetup } from '@/lib/api-types'
import { DEFAULT_ENVIRONMENT, type EnvironmentSpec } from '@/lib/environment'

// Thông số cảnh studio, tách khỏi studio-scene.tsx để trang Studio dùng được mà không kéo three.js vào chunk chính.

/**
 * Phần "diện mạo" ánh sáng ngoài cường độ (thanh trượt): màu, độ cao, vị trí đèn phụ/đèn viền,
 * màu nền, sương. Prompt-to-Environment ghi vào đây; thanh trượt vẫn chỉnh được cường độ và góc đèn chính.
 */
export interface LightLook {
    keyColor: string
    keyElevationDeg: number
    fillColor: string
    /** Góc đèn phụ tính ở phía đối diện đèn chính (dương = đối diện, âm = cùng phía) */
    fillSideDeg: number
    fillElevationDeg: number
    rimColor: string
    /** Lệch của đèn viền so với đường thẳng sau chủ thể, tính theo phía của đèn chính */
    rimSideDeg: number
    rimElevationDeg: number
    background: string
    /** 0–1 */
    fogDensity: number
}

export interface CameraSetup extends DirectorSetup {
    /** Dịch khung theo tỉ lệ khung hình: dương = chủ thể dịch sang phải / lên trên */
    shiftX: number
    shiftY: number
    look: LightLook
}

export const DEFAULT_LOOK: LightLook = {
    keyColor: DEFAULT_ENVIRONMENT.key.color,
    keyElevationDeg: DEFAULT_ENVIRONMENT.key.elevationDeg,
    fillColor: DEFAULT_ENVIRONMENT.fill.color,
    fillSideDeg: DEFAULT_ENVIRONMENT.fill.azimuthDeg,
    fillElevationDeg: DEFAULT_ENVIRONMENT.fill.elevationDeg,
    rimColor: DEFAULT_ENVIRONMENT.rim.color,
    rimSideDeg: 30,
    rimElevationDeg: DEFAULT_ENVIRONMENT.rim.elevationDeg,
    background: DEFAULT_ENVIRONMENT.background,
    fogDensity: DEFAULT_ENVIRONMENT.fogDensity,
}

export const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

/** Áp thông số AI vào setup: cường độ + góc đèn chính vào thanh trượt, phần còn lại vào look. Máy ảnh giữ nguyên. */
export function setupFromEnvironment(base: CameraSetup, env: EnvironmentSpec): CameraSetup {
    const side = Math.sign(env.key.azimuthDeg) || 1
    return {
        ...base,
        key: Math.round(env.key.intensity),
        fill: Math.round(env.fill.intensity),
        rim: Math.round(env.rim.intensity),
        keyAngleDeg: Math.round(env.key.azimuthDeg),
        look: {
            keyColor: env.key.color,
            keyElevationDeg: env.key.elevationDeg,
            fillColor: env.fill.color,
            fillSideDeg: -side * env.fill.azimuthDeg,
            fillElevationDeg: env.fill.elevationDeg,
            rimColor: env.rim.color,
            rimSideDeg: wrap180((env.rim.azimuthDeg - 180) * side),
            rimElevationDeg: env.rim.elevationDeg,
            background: env.background,
            fogDensity: env.fogDensity,
        },
    }
}

export const DEFAULT_SETUP: CameraSetup = {
    focalLengthMm: 50,
    azimuthDeg: 0,
    elevationDeg: 8,
    distance: 6,
    key: 70,
    fill: 30,
    rim: 0,
    keyAngleDeg: -40,
    shiftX: 0,
    shiftY: 0,
    look: DEFAULT_LOOK,
}
