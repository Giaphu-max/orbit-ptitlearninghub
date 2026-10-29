import { useSyncExternalStore } from 'react'

// Chế độ tập trung của trang học bài: navbar nằm ngoài trang nên nhận tín hiệu qua đây (không đặt class/biến lên <html>).
// `focus`: đang tập trung; `peek`: navbar được rê chuột gọi ra tạm thời.
let state = { focus: false, peek: false }
const listeners = new Set<() => void>()
let hideTimer: number | undefined

function emit(next: Partial<typeof state>) {
    const merged = { ...state, ...next }
    if (merged.focus === state.focus && merged.peek === state.peek) return
    state = merged
    listeners.forEach((l) => l())
}

export function setFocusMode(on: boolean) {
    window.clearTimeout(hideTimer)
    emit({ focus: on, peek: false })
}

/** Rê vào dải mép trên hoặc vào navbar: hiện ngay; rời ra thì 600ms sau ẩn lại. */
export function peekNav(show: boolean) {
    window.clearTimeout(hideTimer)
    if (show) emit({ peek: true })
    else hideTimer = window.setTimeout(() => emit({ peek: false }), 600)
}

export function useNavHidden(): boolean {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
        () => state.focus && !state.peek,
        () => false,
    )
}
