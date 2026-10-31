// Kho tri thức của trợ giảng AI (RAG chạy ở trình duyệt, không database).
// Nguồn có sẵn (src/data/kb.json) + nguồn giảng viên tải lên lúc demo (IndexedDB).

export type KbKind = 'doc' | 'video'
export type KbFormat = 'pdf' | 'docx' | 'pptx' | 'video'

/** Một đoạn kiến thức: tài liệu có page/section, video có start/end (giây). */
export interface KbChunk {
    id: string
    sourceId: string
    sourceTitle: string
    courseId: string
    kind: KbKind
    page?: number
    /** Số mục, ví dụ "1.3" */
    section?: string
    sectionTitle?: string
    start?: number
    end?: number
    text: string
}

export interface KbSource {
    id: string
    title: string
    courseId: string
    kind: KbKind
    format: KbFormat
    /** Số trang (PDF) hoặc slide (PPTX) */
    pages?: number
    chunkCount: number
    /** Số tiêu đề mục (tài liệu) hoặc số khái niệm (video): đếm vào "số khái niệm" của kho */
    sectionCount: number
    durationSec?: number
    /** Số dòng phụ đề (video) */
    lines?: number
    /** Bài giảng có sẵn mà video này là transcript của nó */
    lessonId?: string
    /** Đường dẫn file có sẵn trong public/ (xem được trong popup) */
    url?: string
    builtin?: boolean
    createdAt?: number
}

export interface KbData {
    sources: KbSource[]
    chunks: KbChunk[]
}

/** Một trang (hoặc slide) đã đọc ra chữ, đầu vào của chunkPages. */
export interface RawPage {
    page: number
    lines: string[]
}
