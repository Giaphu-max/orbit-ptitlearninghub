import type { DailyArticle, DailyBlock } from '@/data/types'

export type InlinePart = { text: string; conceptId?: string }

const MARK = /\{\{([a-z0-9-]+)\|([^}]+)\}\}/g

/** Tách văn bản có đánh dấu `{{conceptId|từ khóa}}` thành các đoạn thường và đoạn khái niệm. */
export function parseInline(raw: string): InlinePart[] {
    const parts: InlinePart[] = []
    let last = 0
    for (const m of raw.matchAll(MARK)) {
        if (m.index > last) parts.push({ text: raw.slice(last, m.index) })
        parts.push({ text: m[2], conceptId: m[1] })
        last = m.index + m[0].length
    }
    if (last < raw.length) parts.push({ text: raw.slice(last) })
    return parts
}

export const plainText = (raw: string) => raw.replace(MARK, '$2')

export const blockTexts = (b: DailyBlock): string[] => (b.type === 'bullets' ? b.items : b.type === 'check' ? [] : [b.text])

export const checkBlocks = (a: DailyArticle) => a.blocks.flatMap((b) => (b.type === 'check' ? [b] : []))

/** Mọi nguồn của bài, theo thứ tự khối. */
export const articleSources = (a: DailyArticle) => a.blocks.flatMap((b) => b.sources)
