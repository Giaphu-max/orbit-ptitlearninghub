import { parseInline } from '@/lib/daily-text'

/** Văn bản có từ khóa khái niệm: mỗi từ khóa là nút bấm, bấm mở popover ở bài đọc. */
export function InlineText({ text, onConcept }: { text: string; onConcept: (conceptId: string, el: HTMLElement) => void }) {
    return (
        <>
            {parseInline(text).map((p, i) =>
                p.conceptId ? (
                    <button
                        key={i}
                        type="button"
                        onClick={(e) => onConcept(p.conceptId!, e.currentTarget)}
                        aria-haspopup="dialog"
                        className="rounded-md border-b-2 border-brand-300 bg-brand-soft px-1 font-semibold text-foreground transition-colors duration-fast hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                        {p.text}
                    </button>
                ) : (
                    <span key={i}>{p.text}</span>
                ),
            )}
        </>
    )
}
