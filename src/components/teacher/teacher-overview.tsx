import { Link, Navigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { useAddDialog } from '@/components/teacher/add-dialog-state'
import { TEACHER_PROFILE } from '@/data/teacher-notes'
import type { ClassStats } from '@/data/types'
import { buildAttention, buildTasks, pct, questionPicks, topTrap, useAllStats, useLessonReviews, type Attention, type TeacherTask } from '@/lib/teacher'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const reviewTo = (id: string, query = '') => `/teacher/review/${id}${query}`
const shortConcept = (name: string) => name.replace(/\s*\(.*\)$/, '')

function todayLabel() {
    const d = new Date()
    const w = d.toLocaleDateString('vi-VN', { weekday: 'long' })
    return `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface TaskView {
    ring: { p: number; label: string; warn?: boolean }
    title: string
    chip: { text: string; tone: 'edit' | 'wait' }
    sub: string
    bar: number
    big: string
    unit: string
    cta: string
    to: string
}

function describe(t: TeacherTask, stats: ClassStats): TaskView {
    const { review } = t
    const course = review.course?.title ?? ''
    if (t.kind === 'resume') {
        return {
            ring: { p: pct(review.done, review.total), label: `${review.done}/${review.total}` },
            title: `Duyệt tiếp: ${review.lesson.title}`,
            chip: { text: 'Đang duyệt', tone: 'edit' },
            sub: `${course} · bài ${review.index + 1} · ~${t.minutes} phút`,
            bar: pct(review.done, review.total),
            big: String(t.left),
            unit: 'mục còn lại',
            cta: 'Duyệt tiếp',
            to: reviewTo(review.lesson.id),
        }
    }
    if (t.kind === 'new') {
        return {
            ring: { p: 0, label: `0/${review.total}` },
            title: `Duyệt bài mới: ${review.lesson.title}`,
            chip: { text: 'Chờ duyệt', tone: 'wait' },
            sub: `${course} · AI vừa tạo xong · ~${t.minutes} phút`,
            bar: 0,
            big: String(review.total),
            unit: 'mục còn lại',
            cta: 'Bắt đầu',
            to: reviewTo(review.lesson.id),
        }
    }
    const concept = review.lesson.concepts.find((c) => c.id === t.question.conceptId)
    const trap = topTrap(stats, t.question)
    const picks = questionPicks(stats, t.question.id)
    const n = trap && picks ? picks[trap.index] : 0
    const total = picks ? picks.reduce((a, b) => a + b, 0) : 0
    return {
        ring: { p: t.share, label: String(n), warn: true },
        title: `Sửa câu hỏi gây nhầm: ${shortConcept(concept?.name ?? 'Khái niệm')}`,
        chip: { text: 'Đáp án nhiễu', tone: 'wait' },
        sub: `${n}/${total} SV chọn cùng một đáp án sai · ~${t.minutes} phút`,
        bar: t.share,
        big: `${t.share}%`,
        unit: 'chọn nhầm',
        cta: 'Sửa',
        to: reviewTo(review.lesson.id, `?item=q:${t.question.id}`),
    }
}

/** Tổng quan của vai giảng viên (route "/"): việc hôm nay và điểm sinh viên đang hổng, tính trên toàn bộ sinh viên đã học (không theo lớp). Không có cảnh 3D. */
export function TeacherOverview() {
    const role = useOrbitStore((s) => s.role)
    const all = useLessonReviews()
    const stats = useAllStats()
    if (role !== 'teacher') return <Navigate to="/" replace />

    // Bài đang AI tạo chưa duyệt được; số liệu chỉ tính trên bài có nội dung
    const reviews = all.filter((r) => r.state !== 'generating')
    const tasks = buildTasks(reviews, stats)
    // Số liệu sinh viên chỉ lấy từ bài đã xuất bản (bài chưa xuất bản chưa có lượt làm thật)
    const att = buildAttention(reviews.filter((r) => r.state === 'published'), stats)
    const minutes = tasks.reduce((n, t) => n + t.minutes, 0)
    const pendingReviews = reviews.filter((r) => r.state === 'wait' || r.state === 'editing')
    const first = tasks[0]
    const published = reviews.filter((r) => r.state === 'published').length

    return (
        <div className="w-full pb-8">
            <section className="lesson-grid items-stretch">
                <div className="flex min-w-0 flex-col pt-1.5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
                        Tổng quan <span className="tracking-[0.08em] text-muted-foreground">· {todayLabel()}</span>
                    </p>
                    <h1 className="mt-3.5 text-[clamp(64px,6.4vw,118px)] font-black leading-[0.92] tracking-[-0.055em] text-strong">
                        Chào {TEACHER_PROFILE.honorific} {TEACHER_PROFILE.name}.
                    </h1>
                    <p className="mt-[18px] text-[clamp(28px,2.6vw,44px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-muted-foreground">
                        {tasks.length > 0 ? (
                            <>
                                Hôm nay có <em className="not-italic text-brand-ink">{tasks.length} việc</em>, khoảng {minutes} phút.
                            </>
                        ) : (
                            <>
                                Hôm nay <em className="not-italic text-brand-ink">hết việc</em>.
                            </>
                        )}
                    </p>
                    <p className="mt-4 max-w-[60ch] text-[16.5px] leading-[1.65] text-muted-foreground">
                        {first?.kind === 'resume' && 'Ưu tiên bài đang duyệt dở. '}
                        {first?.kind === 'new' && 'Ưu tiên duyệt bài AI vừa tạo xong. '}
                        {first?.kind === 'fix' && 'Ưu tiên sửa câu hỏi đang gây nhầm. '}
                        {!first && 'Mọi bài đã xuất bản. '}
                        {att ? (
                            <>
                                Sinh viên sai nhiều nhất ở <b className="text-strong">{shortConcept(att.concept.name)}</b>: {att.wrong}/{att.answered} bạn đã học trả lời sai ngay lần đầu.
                            </>
                        ) : (
                            'Chưa có dữ liệu trả lời của sinh viên.'
                        )}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-y-4 pt-10">
                        <PrimaryAction task={first} />
                        <Stat value={first?.kind === 'resume' ? `${first.review.done}/${first.review.total}` : `${pendingReviews.reduce((n, r) => n + r.done, 0)}/${pendingReviews.reduce((n, r) => n + r.total, 0)}`} label="mục đã duyệt" />
                        <Stat value={String(pendingReviews.length)} label="bài chờ duyệt" />
                        <Stat value={att ? `${att.wrong}/${att.answered}` : '—'} label="SV sai lần đầu" />
                    </div>
                </div>

                <AttentionCard stats={stats} att={att} />
            </section>

            <section className="mt-12" aria-labelledby="todo-title">
                <div className="mb-3.5 flex items-baseline justify-between">
                    <h2 id="todo-title" className="text-[26px] font-black tracking-[-0.02em] text-strong">
                        Việc hôm nay
                    </h2>
                    <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <i aria-hidden className="ml-2.5 inline-block h-1 w-3.5 rounded-sm bg-success-bright" /> Đã duyệt
                        <i aria-hidden className="ml-2.5 inline-block h-1 w-3.5 rounded-sm border border-border bg-muted" /> Còn lại
                    </span>
                </div>
                <div className="rounded-[20px] border border-border bg-card px-2.5 py-1.5 shadow-card">
                    {tasks.length === 0 && <p className="p-6 text-sm text-muted-foreground">Không còn bài nào chờ duyệt và không có câu hỏi nào gây nhầm. Thầy cô có thể thêm video mới.</p>}
                    {tasks.map((t) => (
                        <TaskRow key={`${t.kind}-${t.review.lesson.id}`} view={describe(t, stats)} />
                    ))}
                </div>
                <p className="mx-1 mt-3.5 text-[13px] text-muted-foreground">
                    Còn {published} bài đã xuất bản ·{' '}
                    <Link to="/teacher/library" className="underline underline-offset-[3px] hover:text-strong">
                        Xem tất cả bài giảng
                    </Link>
                </p>
            </section>
        </div>
    )
}

function PrimaryAction({ task }: { task?: TeacherTask }) {
    const addDialog = useAddDialog((s) => s.show)
    const cls =
        'surface-red tier-1-bob mr-3 inline-flex h-14 items-center rounded-[14px] px-[26px] text-[17px] font-extrabold text-ink-foreground shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'
    if (!task) {
        return (
            <button type="button" onClick={() => addDialog()} className={cls}>
                Thêm video →
            </button>
        )
    }
    const label = task.kind === 'resume' ? `Duyệt tiếp bài ${task.review.index + 1}` : task.kind === 'new' ? 'Duyệt bài mới' : 'Sửa câu hỏi'
    const to = task.kind === 'fix' ? reviewTo(task.review.lesson.id, `?item=q:${task.question.id}`) : reviewTo(task.review.lesson.id)
    return (
        <Link to={to} className={cls}>
            {label} →
        </Link>
    )
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <span className="border-l border-border px-[26px] py-0.5 text-[13.5px] text-muted-foreground">
            <b className="mb-1 block font-mono text-2xl font-extrabold text-strong">{value}</b>
            {label}
        </span>
    )
}

function TaskRow({ view: v }: { view: TaskView }) {
    const color = v.ring.warn ? 'rgb(var(--brand-600))' : 'var(--success-bright)'
    return (
        <Link
            to={v.to}
            className="grid grid-cols-[64px_minmax(0,1.3fr)_minmax(120px,1fr)_110px_100px] items-center gap-[22px] rounded-[14px] px-3.5 py-[18px] transition hover:bg-muted/60 [&+&]:border-t [&+&]:border-border"
        >
            <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `conic-gradient(${color} ${v.ring.p}%, hsl(var(--muted)) 0)` }}>
                <b className="flex h-11 w-11 items-center justify-center rounded-full bg-card font-mono text-[12.5px] font-extrabold text-strong">{v.ring.label}</b>
            </span>
            <span className="min-w-0">
                <b className="block text-base font-bold leading-snug text-strong">{v.title}</b>
                <span className="mt-1.5 flex flex-wrap items-center gap-2.5">
                    <span className={`rounded-full px-[9px] py-1 text-xs font-bold ${v.chip.tone === 'edit' ? 'bg-mm-orange/15 text-[hsl(var(--subject-photo-ink))]' : 'bg-brand-50 text-brand-ink'}`}>{v.chip.text}</span>
                    <small className="font-mono text-xs text-muted-foreground">{v.sub}</small>
                </span>
            </span>
            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                <i className={`block h-full rounded-full ${v.ring.warn ? 'bg-brand-600' : 'bg-success-bright'}`} style={{ width: `${v.bar}%` }} />
            </span>
            <span className="text-right">
                <b className="block font-mono text-xl font-extrabold text-strong">{v.big}</b>
                <small className="text-xs text-muted-foreground">{v.unit}</small>
            </span>
            <span className="justify-self-end text-[14.5px] font-extrabold text-brand-ink">{v.cta}</span>
        </Link>
    )
}

/** Thẻ "Cần chú ý nhất" theo kiểu thẻ "Chặng tiếp theo": khung 16:9 là thumbnail của bài kèm chip mốc thời gian, rồi lý do sai. */
function AttentionCard({ stats, att }: { stats: ClassStats; att: Attention | null }) {
    if (!att) {
        return (
            <aside className="flex flex-col rounded-[20px] border border-border bg-card p-6 shadow-card">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Cần chú ý nhất</h2>
                <p className="mt-3 text-sm text-muted-foreground">Chưa có dữ liệu trả lời của sinh viên.</p>
            </aside>
        )
    }
    const { concept, review, question, why } = att
    const at = question?.pauseAt ?? concept.segment.start
    const to = reviewTo(review.lesson.id, question ? `?item=q:${question.id}` : `?t=${concept.segment.start}`)
    const trap = question ? topTrap(stats, question) : null
    const picks = question ? questionPicks(stats, question.id) : null
    const trapCount = trap && picks ? picks[trap.index] : 0
    const total = picks ? picks.reduce((a, b) => a + b, 0) : 0
    return (
        <aside className="flex min-w-0 flex-col rounded-[20px] border border-border bg-card p-6 shadow-card">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Cần chú ý nhất</h2>
            <Link to={to} aria-label={`Mở câu hỏi ở ${formatTime(at)}`} className="group relative mt-3.5 block aspect-video overflow-hidden rounded-[14px] bg-gradient-to-br from-ink via-ink to-brand-950">
                <img src={`https://i.ytimg.com/vi/${review.lesson.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-slow group-hover:scale-[1.03]" onError={(e) => (e.currentTarget.hidden = true)} />
                <em className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-[9px] py-[5px] font-mono text-xs font-bold not-italic text-ink-foreground">
                    <Play size={11} className="fill-current" aria-hidden /> {formatTime(at)}
                </em>
            </Link>
            <b className="mt-[18px] text-lg font-extrabold leading-snug text-strong">
                {shortConcept(concept.name)} · câu hỏi ở {formatTime(at)}
            </b>
            {why && <p className="mt-2 text-[15px] leading-relaxed text-foreground">{why}</p>}
            {trap && question && (
                <small className="mt-1.5 block text-[12.5px] text-muted-foreground">
                    {trapCount}/{total} SV chọn đáp án nhiễu “{question.options[trap.index]}”
                </small>
            )}
            <div className="mt-auto flex items-center justify-between pt-5">
                <Link to={to} className="inline-flex h-[46px] items-center rounded-xl border-2 border-strong px-[18px] text-[15px] font-extrabold text-strong transition hover:bg-strong hover:text-background">
                    Sửa câu hỏi →
                </Link>
                <Link to="/teacher/class" className="text-sm font-bold text-muted-foreground transition hover:text-strong">
                    Xem lớp học
                </Link>
            </div>
        </aside>
    )
}
