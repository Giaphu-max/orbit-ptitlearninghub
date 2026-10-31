import type { KbChunk, KbKind, RawPage } from './types.js'

// Tách chữ của tài liệu thành đoạn kiến thức ~600–900 ký tự, mỗi đoạn thuộc đúng một trang và một mục.
// Dùng chung cho script build-kb (Node) và trình duyệt: không import gì ngoài kiểu.

const MIN = 40
const SOFT = 600
const HARD = 900
/** "1.3. Tính phi hủy hoại" hoặc "1.3 Tên mục": tiêu đề mục có số phân cấp */
const HEADING = /^(\d+(?:\.\d+)+)\.?\s+(\S.{1,100})$/
/** "Chương 1. Tên chương" */
const CHAPTER = /^(?:Chương|CHƯƠNG)\s+(\d+)\.?\s+(\S.{1,100})$/

export interface ChunkMeta {
    sourceId: string
    sourceTitle: string
    courseId: string
    kind?: KbKind
}

/** Tách một đoạn dài ở ranh giới câu gần ngưỡng mềm. */
function splitLong(text: string): string[] {
    if (text.length <= HARD) return [text]
    const out: string[] = []
    let rest = text
    while (rest.length > HARD) {
        let cut = -1
        for (const m of rest.matchAll(/[.!?…;:]\s+/g)) {
            const end = (m.index ?? 0) + m[0].length
            if (end > HARD) break
            if (end >= SOFT * 0.6) cut = end
            if (end >= SOFT) break
        }
        if (cut < 0) cut = rest.lastIndexOf(' ', HARD) > 0 ? rest.lastIndexOf(' ', HARD) : HARD
        out.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
    }
    if (rest) out.push(rest)
    return out
}

export interface PageChunksResult {
    chunks: KbChunk[]
    /** Số tiêu đề mục tìm thấy */
    sections: number
}

export function chunkPages(pages: RawPage[], meta: ChunkMeta): PageChunksResult {
    const chunks: KbChunk[] = []
    const sectionSet = new Set<string>()
    let section: string | undefined
    let sectionTitle: string | undefined

    for (const pg of pages) {
        let buf: string[] = []
        const flush = () => {
            const joined = buf.join('\n').replace(/[ \t]+/g, ' ').trim()
            buf = []
            if (joined.length < MIN) return
            for (const part of splitLong(joined)) {
                if (part.length < MIN) continue
                chunks.push({
                    id: `${meta.sourceId}#${chunks.length + 1}`,
                    sourceId: meta.sourceId,
                    sourceTitle: meta.sourceTitle,
                    courseId: meta.courseId,
                    kind: meta.kind ?? 'doc',
                    page: pg.page,
                    section,
                    sectionTitle,
                    text: part,
                })
            }
        }
        for (const raw of pg.lines) {
            const line = raw.replace(/\s+/g, ' ').trim()
            if (!line) continue
            // Dòng đầu trang kiểu "Tài liệu demo ... Trang 1" là phần đầu trang, bỏ
            if (/\bTrang\s+\d+\s*$/.test(line) && line.length < 140) continue
            const h = HEADING.exec(line)
            const c = CHAPTER.exec(line)
            if (h || c) {
                flush()
                section = h ? h[1] : c![1]
                sectionTitle = h ? h[2] : c![2]
                sectionSet.add(`${section}|${sectionTitle}`)
                buf.push(line)
                continue
            }
            buf.push(line)
            if (buf.join(' ').length > HARD * 1.4) flush()
        }
        flush()
    }
    return { chunks, sections: sectionSet.size }
}

/** Đoạn thuần chữ (DOCX): coi như một "trang" duy nhất rồi tách; page để trống vì Word không có trang cố định. */
export function chunkText(text: string, meta: ChunkMeta): PageChunksResult {
    const r = chunkPages([{ page: 1, lines: text.split(/\n+/) }], meta)
    for (const c of r.chunks) delete c.page
    return r
}

/** Transcript video → đoạn ~30–60 giây, gộp các dòng liền nhau. */
export function chunkTranscript(segments: { start: number; end: number; text: string }[], meta: ChunkMeta & { sectionOf?: (sec: number) => { section: string; title: string } | undefined }): KbChunk[] {
    const out: KbChunk[] = []
    let cur: { start: number; end: number; parts: string[] } | null = null
    const flush = () => {
        if (!cur) return
        const text = cur.parts.join(' ').replace(/\s+/g, ' ').trim()
        if (text.length >= 10) {
            const s = meta.sectionOf?.(cur.start)
            out.push({
                id: `${meta.sourceId}#${out.length + 1}`,
                sourceId: meta.sourceId,
                sourceTitle: meta.sourceTitle,
                courseId: meta.courseId,
                kind: 'video',
                start: cur.start,
                end: cur.end,
                section: s?.section,
                sectionTitle: s?.title,
                text,
            })
        }
        cur = null
    }
    for (const seg of segments) {
        if (cur && seg.end - cur.start > 60) flush()
        if (!cur) cur = { start: seg.start, end: seg.end, parts: [] }
        cur.parts.push(seg.text)
        cur.end = seg.end
        if (cur.end - cur.start >= 30) flush()
    }
    flush()
    return out
}
