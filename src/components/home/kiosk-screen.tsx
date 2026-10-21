import type { MutableRefObject, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import { CourseArt } from '@/components/courses/course-cover'
import { STATUS_ORDER, useCourseSummaries, type CourseSummary } from '@/lib/course-map'

/**
 * Cầu nối giữa cảnh 3D và DOM: cảnh ghi trực tiếp (trong useFrame, không qua React) transform/độ mờ của màn kiosk, biến CSS --kiosk-focus
 * lên phần tử gốc, độ mờ của canvas theo footer, độ mờ và chú thích của dock.
 */
export interface KioskBridge {
    screen: RefObject<HTMLDivElement | null>
    root: RefObject<HTMLElement | null>
    /** Khung canvas cố định: mờ dần khi footer đi vào */
    stage: RefObject<HTMLDivElement | null>
    footer: RefObject<HTMLElement | null>
    dock: RefObject<HTMLElement | null>
    /** Chú thích vị trí máy quay trên dock */
    cap: RefObject<HTMLElement | null>
    /** Chế độ làm mờ cảnh 3D: camera ngừng theo cuộn */
    calm: MutableRefObject<boolean>
}

/** Kích thước thiết kế của màn kiosk (tỉ lệ 16:10, khớp màn 3D); cảnh 3D map 4 góc của khối này bằng matrix3d. */
export const KIOSK_W = 960
export const KIOSK_H = 600

function KioskCourse({ summary }: { summary: CourseSummary }) {
    const { course, lessons: ls, status, pct, curIndex } = summary
    const lesson = ls[curIndex] ?? ls[0]
    const sub = status === 'doing' ? `Chặng ${curIndex + 1}/${ls.length}` : status === 'done' ? 'Đã xong' : `${ls.length} bài`
    const action = status === 'done' ? 'Xem lại' : pct > 0 ? 'Học tiếp' : 'Bắt đầu'
    return (
        <div className="relative flex min-h-0 flex-col justify-between gap-3 rounded-[18px] border border-ink-foreground/10 bg-ink-foreground/5 p-6">
            <Link to={`/learning?course=${course.id}`} aria-label={`Xem khóa ${course.title}`} className="absolute inset-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70" />
            <div className="pointer-events-none flex items-start gap-4">
                <div className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl ${status === 'new' ? 'saturate-[.5]' : ''}`}>
                    <CourseArt course={course} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                    <small className="block truncate font-mono text-[13px] font-extrabold uppercase tracking-[0.12em] text-brand-light">
                        {course.subject} · {sub}
                    </small>
                    <b className="mt-1 line-clamp-2 block text-[24px] leading-tight">{course.title}</b>
                </div>
            </div>
            <div className="pointer-events-none flex items-end justify-between gap-4">
                <span className="font-mono text-[44px] font-bold leading-none">{pct}%</span>
                {lesson && (
                    <Link to={`/lesson/${lesson.id}`} className="pointer-events-auto relative z-10 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-[16px] font-extrabold text-ink-foreground shadow-brand transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
                        <Play size={14} className="fill-current" /> {action}
                    </Link>
                )}
            </div>
            <span className="pointer-events-none h-1.5 overflow-hidden rounded bg-ink-foreground/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ ${course.title}`}>
                <span className="block h-full rounded bg-brand-600" style={{ width: `${pct}%` }} />
            </span>
        </div>
    )
}

/** Nội dung thật của màn kiosk (DOM, dữ liệu khóa học thật). Ẩn và inert cho tới khi máy quay zoom tới kiosk. */
export function KioskScreen({ screenRef }: { screenRef: RefObject<HTMLDivElement | null> }) {
    const summaries = useCourseSummaries()
    const list = [...summaries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]).slice(0, 4)
    return (
        <div
            ref={screenRef}
            inert
            role="region"
            aria-label="Khóa học của bạn"
            style={{ width: KIOSK_W, height: KIOSK_H, opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}
            className="fixed left-0 top-0 z-[5] flex origin-top-left flex-col gap-5 overflow-hidden bg-ink p-12 text-ink-foreground"
        >
            <div>
                <p className="font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-brand-light">02 · Khóa học</p>
                <h3 className="mt-1.5 text-[44px] font-extrabold leading-none tracking-tight">Khóa học của bạn</h3>
                <p className="mt-2 text-[17px] text-ink-foreground/70">Học theo chặng, đích là test cuối chương.</p>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-[18px]" style={{ gridTemplateRows: `repeat(${list.length > 2 ? 2 : 1}, minmax(0, 1fr))` }}>
                {list.map((s) => (
                    <KioskCourse key={s.course.id} summary={s} />
                ))}
            </div>
            <Link to="/learning" className="inline-flex items-center gap-2 self-start text-[15px] font-bold text-ink-foreground/70 hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground/70">
                Xem tất cả khóa học <ArrowRight size={15} />
            </Link>
        </div>
    )
}
