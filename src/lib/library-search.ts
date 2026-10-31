import { fold } from '@/lib/kb/text'
import type { KbChunk } from '@/lib/kb/types'
import type { LibraryCourse, LibraryItem } from '@/lib/library'

export type LibraryFilter = 'all' | 'doc' | 'video' | 'reading' | 'locked'
export const FILTERS: { id: LibraryFilter; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'doc', label: 'Tài liệu' },
    { id: 'video', label: 'Video' },
    { id: 'reading', label: 'AI đang đọc' },
    { id: 'locked', label: 'Khóa đang khóa' },
]
export const parseFilter = (v: string | null): LibraryFilter => (FILTERS.some((f) => f.id === v) ? (v as LibraryFilter) : 'all')

export interface ViewGroup {
    group: LibraryCourse
    items: LibraryItem[]
    /** Trích một dòng khi nguồn khớp trong nội dung (id nguồn → trích) */
    snippets: Map<string, string>
}

/** Một dòng quanh chỗ khớp (vị trí tính trên văn bản đã bỏ dấu, cùng độ dài với bản gốc ở dạng NFC). */
function snippetOf(text: string, at: number, len: number) {
    const from = Math.max(0, at - 30)
    const to = Math.min(text.length, at + len + 60)
    return `${from > 0 ? '…' : ''}${text.slice(from, to).replace(/\s+/g, ' ').trim()}${to < text.length ? '…' : ''}`
}

/**
 * Lọc kho theo từ khóa (không phân biệt dấu/hoa thường: tên khóa, tên nguồn, nội dung đoạn kiến thức) và chip lọc.
 * Khóa không có kết quả bị ẩn; không lọc gì thì khóa rỗng vẫn hiện.
 */
export function filterLibrary(groups: LibraryCourse[], chunks: Map<string, KbChunk[]>, q: string, f: LibraryFilter): ViewGroup[] {
    const fq = fold(q.trim())
    const out: ViewGroup[] = []
    for (const group of groups) {
        if (f === 'locked' && group.course.open) continue
        const snippets = new Map<string, string>()
        const courseMatch = Boolean(fq) && fold(`${group.course.title} ${group.course.subject}`).includes(fq)
        let items = group.items.filter((i) => (f === 'doc' ? i.source.kind === 'doc' : f === 'video' ? i.source.kind === 'video' : f === 'reading' ? Boolean(i.reading) : true))
        if (fq && !courseMatch) {
            items = items.filter((i) => {
                if (fold(i.source.title).includes(fq)) return true
                for (const c of chunks.get(i.source.id) ?? []) {
                    const text = c.text.normalize('NFC')
                    const ft = fold(text)
                    const at = ft.indexOf(fq)
                    if (at >= 0) {
                        snippets.set(i.source.id, snippetOf(text, at, fq.length))
                        return true
                    }
                }
                return false
            })
        }
        const narrowed = Boolean(fq) || f !== 'all'
        if (items.length > 0 || (!narrowed && group.items.length === 0) || (courseMatch && f === 'all') || (f === 'locked' && !fq)) out.push({ group, items, snippets })
    }
    return out
}
