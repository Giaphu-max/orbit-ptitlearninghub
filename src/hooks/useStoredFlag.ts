import { useCallback, useState } from 'react'

/** Cờ bật/tắt lưu localStorage (bọc try/catch: chế độ riêng tư hay bị chặn thì vẫn chạy, chỉ không nhớ). */
export function useStoredFlag(key: string, initial: boolean) {
    const [value, setValue] = useState<boolean>(() => {
        try {
            const raw = localStorage.getItem(key)
            return raw === null ? initial : raw === '1'
        } catch {
            return initial
        }
    })
    const set = useCallback(
        (next: boolean | ((prev: boolean) => boolean)) => {
            setValue((prev) => {
                const v = typeof next === 'function' ? next(prev) : next
                try {
                    localStorage.setItem(key, v ? '1' : '0')
                } catch {
                    /* không lưu được thì thôi */
                }
                return v
            })
        },
        [key],
    )
    return [value, set] as const
}
