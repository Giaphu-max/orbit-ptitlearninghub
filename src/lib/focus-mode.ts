import { useSyncExternalStore } from 'react'

// Chế độ tập trung của trang học bài: navbar nằm ngoài trang nên nhận tín hiệu qua đây (không đặt class/biến lên <html>).
let focus = false
const listeners = new Set<() => void>()

export function setFocusMode(on: boolean) {
    if (on === focus) return
    focus = on
    listeners.forEach((l) => l())
}

/** Navbar ẩn hẳn khi đang tập trung. */
export function useNavHidden(): boolean {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
        () => focus,
        () => false,
    )
}
