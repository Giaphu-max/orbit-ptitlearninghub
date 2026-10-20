// Hợp đồng dữ liệu giữa frontend và các hàm serverless trong api/.

export const CHAT_LIMITS = {
    questionMaxChars: 500,
    historyMaxTurns: 6,
    historyTurnMaxChars: 1500,
} as const

export interface ChatTurn {
    role: 'user' | 'assistant'
    text: string
}

export interface ChatRequest {
    lessonId: string
    question: string
    /** Vài lượt hỏi đáp gần nhất để AI hiểu ngữ cảnh câu hỏi tiếp theo */
    history?: ChatTurn[]
    /** Giây video sinh viên đang xem, để trả lời được câu kiểu "đoạn này nghĩa là gì" */
    currentTimeSec?: number
}

/** Mốc thời gian AI dẫn ra, frontend hiện thành chip bấm để tua video. */
export interface ChatCitation {
    start: number
    label: string
}

export interface ChatResponse {
    /** Câu trả lời dạng Markdown */
    answer: string
    citations: ChatCitation[]
    /** false khi câu hỏi nằm ngoài nội dung bài giảng */
    inLesson: boolean
}

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

export interface GradePhotoRequest {
    /** JPEG base64, không kèm tiền tố data: */
    imageBase64: string
    setup: DirectorSetup
    intent?: LightingIntent
}

/** Vùng cần chỉnh, toạ độ 0–1 so với khung ảnh (gốc ở góc trên trái). */
export interface FocusArea {
    x: number
    y: number
    w: number
    h: number
    note: string
}

export interface GradePhotoResponse {
    /** Điểm 0–100 */
    composition: number
    lighting: number
    overall: number
    compositionComment: string
    lightingComment: string
    /** Việc nên chỉnh tiếp theo, ngắn gọn */
    tips: string[]
    areas: FocusArea[]
}
