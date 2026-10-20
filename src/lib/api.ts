import type { ApiErrorBody, ChatRequest, ChatResponse, GradePhotoRequest, GradePhotoResponse } from './api-types'
import type { EnvironmentRequest, EnvironmentSpec } from './environment'
import { validateEnvironment } from './environment'
import type { ExplainRequest, ExplainResponse } from './quiz'

// Gọi các hàm serverless trong api/. Trình duyệt không bao giờ gọi Gemini trực tiếp.

const TIMEOUT_MS = 45_000
// Chấm ảnh gửi ảnh lên và chạy model suy luận hình ảnh nên cho chờ lâu hơn
const GRADE_TIMEOUT_MS = 100_000

export class ApiRequestError extends Error {}

async function postJson<T>(path: string, body: unknown, opts: { timeoutMs?: number; timeoutMessage?: string; fallbackMessage?: string } = {}): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS)
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
            throw new ApiRequestError(opts.timeoutMessage ?? 'Trợ giảng AI phản hồi lâu quá. Bạn thử hỏi lại nhé.')
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
        : (opts.fallbackMessage ?? 'Trợ giảng AI chưa trả lời được lúc này. Bạn thử lại nhé.')
    throw new ApiRequestError(message)
}

export const askTutor = (req: ChatRequest) => postJson<ChatResponse>('/api/chat', req)
export const explainAnswer = (req: ExplainRequest) => postJson<ExplainResponse>('/api/explain', req)
export const gradePhoto = (req: GradePhotoRequest) => postJson<GradePhotoResponse>('/api/grade-photo', req, {
        timeoutMs: GRADE_TIMEOUT_MS,
        timeoutMessage: 'AI chấm ảnh lâu quá. Bạn bấm chụp lại nhé.',
        fallbackMessage: 'AI chưa chấm được ảnh lúc này. Bạn thử lại nhé.',
    })

/** Prompt-to-Environment: mô tả ánh sáng → thông số đèn. JSON được kiểm tra lại ở trình duyệt trước khi trả về. */
export async function generateEnvironment(req: EnvironmentRequest): Promise<EnvironmentSpec> {
    const raw = await postJson<unknown>('/api/environment', req, {
        timeoutMs: 60_000,
        timeoutMessage: 'AI nghĩ lâu quá, cảnh được giữ nguyên. Bạn thử lại nhé.',
        fallbackMessage: 'AI chưa tạo được ánh sáng lúc này, cảnh được giữ nguyên. Bạn thử lại nhé.',
    })
    try {
        return validateEnvironment(raw)
    } catch (err) {
        console.error(err)
        throw new ApiRequestError('AI trả về thông số ánh sáng chưa hợp lệ, cảnh được giữ nguyên. Bạn thử mô tả lại nhé.')
    }
}
