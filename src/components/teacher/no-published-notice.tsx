import { useState } from 'react'
import type { LessonReview } from '@/lib/teacher'

/** Bài nên mở để duyệt tiếp: đang duyệt dở, rồi bài chờ duyệt đầu tiên. */
export const firstToReview = (items: LessonReview[]) => (items.find((r) => r.state === 'editing') ?? items.find((r) => r.state === 'wait') ?? items.find((r) => r.state !== 'published'))?.lesson.id

const SHOWN = 3
const chip = (r: LessonReview) => (r.state === 'editing' ? `Đang duyệt ${r.done}/${r.total}` : r.state === 'generating' ? 'AI đang tạo' : 'Chờ duyệt')

/** Danh sách bài chưa xuất bản của khóa: mỗi hàng bấm được để mở trang Duyệt; bài đang dở lên trước, quá 3 bài thì thu gọn "Xem thêm". */
export function LessonStateList({ items, onPick }: { items: LessonReview[]; onPick: (lessonId: string) => void }) {
    const [expanded, setExpanded] = useState(false)
    const sorted = [...items].sort((a, b) => Number(b.state === 'editing') - Number(a.state === 'editing'))
    const shown = expanded ? sorted : sorted.slice(0, SHOWN)
    const more = sorted.length - SHOWN
    return (
        <div className="mt-3">
            <ul className={`divide-y divide-border rounded-[12px] border border-border ${expanded ? 'max-h-[320px] overflow-y-auto' : ''}`}>
                {shown.map((r) => {
                    const row = (
                        <>
                            <span title={r.lesson.title} className="min-w-0 flex-1 truncate text-left font-semibold text-strong">
                                {r.lesson.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{chip(r)}</span>
                            {r.state !== 'generating' && <span className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-extrabold text-strong">{r.state === 'editing' ? 'Duyệt tiếp' : 'Duyệt'}</span>}
                        </>
                    )
                    return (
                        <li key={r.lesson.id}>
                            {r.state === 'generating' ? (
                                <div className="flex items-center gap-2.5 px-3.5 py-2 text-[13.5px]">{row}</div>
                            ) : (
                                <button type="button" onClick={() => onPick(r.lesson.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13.5px] transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                                    {row}
                                </button>
                            )}
                        </li>
                    )
                })}
            </ul>
            {more > 0 && (
                <button type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="mt-1.5 rounded-lg px-1 py-1 text-[13px] font-bold text-brand-ink hover:underline">
                    {expanded ? 'Thu gọn ▴' : `Xem thêm ${more} bài ▾`}
                </button>
            )}
        </div>
    )
}

/** Nội dung báo "chưa thể soạn Test cuối chương" khi khóa chưa có bài nào xuất bản; dùng chung cho hộp thoại ở trang Bài giảng và trang soạn test. */
export function NoPublishedBody({ courseTitle, pending, onPick }: { courseTitle: string; pending: LessonReview[]; onPick: (lessonId: string) => void }) {
    return (
        <>
            <p>
                Đề test chỉ lấy câu hỏi từ các bài đã duyệt và xuất bản. Khóa {courseTitle} chưa có bài nào được xuất bản.
            </p>
            {pending.length > 0 && <LessonStateList items={pending} onPick={onPick} />}
        </>
    )
}
