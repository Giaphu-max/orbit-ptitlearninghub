import { create } from 'zustand'
import type { Badge } from '@/data/types'

// Hàng đợi màn hình thưởng phủ đỏ. Chỉ là trạng thái tạm của giao diện nên không lưu localStorage.

export interface RewardRow {
    label: string
    xp: number
    /** Dòng nổi bật (nền trắng chữ đỏ), ví dụ "Sửa đúng sau khi sai · thưởng x2" */
    highlight?: boolean
}

/** Nơi màn thưởng được mở, để nút chính dẫn đúng việc kế tiếp trong ngữ cảnh đó. */
export type RewardSource = 'lesson' | 'daily' | 'test' | 'studio' | 'mission'

/** Hành động chính của màn thưởng: đi tới `to`, hoặc chạy `onClick` (ví dụ xem tiếp video, không rời trang). */
export interface RewardNext {
    label: string
    to?: string
    onClick?: () => void
    /** Nút phụ thay cho "Về trang chủ" */
    secondary?: { label: string; to: string }
}

/** Một màn nhận thưởng đầy đủ: XP + chi tiết + cấp độ + huy hiệu hoặc mức nắm vững + mở khóa. */
export interface RewardEvent {
    id: number
    /** Chip ngữ cảnh, ví dụ "Hoàn thành · Bản chất dựng phi tuyến" */
    context: string
    /** Câu chốt lớn theo tình huống */
    headline: string
    xp: number
    rows: RewardRow[]
    xpBefore: number
    xpAfter: number
    badge?: Badge
    mastery?: { name: string; from: number; to: number }
    /** Tên khái niệm vừa được mở khóa trên bản đồ kỹ năng */
    unlocked: string[]
    streak: number
    next: RewardNext
    source: RewardSource
    /** Điểm màn nền đỏ lan ra: nút vừa bấm (px trong cửa sổ) */
    origin?: { x: number; y: number }
    /** Chờ bao lâu (ms) mới mở màn, để phản hồi tại nút kịp chạy sau khi trả lời */
    delayMs?: number
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
