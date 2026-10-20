import { z } from 'zod'

// Schema đầu ra của Gemini. Dùng cho cả hai việc: ép Gemini trả JSON đúng cấu trúc
// (responseJsonSchema) và kiểm tra lại kết quả trước khi hậu xử lý.
// Mô tả trong .describe() được gửi kèm schema, nên viết như hướng dẫn cho model.

const seconds = z.number().int().min(0)

// Gemini đọc mốc thời gian video chuẩn nhất khi viết như đồng hồ trình phát (MM:SS).
// Để nó viết số giây nguyên thì hay nhầm (ví dụ 7:19 thành 719, hoặc đếm lệch dần), nên
// gửi schema dạng chuỗi "MM:SS" rồi đổi sang giây ở fromWireDraft().
const clock = z
    .string()
    .regex(/^\d{1,3}:[0-5]\d$/)
    .describe('Mốc thời gian dạng MM:SS đúng như đồng hồ trình phát video, ví dụ "03:47"')

export function parseClock(value: string): number {
    const [m, s] = value.split(':').map(Number)
    return m * 60 + s
}

export const ChoiceQuestionDraft = z.object({
    conceptId: z.string().describe('id của khái niệm mà câu hỏi kiểm tra, lấy đúng từ danh sách concepts'),
    prompt: z.string().describe('Câu hỏi tiếng Việt, ngắn gọn, kiểm tra hiểu bài chứ không học thuộc'),
    options: z.array(z.string()).min(4).max(4).describe('Đúng 4 phương án, các phương án sai phải hợp lý'),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().describe('1–2 câu giải thích vì sao đáp án đúng, bám nội dung bài giảng'),
})

const buildLessonDraft = <T extends z.ZodType>(time: T) =>
    z.object({
    title: z.string().describe('Tên bài học tiếng Việt, ngắn gọn, nêu đúng chủ đề'),
    summary: z.string().describe('Tóm tắt 3–4 câu tiếng Việt về những gì bài giảng dạy'),
    transcript: z
        .array(z.object({ start: time, end: time, text: z.string() }))
        .min(3)
        .describe('Lời giảng theo thứ tự thời gian, mỗi đoạn 15–45 giây, cắt ở ranh giới câu, phủ toàn bộ video'),
    concepts: z
        .array(
            z.object({
                id: z.string().describe('slug không dấu, nối bằng gạch ngang, ví dụ "quy-tac-mot-phan-ba"'),
                name: z.string(),
                definition: z.string().describe('Định nghĩa 1–2 câu đúng như giảng viên giải thích'),
                segment: z.object({ start: time, end: time }).describe('Đoạn video giảng khái niệm này'),
                prerequisiteIds: z.array(z.string()).describe('id các khái niệm nền trong cùng bài cần nắm trước; rỗng nếu không có'),
            }),
        )
        .min(2)
        .max(6),
    quiz: z
        .array(
            ChoiceQuestionDraft.extend({
                pauseAt: time.describe('Mốc dừng video để hỏi: ngay sau khi giảng xong khái niệm'),
                answerSegment: z
                    .object({ start: time, end: time })
                    .describe('Đoạn video mà giảng viên nói ra kiến thức giải đáp câu hỏi; sinh viên trả lời sai sẽ được tua lại đây'),
                variants: z
                    .array(ChoiceQuestionDraft)
                    .min(1)
                    .max(1)
                    .describe('1 câu biến thể cùng khái niệm, cùng độ khó, khác tình huống/cách hỏi, dùng khi sinh viên trả lời sai'),
            }),
        )
        .min(4)
        .max(6)
        .describe('4–6 câu, mỗi khái niệm quan trọng một câu, pauseAt tăng dần'),
})

export const LessonDraft = buildLessonDraft(seconds)
/** Dạng gửi cho Gemini: mốc thời gian là chuỗi MM:SS */
export const LessonDraftWire = buildLessonDraft(clock)
export type LessonDraftWire = z.infer<typeof LessonDraftWire>

/** Đổi mọi mốc MM:SS (start, end, pauseAt) sang số giây. */
export function fromWireDraft(wire: LessonDraftWire): LessonDraft {
    const walk = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(walk)
        if (!node || typeof node !== 'object') return node
        return Object.fromEntries(
            Object.entries(node).map(([k, v]) => [k, (k === 'start' || k === 'end' || k === 'pauseAt') && typeof v === 'string' ? parseClock(v) : walk(v)]),
        )
    }
    return walk(wire) as LessonDraft
}
export type LessonDraft = z.infer<typeof LessonDraft>

export const DailyDraft = z.object({
    articles: z.array(
        z.object({
            title: z.string().describe('Tiêu đề gợi tò mò, dạng câu hỏi hoặc nhận định, tiếng Việt'),
            conceptIds: z.array(z.string()).min(2).describe('id khái niệm bài đọc ôn lại, lấy từ danh sách đã cho; gồm khái niệm của ít nhất 2 bài giảng khác nhau'),
            paragraphs: z
                .array(
                    z.object({
                        text: z.string().describe('Đoạn văn 80–110 chữ'),
                        sources: z
                            .array(z.object({ lessonId: z.string(), start: seconds }))
                            .min(1)
                            .describe('Nguồn: lessonId và start lấy đúng từ các đoạn transcript đã cho; đoạn nối nhiều bài thì ghi nguồn của từng bài'),
                    }),
                )
                .min(4)
                .max(5),
            checks: z.array(ChoiceQuestionDraft).min(1).max(2),
        }),
    ),
})
export type DailyDraft = z.infer<typeof DailyDraft>

/** Chuyển schema zod sang JSON Schema mà Gemini chấp nhận (bỏ các khóa nó không cần). */
export function toGeminiSchema(schema: z.ZodType): unknown {
    const strip = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(strip)
        if (!node || typeof node !== 'object') return node
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(node)) {
            if (k === '$schema') continue
            if (k === 'maximum' && v === Number.MAX_SAFE_INTEGER) continue
            if (k === 'minimum' && v === Number.MIN_SAFE_INTEGER) continue
            out[k] = strip(v)
        }
        return out
    }
    return strip(z.toJSONSchema(schema))
}
