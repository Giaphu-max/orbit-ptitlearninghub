import { useSyncExternalStore } from 'react'

// Khóa đang được rê chuột / focus ở cột chữ chương Khóa học: poster trên màn kiosk 3D đổi theo.
// null = về khóa đang học. Chỉ phát thay đổi khi giá trị đổi, không gọi theo khung hình.

let hovered: string | null = null
const listeners = new Set<() => void>()

export function setKioskCourse(id: string | null) {
    if (id === hovered) return
    hovered = id
    listeners.forEach((l) => l())
}

export function useKioskCourse() {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
        () => hovered,
        () => null,
    )
}
