import { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { compressToJpeg } from '@/components/courses/cover-editor'
import { CourseCover } from '@/components/courses/course-cover'
import { field, ghost, labelCls, Modal, primary } from '@/components/teacher/library-ui'
import type { Course } from '@/data/types'
import { COVER_ACCENTS, deriveCover, type CoverAccent } from '@/lib/cover-kinds'
import { useOrbitStore } from '@/store/useOrbitStore'

const MAX_BYTES = 5 * 1024 * 1024
const IMAGE_TYPE = /^image\/(jpeg|png|webp)$/

const SUBJECT: Record<CoverAccent, string> = { film: 'Dựng phim', photo: 'Nhiếp ảnh', audio: 'Âm thanh', design: 'Thiết kế', default: 'Đa phương tiện' }
const ACCENT_LABEL: Record<CoverAccent, string> = { film: 'Đỏ cam', photo: 'Cam', audio: 'Xanh lam', design: 'Tím', default: 'Xám xanh' }

interface FieldsProps {
    /** Khóa dùng để dựng bìa tự sinh (id + họa tiết/seed mặc định) */
    course: Pick<Course, 'id' | 'subject' | 'cover'>
    accent: CoverAccent
    image?: string
    onAccent: (a: CoverAccent) => void
    onImage: (dataUrl: string) => void
    onClearImage: () => void
}

/** Mục "Bìa khóa học" dùng chung cho hộp Khóa học mới và Đổi bìa: xem trước 16:9 bên trái, tải ảnh (chính) và chọn màu bên phải. */
function CoverFields({ course, accent, image, onAccent, onImage, onClearImage }: FieldsProps) {
    const [error, setError] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [busy, setBusy] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)
    const pick = async (file: File | undefined) => {
        if (!file) return
        setError('')
        if (!IMAGE_TYPE.test(file.type)) return setError('Chỉ nhận ảnh jpg, png hoặc webp.')
        if (file.size > MAX_BYTES) return setError('Ảnh lớn quá 5 MB, thầy cô chọn ảnh nhỏ hơn nhé.')
        setBusy(true)
        try {
            onImage(await compressToJpeg(file))
        } catch {
            setError('Không đọc được ảnh này. Thầy cô thử ảnh khác nhé.')
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="grid gap-5 sm:grid-cols-[1.15fr_1fr]">
            <div className="aspect-video overflow-hidden rounded-[14px] border border-border">
                {image ? <img src={image} alt="" className="block h-full w-full object-cover" /> : <CourseCover course={course} accent={accent} />}
            </div>
            <div>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => (e.preventDefault(), setDragOver(false), void pick(e.dataTransfer.files?.[0]))}
                    className={`flex w-full flex-col items-center gap-1 rounded-[14px] border-2 border-dashed px-3 py-5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${dragOver ? 'border-brand-600 bg-brand-50' : 'border-border hover:bg-muted'}`}
                >
                    <ImagePlus size={20} aria-hidden className="text-muted-foreground" />
                    <b className="text-[13.5px] font-bold text-strong">{busy ? 'Đang xử lý ảnh…' : 'Tải ảnh lên'}</b>
                    <small className="text-xs text-muted-foreground">Kéo thả hoặc bấm chọn · jpg, png, webp · tối đa 5 MB</small>
                </button>
                {error && (
                    <p role="alert" className="mt-2 text-[13px] font-semibold text-destructive">
                        {error}
                    </p>
                )}
                <p className="mb-2 mt-4 text-[13px] text-muted-foreground">hoặc chọn màu</p>
                <div role="radiogroup" aria-label="Màu bìa" className="flex flex-wrap gap-2.5">
                    {COVER_ACCENTS.map((a) => (
                        <button
                            key={a}
                            type="button"
                            role="radio"
                            aria-checked={!image && accent === a}
                            aria-label={ACCENT_LABEL[a]}
                            title={ACCENT_LABEL[a]}
                            onClick={() => onAccent(a)}
                            className={`h-9 w-9 rounded-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${!image && accent === a ? 'ring-2 ring-strong ring-offset-2 ring-offset-card' : ''}`}
                            style={{ background: `hsl(var(--subject-${a}))` }}
                        />
                    ))}
                </div>
                {image && (
                    <button type="button" onClick={onClearImage} className="mt-3 text-[13px] font-bold text-muted-foreground underline-offset-2 hover:text-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
                        Bỏ ảnh
                    </button>
                )}
            </div>
        </div>
    )
}

/** Khóa mới: tên + bìa. Khóa mới mặc định đang khóa (chỉ thầy cô thấy). Ảnh bìa (nếu có) trả kèm để người gọi lưu vào courseCovers. */
export function NewCourseDialog({ onCreate, onClose }: { onCreate: (course: Course, image?: string) => void; onClose: () => void }) {
    const [title, setTitle] = useState('')
    const [accent, setAccent] = useState<CoverAccent>('photo')
    const [image, setImage] = useState<string | undefined>()
    const [draft] = useState(() => ({ id: `imp-c-${Date.now().toString(36)}`, seed: Math.floor(Math.random() * 9) + 1 }))
    const ref = useRef<HTMLInputElement>(null)
    useEffect(() => ref.current?.focus(), [])
    const ok = title.trim() !== ''
    const cover = { motif: deriveCover(SUBJECT[accent]).motif, accent, seed: draft.seed }
    const submit = () => {
        if (!ok) return
        onCreate(
            { id: draft.id, title: title.trim(), subject: SUBJECT[accent], instructor: 'Khoa Đa phương tiện, PTIT', description: '', lessonIds: [], cover, createdAt: Date.now() },
            image,
        )
        onClose()
    }
    return (
        <Modal title="Khóa học mới" onClose={onClose}>
            <label htmlFor="new-course-title" className={`${labelCls} mt-4`}>
                Tên khóa
            </label>
            <input id="new-course-title" ref={ref} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className={field} />
            <p className={`${labelCls} mt-5`}>Bìa khóa học</p>
            <CoverFields course={{ id: draft.id, subject: SUBJECT[accent], cover }} accent={accent} image={image} onAccent={(a) => (setAccent(a), setImage(undefined))} onImage={setImage} onClearImage={() => setImage(undefined)} />
            <p className="mt-4 text-xs text-muted-foreground/80">Khóa học mới mặc định đang khóa: chỉ thầy cô thấy cho tới khi thầy cô mở cho sinh viên.</p>
            <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className={ghost}>
                    Hủy
                </button>
                <button type="button" onClick={submit} disabled={!ok} className={primary}>
                    Tạo khóa
                </button>
            </div>
        </Modal>
    )
}

/** Đổi bìa khóa đã có: lưu vào store ngay khi chọn, nên xem trước và ô bìa ngoài danh sách cập nhật tức thì; "Xong" chỉ đóng hộp. */
export function CoverDialog({ course, onClose }: { course: Course; onClose: () => void }) {
    const override = useOrbitStore((s) => s.courseCovers[course.id])
    const setCover = useOrbitStore((s) => s.setCourseCover)
    const derived = deriveCover(course.subject)
    const accent = override?.accent ?? course.cover?.accent ?? derived.accent
    return (
        <Modal title="Đổi bìa khóa" onClose={onClose}>
            <p className="mt-1 text-sm text-muted-foreground">{course.title}</p>
            <div className="mt-4">
                <CoverFields
                    course={{ id: course.id, subject: course.subject, cover: { ...course.cover, ...(override?.motif && { motif: override.motif }), ...(override?.seed !== undefined && { seed: override.seed }) } }}
                    accent={accent}
                    image={override?.image}
                    onAccent={(a) => setCover(course.id, { accent: a, image: undefined })}
                    onImage={(image) => setCover(course.id, { image })}
                    onClearImage={() => setCover(course.id, { image: undefined })}
                />
            </div>
            <div className="mt-6 flex justify-end">
                <button type="button" onClick={onClose} className={primary}>
                    Xong
                </button>
            </div>
        </Modal>
    )
}
