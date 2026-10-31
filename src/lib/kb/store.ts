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
}

export interface Reading {
    source: KbSource
    /** 0..1: theo số trang (hoặc dòng phụ đề) đã xử lý */
    progress: number
}

interface KbState extends Persisted {
    loaded: boolean
    reading: Record<string, Reading>
    /** Nguồn vừa xóa, chờ Hoàn tác 5 giây */
    undo: { id: string; title: string } | null
    load: () => Promise<void>
    startReading: (source: KbSource) => void
    setProgress: (id: string, progress: number) => void
    finishReading: (source: KbSource, chunks: KbChunk[], file?: Blob) => void
    failReading: (id: string) => void
    rename: (id: string, title: string) => void
    remove: (id: string) => void
    restore: () => void
    dismissUndo: () => void
}

let loading: Promise<void> | null = null
const persist = (s: Persisted) => void set(STATE_KEY, { uploads: s.uploads, removed: s.removed, renames: s.renames }).catch(() => undefined)

export const useKb = create<KbState>((setState, getState) => ({
    uploads: [],
    removed: [],
    renames: {},
    loaded: false,
    reading: {},
    undo: null,
    load: () => {
        loading ??= (async () => {
            try {
                const saved = await get<Persisted>(STATE_KEY)
                if (saved) setState({ uploads: saved.uploads ?? [], removed: saved.removed ?? [], renames: saved.renames ?? {} })
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
            const next = { ...s, reading, uploads: [...s.uploads, { source, chunks }] }
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
    remove: (id) =>
        setState((s) => {
            const title = allSources(s).find((x) => x.id === id)?.title ?? ''
            const next = { ...s, removed: [...s.removed, id] }
            persist(next)
            return { removed: next.removed, undo: { id, title } }
        }),
    restore: () =>
        setState((s) => {
            if (!s.undo) return s
            const next = { ...s, removed: s.removed.filter((x) => x !== s.undo!.id) }
            persist(next)
            return { removed: next.removed, undo: null }
        }),
    dismissUndo: () => {
        const u = getState().undo
        if (!u) return
        // Xóa hẳn file đã tải lên khỏi IndexedDB khi hết thời gian hoàn tác
        const up = getState().uploads.find((x) => x.source.id === u.id)
        if (up) {
            const rest = getState().uploads.filter((x) => x.source.id !== u.id)
            const removed = getState().removed.filter((x) => x !== u.id)
            void del(fileKey(u.id)).catch(() => undefined)
            persist({ uploads: rest, removed, renames: getState().renames })
            setState({ uploads: rest, removed, undo: null })
        } else setState({ undo: null })
    },
}))

/** Mọi nguồn đang có trong kho (đã trừ nguồn xóa, áp tên đã đổi), nguồn tải lên xếp trước. */
function allSources(s: Pick<KbState, 'uploads' | 'removed' | 'renames'>): KbSource[] {
    const all = [...s.uploads.map((u) => u.source).reverse(), ...BUILTIN.sources]
    return all.filter((x) => !s.removed.includes(x.id)).map((x) => (s.renames[x.id] ? { ...x, title: s.renames[x.id] } : x))
}

export const selectSources = (s: KbState) => allSources(s)

/** Chunk của một khóa (mọi nguồn còn lại); tên nguồn theo tên đã đổi. */
export function chunksOf(s: Pick<KbState, 'uploads' | 'removed' | 'renames'>, courseId: string): KbChunk[] {
    const live = new Set(allSources(s).map((x) => x.id))
    const all = [...BUILTIN.chunks, ...s.uploads.flatMap((u) => u.chunks)]
    return all
        .filter((c) => c.courseId === courseId && live.has(c.sourceId))
        .map((c) => (s.renames[c.sourceId] ? { ...c, sourceTitle: s.renames[c.sourceId] } : c))
}

export const getUploadedFile = (id: string) => get<Blob>(fileKey(id)).catch(() => undefined)

/** "Đặt lại dữ liệu demo": xóa cả kho IndexedDB (nguồn tải lên, file, tên đã đổi, nguồn đã xóa). */
export async function clearKb() {
    useKb.setState({ uploads: [], removed: [], renames: {}, reading: {}, undo: null })
    await clear().catch(() => undefined)
}
