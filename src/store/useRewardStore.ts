import { create } from 'zustand'
import type { Badge } from '@/data/types'

// Hàng đợi màn hình thưởng phủ đỏ. Chỉ là trạng thái tạm của giao diện nên không lưu localStorage.

export type RewardEvent =
    | { kind: 'xp'; id: number; xp: number; title: string; subtitle: string }
    | { kind: 'level-up'; id: number; level: number }
    | { kind: 'badge'; id: number; badge: Badge }

type NewEvent = RewardEvent extends infer E ? (E extends { id: number } ? Omit<E, 'id'> : never) : never

interface RewardState {
    queue: RewardEvent[]
    push: (...events: NewEvent[]) => void
    dismiss: () => void
}

let nextId = 1

export const useRewardStore = create<RewardState>()((set) => ({
    queue: [],
    push: (...events) => set((s) => ({ queue: [...s.queue, ...events.map((e) => ({ ...e, id: nextId++ }) as RewardEvent)] })),
    dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
}))
