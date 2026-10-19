import lessonsJson from '../src/data/lessons.json' with { type: 'json' }
import type { Lesson } from '../src/data/types.js'
import { EXPLAIN_LIMITS, findQuizQuestion, type ExplainResponse } from '../src/lib/quiz.js'
import { HttpError, errorResponse, getGemini, json, rateLimit, readJsonBody, withFallback } from './_lib/gemini.js'
import { ThinkingLevel } from '@google/genai'

// POST /api/explain – giải thích khi sinh viên trả lời sai quiz và chọn đoạn video cần xem lại.
// Câu hỏi, đáp án và transcript đều tra ở server theo id: trình duyệt chỉ gửi
// lựa chọn của sinh viên, nên không thể sửa đề hay chèn nội dung vào prompt.

const lessons = lessonsJson as Lesson[]

const SYSTEM_INSTRUCTION = `Bạn là trợ giảng của PTIT, giúp sinh viên hiểu vì sao mình trả lời sai một câu hỏi trắc nghiệm trong bài giảng video.

Quy tắc:
- Viết tiếng Việt, tối đa khoảng 90 chữ, giọng khích lệ, không chê trách.
- Nói ngắn gọn vì sao lựa chọn của sinh viên chưa đúng (hiểu lầm nằm ở đâu), rồi giải thích đáp án đúng dựa trên lời giảng.
- Chỉ dùng kiến thức trong đoạn transcript được cung cấp. Được dùng **in đậm** cho ý chính.
- reviewStart là giá trị start=… của đoạn transcript chứa kiến thức giải đáp câu hỏi (lấy đúng giá trị đã cho).
- Không nhắc tới số giây trong explanation.`

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        explanation: { type: 'string' },
        reviewStart: { type: 'number' },
    },
    required: ['explanation', 'reviewStart'],
}

function parseRequest(body: unknown) {
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Yêu cầu không hợp lệ.')
    const { lessonId, questionId, chosenIndex } = body as Record<string, unknown>
    if (typeof lessonId !== 'string' || typeof questionId !== 'string') throw new HttpError(400, 'Thiếu câu hỏi.')
    if (typeof chosenIndex !== 'number' || !Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex > EXPLAIN_LIMITS.maxChosenIndex) {
        throw new HttpError(400, 'Lựa chọn không hợp lệ.')
    }
    return { lessonId, questionId, chosenIndex }
}

export async function POST(request: Request): Promise<Response> {
    try {
        rateLimit(request, 20, 60_000)
        const { lessonId, questionId, chosenIndex } = parseRequest(await readJsonBody(request, 2_000))

        const lesson = lessons.find((l) => l.id === lessonId)
        const found = lesson && findQuizQuestion(lesson, questionId)
        if (!lesson || !found) throw new HttpError(404, 'Không tìm thấy câu hỏi này.')
        const { question, root } = found
        if (chosenIndex >= question.options.length) throw new HttpError(400, 'Lựa chọn không hợp lệ.')

        const concept = lesson.concepts.find((c) => c.id === question.conceptId)
        const segment = root.answerSegment ?? concept?.segment ?? { start: root.pauseAt - 60, end: root.pauseAt }
        // Đoạn giảng khái niệm, nới thêm một đoạn trước để AI có ngữ cảnh
        const related = lesson.transcript.filter((s) => s.end > segment.start - 30 && s.start < segment.end)
        const fallbackReview = { start: segment.start, end: segment.end }

        const prompt = [
            `Bài giảng: ${lesson.title}`,
            concept ? `Khái niệm: ${concept.name} – ${concept.definition}` : '',
            `Transcript liên quan:\n${related.map((s) => `[start=${s.start}] ${s.text}`).join('\n')}`,
            `Câu hỏi: ${question.prompt}`,
            `Các lựa chọn:\n${question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}`,
            `Sinh viên chọn: ${String.fromCharCode(65 + chosenIndex)}. ${question.options[chosenIndex]}`,
            `Đáp án đúng: ${String.fromCharCode(65 + question.correctIndex)}. ${question.options[question.correctIndex]}`,
            `Gợi ý giải thích của giảng viên: ${question.explanation}`,
        ]
            .filter(Boolean)
            .join('\n\n')

        const gemini = getGemini()
        const result = await withFallback(gemini, (model) =>
            gemini.ai.models.generateContent({
                model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    responseMimeType: 'application/json',
                    responseJsonSchema: RESPONSE_SCHEMA,
                    temperature: 0.4,
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                    maxOutputTokens: 1024,
                },
            }),
        )

        let parsed: { explanation?: string; reviewStart?: number }
        try {
            parsed = JSON.parse(result.text ?? '')
        } catch {
            throw new Error(`Gemini trả về không phải JSON: ${result.text?.slice(0, 200)}`)
        }

        // Đoạn xem lại: đoạn transcript AI chọn (nếu có thật), kéo dài tới hết đoạn giảng khái niệm
        const picked = lesson.transcript.find((s) => s.start === parsed.reviewStart)
        const review = picked
            ? { start: picked.start, end: Math.max(picked.end, picked.start < segment.end ? segment.end : picked.end) }
            : fallbackReview

        const response: ExplainResponse = {
            explanation: String(parsed.explanation ?? '').trim() || question.explanation,
            review,
        }
        return json(response)
    } catch (err) {
        return errorResponse(err)
    }
}
