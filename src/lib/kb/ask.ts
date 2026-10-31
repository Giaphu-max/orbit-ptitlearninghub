import { askTutor } from '@/lib/api'
import { CHAT_LIMITS, NOT_FOUND_ANSWER, type ChatChunk, type ChatTurn } from '@/lib/api-types'
import { buildIndex, isRelevant, search, TOP_K, type KbIndex } from './bm25'
import { chunksOf, useKb } from './store'
import type { KbChunk } from './types'

export const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** Nhãn ngắn của một đoạn: tài liệu "Tên · tr.x · mục y", video "Tên · mm:ss" */
export function chunkLabel(c: KbChunk): string {
    if (c.kind === 'video') return `${c.sourceTitle} · ${mmss(c.start ?? 0)}`
    return [c.sourceTitle, c.page ? `tr.${c.page}` : null, c.section ? `mục ${c.section}` : null].filter(Boolean).join(' · ')
}

// Chỉ mục BM25 theo khóa, dựng lại khi danh sách chunk đổi (nguồn thêm/xóa/đổi tên)
const cache = new Map<string, { key: string; index: KbIndex; chunks: KbChunk[] }>()
export function indexFor(courseId: string) {
    const chunks = chunksOf(useKb.getState(), courseId)
    const key = chunks.map((c) => `${c.id}:${c.sourceTitle}`).join('|')
    const hit = cache.get(courseId)
    if (hit && hit.key === key) return hit
    const next = { key, index: buildIndex(chunks), chunks }
    cache.set(courseId, next)
    return next
}

export interface KbAnswer {
    answer: string
    notFound: boolean
    citations: KbChunk[]
}

const notFound = (): KbAnswer => ({ answer: NOT_FOUND_ANSWER, notFound: true, citations: [] })

/** Chọn tối đa TOP_K đoạn và cắt cho vừa giới hạn ký tự của server. */
function pickChunks(hits: KbChunk[]): KbChunk[] {
    const out: KbChunk[] = []
    let total = 0
    for (const c of hits.slice(0, Math.min(TOP_K, CHAT_LIMITS.chunksMax))) {
        if (total + c.text.length > CHAT_LIMITS.chunksMaxChars) continue
        total += c.text.length
        out.push(c)
    }
    return out
}

/**
 * Hỏi trợ giảng: truy hồi BM25 trên kho của khóa → top 6 đoạn → api/chat.
 * Điểm cao nhất dưới ngưỡng thì trả "không có trong tài liệu" ngay, không gọi API.
 */
export async function askKb(courseId: string, question: string, history: ChatTurn[]): Promise<KbAnswer> {
    await useKb.getState().load()
    const { index } = indexFor(courseId)
    const hits = search(index, question, TOP_K)
    if (!isRelevant(hits)) return notFound()
    const picked = pickChunks(hits.map((h) => h.chunk))
    const chunks: ChatChunk[] = picked.map((c) => ({ id: c.id, label: chunkLabel(c), text: c.text }))
    const res = await askTutor({ question, chunks, history })
    if (res.notFound) return notFound()
    const byId = new Map(picked.map((c) => [c.id, c]))
    return { answer: res.answer, notFound: false, citations: res.citations.map((id) => byId.get(id)).filter((c): c is KbChunk => !!c) }
}
