// Dùng chung cho frontend và api/rewrite.ts (đuôi .js ở nơi import để chạy được dạng ES module trên Node).

/** Giảng viên nhờ AI viết lại một phần nội dung trước khi duyệt. */
export type RewriteKind = 'distractors' | 'shorten' | 'simplify'

export const REWRITE_LIMITS = { id: 80, text: 1200, option: 300, options: 4 } as const

export interface RewriteRequest {
    kind: RewriteKind
    lessonId: string
    /** distractors: câu hỏi + 4 đáp án + chỉ số đáp án đúng. shorten: tóm tắt. simplify: tên + định nghĩa khái niệm. */
    prompt?: string
    options?: string[]
    correctIndex?: number
    text?: string
    name?: string
}

export interface RewriteResponse {
    /** distractors: đủ 4 đáp án, đáp án đúng giữ nguyên vị trí và nội dung */
    options?: string[]
    /** shorten, simplify: nội dung mới */
    text?: string
}
