import { create } from 'zustand'
import type { DirectorSetup, GradePhotoResponse, LightingIntent } from '@/lib/api-types'
import { ApiRequestError, gradePhoto } from '@/lib/api'
import { announceRewards } from '@/lib/gamification'
import type { CameraSetup } from '@/lib/studio-setup'
import { useOrbitStore } from '@/store/useOrbitStore'

// Ảnh chụp trong phiên Studio: chỉ sống trong bộ nhớ (không lưu localStorage), nhưng nằm ngoài component
// để việc chấm vẫn chạy tiếp và kết quả không mất khi người dùng đổi trang rồi quay lại.

export const SHOTS_MAX = 24

export type GalleryFilter = 'all' | 'graded' | 'ungraded'

export type ShotStatus = 'idle' | 'grading' | 'done' | 'error'

export interface StudioShot {
    id: number
    /** Giờ chụp (ms) */
    at: number
    /** Data URL để hiển thị */
    image: string
    /** Base64 JPEG gửi cho api/grade-photo */
    base64: string
    /** Thông số máy và đèn lúc chụp, dùng khi chấm và khi "Áp gợi ý rồi chụp lại" */
    setup: CameraSetup
    intent: LightingIntent
    status: ShotStatus
    result?: GradePhotoResponse
    error?: string
}

interface StudioSessionState {
    shots: StudioShot[]
    selectedId: number | null
    /** Ngăn phải (Xem ảnh / kết quả chấm) đang mở */
    drawerOpen: boolean
    lightboxOpen: boolean
    galleryOpen: boolean
    galleryFilter: GalleryFilter
    compareMode: boolean
    /** Tối đa 2 ảnh đang chọn để so sánh, theo thứ tự chọn */
    compareIds: number[]
    /** Thêm ảnh; trả về null khi đã đủ SHOTS_MAX (không tự xóa ảnh nào) */
    addShot: (shot: Omit<StudioShot, 'id' | 'status' | 'at'>) => number | null
    /** Chọn ảnh và mở ngăn Xem ảnh */
    select: (id: number | null) => void
    openDrawer: (open: boolean) => void
    setLightbox: (open: boolean) => void
    setGallery: (open: boolean) => void
    setFilter: (f: GalleryFilter) => void
    setCompareMode: (on: boolean) => void
    toggleCompare: (id: number) => void
    /** Xóa ảnh; trả về vị trí cũ để hoàn tác */
    removeShot: (id: number) => number
    /** Đưa ảnh đã xóa về đúng vị trí cũ; false nếu kho đã đầy */
    restoreShot: (shot: StudioShot, index: number) => boolean
}

let nextId = 1

export const useStudioSession = create<StudioSessionState>()((set, get) => ({
    shots: [],
    selectedId: null,
    drawerOpen: false,
    lightboxOpen: false,
    galleryOpen: false,
    galleryFilter: 'all',
    compareMode: false,
    compareIds: [],
    addShot: (shot) => {
        if (get().shots.length >= SHOTS_MAX) return null
        const id = nextId++
        set((s) => ({ shots: [...s.shots, { ...shot, id, at: Date.now(), status: 'idle' }], selectedId: id, drawerOpen: false }))
        return id
    },
    select: (id) => set({ selectedId: id, drawerOpen: id !== null }),
    openDrawer: (open) => set({ drawerOpen: open }),
    setLightbox: (open) => set({ lightboxOpen: open }),
    setGallery: (open) => set(open ? { galleryOpen: true } : { galleryOpen: false, compareMode: false, compareIds: [] }),
    setFilter: (f) => set({ galleryFilter: f }),
    setCompareMode: (on) => set({ compareMode: on, compareIds: [] }),
    toggleCompare: (id) =>
        set((s) => {
            if (s.compareIds.includes(id)) return { compareIds: s.compareIds.filter((x) => x !== id) }
            return { compareIds: s.compareIds.length >= 2 ? [s.compareIds[1], id] : [...s.compareIds, id] }
        }),
    removeShot: (id) => {
        const { shots, selectedId } = get()
        const index = shots.findIndex((x) => x.id === id)
        if (index < 0) return -1
        const rest = shots.filter((x) => x.id !== id)
        const neighbour = rest[index] ?? rest[index - 1] ?? null
        set((s) => ({
            shots: rest,
            compareIds: s.compareIds.filter((x) => x !== id),
            ...(selectedId === id ? { selectedId: neighbour?.id ?? null, drawerOpen: neighbour ? s.drawerOpen : false } : {}),
            ...(rest.length === 0 ? { lightboxOpen: false, galleryOpen: false, compareMode: false } : {}),
        }))
        return index
    },
    restoreShot: (shot, index) => {
        if (get().shots.length >= SHOTS_MAX) return false
        set((s) => {
            const shots = [...s.shots]
            shots.splice(Math.min(index, shots.length), 0, shot)
            return { shots }
        })
        return true
    },
}))

const patch = (id: number, p: Partial<StudioShot>) =>
    useStudioSession.setState((s) => ({ shots: s.shots.map((x) => (x.id === id ? { ...x, ...p } : x)) }))

/** Gửi một ảnh đi chấm. Ảnh đã chấm hoặc đang chấm thì bỏ qua. Người dùng vẫn chỉnh và chụp được trong lúc chờ. */
export async function gradeShot(id: number) {
    const shot = useStudioSession.getState().shots.find((x) => x.id === id)
    if (!shot || shot.status === 'done' || shot.status === 'grading') return
    patch(id, { status: 'grading', error: undefined })
    // Chỉ mở ngăn nếu người dùng chưa chuyển sang xem ảnh khác
    if (useStudioSession.getState().selectedId === id) useStudioSession.setState({ drawerOpen: true })
    try {
        // Chỉ gửi thông số nhiếp ảnh; dịch khung đã thể hiện trong ảnh
        const { shiftX: _x, shiftY: _y, look: _look, ...director } = shot.setup
        const result = await gradePhoto({ imageBase64: shot.base64, setup: director satisfies DirectorSetup, intent: shot.intent })
        patch(id, { status: 'done', result })
        const before = useOrbitStore.getState()
        before.recordDirectorScore(result.overall)
        const after = useOrbitStore.getState()
        announceRewards(before, after, undefined, { source: 'studio', next: { label: 'Chụp lại theo gợi ý', onClick: () => {} } })
    } catch (err) {
        patch(id, { status: 'error', error: err instanceof ApiRequestError ? err.message : 'AI chưa chấm được lúc này. Bạn thử lại nhé.' })
    }
}
