import { staticLessons } from '@/data'
import { DEMO_VIDEO } from '@/data/demo-video'
import { makeSampleLesson } from '@/data/demo-lesson'
import type { Lesson } from '@/data/types'
import { newId, useCatalog } from '@/store/useCatalog'
import { chunkTranscript } from './chunking'
import { formatOf, MAX_FILE_BYTES, parseDocument } from './parsers'
import { chunksOf, getUploadedFile, selectSources, sourceById, useKb } from './store'
import type { KbFormat, KbSource } from './types'

// Nạp nguồn vào kho: đọc ngay trên trình duyệt, tiến độ theo số trang (hoặc dòng phụ đề) đã xử lý.
// Tài liệu → chunk cho trợ giảng AI + hiện ở tab Tài liệu của sinh viên. Video → một BÀI GIẢNG của khóa (nội dung mẫu cho video mới).

export const SAMPLE_PDF_URL = '/demo/giao-trinh-dung-phi-tuyen-chuong-1.pdf'
export const SAMPLE_PDF_NAME = 'Giáo trình dựng phi tuyến – chương 1 (mẫu)'
const MIN_READING_MS = 1400
/** Video nền cho bài mẫu: video tải từ máy chưa phát được trong bản demo nên dùng video có sẵn làm hình */
const HOST_LESSON_ID = 'ban-chat-dung-phi-tuyen'

export class IngestError extends Error {}

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
    /** Thay file: giữ id (và tên nếu không nhập tên mới) của nguồn đang có */
    replaceId?: string
}

export async function ingestDocument({ courseId, title, file, replaceId }: DocInput): Promise<void> {
    const format = formatOf(file.name)
    if (!format) throw new IngestError('Chỉ đọc được PDF, Word (.docx) và PowerPoint (.pptx).')
    if (file.size > MAX_FILE_BYTES) throw new IngestError('File lớn hơn 50 MB, thầy cô chọn file nhỏ hơn nhé.')
    const kb = useKb.getState()
    const old = replaceId ? sourceById(kb, replaceId) : undefined
    const id = replaceId ?? newId('up')
    const source: KbSource = { id, title: title.trim() || old?.title || baseName(file.name), courseId: old?.courseId ?? courseId, kind: 'doc', format, chunkCount: 0, sectionCount: 0, createdAt: old?.createdAt ?? Date.now() }
    kb.startReading(source)
    const t0 = Date.now()
    try {
        const r = await parseDocument(file, format, { sourceId: id, sourceTitle: source.title, courseId: source.courseId }, (p) => kb.setProgress(id, p))
        kb.setProgress(id, 1)
        await pause(Math.max(0, MIN_READING_MS - (Date.now() - t0)))
        // Tên đã đổi thủ công được thay bằng tên mới (nếu có), nên bỏ đè tên cũ
        if (replaceId && title.trim()) kb.rename(id, title.trim())
        kb.finishReading({ ...source, pages: r.pages, chunkCount: r.chunks.length, sectionCount: r.sections }, r.chunks, file)
    } catch {
        kb.failReading(id)
        throw new IngestError(
            format === 'pdf' ? 'Không đọc được chữ trong PDF này (có thể là file scan ảnh). Thầy cô thử file khác nhé.' : 'Không đọc được file này. Thầy cô kiểm tra file rồi thử lại nhé.',
        )
    }
}

export async function ingestSampleDocument(courseId: string, title: string, replaceId?: string) {
    const res = await fetch(SAMPLE_PDF_URL)
    if (!res.ok) throw new IngestError('Không tải được file mẫu.')
    const blob = await res.blob()
    await ingestDocument({ courseId, title: title.trim() || (replaceId ? '' : SAMPLE_PDF_NAME), file: new File([blob], `${SAMPLE_PDF_NAME}.pdf`, { type: 'application/pdf' }), replaceId })
}

export interface VideoInput {
    courseId: string
    title: string
    /** Link YouTube; trùng bài có sẵn thì dùng lại bài đó */
    link?: string
    /** Tên file video tải lên (bản demo giả lập bằng bài mẫu) */
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

/** Bài giảng (Lesson) còn tồn tại trong danh mục giảng viên? */
const lessonAlive = (id: string) => {
    const c = useCatalog.getState()
    return !c.deletedLessons.includes(id) && [...staticLessons, ...c.customLessons].some((l) => l.id === id)
}

export async function ingestVideo({ courseId, title, link, fileName }: VideoInput): Promise<void> {
    const kb = useKb.getState()
    const cat = useCatalog.getState()
    const host = staticLessons.find((l) => l.id === HOST_LESSON_ID)!
    let youtubeId = host.youtubeId
    let name = title.trim() || (fileName ? baseName(fileName) : DEMO_VIDEO.title)
    let restore: Lesson | undefined

    if (link?.trim()) {
        const yt = youtubeIdOf(link)
        if (!yt) throw new IngestError('Link này chưa đúng dạng YouTube. Thầy cô dán lại link nhé.')
        const known = [...staticLessons, ...cat.customLessons].find((l) => l.youtubeId === yt)
        if (known && lessonAlive(known.id)) throw new IngestError('Video này đã có trong kho tài liệu.')
        if (known) restore = known
        else youtubeId = yt
    }

    const lessonId = restore?.id ?? newId('imp')
    const srcId = `video-${lessonId}`
    const lesson: Lesson = restore ?? makeSampleLesson({ id: lessonId, courseId, title: name, youtubeId, durationSec: host.durationSec })
    if (restore) name = title.trim() || `Bài giảng: ${restore.title}`
    const source: KbSource = { id: srcId, title: name, courseId, kind: 'video', format: 'video' as KbFormat, chunkCount: 0, sectionCount: lesson.concepts.length, durationSec: lesson.durationSec, lines: lesson.transcript.length, lessonId, createdAt: Date.now() }
    kb.startReading(source)
    await readLines(srcId, lesson.transcript.length)
    const chunks = chunkTranscript(lesson.transcript, { sourceId: srcId, sourceTitle: name, courseId })
    // Chỉ khi AI đọc xong bài mới xuất hiện ở phía sinh viên
    if (restore) {
        useCatalog.getState().restoreLesson(lessonId, courseId)
        kb.restore(srcId)
        kb.move(srcId, courseId)
    } else useCatalog.getState().addLesson({ ...lesson, title: name, courseId })
    kb.finishReading({ ...source, chunkCount: chunks.length }, chunks)
}

/** "Cho AI đọc lại": đọc lại đúng nguồn đó, giữ id (tiến độ sinh viên không mất). Video giả lập đọc lại phụ đề; tài liệu đọc lại từ file đã lưu. */
export async function rereadSource(source: KbSource): Promise<void> {
    const kb = useKb.getState()
    if (source.kind === 'video') {
        kb.startReading(source)
        await readLines(source.id, source.lines ?? 8)
        const chunks = chunksOf(useKb.getState(), source.courseId).filter((c) => c.sourceId === source.id)
        kb.finishReading({ ...source, chunkCount: chunks.length }, chunks)
        return
    }
    const blob = source.url ? await fetch(source.url).then((r) => (r.ok ? r.blob() : undefined)) : await getUploadedFile(source.id)
    if (!blob) throw new IngestError('Không tìm thấy file gốc để đọc lại. Thầy cô dùng "Thay file" nhé.')
    await ingestDocument({ courseId: source.courseId, title: source.title, file: new File([blob], `${source.title}.${source.format}`), replaceId: source.id })
}

export const hasLiveVideoOf = (lessonId: string) => selectSources(useKb.getState()).some((s) => s.lessonId === lessonId)
