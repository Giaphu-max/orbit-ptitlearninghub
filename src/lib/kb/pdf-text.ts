import type { RawPage } from './types.js'

/** Phần tối thiểu của PDFDocumentProxy mà ta dùng (để dùng chung cho bản trình duyệt và bản legacy ở Node). */
export interface PdfLike {
    numPages: number
    getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>
}

/** Đọc chữ từng trang, ghép thành dòng theo hasEOL của pdf.js. onPage báo trang vừa xử lý xong (để hiện tiến độ thật). */
export async function readPdfPages(pdf: PdfLike, onPage?: (done: number, total: number) => void): Promise<RawPage[]> {
    const pages: RawPage[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const lines: string[] = []
        let line = ''
        for (const it of content.items as { str?: string; hasEOL?: boolean }[]) {
            if (typeof it.str !== 'string') continue
            line += it.str
            if (it.hasEOL) {
                lines.push(line)
                line = ''
            } else line += ' '
        }
        if (line.trim()) lines.push(line)
        pages.push({ page: i, lines })
        onPage?.(i, pdf.numPages)
    }
    return pages
}
