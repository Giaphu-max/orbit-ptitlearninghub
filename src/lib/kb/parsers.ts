import { chunkPages, chunkText, chunkTranscript, type ChunkMeta } from './chunking'
import { readPdfPages } from './pdf-text'
import type { KbChunk, KbFormat, RawPage } from './types'

// Đọc file giảng viên tải lên ngay trong trình duyệt (file không gửi đi đâu). Thư viện nặng chỉ được tải khi cần.

export interface ParsedDoc {
    chunks: KbChunk[]
    sections: number
    pages?: number
}

export const DOC_ACCEPT = '.pdf,.docx,.pptx'
export const MAX_FILE_BYTES = 50 * 1024 * 1024

export function formatOf(name: string): KbFormat | null {
    const ext = name.toLowerCase().split('.').pop()
    return ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'pptx' ? 'pptx' : null
}

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null
/** pdf.js + worker, tải một lần (dùng chung cho đọc chữ và popup xem file) */
export function loadPdfjs() {
    pdfjsReady ??= (async () => {
        const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        return pdfjs
    })()
    return pdfjsReady
}

async function parsePdf(data: ArrayBuffer, meta: ChunkMeta, onProgress: (p: number) => void): Promise<ParsedDoc> {
    const pdfjs = await loadPdfjs()
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
    const pages = await readPdfPages(pdf, (done, total) => onProgress(done / total))
    const r = chunkPages(pages, meta)
    return { chunks: r.chunks, sections: r.sections, pages: pdf.numPages }
}

async function parseDocx(data: ArrayBuffer, meta: ChunkMeta, onProgress: (p: number) => void): Promise<ParsedDoc> {
    const mammoth = await import('mammoth')
    onProgress(0.3)
    const { value } = await mammoth.extractRawText({ arrayBuffer: data })
    onProgress(0.8)
    const r = chunkText(value, meta)
    return { chunks: r.chunks, sections: r.sections }
}

/** Chữ trong <a:t> của từng đoạn <a:p>, mỗi slide là một "trang"; dòng đầu của slide là tiêu đề. */
async function parsePptx(data: ArrayBuffer, meta: ChunkMeta, onProgress: (p: number) => void): Promise<ParsedDoc> {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(data)
    const names = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]))
    const pages: RawPage[] = []
    const dom = new DOMParser()
    for (let i = 0; i < names.length; i++) {
        const xml = await zip.files[names[i]].async('string')
        const doc = dom.parseFromString(xml, 'application/xml')
        const lines: string[] = []
        for (const p of Array.from(doc.getElementsByTagNameNS('*', 'p'))) {
            const t = Array.from(p.getElementsByTagNameNS('*', 't'))
                .map((n) => n.textContent ?? '')
                .join('')
                .trim()
            if (t) lines.push(t)
        }
        // Tiêu đề slide thành "mục" để đếm khái niệm và dẫn nguồn
        if (lines[0] && !/^\d+(\.\d+)+/.test(lines[0])) lines[0] = `${i + 1}.0 ${lines[0]}`
        pages.push({ page: i + 1, lines })
        onProgress((i + 1) / names.length)
    }
    const r = chunkPages(pages, meta)
    return { chunks: r.chunks, sections: r.sections, pages: names.length }
}

export async function parseDocument(file: File | { arrayBuffer(): Promise<ArrayBuffer> }, format: KbFormat, meta: ChunkMeta, onProgress: (p: number) => void): Promise<ParsedDoc> {
    const data = await file.arrayBuffer()
    const r = format === 'pdf' ? await parsePdf(data, meta, onProgress) : format === 'docx' ? await parseDocx(data, meta, onProgress) : await parsePptx(data, meta, onProgress)
    if (!r.chunks.length) throw new Error('empty')
    return r
}

export { chunkTranscript }
