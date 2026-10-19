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
