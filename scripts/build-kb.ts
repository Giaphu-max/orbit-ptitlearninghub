/**
 * Dựng kho tri thức có sẵn cho trợ giảng AI, ghi src/data/kb.json. Chạy local một lần:
 *
 *   npx tsx scripts/build-kb.ts
 *
 * Nguồn: (a) public/demo/giao-trinh-dung-phi-tuyen-chuong-1.pdf (pdfjs-dist, tách theo mục 1.1, 1.2… và trang)
 *        (b) transcript các bài giảng trong src/data/lessons.json (đoạn ~30–60 giây).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Lesson } from '../src/data/types.js'
import { chunkPages, chunkTranscript } from '../src/lib/kb/chunking.js'
import { readPdfPages, type PdfLike } from '../src/lib/kb/pdf-text.js'
import type { KbChunk, KbData, KbSource } from '../src/lib/kb/types.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const PDF = '/demo/giao-trinh-dung-phi-tuyen-chuong-1.pdf'

const lessons = JSON.parse(readFileSync(path.join(ROOT, 'src/data/lessons.json'), 'utf8')) as Lesson[]
const sources: KbSource[] = []
const chunks: KbChunk[] = []

const data = new Uint8Array(readFileSync(path.join(ROOT, 'public', PDF)))
const pdf = (await getDocument({ data, verbosity: 0 }).promise) as unknown as PdfLike
const pages = await readPdfPages(pdf)
const pdfMeta = { sourceId: 'doc-giao-trinh-chuong-1', sourceTitle: 'Chương 1 – Bản chất của dựng phi tuyến', courseId: 'dung-audio-video-phi-tuyen' }
const pdfChunks = chunkPages(pages, pdfMeta)
sources.push({ id: pdfMeta.sourceId, title: pdfMeta.sourceTitle, courseId: pdfMeta.courseId, kind: 'doc', format: 'pdf', pages: pdf.numPages, chunkCount: pdfChunks.chunks.length, sectionCount: pdfChunks.sections, url: PDF, builtin: true })
chunks.push(...pdfChunks.chunks)

for (const l of lessons) {
    const meta = { sourceId: `video-${l.id}`, sourceTitle: `Bài giảng: ${l.title}`, courseId: l.courseId }
    const cs = chunkTranscript(l.transcript, {
        ...meta,
        sectionOf: (sec) => {
            const c = l.concepts.find((k) => sec >= k.segment.start && sec < k.segment.end)
            return c ? { section: c.id, title: c.name } : undefined
        },
    })
    sources.push({ id: meta.sourceId, title: meta.sourceTitle, courseId: l.courseId, kind: 'video', format: 'video', chunkCount: cs.length, sectionCount: l.concepts.length, durationSec: l.durationSec, lines: l.transcript.length, lessonId: l.id, builtin: true })
    chunks.push(...cs)
}

const out: KbData = { sources, chunks }
writeFileSync(path.join(ROOT, 'src/data/kb.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`kb.json: ${sources.length} nguồn, ${chunks.length} đoạn`)
for (const s of sources) console.log(`- ${s.title}: ${s.chunkCount} đoạn, ${s.sectionCount} mục/khái niệm`)
