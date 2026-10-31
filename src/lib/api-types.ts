// Hợp đồng dữ liệu giữa frontend và các hàm serverless trong api/.

export const CHAT_LIMITS = {
    questionMaxChars: 500,
    historyMaxTurns: 6,
    historyTurnMaxChars: 1500,
    /** Tổng ký tự của các đoạn kiến thức gửi kèm một câu hỏi */
    chunksMaxChars: 12_000,
    chunksMax: 12,
} as const

export interface ChatTurn {
    role: 'user' | 'assistant'
    text: string
}

/** Một đoạn kiến thức truy hồi ở trình duyệt (BM25) gửi kèm câu hỏi; AI chỉ được dùng các đoạn này. */
export interface ChatChunk {
    id: string
    /** Nhãn nguồn, ví dụ "Chương 1 · tr.1 · mục 1.3" hoặc "Bài giảng X · 01:53" */
    label: string
    text: string
}

export interface ChatRequest {
    question: string
    chunks: ChatChunk[]
    /** Vài lượt hỏi đáp gần nhất để AI hiểu ngữ cảnh câu hỏi tiếp theo */
    history?: ChatTurn[]
}

export interface ChatResponse {
    /** Câu trả lời dạng Markdown */
    answer: string
    /** Id các đoạn đã dùng để trả lời (chỉ gồm id có trong yêu cầu) */
    citations: string[]
    /** true khi các đoạn được cung cấp không có thông tin để trả lời */
    notFound: boolean
}

export const NOT_FOUND_ANSWER = 'Nội dung này không có trong tài liệu của khóa học.'

export interface ApiErrorBody {
    error: string
}

// ── Virtual Director: chấm ảnh chụp từ studio 3D ────────────────────────────

export const GRADE_LIMITS = {
    /** Ảnh JPEG base64 (không kèm tiền tố data:) tối đa ~1,5 MB */
    imageMaxChars: 2_000_000,
} as const

/** Thông số máy và đèn lúc chụp, gửi kèm để AI chỉ ra nguyên nhân bằng ngôn ngữ nhiếp ảnh. */
export interface DirectorSetup {
    focalLengthMm: number
    /** Góc xoay quanh chủ thể (độ), 0 = chính diện */
    azimuthDeg: number
    elevationDeg: number
    distance: number
    /** Cường độ đèn 0–100 */
    key: number
    fill: number
    rim: number
    /** Góc đèn chính so với trục máy ảnh (độ, âm = bên trái) */
    keyAngleDeg: number
}

/** Ý đồ ánh sáng sinh viên đã chọn, để AI chấm theo ý đồ thay vì một đề cố định. */
export interface LightingIntent {
    /** Mô tả sinh viên nhập cho Prompt-to-Environment; không có nếu chỉ dùng thanh trượt */
    prompt?: string
    /** Lời giải thích AI đã đưa ra khi tạo ánh sáng */
    explanation?: string
    /** Màu phông (#RRGGBB) và độ sương 0–1 của cảnh lúc chụp */
    background: string
    fogDensity: number
    /** Sinh viên đã chỉnh tay thanh trượt sau khi AI tạo ánh sáng */
    tweaked?: boolean
}

export const INTENT_LIMITS = { textMaxChars: 500 } as const

/** Một tiêu chí của đề, gửi kèm để AI chấm theo mô tả (không theo thông số). */
export interface GradeRubricItem {
    key: string
    label: string
    points: number
    description: string
}

export const RUBRIC_LIMITS = { maxItems: 6, textMaxChars: 400 } as const

export interface GradePhotoRequest {
    /** JPEG base64, không kèm tiền tố data: */
    imageBase64: string
    setup: DirectorSetup
    intent?: LightingIntent
    /** Đề đang làm: ý đồ + rubric. Thiếu thì chấm theo bố cục / ánh sáng mặc định */
    brief?: { goal: string; rubric: GradeRubricItem[] }
}

/** Thông số có thể áp thẳng vào studio khi bấm "Thử" ở một gợi ý khắc phục. */
export const SUGGEST_PARAMS = ['key', 'fill', 'rim', 'keyAngleDeg', 'focalLengthMm', 'azimuthDeg', 'elevationDeg', 'shiftX', 'shiftY'] as const
export type SuggestParam = (typeof SUGGEST_PARAMS)[number]

export interface FixSuggestion {
    text: string
    /** Thay đổi tương đối nếu ánh xạ được vào một thanh trượt (vd đèn phụ +15) */
    change?: { param: SuggestParam; delta: number }
}

/** Một lỗi AI chỉ ra: tên lỗi, vùng trên ảnh (toạ độ 0–1, gốc ở góc trên trái) và các cách khắc phục. */
export interface FocusArea {
    x: number
    y: number
    w: number
    h: number
    title: string
    fixes: FixSuggestion[]
}

export interface GradeCriterionResult {
    key: string
    label: string
    score: number
    max: number
    comment: string
}

export interface GradePhotoResponse {
    /** Tổng các tiêu chí + điểm sáng tạo (tối đa 100 + 10) */
    overall: number
    criteria: GradeCriterionResult[]
    /** 0–10, chỉ khi cách làm khác gợi ý nhưng vẫn đạt ý đồ của đề */
    creativityBonus: number
    /** Một câu mô tả cách tiếp cận khác (khi có điểm sáng tạo) */
    approachNote?: string
    /** Việc nên chỉnh tiếp theo, ngắn gọn */
    tips: string[]
    areas: FocusArea[]
}
