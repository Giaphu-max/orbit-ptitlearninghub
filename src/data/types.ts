// Kiểu dữ liệu cho nội dung tĩnh trong src/data/.
// Nội dung do scripts/generate-content.ts (Gemini) tạo một lần rồi ghi ra JSON;
// mọi mốc thời gian tính bằng giây kể từ đầu video YouTube.

import type { CourseCoverSpec } from '../lib/cover-kinds.js'

export type Seconds = number

/** Nguồn gốc của một mục nội dung: AI tạo thật, hay dữ liệu mẫu viết tay để dựng giao diện. */
export type ContentOrigin = 'gemini' | 'sample'

/** Trạng thái duyệt của giảng viên trước khi sinh viên thấy nội dung. */
export type ReviewStatus = 'draft' | 'published'

export interface Course {
    id: string
    title: string
    /** Môn học, ví dụ "Nhiếp ảnh cơ bản" */
    subject: string
    instructor: string
    description: string
    lessonIds: string[]
    /** Mã lớp học phần hiển thị trên thẻ ở /learning (dữ liệu mẫu) */
    classCode?: string
    /** Bìa tự sinh (họa tiết, màu nhấn, seed); thiếu thì suy từ subject */
    cover?: CourseCoverSpec
}

export interface TranscriptSegment {
    start: Seconds
    end: Seconds
    text: string
}

export interface Concept {
    id: string
    name: string
    definition: string
    /** Đoạn video giảng khái niệm này, dùng để tua lại khi sinh viên trả lời sai */
    segment: { start: Seconds; end: Seconds }
    /** Khái niệm nền phải nắm trước (bản đồ kỹ năng mở theo đây) */
    prerequisiteIds: string[]
}

export interface QuizChoiceQuestion {
    id: string
    conceptId: string
    prompt: string
    options: string[]
    correctIndex: number
    /** Giải thích ngắn, hiện sau khi trả lời; khi sai sẽ gọi thêm api/explain.ts */
    explanation: string
}

/** Câu hỏi dừng video tại một mốc, kèm câu biến thể cùng cấp độ cho vòng củng cố. */
export interface LessonQuizQuestion extends QuizChoiceQuestion {
    pauseAt: Seconds
    /** Đoạn video chứa kiến thức giải đáp câu hỏi; tua lại đây khi sinh viên trả lời sai */
    answerSegment: { start: Seconds; end: Seconds }
    variants: QuizChoiceQuestion[]
}

export interface Lesson {
    id: string
    courseId: string
    title: string
    /** Tên rút gọn (2–5 từ) cho chip nguồn và chỗ hẹp; thiếu thì cắt từ title */
    shortTitle?: string
    youtubeId: string
    durationSec: Seconds
    summary: string
    concepts: Concept[]
    transcript: TranscriptSegment[]
    quiz: LessonQuizQuestion[]
    origin: ContentOrigin
    /** Trạng thái mặc định khi mới tạo; giảng viên đổi trong store */
    status: ReviewStatus
}

/** Dẫn nguồn một đoạn bài đọc về bài giảng và mốc thời gian cụ thể. */
export interface SourceRef {
    lessonId: string
    start: Seconds
}

/**
 * Một khối của bài Daily. Trong `text` (và `items`), từ khóa khái niệm được đánh dấu
 * dạng `{{conceptId|từ hiển thị}}`; giao diện tách ra bằng parseInline (src/lib/daily-text.ts).
 */
export type DailyBlock =
    | { type: 'hook'; text: string; sources: SourceRef[] }
    | { type: 'paragraph'; text: string; sources: SourceRef[] }
    | { type: 'quote'; text: string; sources: SourceRef[] }
    | { type: 'keypoint'; text: string; sources: SourceRef[] }
    | { type: 'bullets'; items: string[]; sources: SourceRef[] }
    | { type: 'example'; text: string; sources: SourceRef[] }
    /** Câu kiểm tra nhanh; trả lời đúng mới tính hoàn thành bài */
    | { type: 'check'; question: QuizChoiceQuestion; sources: SourceRef[] }

export interface DailyArticle {
    id: string
    title: string
    readingMinutes: number
    conceptIds: string[]
    blocks: DailyBlock[]
    origin: ContentOrigin
}

export type BadgeCriterion =
    | { type: 'concept-mastery'; conceptIds: string[]; threshold: number }
    | { type: 'corrected-mistakes'; count: number }
    | { type: 'streak'; days: number }
    | { type: 'director-score'; minScore: number }
    | { type: 'test-score'; minRatio: number }
    /** Nhiệm vụ ẩn: chỉ nhận qua hành động riêng, không tự xét theo số liệu */
    | { type: 'hidden-mission' }

export interface Badge {
    id: string
    name: string
    /** Năng lực cụ thể mà huy hiệu chứng nhận */
    description: string
    criterion: BadgeCriterion
    /** Huy hiệu ẩn: không hiện trong danh sách cho tới khi nhận */
    hidden?: boolean
}

/** Thống kê lớp (dữ liệu mẫu) để giảng viên thấy khái niệm nào sinh viên hay sai. */
export interface ClassStats {
    note: string
    classSize: number
    /** Theo khái niệm: số sinh viên đã làm, số sai ngay lần đầu, số sửa đúng sau khi sai */
    concepts: Record<string, { answered: number; wrongFirstTry: number; corrected: number }>
    /** Theo câu gốc: số lượt chọn từng đáp án (cùng thứ tự options) */
    questions: Record<string, { picks: number[] }>
    /** Kết quả test cuối chương của lớp, theo id khóa */
    tests: Record<string, ClassTestStats>
}

export interface ClassTestStats {
    /** Số sinh viên đã làm test ít nhất một lần */
    attempted: number
    /** Tổng số lượt làm (kể cả làm lại) */
    attempts: number
    /** Điểm trung bình, % câu đúng */
    avgCorrectPct: number
    /** Số sinh viên đạt từ 80% */
    passed: number
    avgDurationSec: number
    /** Số lượt bị tự nộp vì hết giờ */
    timedOut: number
    scoreBuckets: { label: string; count: number }[]
    /** Theo khái niệm: số lần được hỏi và số lần trả lời đúng trong test */
    concepts: Record<string, { asked: number; correct: number }>
}
