import { staticLessons } from '@/data'
import { DEMO_VIDEO, DEMO_VIDEO_TRANSCRIPT } from '@/data/demo-video'
import { chunkTranscript } from './chunking'
import { formatOf, MAX_FILE_BYTES, parseDocument } from './parsers'
import { selectSources, useKb } from './store'
import type { KbFormat, KbSource } from './types'

// Nạp nguồn mới vào kho: đọc ngay trên trình duyệt, tiến độ theo số trang (hoặc dòng phụ đề) đã xử lý.

export const SAMPLE_PDF_URL = '/demo/giao-trinh-dung-phi-tuyen-chuong-1.pdf'
export const SAMPLE_PDF_NAME = 'Giáo trình dựng phi tuyến – chương 1 (mẫu)'
const MIN_READING_MS = 1400

export class IngestError extends Error {}

const newId = () => `up-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
const baseName = (n: string) => n.replace(/\.[^.]+$/, '')

export function youtubeIdOf(link: string): string | null {
    const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/.exec(link.trim())
    return m ? m[1] : null
}

export interface DocInput {
    courseId: string
    title: string
    file: File
}

export async function ingestDocument({ courseId, title, file }: DocInput): Promise<void> {
    const format = formatOf(file.name)
    if (!format) throw new IngestError('Chỉ đọc được PDF, Word (.docx) và PowerPoint (.pptx).')
    if (file.size > MAX_FILE_BYTES) throw new IngestError('File lớn hơn 50 MB, thầy cô chọn file nhỏ hơn nhé.')
    const kb = useKb.getState()
    const id = newId()
    const source: KbSource = { id, title: title.trim() || baseName(file.name), courseId, kind: 'doc', format, chunkCount: 0, sectionCount: 0, createdAt: Date.now() }
    kb.startReading(source)
    const t0 = Date.now()
    try {
        const r = await parseDocument(file, format, { sourceId: id, sourceTitle: source.title, courseId }, (p) => kb.setProgress(id, p))
        kb.setProgress(id, 1)
        await pause(Math.max(0, MIN_READING_MS - (Date.now() - t0)))
        kb.finishReading({ ...source, pages: r.pages, chunkCount: r.chunks.length, sectionCount: r.sections }, r.chunks, file)
    } catch {
        kb.failReading(id)
        throw new IngestError(
            format === 'pdf' ? 'Không đọc được chữ trong PDF này (có thể là file scan ảnh). Thầy cô thử file khác nhé.' : 'Không đọc được file này. Thầy cô kiểm tra file rồi thử lại nhé.',
        )
    }
}

export async function ingestSampleDocument(courseId: string, title: string) {
    const res = await fetch(SAMPLE_PDF_URL)
    if (!res.ok) throw new IngestError('Không tải được file mẫu.')
    const blob = await res.blob()
    await ingestDocument({ courseId, title: title.trim() || SAMPLE_PDF_NAME, file: new File([blob], `${SAMPLE_PDF_NAME}.pdf`, { type: 'application/pdf' }) })
}

export interface VideoInput {
    courseId: string
    title: string
    /** Link YouTube; trùng video có sẵn thì dùng transcript có sẵn */
    link?: string
    /** Tên file video tải lên (bản demo chỉ giả lập bằng transcript mẫu) */
    fileName?: string
}

/** Đọc "phụ đề" từng dòng với nhịp giả lập, báo tiến độ theo số dòng đã xử lý. */
async function readLines(id: string, n: number) {
    const kb = useKb.getState()
    for (let i = 1; i <= n; i++) {
        await pause(150)
        kb.setProgress(id, i / n)
    }
}

export async function ingestVideo({ courseId, title, link, fileName }: VideoInput): Promise<void> {
    const kb = useKb.getState()
    let segs = DEMO_VIDEO_TRANSCRIPT
    let durationSec: number = DEMO_VIDEO.durationSec
    let lessonId: string | undefined
    let name = title.trim() || (fileName ? baseName(fileName) : DEMO_VIDEO.title)
    let course = courseId

    if (link?.trim()) {
        const yt = youtubeIdOf(link)
        if (!yt) throw new IngestError('Link này chưa đúng dạng YouTube. Thầy cô dán lại link nhé.')
        const lesson = staticLessons.find((l) => l.youtubeId === yt)
        if (lesson) {
            const live = selectSources(useKb.getState()).some((s) => s.lessonId === lesson.id)
            if (live) throw new IngestError('Video này đã có trong kho tài liệu.')
            segs = lesson.transcript
            durationSec = lesson.durationSec
            lessonId = lesson.id
            course = lesson.courseId
            name = title.trim() || `Bài giảng: ${lesson.title}`
        } else name = title.trim() || DEMO_VIDEO.title
    }

    const id = newId()
    const source: KbSource = { id, title: name, courseId: course, kind: 'video', format: 'video' as KbFormat, chunkCount: 0, sectionCount: 0, durationSec, lines: segs.length, lessonId, createdAt: Date.now() }
    kb.startReading(source)
    await readLines(id, segs.length)
    const chunks = chunkTranscript(segs, { sourceId: id, sourceTitle: name, courseId: course })
    kb.finishReading({ ...source, chunkCount: chunks.length, sectionCount: Math.max(1, Math.round(durationSec / 110)) }, chunks)
}
