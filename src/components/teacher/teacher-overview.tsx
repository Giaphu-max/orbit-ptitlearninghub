import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, ClipboardCheck, Play } from 'lucide-react'
import { ClassPicker } from '@/components/teacher/class-picker'
import { AddLessonsDialog } from '@/components/teacher/add-lessons-dialog'
import { AnswerBars } from '@/components/teacher/answer-bars'
import { buildAttention, buildTasks, pct, useLessonReviews, useTeacherClass, type TeacherTask } from '@/lib/teacher'
import { TEACHER_PROFILE } from '@/data/teacher-notes'
import type { ClassStats } from '@/data/types'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const reviewTo = (id: string, query = '') => `/teacher/review/${id}${query}`
const shortConcept = (name: string) => name.replace(/\s*\(.*\)$/, '')

/** Tổng quan của vai giảng viên (route "/"): việc hôm nay và điểm lớp đang hổng, theo lớp đang chọn. Không có cảnh 3D. */
export function TeacherOverview() {
    const role = useOrbitStore((s) => s.role)
    const all = useLessonReviews()
    const { cls, courseIds, stats } = useTeacherClass()
    const [adding, setAdding] = useState(false)
    if (role !== 'teacher') return <Navigate to="/" replace />

    const reviews = all.filter((r) => courseIds.includes(r.lesson.courseId))
    const tasks = buildTasks(reviews, stats)
    const att = buildAttention(reviews, stats)

    return (
        <div className="w-full">
            <div className="container-wide pb-10 pt-6">
                <div className="flex items-center justify-between gap-4">
                    <ClassPicker />
                    <button type="button" onClick={() => setAdding(true)} className="text-sm font-bold text-muted-foreground transition hover:text-brand-ink">
                        + Thêm bài giảng
                    </button>
                </div>

                <section className="lesson-grid mt-7 items-start">
                    <div className="flex min-w-0 flex-col">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
                            Tổng quan <span className="tracking-[0.08em] text-muted-foreground">· lớp {cls.id} · {cls.size} sinh viên</span>
                        </p>
                        <h1 className="mt-3 text-[clamp(40px,3.4vw,56px)] font-black leading-[1.04] tracking-[-0.04em] text-strong">
                            Chào {TEACHER_PROFILE.honorific} {TEACHER_PROFILE.name}.
                            <br />
                            {tasks.length > 0 ? (
                                <>
                                    Hôm nay có <em className="not-italic text-brand-ink">{tasks.length} việc</em>.
                                </>
                            ) : (
                                <>
                                    Hôm nay <em className="not-italic text-brand-ink">hết việc</em>.
                                </>
                            )}
                        </h1>

                        <div className="mt-7 flex max-w-[820px] flex-col gap-2.5">
                            {tasks.length === 0 ? (
                                <div className="flex items-center justify-between gap-4 rounded-[22px] border border-border bg-card p-5 shadow-card">
                                    <div>
                                        <p className="text-lg font-extrabold text-strong">Mọi bài đã xuất bản</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Không còn nội dung AI nào của lớp {cls.id} chờ thầy cô duyệt.</p>
                                    </div>
                                    <Link to="/teacher/class" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-brand-200 px-5 text-sm font-bold text-brand-ink transition hover:bg-brand-50">
                                        Xem lớp học <ArrowRight size={15} />
                                    </Link>
                                </div>
                            ) : (
                                tasks.map((t, i) => (i === 0 ? <PrimaryTask key={t.kind} task={t} /> : <TaskRow key={t.kind} task={t} n={i + 1} />))
                            )}
                        </div>
                    </div>

                    <AttentionCard stats={stats} att={att} />
                </section>
            </div>
            {adding && <AddLessonsDialog onClose={() => setAdding(false)} />}
        </div>
    )
}

interface TaskView {
    eyebrow: string
    title: string
    sub: string
    time: string
    to: string
    cta: string
}

function describe(t: TeacherTask): TaskView {
    const lessonTitle = t.review.lesson.title
    const course = t.review.course?.title ?? ''
    if (t.kind === 'resume') {
        return { eyebrow: 'Duyệt tiếp bài đang dở', title: lessonTitle, sub: course, time: `~${t.minutes} phút`, to: reviewTo(t.review.lesson.id), cta: 'Tiếp tục' }
    }
    if (t.kind === 'new') {
        return { eyebrow: 'Duyệt bài mới AI vừa tạo', title: lessonTitle, sub: `${course} · ${t.review.total} mục`, time: `~${t.minutes} phút`, to: reviewTo(t.review.lesson.id), cta: 'Bắt đầu' }
    }
    const concept = t.review.lesson.concepts.find((c) => c.id === t.question.conceptId)
    return {
        eyebrow: 'Sửa một câu hỏi gây nhầm',
        title: t.question.prompt,
        sub: `${shortConcept(concept?.name ?? 'Khái niệm')} · xem thẻ bên phải`,
        time: `~${t.minutes} phút`,
        to: reviewTo(t.review.lesson.id, `?item=q:${t.question.id}`),
        cta: 'Sửa',
    }
}

/** Việc đầu tiên: khối đỏ tầng 1, cả khối là nút. */
function PrimaryTask({ task }: { task: TeacherTask }) {
    const v = describe(task)
    const resume = task.kind === 'resume' ? task : null
    return (
        <Link
            to={v.to}
            className="surface-red tier-1-bob grid grid-cols-[64px_1fr_48px] items-center gap-5 rounded-[22px] px-[22px] py-5 text-ink-foreground shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
            <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-ink-foreground/20">
                <ClipboardCheck size={28} aria-hidden />
            </span>
            <span className="min-w-0">
                <small className="block text-xs font-bold uppercase tracking-[0.12em] opacity-90">1 · {v.eyebrow}</small>
                <b className="mt-1.5 block text-xl font-extrabold leading-snug">{v.title}</b>
                {resume ? (
                    <span className="mt-2.5 flex items-center gap-3 font-mono text-[13px] font-semibold opacity-95">
                        <span>
                            {resume.review.done}/{resume.review.total} mục
                        </span>
                        <i className="h-[5px] max-w-[220px] flex-1 overflow-hidden rounded-full bg-ink-foreground/30">
                            <u className="block h-full bg-ink-foreground no-underline" style={{ width: `${pct(resume.review.done, resume.review.total)}%` }} />
                        </i>
                        <span>
                            còn {resume.left} · {v.time}
                        </span>
                    </span>
                ) : (
                    <span className="mt-2.5 block font-mono text-[13px] font-semibold opacity-95">
                        {v.sub} · {v.time}
                    </span>
                )}
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-foreground text-brand-600" aria-hidden>
                <ArrowRight size={20} />
            </span>
        </Link>
    )
}

function TaskRow({ task, n }: { task: TeacherTask; n: number }) {
    const v = describe(task)
    return (
        <div className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-4 rounded-[18px] border border-border bg-card px-5 py-4 shadow-card">
            <span className="font-mono text-sm font-bold text-muted-foreground">{n}</span>
            <span className="min-w-0">
                <b className="block text-[15px] font-bold leading-snug text-strong">{v.eyebrow}</b>
                <small className="mt-0.5 block truncate text-[13px] text-muted-foreground" title={v.title}>
                    {task.kind === 'fix' ? v.sub : `${v.title} · ${v.sub}`}
                </small>
            </span>
            <span className="font-mono text-[13px] font-semibold text-muted-foreground">{v.time}</span>
            <Link to={v.to} className="inline-flex h-9 items-center rounded-full border border-brand-300 px-4 text-sm font-bold text-brand-ink transition hover:bg-brand-50">
                {v.cta}
            </Link>
        </div>
    )
}

function AttentionCard({ stats, att }: { stats: ClassStats; att: ReturnType<typeof buildAttention> }) {
    if (!att) {
        return (
            <aside className="flex flex-col rounded-[20px] border border-border bg-card p-[22px] shadow-card">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">Cần chú ý nhất</h2>
                <p className="mt-2 text-sm text-muted-foreground">Chưa có dữ liệu trả lời của lớp này.</p>
            </aside>
        )
    }
    const { concept, review, question, wrong, answered, why } = att
    const base = reviewTo(review.lesson.id)
    const seekAt = question?.pauseAt ?? concept.segment.start
    const itemQuery = question ? `?item=q:${question.id}` : `?t=${concept.segment.start}`
    return (
        <aside className="flex min-w-0 flex-col rounded-[20px] border border-border bg-card p-[22px] shadow-card">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
                Cần chú ý nhất <span className="tracking-[0.06em] text-muted-foreground normal-case">· Bài {review.index + 1} · {review.course?.title}</span>
            </h2>
            <p className="mt-3.5 font-mono text-[52px] font-extrabold leading-none tracking-[-0.03em] text-brand-ink">
                {wrong}/{answered}
            </p>
            <p className="mt-2 text-sm leading-snug text-foreground">
                sinh viên sai ngay lần đầu ở <b className="text-strong">{shortConcept(concept.name)}</b>
            </p>
            {why && (
                <div className="mt-4 rounded-r-xl border-l-[3px] border-brand-600 bg-brand-50 px-4 py-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-ink">Vì sao sai</p>
                    <p className="mt-1.5 text-[16.5px] font-bold leading-snug text-strong">{why}</p>
                </div>
            )}
            {question && (
                <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                        Câu hỏi trong video · <span className="font-mono">{formatTime(question.pauseAt)}</span>
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-strong">{question.prompt}</p>
                    <details className="group mt-2.5">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-bold text-muted-foreground transition hover:text-strong [&::-webkit-details-marker]:hidden">
                            Xem sinh viên chọn đáp án <ChevronDown size={13} className="transition-transform duration-fast group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="mt-2.5">
                            <AnswerBars stats={stats} question={question} />
                        </div>
                    </details>
                </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`${base}${itemQuery}`} className="inline-flex h-9 items-center rounded-[10px] bg-strong px-4 text-[13.5px] font-bold text-background transition hover:opacity-90">
                    Sửa câu hỏi
                </Link>
                <Link to={`${base}${itemQuery}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-brand-50 px-3.5 text-[13px] font-bold text-brand-ink transition hover:bg-brand-100">
                    <Play size={12} className="fill-current" aria-hidden /> Xem đoạn <span className="font-mono">{formatTime(seekAt)}</span>
                </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
                Các khái niệm khác lớp còn sai →{' '}
                <Link to="/teacher/class" className="font-bold text-brand-ink hover:underline">
                    Lớp học
                </Link>
            </p>
        </aside>
    )
}
