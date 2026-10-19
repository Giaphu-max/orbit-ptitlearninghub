import { ApiError, GoogleGenAI } from '@google/genai'

// Dùng chung cho các hàm trong api/. Thư mục bắt đầu bằng "_" nên Vercel
// không coi đây là một endpoint.
// GEMINI_API_KEY chỉ đọc ở server; không bao giờ đặt tiền tố VITE_.

const DEFAULT_MODEL = 'gemini-3.8-flash'
const DEFAULT_FALLBACK_MODELS = 'gemini-3.5-flash,gemini-3.5-flash-lite'

let client: GoogleGenAI | null = null

export interface GeminiSetup {
    ai: GoogleGenAI
    model: string
    /** Các model dự phòng, thử lần lượt khi model trước quá tải */
    fallbackModels: string[]
}

export function getGemini(): GeminiSetup {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new HttpError(500, 'Máy chủ chưa được cấu hình khóa AI. Vui lòng báo nhóm phát triển.')
    client ??= new GoogleGenAI({ apiKey })
    return {
        ai: client,
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        fallbackModels: (process.env.GEMINI_FALLBACK_MODELS || DEFAULT_FALLBACK_MODELS)
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean),
    }
}

/**
 * Gọi model chính; nếu Gemini báo quá tải tạm thời (503, hay gặp giờ cao điểm) hoặc
 * hết hạn mức (429; gói miễn phí tính hạn mức riêng cho từng model, ví dụ 20 lượt/ngày)
 * thì thử lần lượt các model dự phòng để buổi demo không bị gián đoạn.
 */
export async function withFallback<T>(setup: GeminiSetup, call: (model: string) => Promise<T>): Promise<T> {
    const models = [...new Set([setup.model, ...setup.fallbackModels])]
    for (let i = 0; ; i++) {
        try {
            return await call(models[i])
        } catch (err) {
            const retryable = err instanceof ApiError && (err.status === 503 || err.status === 429)
            if (!retryable || i === models.length - 1) throw err
            const reason = err.status === 429 ? 'hết hạn mức' : 'quá tải'
            console.warn(`[api] ${models[i]} ${reason}, chuyển sang ${models[i + 1]}`)
        }
    }
}

/** Lỗi đã có thông báo tiếng Việt, an toàn để trả thẳng cho trình duyệt. */
export class HttpError extends Error {
    readonly status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
}

/** Chuyển mọi lỗi thành { error } thân thiện; chi tiết kỹ thuật chỉ ghi log server. */
export function errorResponse(err: unknown): Response {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    console.error('[api]', err)
    if (err instanceof ApiError) {
        if (err.status === 429) {
            return json({ error: 'Trợ giảng AI đang hết lượt hoặc quá tải. Bạn thử lại sau ít phút nhé.' }, 429)
        }
        if (err.status >= 500) {
            return json({ error: 'Dịch vụ AI đang gián đoạn. Bạn thử lại sau ít phút nhé.' }, 503)
        }
    }
    return json({ error: 'Trợ giảng AI chưa trả lời được lúc này. Bạn thử lại nhé.' }, 500)
}

/** Đọc body JSON có giới hạn kích thước để chặn request quá lớn. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > maxBytes) throw new HttpError(413, 'Nội dung gửi lên quá dài.')
    const text = await request.text()
    if (text.length > maxBytes) throw new HttpError(413, 'Nội dung gửi lên quá dài.')
    try {
        return JSON.parse(text)
    } catch {
        throw new HttpError(400, 'Yêu cầu không hợp lệ.')
    }
}

// Giới hạn tần suất đơn giản theo IP. Chỉ có hiệu lực trong một instance
// serverless (bộ nhớ không chia sẻ), đủ để chặn bấm liên tục khi demo.
const hits = new Map<string, number[]>()

export function rateLimit(request: Request, limit: number, windowMs: number) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const now = Date.now()
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= limit) {
        throw new HttpError(429, 'Bạn hỏi hơi nhanh, đợi một chút rồi hỏi tiếp nhé.')
    }
    recent.push(now)
    hits.set(ip, recent)
}
