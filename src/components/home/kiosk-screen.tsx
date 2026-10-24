import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import { CourseArt } from '@/components/courses/course-cover'
import { useKioskCourse } from '@/lib/kiosk-course'
import { courseKicker, primaryCourse, STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'

/**
 * Cầu nối giữa cảnh 3D và DOM: cảnh ghi trực tiếp (trong useFrame, không qua React) transform/độ mờ của màn kiosk,
 * độ mờ của các phần tử lá (veil, rail; không dùng biến CSS ở phần tử cha), độ mờ của canvas theo footer, độ mờ và chú thích của dock.
 */
export interface KioskBridge {
    screen: RefObject<HTMLDivElement | null>
    root: RefObject<HTMLElement | null>
    /** Khung canvas cố định: mờ dần khi footer đi vào */
    stage: RefObject<HTMLDivElement | null>
    footer: RefObject<HTMLElement | null>
    dock: RefObject<HTMLElement | null>
    /** Chú thích vị trí máy quay trên dock */
    /** Lớp mờ nền phía trái (stage-veil) */
    veil: RefObject<HTMLElement | null>
    /** Chế độ làm mờ cảnh 3D: camera ngừng theo cuộn */
    calm: MutableRefObject<boolean>
}

/** Kích thước thiết kế của màn kiosk (tỉ lệ 16:10, khớp màn 3D); cảnh 3D map 4 góc của khối này bằng matrix3d. */
export const KIOSK_W = 960
export const KIOSK_H = 600

function KioskPoster({ summary, fade }: { summary: CourseSummary; fade?: boolean }) {
    const { course, pct } = summary
    return (
        <div className={`absolute inset-0 ${fade ? 'kiosk-poster-in' : ''}`}>
            <CourseArt course={course} className="h-full w-full" />
            <span aria-hidden className="absolute inset-x-0 bottom-0 top-[35%] bg-gradient-to-b from-ink/0 to-ink/95" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-16 pb-14">
                <p className="truncate font-mono text-[28px] font-extrabold uppercase tracking-[0.12em] text-brand-light">{courseKicker(summary)}</p>
                <b className="line-clamp-2 text-[60px] font-black leading-[1.08] tracking-[-0.02em]">{course.title}</b>
                <div className="mt-3 flex items-center gap-6">
                    <span className="h-3 flex-1 overflow-hidden rounded bg-ink-foreground/20">
                        <span className="block h-full rounded bg-brand-600" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="font-mono text-[40px] font-extrabold leading-none">{pct}%</span>
                </div>
            </div>
        </div>
    )
}

/**
 * Màn kiosk 3D: MỘT poster của khóa đang chọn (khóa đang học, hoặc khóa đang rê chuột / focus ở cột chữ), chỉ để trang trí.
 * Đổi khóa = crossfade ~200ms (giảm chuyển động: đổi ngay); chỉ ghi DOM khi khóa đổi.
 */
export function KioskScreen({ screenRef }: { screenRef: RefObject<HTMLDivElement | null> }) {
    const summaries = useCourseSummaries()
    const hovered = useKioskCourse()
    const list = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    const current = list.find((c) => c.course.id === hovered) ?? primaryCourse(list)
    const id = current?.course.id
    // Poster trước giữ bên dưới cho tới khi poster mới hiện xong
    const [prev, setPrev] = useState<{ id: string; summary: CourseSummary } | null>(null)
    const last = useRef<{ id: string; summary: CourseSummary } | undefined>(undefined)
    useEffect(() => {
        const before = last.current
        if (current && id) last.current = { id, summary: current }
        if (!before || before.id === id || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const t = window.setTimeout(() => setPrev(null), 220)
        setPrev(before)
        return () => window.clearTimeout(t)
    }, [id, current])
    return (
        <div
            ref={screenRef}
            aria-hidden
            style={{ width: KIOSK_W, height: KIOSK_H, opacity: 0, visibility: 'hidden', pointerEvents: 'none', transformStyle: 'flat', contain: 'strict' }}
            className="fixed left-0 top-0 z-[5] origin-top-left overflow-hidden bg-ink text-ink-foreground"
        >
            {prev && prev.id !== id && <KioskPoster summary={prev.summary} />}
            {current && <KioskPoster key={current.course.id} summary={current} fade />}
        </div>
    )
}
