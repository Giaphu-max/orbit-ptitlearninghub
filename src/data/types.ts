// Kiểu dữ liệu cho nội dung tĩnh trong src/data/.
// Nội dung do scripts/generate-content.ts (Gemini) tạo một lần rồi ghi ra JSON;
// mọi mốc thời gian tính bằng giây kể từ đầu video YouTube.

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
    /** Khái niệm nền phải nắm trước (cây kỹ năng mở theo đây) */
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
    variants: QuizChoiceQuestion[]
}

export interface Lesson {
    id: string
    courseId: string
    title: string
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

export interface DailyParagraph {
    text: string
    sources: SourceRef[]
}

export interface DailyArticle {
    id: string
    title: string
    readingMinutes: number
    conceptIds: string[]
    paragraphs: DailyParagraph[]
    /** 1–2 câu kiểm tra nhanh; trả lời đúng mới tính hoàn thành */
    checks: QuizChoiceQuestion[]
    origin: ContentOrigin
}

export type BadgeCriterion =
    | { type: 'concept-mastery'; conceptIds: string[]; threshold: number }
    | { type: 'corrected-mistakes'; count: number }
    | { type: 'streak'; days: number }
    | { type: 'director-score'; minScore: number }

export interface Badge {
    id: string
    name: string
    /** Năng lực cụ thể mà huy hiệu chứng nhận */
    description: string
    criterion: BadgeCriterion
}
