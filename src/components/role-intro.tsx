import { useEffect, useRef } from 'react'
import { bindIntro } from '@/lib/role-intro'
import './role-intro.css'

/** Màn intro sau khi chọn vai trò: mount sẵn, ẩn bằng visibility, điều khiển bởi lib/role-intro.ts (tìm phần tử theo data-ri). */
export function RoleIntro() {
    const root = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!root.current) return
        bindIntro(root.current)
        return () => bindIntro(null)
    }, [])

    return (
        <div ref={root} className="ri" role="dialog" aria-label="Đang vào hệ thống" aria-hidden="true">
            <canvas data-ri="scene" className="ri-scene" aria-hidden="true" />
            <canvas data-ri="gl" className="ri-gl" aria-hidden="true" />
            <button data-ri="skip" type="button" className="ri-skip" aria-label="Bỏ qua phần mở đầu">
                Bỏ qua
            </button>
        </div>
    )
}
