import { lazy, Suspense, useEffect, useState } from 'react'
import { FileText, FileType2, Presentation } from 'lucide-react'
import { chunksOf, selectSources, useKb } from '@/lib/kb/store'
import type { KbFormat, KbSource } from '@/lib/kb/types'

// Popup xem PDF kéo theo pdf.js nên chỉ tải khi sinh viên bấm một tài liệu
const DocViewer = lazy(() => import('@/components/kb/doc-viewer').then((m) => ({ default: m.DocViewer })))

const ICON: Record<KbFormat, typeof FileText> = { pdf: FileText, docx: FileType2, pptx: Presentation, video: FileText }

/** Tài liệu tham khảo ĐÃ ĐỌC XONG của một khóa (nguồn đang "AI đang đọc" chưa hiện cho sinh viên). */
export function useCourseDocs(courseId: string | undefined): KbSource[] {
    const kb = useKb()
    useEffect(() => void kb.load(), [kb.load]) // eslint-disable-line react-hooks/exhaustive-deps
    return selectSources(kb).filter((s) => s.kind === 'doc' && s.courseId === courseId && !kb.reading[s.id])
}

/** Danh sách tài liệu của khóa; bấm để mở xem (PDF render đúng trang, DOCX/PPTX xem chữ đã đọc). */
export function CourseDocs({ courseId, empty }: { courseId: string; empty?: string }) {
    const docs = useCourseDocs(courseId)
    const kb = useKb()
    const [open, setOpen] = useState<KbSource | null>(null)
    if (docs.length === 0) return empty ? <p className="p-4 text-sm text-muted-foreground">{empty}</p> : null
    return (
        <>
            <ul className="space-y-2">
                {docs.map((d) => {
                    const Icon = ICON[d.format]
                    return (
                        <li key={d.id}>
                            <button type="button" onClick={() => setOpen(d)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-ink">
                                    <Icon size={18} aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <b className="block truncate text-sm text-strong">{d.title}</b>
                                    <small className="text-xs text-muted-foreground">
                                        {d.format.toUpperCase()}
                                        {d.pages ? ` · ${d.pages} ${d.format === 'pptx' ? 'slide' : 'trang'}` : ''}
                                    </small>
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ul>
            {open && (
                <Suspense fallback={null}>
                    <DocViewer source={open} chunks={chunksOf(kb, open.courseId).filter((c) => c.sourceId === open.id)} onClose={() => setOpen(null)} />
                </Suspense>
            )}
        </>
    )
}

/** Khối "Tài liệu của học phần" ở trang Học phần: chỉ hiện khi khóa có tài liệu. */
export function CourseDocsSection({ courseId }: { courseId: string }) {
    const docs = useCourseDocs(courseId)
    if (docs.length === 0) return null
    return (
        <section aria-label="Tài liệu của học phần" className="mt-6">
            <h2 className="mb-3 text-[15px] font-extrabold text-strong">Tài liệu của học phần</h2>
            <div className="max-w-xl">
                <CourseDocs courseId={courseId} />
            </div>
        </section>
    )
}
