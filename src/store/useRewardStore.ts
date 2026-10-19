import { create } from 'zustand'
import type { Badge } from '@/data/types'

// Hàng đợi màn hình thưởng phủ đỏ. Chỉ là trạng thái tạm của giao diện nên không lưu localStorage.

export interface RewardRow {
    label: string
    xp: number
    /** Dòng nổi bật (nền trắng chữ đỏ), ví dụ "Sửa đúng sau khi sai · thưởng x2" */
    highlight?: boolean
}

/** Một màn nhận thưởng đầy đủ: XP + chi tiết + cấp độ + huy hiệu hoặc mức nắm vững + mở khóa. */
export interface RewardEvent {
    id: number
    /** Chip ngữ cảnh, ví dụ "Hoàn thành · Bố cục cơ bản" */
    context: string
    /** Câu chốt lớn theo tình huống */
    headline: string
    xp: number
    rows: RewardRow[]
    xpBefore: number
    xpAfter: number
    badge?: Badge
    mastery?: { name: string; from: number; to: number }
    /** Tên khái niệm vừa được mở khóa trên cây kỹ năng */
    unlocked: string[]
    streak: number
    next: { label: string; to: string }
}

interface RewardState {
    queue: RewardEvent[]
    push: (...events: Omit<RewardEvent, 'id'>[]) => void
    dismiss: () => void
}

let nextId = 1

export const useRewardStore = create<RewardState>()((set) => ({
    queue: [],
    push: (...events) => set((s) => ({ queue: [...s.queue, ...events.map((e) => ({ ...e, id: nextId++ }))] })),
    dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
}))
