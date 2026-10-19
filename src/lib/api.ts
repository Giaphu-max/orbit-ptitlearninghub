import type { ApiErrorBody, ChatRequest, ChatResponse } from './api-types'
import type { ExplainRequest, ExplainResponse } from './quiz'

// Gọi các hàm serverless trong api/. Trình duyệt không bao giờ gọi Gemini trực tiếp.

const TIMEOUT_MS = 45_000

export class ApiRequestError extends Error {}

async function postJson<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
        res = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        })
    } catch (err) {
        if (controller.signal.aborted) {
            throw new ApiRequestError('Trợ giảng AI phản hồi lâu quá. Bạn thử hỏi lại nhé.')
        }
        console.error(err)
        throw new ApiRequestError('Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.')
    } finally {
        clearTimeout(timer)
    }

    const data: unknown = await res.json().catch(() => null)
    if (res.ok && data) return data as T

    if (res.status === 404 && import.meta.env.DEV && !data) {
        throw new ApiRequestError('Chưa có máy chủ AI. Khi phát triển, hãy chạy bằng "vercel dev" thay cho "npm run dev".')
    }
    const message = data && typeof data === 'object' && 'error' in data
        ? (data as ApiErrorBody).error
        : 'Trợ giảng AI chưa trả lời được lúc này. Bạn thử lại nhé.'
    throw new ApiRequestError(message)
}

export const askTutor = (req: ChatRequest) => postJson<ChatResponse>('/api/chat', req)
export const explainAnswer = (req: ExplainRequest) => postJson<ExplainResponse>('/api/explain', req)
