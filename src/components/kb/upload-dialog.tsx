import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { staticCourses } from '@/data'
import { ingestDocument, IngestError, ingestSampleDocument, ingestVideo, SAMPLE_PDF_NAME } from '@/lib/kb/ingest'
import { DOC_ACCEPT, formatOf } from '@/lib/kb/parsers'
import { DEMO_VIDEO } from '@/data/demo-video'

type Tab = 'doc' | 'video'
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov'
const field = 'mt-1.5 block h-[42px] w-full rounded-[11px] border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300'

interface Props {
    defaultCourseId?: string
    onClose: () => void
    /** Báo kết quả (thành công hoặc lỗi) cho trang gọi để hiện thông báo */
    onNotify: (msg: string) => void
}

/** Hộp "Tải lên nguồn kiến thức": tab Tài liệu / Video, kéo-thả, file mẫu, chọn khóa và tên hiển thị. Đóng bằng ✕, bấm ra ngoài hoặc Esc. */
export function UploadDialog({ defaultCourseId, onClose, onNotify }: Props) {
    const [tab, setTab] = useState<Tab>('doc')
    const [file, setFile] = useState<File | null>(null)
    const [sample, setSample] = useState(false)
    const [link, setLink] = useState('')
    const [courseId, setCourseId] = useState(defaultCourseId ?? staticCourses[0].id)
    const [name, setName] = useState('')
    const [drag, setDrag] = useState(false)
    const [error, setError] = useState('')
    const input = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    const choose = (f: File | undefined) => {
        if (!f) return
        setError('')
        if (tab === 'doc' && !formatOf(f.name)) return setError('Chỉ nhận PDF, Word (.docx) hoặc PowerPoint (.pptx).')
        if (tab === 'video' && !/\.(mp4|mov)$/i.test(f.name)) return setError('Chỉ nhận video MP4 hoặc MOV.')
        setSample(false)
        setFile(f)
    }
    const switchTab = (t: Tab) => {
        setTab(t)
        setFile(null)
        setSample(false)
        setError('')
    }
    const picked = sample ? `${tab === 'doc' ? SAMPLE_PDF_NAME + '.pdf' : DEMO_VIDEO.title}` : file?.name
    const ready = tab === 'doc' ? Boolean(file || sample) : Boolean(file || sample || link.trim())

    const submit = () => {
        if (!ready) return setError(tab === 'doc' ? 'Thầy cô chọn một tài liệu hoặc "Chọn file mẫu" trước nhé.' : 'Thầy cô chọn video, dán link YouTube hoặc "Chọn file mẫu" trước nhé.')
        const display = name.trim()
        // Việc đọc chạy nền: hộp đóng ngay, thẻ mới hiện ở kho với tiến độ thật
        const run = tab === 'doc' ? (sample ? ingestSampleDocument(courseId, display) : ingestDocument({ courseId, title: display, file: file! })) : ingestVideo({ courseId, title: display, link: link || undefined, fileName: file?.name })
        run.then(
            () => onNotify(`AI đã đọc xong: ${display || picked || 'nguồn mới'}`),
            (e) => onNotify(e instanceof IngestError ? e.message : 'Chưa đọc được nguồn này. Thầy cô thử lại nhé.'),
        )
        onNotify('Đang cho AI đọc nguồn mới…')
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-strong/40 p-6 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="kb-up-title" className="w-[min(680px,100%)] rounded-3xl border border-white/90 bg-card/90 p-7 shadow-raised backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                    <h2 id="kb-up-title" className="text-2xl font-black tracking-[-0.02em] text-strong">
                        Tải lên nguồn kiến thức
                    </h2>
                    <button type="button" aria-label="Đóng" onClick={onClose} className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-muted">
                        <X size={18} />
                    </button>
                </div>
                <div role="tablist" className="mt-4 flex gap-1.5 rounded-[14px] bg-muted p-1.5">
                    {(['doc', 'video'] as const).map((t) => (
                        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => switchTab(t)} className={`h-10 flex-1 rounded-[10px] text-sm font-bold transition ${tab === t ? 'bg-card text-strong shadow-card' : 'text-muted-foreground hover:text-strong'}`}>
                            {t === 'doc' ? 'Tài liệu' : 'Video'}
                        </button>
                    ))}
                </div>

                <div
                    onDragOver={(e) => {
                        e.preventDefault()
                        setDrag(true)
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => {
                        e.preventDefault()
                        setDrag(false)
                        choose(e.dataTransfer.files[0])
                    }}
                    className={`mt-4 rounded-[18px] border-2 border-dashed p-8 text-center transition ${drag ? 'border-brand-600 bg-brand-50' : 'border-brand-200 bg-brand-50/50'}`}
                >
                    {picked ? (
                        <b className="flex items-center justify-center gap-2 text-base text-strong">
                            <Check size={18} className="text-success" aria-hidden /> {picked}
                        </b>
                    ) : (
                        <>
                            <b className="block text-base text-strong">{tab === 'doc' ? 'Kéo thả tài liệu vào đây' : 'Kéo thả video hoặc dán link YouTube'}</b>
                            <small className="mt-1.5 block text-[13px] text-muted-foreground">{tab === 'doc' ? 'PDF, Word, PowerPoint · tối đa 50 MB' : 'MP4, MOV · hoặc link YouTube có phụ đề'}</small>
                        </>
                    )}
                    <div className="mt-3.5 flex items-center justify-center gap-5 text-sm font-extrabold text-brand-ink">
                        <button type="button" onClick={() => input.current?.click()} className="hover:underline">
                            Chọn từ máy
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFile(null)
                                setSample(true)
                                setError('')
                            }}
                            className="hover:underline"
                        >
                            Chọn file mẫu
                        </button>
                    </div>
                    <input ref={input} type="file" hidden accept={tab === 'doc' ? DOC_ACCEPT : VIDEO_ACCEPT} onChange={(e) => (choose(e.target.files?.[0]), (e.target.value = ''))} />
                </div>
                {tab === 'video' && (
                    <label className="mt-3 block text-xs font-bold text-muted-foreground">
                        Hoặc link YouTube
                        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" className={field} />
                    </label>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <label className="text-xs font-bold text-muted-foreground">
                        Khóa học
                        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={field}>
                            {staticCourses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.title}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs font-bold text-muted-foreground">
                        Tên hiển thị
                        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Tự lấy từ tên file" className={field} />
                    </label>
                </div>
                <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted-foreground">AI sẽ đọc, chia thành các đoạn kiến thức có số trang, rồi dùng làm nguồn trả lời cho sinh viên. Bản demo: file không rời khỏi máy.</p>
                {error && (
                    <p role="alert" className="mt-2 text-sm font-semibold text-brand-ink">
                        {error}
                    </p>
                )}
                <div className="mt-4 flex justify-end">
                    <button type="button" onClick={submit} className="inline-flex h-[52px] items-center gap-3 rounded-full surface-red pl-[22px] pr-2 text-[15.5px] font-extrabold text-ink-foreground shadow-brand transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                        Cho AI đọc
                        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-ink-foreground text-brand-600">
                            <ArrowRight size={18} />
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}
