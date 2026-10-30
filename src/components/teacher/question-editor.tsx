import { fieldCls, labelCls, OptionRows } from '@/components/teacher/review-fields'
import type { Concept } from '@/data/types'
import { newCustomId, type SourcedQuestion } from '@/lib/test-sets'

/** Câu mới để thầy cô tự viết: 4 đáp án trống, đáp án đúng là A. */
export function blankQuestion(lessonId: string, conceptId: string): SourcedQuestion {
    return { id: newCustomId(), lessonId, conceptId, prompt: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', source: 'teacher' }
}

/** Editor một câu hỏi trong đề (dùng ở Kiểm tra nhanh và Test cuối chương): nội dung, 4 đáp án, đáp án đúng, giải thích, khái niệm. */
export function QuestionEditor({
    question,
    concepts,
    isBank,
    onChange,
    onDone,
}: {
    question: SourcedQuestion
    concepts: Concept[]
    /** Câu lấy từ kho: sửa sẽ thành bản riêng của đề, bài giảng gốc không đổi */
    isBank: boolean
    onChange: (next: SourcedQuestion) => void
    onDone: () => void
}) {
    const id = `qe-${question.id}`
    const valid = question.prompt.trim() && question.options.every((o) => o.trim()) && new Set(question.options.map((o) => o.trim())).size === question.options.length
    return (
        <div className="rounded-[14px] border border-border bg-card p-4">
            {isBank && <p className="mb-1 rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">Sửa câu này sẽ tạo bản riêng cho đề, bài giảng gốc giữ nguyên.</p>}
            <label className={labelCls} htmlFor={`${id}-prompt`}>
                Câu hỏi
            </label>
            <textarea id={`${id}-prompt`} rows={2} value={question.prompt} onChange={(e) => onChange({ ...question, prompt: e.target.value })} className={fieldCls} />
            <span className={labelCls}>Đáp án · bấm vòng tròn để chọn đáp án đúng</span>
            <OptionRows question={question} onChange={(next) => onChange({ ...question, ...next })} />
            <label className={labelCls} htmlFor={`${id}-explain`}>
                Giải thích khi sinh viên sai
            </label>
            <textarea id={`${id}-explain`} rows={2} value={question.explanation} onChange={(e) => onChange({ ...question, explanation: e.target.value })} className={fieldCls} />
            <label className={labelCls} htmlFor={`${id}-concept`}>
                Khái niệm
            </label>
            <select id={`${id}-concept`} value={question.conceptId} onChange={(e) => onChange({ ...question, conceptId: e.target.value })} className={`${fieldCls} h-11`}>
                {concepts.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.name}
                    </option>
                ))}
            </select>
            <div className="mt-4 flex items-center gap-3">
                <button type="button" onClick={onDone} disabled={!valid} className="h-11 rounded-xl bg-strong px-5 text-[15px] font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                    Xong
                </button>
                {!valid && <small className="text-[13px] text-muted-foreground">Cần có nội dung câu hỏi và 4 đáp án khác nhau.</small>}
            </div>
        </div>
    )
}
