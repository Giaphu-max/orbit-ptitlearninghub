import { Check } from 'lucide-react'
import { subjectVars, type CourseSummary } from '@/lib/course-map'
import { CourseArt } from '@/components/courses/course-cover'
import './course-map.css'

/** Số cột lưới ô khóa: tự co theo bề rộng (≥250px/ô), mobile 2 cột. */
export const COURSE_GRID = 'grid grid-cols-2 gap-2.5 min-[760px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] min-[760px]:gap-3.5'

/** Ô khóa: bìa khóa 16:7, chip môn, tên khóa, đường chặng mini và một dòng trạng thái. */
export function CourseTile({ summary, selected, onSelect }: { summary: CourseSummary; selected: boolean; onSelect: () => void }) {
    const { course, lessons, status, pct, pcts, curIndex, fill, minutes, record } = summary
    const passed = record && record.bestTotal > 0 && record.bestCorrect / record.bestTotal >= 0.7
    const sub =
        status === 'done'
            ? `Đã xong · test ${record ? `${record.bestCorrect}/${record.bestTotal}` : 'chưa làm'}`
            : status === 'doing'
              ? `Tiếp: Chặng ${String(curIndex + 1).padStart(2, '0')} · ${pct}%`
              : `${lessons.length} bài · ${minutes} phút`
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            style={subjectVars(course.subject, course.cover?.accent)}
            className={`group flex w-full flex-col overflow-hidden rounded-[20px] border bg-card text-left transition duration-base ease-out hover:-translate-y-[3px] hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                selected ? 'border-brand-600 shadow-[0_0_0_1px_rgb(var(--brand-600))]' : 'border-border'
            }`}
        >
            <span className={`relative block aspect-[16/7] max-h-60 w-full overflow-hidden ${status === 'new' ? 'saturate-[.35] brightness-90' : ''}`}>
                <CourseArt course={course} />
                {status !== 'new' && (
                    <b className={`absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono text-[13px] ${status === 'done' ? 'bg-success text-success-foreground' : 'bg-ink/60 text-ink-foreground'}`}>
                        {status === 'done' && <Check size={12} strokeWidth={3} aria-hidden />}
                        {pct}%
                    </b>
                )}
            </span>
            <span className="flex flex-col gap-1.5 px-3 pb-3 pt-2.5 min-[760px]:px-4 min-[760px]:pb-4 min-[760px]:pt-3.5">
                <span className="cm-chip self-start rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">{course.subject}</span>
                <strong className="line-clamp-2 min-h-[2.6em] text-sm font-extrabold leading-[1.3] text-foreground min-[760px]:text-base">{course.title}</strong>
                <span className="cm-mini mt-1.5" style={{ ['--f' as string]: fill }} aria-hidden>
                    {lessons.map((l, j) => (
                        <i key={l.id} className={pcts[j] >= 100 ? 'd' : j === curIndex && status === 'doing' ? 'c' : ''} />
                    ))}
                    <i className={`f ${passed ? 'd' : ''}`} />
                </span>
                <em className={`text-xs not-italic ${status === 'doing' ? 'font-bold text-brand-ink' : 'text-muted-foreground'}`}>{sub}</em>
            </span>
        </button>
    )
}
