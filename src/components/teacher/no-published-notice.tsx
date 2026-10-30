import type { LessonReview } from '@/lib/teacher'

const STATE_LABEL: Record<LessonReview['state'], string> = { wait: 'Chờ duyệt', editing: 'Đang duyệt', generating: 'AI đang tạo', published: 'Đã xuất bản' }

/** Bài nên mở để duyệt tiếp: đang duyệt dở, rồi bài chờ duyệt đầu tiên. */
export const firstToReview = (items: LessonReview[]) => (items.find((r) => r.state === 'editing') ?? items.find((r) => r.state === 'wait') ?? items.find((r) => r.state !== 'published'))?.lesson.id

/** Danh sách bài chưa xuất bản của khóa (tên + trạng thái). */
export function LessonStateList({ items }: { items: LessonReview[] }) {
    return (
        <ul className="mt-3 divide-y divide-border rounded-[12px] border border-border">
            {items.map((r) => (
                <li key={r.lesson.id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[13.5px]">
                    <span className="min-w-0 truncate font-semibold text-strong">{r.lesson.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{STATE_LABEL[r.state]}</span>
                </li>
            ))}
        </ul>
    )
}

/** Nội dung báo "chưa thể soạn Test cuối chương" khi khóa chưa có bài nào xuất bản; dùng chung cho hộp thoại ở trang Bài giảng và trang soạn test. */
export function NoPublishedBody({ courseTitle, pending }: { courseTitle: string; pending: LessonReview[] }) {
    return (
        <>
            <p>
                Đề test chỉ lấy câu hỏi từ các bài đã duyệt và xuất bản. Khóa {courseTitle} chưa có bài nào được xuất bản.
            </p>
            {pending.length > 0 && <LessonStateList items={pending} />}
        </>
    )
}
