import { ApiError, GoogleGenAI } from '@google/genai'

// Dùng chung cho các hàm trong api/. Thư mục bắt đầu bằng "_" nên Vercel
// không coi đây là một endpoint.
// GEMINI_API_KEY chỉ đọc ở server; không bao giờ đặt tiền tố VITE_.

const DEFAULT_MODEL = 'gemini-3.8-flash'
const DEFAULT_FALLBACK_MODELS = 'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite'

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

/** Model đã trả 429 trong instance này, và thời điểm được thử lại (hạn mức free tính theo ngày nên nghỉ lâu). */
const exhaustedUntil = new Map<string, number>()
const EXHAUSTED_COOLDOWN_MS = 15 * 60_000
/** Model trả lời quá chậm (bị model khác vượt qua hoặc quá hạn): nghỉ ngắn hơn vì thường chỉ là quá tải tạm thời. */
const slowUntil = new Map<string, number>()
const SLOW_COOLDOWN_MS = 3 * 60_000

export interface FallbackOptions {
    /** Thời gian chờ tối đa cho mỗi model (mặc định GEMINI_MODEL_TIMEOUT_MS hoặc 10 giây) */
    perModelTimeoutMs?: number
    /** Tổng thời gian chờ tối đa qua cả chuỗi (mặc định GEMINI_TOTAL_TIMEOUT_MS hoặc 20 giây) */
    totalTimeoutMs?: number
    /** Sau chừng này mà model đang chạy chưa trả lời thì chạy thêm model dự phòng song song (mặc định GEMINI_HEDGE_MS hoặc 3,5 giây) */
    hedgeMs?: number
}

class ModelTimeout extends Error {}

const envMs = (name: string, fallback: number) => {
    const n = Number(process.env[name])
    return Number.isFinite(n) && n > 0 ? n : fallback
}

const isQuota = (err: unknown) => err instanceof ApiError && err.status === 429
const isRetryable = (err: unknown) => err instanceof ModelTimeout || (err instanceof ApiError && (err.status === 503 || err.status === 429))

/** Các model sẽ thử, theo thứ tự ưu tiên: bỏ model đang nghỉ (hết hạn mức / quá chậm); nếu hết thì lấy model sắp hết nghỉ nhất. */
function usableModels(all: string[]): string[] {
    const now = Date.now()
    const until = (m: string) => Math.max(exhaustedUntil.get(m) ?? 0, slowUntil.get(m) ?? 0)
    const ready = all.filter((m) => until(m) <= now)
    return ready.length ? ready : [all.reduce((a, b) => (until(a) <= until(b) ? a : b))]
}

/**
 * Gọi model chính và tự chuyển sang model dự phòng để buổi demo không bị gián đoạn:
 * - 429 (hết hạn mức) hoặc 503: chuyển ngay sang model kế; model 429 được nhớ trong instance và bị bỏ qua 15 phút.
 * - Model chưa trả lời sau vài giây: chạy thêm model kế song song (lấy kết quả nào về trước), model chậm bị bỏ qua 3 phút.
 * - Mỗi model có timeout riêng và cả chuỗi có hạn chót, quá hạn thì báo lỗi thân thiện thay vì treo.
 * Thứ tự model đọc từ GEMINI_MODEL + GEMINI_FALLBACK_MODELS (đổi sang key trả phí chỉ cần sửa biến môi trường).
 */
export function withFallback<T>(setup: GeminiSetup, call: (model: string) => Promise<T>, opts: FallbackOptions = {}): Promise<T> {
    const perModel = opts.perModelTimeoutMs ?? envMs('GEMINI_MODEL_TIMEOUT_MS', 10_000)
    const total = opts.totalTimeoutMs ?? envMs('GEMINI_TOTAL_TIMEOUT_MS', 20_000)
    const hedge = opts.hedgeMs ?? envMs('GEMINI_HEDGE_MS', 3_500)
    const models = usableModels([...new Set([setup.model, ...setup.fallbackModels])])

    return new Promise<T>((resolve, reject) => {
        const startedAt = Date.now()
        const pending = new Set<string>()
        let next = 0
        let settled = false
        let lastErr: unknown
        let hedgeTimer: ReturnType<typeof setTimeout> | undefined
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined

        const finish = (fn: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(hedgeTimer)
            clearTimeout(deadlineTimer)
            fn()
        }

        const launch = () => {
            if (settled || next >= models.length) return
            const model = models[next++]
            pending.add(model)
            clearTimeout(hedgeTimer)
            if (next < models.length) hedgeTimer = setTimeout(launch, hedge)

            const remaining = total - (Date.now() - startedAt)
            let timer: ReturnType<typeof setTimeout>
            const timeout = new Promise<never>((_, rej) => {
                timer = setTimeout(() => rej(new ModelTimeout()), Math.min(perModel, remaining))
            })
            Promise.race([call(model), timeout]).then(
                (value) => {
                    clearTimeout(timer)
                    pending.delete(model)
                    // Model chạy trước mà vẫn chưa trả lời khi model khác đã xong: coi là chậm
                    for (const slow of pending) slowUntil.set(slow, Date.now() + SLOW_COOLDOWN_MS)
                    finish(() => resolve(value))
                },
                (err) => {
                    clearTimeout(timer)
                    pending.delete(model)
                    lastErr = err
                    if (!isRetryable(err)) return finish(() => reject(err))
                    if (isQuota(err)) exhaustedUntil.set(model, Date.now() + EXHAUSTED_COOLDOWN_MS)
                    else if (err instanceof ModelTimeout) slowUntil.set(model, Date.now() + SLOW_COOLDOWN_MS)
                    const reason = isQuota(err) ? 'hết hạn mức' : err instanceof ModelTimeout ? 'trả lời quá chậm' : 'quá tải'
                    console.warn(`[api] ${model} ${reason}${models[next] ? `, thử ${models[next]}` : ''}`)
                    if (next < models.length) launch()
                    else if (pending.size === 0) {
                        finish(() => reject(lastErr instanceof ApiError ? lastErr : new HttpError(504, 'AI đang phản hồi chậm hoặc quá tải. Bạn thử lại sau ít phút nhé.')))
                    }
                },
            )
        }

        deadlineTimer = setTimeout(() => {
            finish(() => reject(lastErr instanceof ApiError && lastErr.status === 429 ? lastErr : new HttpError(504, 'AI đang phản hồi chậm hoặc quá tải. Bạn thử lại sau ít phút nhé.')))
        }, total)
        launch()
    })
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

// Giới hạn tần suất theo IP: tối đa 20 lượt/phút cho tất cả các hàm AI cộng lại (chat, explain, grade-photo, environment).
// Đếm trong bộ nhớ của một instance serverless (không chia sẻ giữa các instance), đủ để chặn bấm liên tục khi demo.
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

export function rateLimit(request: Request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const now = Date.now()
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
    if (recent.length >= RATE_LIMIT) {
        hits.set(ip, recent)
        throw new HttpError(429, 'Bạn thao tác hơi nhanh, đợi một chút rồi thử lại nhé.')
    }
    recent.push(now)
    hits.set(ip, recent)
    // Dọn IP đã im lặng để Map không phình ra
    if (hits.size > 500) for (const [k, v] of hits) if (now - v[v.length - 1] >= RATE_WINDOW_MS) hits.delete(k)
}
