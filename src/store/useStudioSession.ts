import { create } from 'zustand'
import type { DirectorSetup, GradePhotoResponse, LightingIntent } from '@/lib/api-types'
import { ApiRequestError, gradePhoto } from '@/lib/api'
import { announceRewards } from '@/lib/gamification'
import type { CameraSetup } from '@/lib/studio-setup'
import { useOrbitStore } from '@/store/useOrbitStore'

// Ảnh chụp trong phiên Studio: chỉ sống trong bộ nhớ (không lưu localStorage), nhưng nằm ngoài component
// để việc chấm vẫn chạy tiếp và kết quả không mất khi người dùng đổi trang rồi quay lại.

export const SHOTS_MAX = 6

export type ShotStatus = 'idle' | 'grading' | 'done' | 'error'

export interface StudioShot {
    id: number
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
    drawerOpen: boolean
    addShot: (shot: Omit<StudioShot, 'id' | 'status'>) => number
    select: (id: number | null) => void
    openDrawer: (open: boolean) => void
}

let nextId = 1

export const useStudioSession = create<StudioSessionState>()((set) => ({
    shots: [],
    selectedId: null,
    drawerOpen: false,
    addShot: (shot) => {
        const id = nextId++
        set((s) => {
            let shots = s.shots
            if (shots.length >= SHOTS_MAX) {
                // Đủ 6 ảnh: bỏ ảnh cũ nhất chưa chấm (không bỏ ảnh đang chấm); nếu tất cả đã chấm thì bỏ ảnh cũ nhất
                const drop = shots.find((x) => x.status === 'idle' || x.status === 'error') ?? shots.find((x) => x.status === 'done') ?? shots[0]
                shots = shots.filter((x) => x !== drop)
            }
            return { shots: [...shots, { ...shot, id, status: 'idle' }], selectedId: id, drawerOpen: false }
        })
        return id
    },
    select: (id) =>
        set((s) => {
            const shot = s.shots.find((x) => x.id === id)
            // Ảnh đã chấm hoặc đang chấm: mở ngăn kết quả; ảnh chưa chấm: đóng ngăn
            return { selectedId: id, drawerOpen: shot ? shot.status === 'done' || shot.status === 'grading' : false }
        }),
    openDrawer: (open) => set({ drawerOpen: open }),
}))

const patch = (id: number, p: Partial<StudioShot>) =>
    useStudioSession.setState((s) => ({ shots: s.shots.map((x) => (x.id === id ? { ...x, ...p } : x)) }))

/** Gửi một ảnh đi chấm. Ảnh đã chấm hoặc đang chấm thì bỏ qua. Người dùng vẫn chỉnh và chụp được trong lúc chờ. */
export async function gradeShot(id: number) {
    const shot = useStudioSession.getState().shots.find((x) => x.id === id)
    if (!shot || shot.status === 'done' || shot.status === 'grading') return
    patch(id, { status: 'grading', error: undefined })
    useStudioSession.setState({ selectedId: id, drawerOpen: true })
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
