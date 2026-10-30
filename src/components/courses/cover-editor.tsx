import { useRef, useState } from 'react'
import { ImagePlus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { CourseArt } from '@/components/courses/course-cover'
import type { Course } from '@/data/types'
import { COVER_MOTIFS, deriveCover, MOTIF_LABELS, type CoverMotif } from '@/lib/cover-kinds'
import { useTeacherCourses } from '@/lib/teacher'
import { useOrbitStore } from '@/store/useOrbitStore'

const MAX_EDGE = 1280
const MAX_BYTES = 12 * 1024 * 1024

/** Nén ảnh tải lên về JPEG cạnh dài ≤1280px để lưu dataURL trong localStorage không vượt hạn mức. */
async function compressToJpeg(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file)
    const k = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const cv = document.createElement('canvas')
    cv.width = Math.round(bitmap.width * k)
    cv.height = Math.round(bitmap.height * k)
    const ctx = cv.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bitmap, 0, 0, cv.width, cv.height)
    bitmap.close()
    return cv.toDataURL('image/jpeg', 0.78)
}

/** Tab "Bìa khóa học" của giảng viên: xem trước, đổi kiểu (tăng seed), chọn họa tiết, tải ảnh lên (ưu tiên hơn bìa tự sinh). */
export function CoverEditor() {
    const courses = useTeacherCourses()
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {courses.map((c) => (
                <CoverCard key={c.id} course={c} />
            ))}
            {courses.length === 0 && <p className="text-muted-foreground">Chưa có khóa học nào.</p>}
        </div>
    )
}

export function CoverCard({ course, aspect = 'aspect-[16/7]' }: { course: Course; aspect?: string }) {
    const override = useOrbitStore((s) => s.courseCovers[course.id])
    const setCover = useOrbitStore((s) => s.setCourseCover)
    const fileRef = useRef<HTMLInputElement>(null)
    const [error, setError] = useState<string | null>(null)
    const motif: CoverMotif = override?.motif ?? course.cover?.motif ?? deriveCover(course.subject).motif
    const seed = override?.seed ?? course.cover?.seed ?? 0

    const upload = async (file: File | undefined) => {
        if (!file) return
        setError(null)
        if (!file.type.startsWith('image/') || file.size > MAX_BYTES) return setError('Chọn một ảnh dưới 12 MB (JPEG, PNG hoặc WebP).')
        try {
            setCover(course.id, { image: await compressToJpeg(file) })
        } catch {
            setError('Không đọc được ảnh này. Bạn thử ảnh khác nhé.')
        }
    }
    const btn = 'inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-bold text-foreground transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

    return (
        <section aria-label={`Bìa khóa ${course.title}`} className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <div className={`${aspect} w-full overflow-hidden`}>
                <CourseArt course={course} />
            </div>
            <div className="flex flex-col gap-3 p-4">
                <div>
                    <p className="text-eyebrow uppercase text-muted-foreground">{course.subject}</p>
                    <h3 className="mt-1 font-extrabold text-foreground">{course.title}</h3>
                    {override?.image && <p className="mt-1 text-xs text-muted-foreground">Đang dùng ảnh tải lên (ưu tiên hơn bìa tự sinh).</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={btn} onClick={() => setCover(course.id, { seed: seed + 1, image: undefined })}>
                        <RefreshCw size={14} /> Đổi kiểu
                    </button>
                    <label className="sr-only" htmlFor={`motif-${course.id}`}>Họa tiết</label>
                    <select
                        id={`motif-${course.id}`}
                        value={motif}
                        onChange={(e) => setCover(course.id, { motif: e.target.value as CoverMotif, image: undefined })}
                        className="rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                        {COVER_MOTIFS.map((m) => (
                            <option key={m} value={m}>{MOTIF_LABELS[m]}</option>
                        ))}
                    </select>
                    <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
                        <ImagePlus size={14} /> Tải ảnh lên
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
                    {override?.image && (
                        <button type="button" className={btn} onClick={() => setCover(course.id, { image: undefined })}>
                            <Trash2 size={14} /> Bỏ ảnh
                        </button>
                    )}
                    {override && (
                        <button type="button" className={btn} onClick={() => setCover(course.id, null)}>
                            <RotateCcw size={14} /> Về mặc định
                        </button>
                    )}
                </div>
                {error && <p role="alert" className="text-[13px] text-foreground">{error}</p>}
            </div>
        </section>
    )
}
