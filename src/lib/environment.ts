// Prompt-to-Environment: hợp đồng dữ liệu và bộ kiểm tra JSON do AI trả về.
// Dùng chung cho api/environment.ts (kiểm tra ở server) và trình duyệt (kiểm tra lần nữa trước khi áp dụng).
// Đuôi .js trong import ở file khác để chạy được dạng ES module trên Node; file này không import gì.

export const ENV_LIMITS = {
    promptMaxChars: 200,
    explanationMaxChars: 500,
} as const

/** Một đèn: vị trí tính theo góc quanh chủ thể, so với trục máy ảnh. */
export interface EnvLight {
    /** Góc ngang so với trục máy ảnh (độ): 0 = cùng phía máy, âm = lệch trái, ±180 = phía sau chủ thể */
    azimuthDeg: number
    /** Độ cao so với chủ thể (độ): 0 = ngang tầm, 80 = gần như trên đỉnh đầu */
    elevationDeg: number
    /** Cường độ 0–100, cùng thang với thanh trượt (70 = đèn chính chuẩn) */
    intensity: number
    /** Màu đèn, dạng #RRGGBB */
    color: string
}

export interface EnvironmentSpec {
    key: EnvLight
    fill: EnvLight
    rim: EnvLight
    /** Màu phông và nền cảnh, #RRGGBB */
    background: string
    /** Độ mờ sương 0 (trong) – 1 (dày) */
    fogDensity: number
    /** 1–2 câu giải thích theo lý thuyết nhiếp ảnh */
    explanation: string
}

export interface EnvironmentRequest {
    /** Mô tả ánh sáng bằng tiếng Việt */
    prompt: string
}

export type EnvironmentResponse = EnvironmentSpec

/** Cảnh mặc định của studio (khớp DEFAULT_SETUP và bảng màu STUDIO). */
export const DEFAULT_ENVIRONMENT: Omit<EnvironmentSpec, 'explanation'> = {
    key: { azimuthDeg: -40, elevationDeg: 28, intensity: 70, color: '#FFE2C2' },
    fill: { azimuthDeg: 40, elevationDeg: 10, intensity: 30, color: '#CFE0FF' },
    rim: { azimuthDeg: 150, elevationDeg: 25, intensity: 0, color: '#FFB3A8' },
    background: '#B9B0A8',
    fogDensity: 0,
}

const HEX = /^#[0-9a-fA-F]{6}$/

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function num(v: unknown, label: string, min: number, max: number): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Thiếu hoặc sai kiểu số: ${label}`)
    return clamp(v, min, max)
}

function color(v: unknown, label: string): string {
    if (typeof v !== 'string' || !HEX.test(v.trim())) throw new Error(`Màu không hợp lệ: ${label}`)
    return v.trim().toUpperCase()
}

function obj(v: unknown, label: string): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`Thiếu đối tượng: ${label}`)
    return v as Record<string, unknown>
}

function light(v: unknown, label: string, azMin: number, azMax: number, elMax: number): EnvLight {
    const o = obj(v, label)
    return {
        azimuthDeg: num(o.azimuthDeg, `${label}.azimuthDeg`, azMin, azMax),
        elevationDeg: num(o.elevationDeg, `${label}.elevationDeg`, 0, elMax),
        intensity: num(o.intensity, `${label}.intensity`, 0, 100),
        color: color(o.color, `${label}.color`),
    }
}

/**
 * Kiểm tra JSON thô: phải đủ trường, đúng kiểu, màu đúng #RRGGBB; số ngoài khoảng được kẹp về biên.
 * Ném Error nếu sai cấu trúc, khi đó không được áp dụng gì vào cảnh.
 */
export function validateEnvironment(raw: unknown): EnvironmentSpec {
    const o = obj(raw, 'environment')
    const explanation = typeof o.explanation === 'string' ? o.explanation.trim().slice(0, ENV_LIMITS.explanationMaxChars) : ''
    if (!explanation) throw new Error('Thiếu lời giải thích')
    const rim = light(o.rim, 'rim', -180, 180, 80)
    // Đèn viền phải ở phía sau chủ thể (từ ±90° trở ra) mới tách được chủ thể khỏi phông
    if (Math.abs(rim.azimuthDeg) < 90) rim.azimuthDeg = rim.azimuthDeg < 0 ? -90 : 90
    return {
        key: light(o.key, 'key', -90, 90, 80),
        fill: light(o.fill, 'fill', -90, 90, 60),
        rim,
        background: color(o.background, 'background'),
        fogDensity: num(o.fogDensity, 'fogDensity', 0, 1),
        explanation,
    }
}
