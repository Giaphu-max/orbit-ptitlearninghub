import { create } from 'zustand'
import { clear, del, get, set } from 'idb-keyval'
import kbJson from '@/data/kb.json'
import type { KbChunk, KbData, KbSource } from './types'

// Kho tri thức = nguồn có sẵn (kb.json) + nguồn tải lên (IndexedDB) − nguồn đã xóa, có đổi tên. Không database.

const BUILTIN = kbJson as KbData
const STATE_KEY = 'orbit-kb-state'
const fileKey = (id: string) => `orbit-kb-file:${id}`

interface Persisted {
    uploads: { source: KbSource; chunks: KbChunk[] }[]
    removed: string[]
    renames: Record<string, string>
    /** Nguồn đã chuyển sang khóa khác (id nguồn → id khóa) */
    moves: Record<string, string>
}

export interface Reading {
    source: KbSource
    /** 0..1: theo số trang (hoặc dòng phụ đề) đã xử lý */
    progress: number
}

interface KbState extends Persisted {
    loaded: boolean
    reading: Record<string, Reading>
    load: () => Promise<void>
    startReading: (source: KbSource) => void
    setProgress: (id: string, progress: number) => void
    /** Ghi nguồn đã đọc xong; trùng id với nguồn đang có (thay file, đọc lại) thì thay nội dung, giữ id */
    finishReading: (source: KbSource, chunks: KbChunk[], file?: Blob) => void
    move: (id: string, courseId: string) => void
    failReading: (id: string) => void
    rename: (id: string, title: string) => void
    remove: (id: string) => void
    restore: (id: string) => void
    /** Hết thời gian hoàn tác: xóa hẳn file/đoạn của nguồn tải lên */
    purge: (id: string) => void
}

let loading: Promise<void> | null = null
const persist = (s: Persisted) => void set(STATE_KEY, { uploads: s.uploads, removed: s.removed, renames: s.renames, moves: s.moves }).catch(() => undefined)

export const useKb = create<KbState>((setState, getState) => ({
    uploads: [],
    removed: [],
    renames: {},
    moves: {},
    loaded: false,
    reading: {},
    load: () => {
        loading ??= (async () => {
            try {
                const saved = await get<Persisted>(STATE_KEY)
                if (saved) setState({ uploads: saved.uploads ?? [], removed: saved.removed ?? [], renames: saved.renames ?? {}, moves: saved.moves ?? {} })
            } catch {
                /* IndexedDB không dùng được (chế độ riêng tư): chỉ có kho có sẵn */
            }
            setState({ loaded: true })
        })()
        return loading
    },
    startReading: (source) => setState((s) => ({ reading: { ...s.reading, [source.id]: { source, progress: 0 } } })),
    setProgress: (id, progress) =>
        setState((s) => (s.reading[id] ? { reading: { ...s.reading, [id]: { ...s.reading[id], progress } } } : s)),
    finishReading: (source, chunks, file) => {
        if (file) void set(fileKey(source.id), file).catch(() => undefined)
        setState((s) => {
            const { [source.id]: _done, ...reading } = s.reading
            void _done
            const next = { ...s, reading, uploads: [...s.uploads.filter((u) => u.source.id !== source.id), { source, chunks }] }
            persist(next)
            return { reading, uploads: next.uploads }
        })
    },
    failReading: (id) =>
        setState((s) => {
            const { [id]: _gone, ...reading } = s.reading
            void _gone
            return { reading }
        }),
    rename: (id, title) =>
        setState((s) => {
            const next = { ...s, renames: { ...s.renames, [id]: title } }
            persist(next)
            return { renames: next.renames }
        }),
    move: (id, courseId) =>
        setState((s) => {
            const next = { ...s, moves: { ...s.moves, [id]: courseId } }
            persist(next)
            return { moves: next.moves }
        }),
    remove: (id) =>
        setState((s) => {
            const next = { ...s, removed: [...s.removed.filter((x) => x !== id), id] }
            persist(next)
            return { removed: next.removed }
        }),
    restore: (id) =>
        setState((s) => {
            const next = { ...s, removed: s.removed.filter((x) => x !== id) }
            persist(next)
            return { removed: next.removed }
        }),
    purge: (id) => {
        const st = getState()
        if (!st.removed.includes(id)) return
        const up = st.uploads.find((x) => x.source.id === id)
        if (!up) return
        void del(fileKey(id)).catch(() => undefined)
        const uploads = st.uploads.filter((x) => x.source.id !== id)
        const removed = st.removed.filter((x) => x !== id)
        persist({ uploads, removed, renames: st.renames, moves: st.moves })
        setState({ uploads, removed })
    },
}))

type View = Pick<KbState, 'uploads' | 'removed' | 'renames' | 'moves'>

/** Mọi nguồn đang có trong kho (đã trừ nguồn xóa, áp tên đã đổi và khóa đã chuyển), nguồn tải lên xếp trước; nguồn thay file đè lên bản có sẵn cùng id. */
function allSources(s: View): KbSource[] {
    const replaced = new Set(s.uploads.map((u) => u.source.id))
    const all = [...s.uploads.map((u) => u.source).reverse(), ...BUILTIN.sources.filter((x) => !replaced.has(x.id))]
    return all.filter((x) => !s.removed.includes(x.id)).map((x) => ({ ...x, title: s.renames[x.id] ?? x.title, courseId: s.moves[x.id] ?? x.courseId }))
}

export const selectSources = (s: KbState) => allSources(s)

/** Nguồn đã xóa (để hoàn tác / liệt kê) kèm tên hiện tại. */
export const sourceById = (s: View, id: string) => allSources({ ...s, removed: s.removed.filter((x) => x !== id) }).find((x) => x.id === id)

/** Chunk của một khóa (mọi nguồn còn lại, theo khóa hiện tại của nguồn); tên nguồn theo tên đã đổi. */
export function chunksOf(s: View, courseId: string): KbChunk[] {
    const live = new Map(allSources(s).map((x) => [x.id, x]))
    const replaced = new Set(s.uploads.map((u) => u.source.id))
    const all = [...BUILTIN.chunks.filter((c) => !replaced.has(c.sourceId)), ...s.uploads.flatMap((u) => u.chunks)]
    return all.flatMap((c) => {
        const src = live.get(c.sourceId)
        return src && src.courseId === courseId ? [{ ...c, courseId, sourceTitle: src.title }] : []
    })
}

export const getUploadedFile = (id: string) => get<Blob>(fileKey(id)).catch(() => undefined)

/** "Đặt lại dữ liệu demo": xóa cả kho IndexedDB (nguồn tải lên, file, tên đã đổi, nguồn đã xóa). */
export async function clearKb() {
    useKb.setState({ uploads: [], removed: [], renames: {}, moves: {}, reading: {} })
    await clear().catch(() => undefined)
}
