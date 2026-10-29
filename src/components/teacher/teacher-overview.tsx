import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, ClipboardCheck, Play } from 'lucide-react'
import { classStats } from '@/data'
import { TEACHER_PROFILE } from '@/data/teacher-notes'
import { AnswerBars } from '@/components/teacher/answer-bars'
import { buildAttention, buildTasks, courseTest, otherWatch, pct, useLessonReviews, type LessonReview, type TeacherTask } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const reviewTo = (id: string, query = '') => `/teacher/review/${id}${query}`

const STATE_CHIP: Record<LessonReview['state'], string> = {
    wait: 'bg-brand-50 text-brand-ink',
    editing: 'bg-muted text-strong',
    published: 'bg-success-soft text-success',
}

function stateLabel(r: LessonReview) {
    return r.state === 'wait' ? 'Chờ duyệt' : r.state === 'editing' ? `Đang duyệt ${r.done}/${r.total}` : 'Đã xuất bản'
}

/** Tổng quan của vai giảng viên (route "/"): việc hôm nay, điểm lớp đang hổng, danh sách bài. Không có cảnh 3D. */
export function TeacherOverview() {
    const role = useOrbitStore((s) => s.role)
    const reviews = useLessonReviews()
    if (role !== 'teacher') return <Navigate to="/" replace />

    const tasks = buildTasks(reviews)
    const att = buildAttention(reviews)
    const published = reviews.filter((r) => r.published).length

    return (
        <div className="w-full">
            <div className="container-wide pb-8 pt-7">
                <section className="lesson-grid items-stretch">
                    <div className="flex min-w-0 flex-col">
                        <p className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
                            Tổng quan <span className="tracking-[0.08em] text-muted-foreground">· lớp mẫu {classStats.classSize} sinh viên</span>
                        </p>
                        <h1 className="mt-3.5 text-[clamp(48px,4.6vw,76px)] font-black leading-[0.98] tracking-[-0.045em] text-strong">
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

                        <div className="mt-7 flex max-w-[760px] flex-col gap-3">
                            {tasks.length === 0 ? (
                                <div className="flex items-center justify-between gap-4 rounded-[22px] border border-border bg-card p-5 shadow-card">
                                    <div>
                                        <p className="text-lg font-extrabold text-strong">Mọi bài đã xuất bản</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Không còn nội dung AI nào chờ thầy cô duyệt.</p>
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

                    <AttentionCard reviews={reviews} att={att} />
                </section>

                <section className="mt-8 border-t border-border pt-4">
                    <details className="group relative">
                        <summary className="flex h-8 cursor-pointer list-none items-center gap-2.5 text-sm font-bold text-muted-foreground transition hover:text-strong [&::-webkit-details-marker]:hidden">
                            Tất cả bài giảng · {published} đã xuất bản, {reviews.length - published} cần duyệt
                            <ChevronDown size={13} className="transition-transform duration-fast group-open:rotate-180" aria-hidden />
                        </summary>
                        <Link to="/teacher/class" className="absolute right-0 top-0 inline-flex h-8 items-center gap-1.5 text-sm font-bold text-brand-ink transition hover:underline">
                            Xem cả lớp <ArrowRight size={14} aria-hidden />
                        </Link>
                        <ul className="mt-3 flex flex-col">
                            {reviews.map((r) => (
                                <li key={r.lesson.id}>
                                    <Link to={reviewTo(r.lesson.id)} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-muted">
                                        <span className="font-mono text-xs font-bold text-muted-foreground">{String(r.index + 1).padStart(2, '0')}</span>
                                        <b className="min-w-0 text-sm font-semibold leading-snug text-strong">
                                            {r.lesson.title}
                                            <small className="mt-0.5 block font-mono text-xs font-medium text-muted-foreground">
                                                {r.course?.title} · {formatTime(r.lesson.durationSec)}
                                            </small>
                                        </b>
                                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATE_CHIP[r.state]}`}>{stateLabel(r)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </details>
                    {/* Khi đóng, link nằm ở mép phải của hàng; khi mở thì ở đầu danh sách (absolute theo details) */}
                </section>
            </div>
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
        sub: `${t.review.lesson.shortTitle ?? lessonTitle} · ${concept?.name ?? 'khái niệm'} · ${t.share}% chọn nhầm một đáp án`,
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

function AttentionCard({ reviews, att }: { reviews: LessonReview[]; att: ReturnType<typeof buildAttention> }) {
    if (!att) {
        return (
            <aside className="flex flex-col rounded-[20px] border border-border bg-card p-[22px] shadow-card">
                <h2 className="text-base font-extrabold text-strong">Cần chú ý nhất</h2>
                <p className="mt-2 text-sm text-muted-foreground">Chưa có dữ liệu trả lời của lớp.</p>
            </aside>
        )
    }
    const { concept, review, question, rate, wrong, answered, why } = att
    const others = otherWatch(reviews, concept.id)
    const test = courseTest(review.lesson.courseId)
    const base = reviewTo(review.lesson.id)
    const seekAt = question?.pauseAt ?? concept.segment.start
    const itemQuery = question ? `?item=q:${question.id}` : `?t=${concept.segment.start}`
    return (
        <aside className="flex min-w-0 flex-col rounded-[20px] border border-border bg-card p-[22px] shadow-card">
            <h2 className="text-base font-extrabold text-strong">Cần chú ý nhất</h2>
            <p className="mt-3 font-mono text-[44px] font-extrabold leading-none text-brand-ink">{rate}%</p>
            <p className="mt-2 text-sm leading-snug text-foreground">
                sinh viên sai ngay lần đầu ở <b className="text-strong">{concept.name}</b>{' '}
                <span className="font-mono text-xs text-muted-foreground">
                    ({wrong}/{answered})
                </span>
            </p>
            {question && (
                <div className="mt-4">
                    <p className="mb-2 line-clamp-2 text-[13px] font-semibold leading-snug text-strong">{question.prompt}</p>
                    <AnswerBars question={question} compact />
                </div>
            )}
            {why && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{why}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`${base}${question ? `?item=q:${question.id}` : itemQuery}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-ink transition hover:bg-brand-100">
                    <Play size={13} className="fill-current" aria-hidden /> Xem đoạn <span className="font-mono">{formatTime(seekAt)}</span>
                </Link>
                <Link to={`${base}${itemQuery}`} className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-bold text-strong transition hover:bg-muted">
                    Sửa câu hỏi
                </Link>
            </div>
            {others.length > 0 && (
                <details className="group mt-4 border-t border-border pt-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-bold text-muted-foreground transition hover:text-strong [&::-webkit-details-marker]:hidden">
                        {others.length} khái niệm khác cần theo dõi
                        <ChevronDown size={13} className="transition-transform duration-fast group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1.5">
                        {others.slice(0, 6).map((o) => (
                            <li key={o.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                                <span className="min-w-0 truncate text-foreground">{o.name}</span>
                                <span className="font-mono font-bold text-muted-foreground">{o.rate}%</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            {test && (
                <p className="mt-auto pt-4 text-xs text-muted-foreground">
                    <span className="font-mono">
                        {test.attempted}/{classStats.classSize}
                    </span>{' '}
                    làm test · TB <span className="font-mono">{test.avgCorrectPct}%</span> · <span className="font-mono">{pct(test.passed, test.attempted)}%</span> đạt
                </p>
            )}
        </aside>
    )
}
