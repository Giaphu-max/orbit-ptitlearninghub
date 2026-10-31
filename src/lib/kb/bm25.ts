import type { KbChunk } from './types'
import { terms } from './text'

// BM25 trên chunk của một khóa, chạy ở trình duyệt. Chỉ mục dựng lại khi danh sách chunk đổi (vài trăm đoạn, vài ms).

const K1 = 1.4
const B = 0.75
/** Điểm cao nhất dưới ngưỡng này thì coi như tài liệu không có nội dung đó (không gọi API) */
export const MIN_SCORE = 5
export const TOP_K = 6

interface Doc {
    chunk: KbChunk
    tf: Map<string, number>
    len: number
}

export interface KbIndex {
    docs: Doc[]
    df: Map<string, number>
    avg: number
}

export function buildIndex(chunks: KbChunk[]): KbIndex {
    const df = new Map<string, number>()
    const docs = chunks.map((chunk) => {
        const ts = terms(`${chunk.sectionTitle ?? ''} ${chunk.text}`)
        const tf = new Map<string, number>()
        for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1)
        for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
        return { chunk, tf, len: ts.length || 1 }
    })
    const avg = docs.reduce((a, d) => a + d.len, 0) / (docs.length || 1)
    return { docs, df, avg }
}

export interface Hit {
    chunk: KbChunk
    score: number
    /** Tỉ lệ từ khóa của câu hỏi có mặt trong đoạn (0..1) */
    coverage: number
}

export function search(index: KbIndex, query: string, k = TOP_K): Hit[] {
    const q = [...new Set(terms(query))]
    const n = index.docs.length
    if (!q.length || !n) return []
    const hits: Hit[] = []
    for (const d of index.docs) {
        let score = 0
        let matched = 0
        for (const t of q) {
            const f = d.tf.get(t)
            if (!f) continue
            matched++
            const df = index.df.get(t) ?? 0
            const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
            // Cặp âm tiết khớp là tín hiệu mạnh hơn âm tiết đơn
            const w = t.includes('_') ? 1.6 : 1
            score += w * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / index.avg)))
        }
        if (score > 0) hits.push({ chunk: d.chunk, score, coverage: matched / q.length })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k)
}

/** Có đủ bằng chứng để hỏi AI không: điểm đủ cao và đoạn tốt nhất khớp ít nhất một nửa từ khóa của câu hỏi. */
export const isRelevant = (hits: Hit[]) => hits.length > 0 && hits[0].score >= MIN_SCORE && hits[0].coverage >= 0.5
