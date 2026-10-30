import { Link, Navigate } from 'react-router-dom'
import { useAddDialog } from '@/components/teacher/add-dialog-state'
import { findUrgent, pct, useAllStats, useLessonReviews, type LessonReview } from '@/lib/teacher'
import type { PendingTest } from '@/lib/test-sets'
import { usePendingReviewTasks } from '@/components/teacher/use-pending-review-tasks'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const MAX_ROWS = 3

/** Hàng là một link: hover/focus nổi lên, nút CTA bên phải chỉ là hình (aria-hidden) để cả hàng là một điểm focus. */
const rowLinkCls = 'group transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-card hover:shadow-card focus-visible:-translate-y-0.5 focus-visible:bg-card focus-visible:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0'
const ctaCls = 'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[10px] border border-border bg-card px-4 text-sm font-bold text-strong transition duration-200 ease-out group-hover:border-brand-600 group-hover:bg-brand-600 group-hover:text-ink-foreground group-focus-visible:border-brand-600 group-focus-visible:bg-brand-600 group-focus-visible:text-ink-foreground'

const outlineBtn = 'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[10px] border border-border bg-card px-4 text-sm font-bold text-strong transition hover:bg-muted'

/** Tổng quan của vai giảng viên (route "/"): danh sách việc cần làm. Việc khẩn nổi nhất, rồi bài chờ duyệt, cuối trang là bài đã xuất bản. */
export function TeacherOverview() {
    const role = useOrbitStore((s) => s.role)
    const all = useLessonReviews()
    const stats = useAllStats()
    const rows = usePendingReviewTasks()
    const showAdd = useAddDialog((s) => s.show)
    if (role !== 'teacher') return <Navigate to="/" replace />

    const reviews = all.filter((r) => r.state !== 'generating')
    const urgent = findUrgent(reviews, stats)
    const shown = rows.slice(0, MAX_ROWS)
    const published = reviews.filter((r) => r.state === 'published')

    return (
        <div className="w-full pb-8">
            <h1 className="text-[34px] font-black leading-tight tracking-tight text-strong">Việc cần làm</h1>

            {urgent && (
                <section
                    aria-labelledby="urgent-label"
                    className="group relative mt-6 rounded-[22px] text-ink-foreground shadow-[0_24px_40px_-28px_rgba(226,38,28,.7)] transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_30px_46px_-26px_rgba(226,38,28,.85)] focus-within:-translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0"
                    style={{ background: 'linear-gradient(150deg, #FF5A47 0%, #E2261C 55%, #C81B12 100%)' }}
                >
                    {/* Cả khối là một link: lớp phủ trong suốt phủ kín; "Xem đoạn" nằm trên lớp phủ nên là link riêng, không lồng <a> */}
                    <Link
                        to={`/teacher/review/${urgent.review.lesson.id}?item=q:${urgent.question.id}`}
                        aria-label={`Sửa câu hỏi: ${urgent.question.prompt}`}
                        className="absolute inset-0 z-0 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
                    />
                    <div className="pointer-events-none relative flex flex-wrap items-center justify-between gap-x-10 gap-y-5 px-9 py-7">
                        <div className="min-w-0 flex-1 basis-[420px]">
                            <p id="urgent-label" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-foreground/85">
                                <i aria-hidden className="h-2 w-2 rounded-full bg-ink-foreground" /> Cần sửa ngay
                            </p>
                            <h2 className="mt-2.5 text-2xl font-black leading-snug tracking-tight">Câu hỏi đang làm nhiều sinh viên hiểu sai</h2>
                            <blockquote className="mt-3 text-[17px] leading-snug">“{urgent.question.prompt}”</blockquote>
                            <p className="mt-3 text-[15px] leading-relaxed text-ink-foreground/90">
                                <b className="font-mono font-extrabold text-ink-foreground">
                                    {urgent.wrong}/{urgent.total}
                                </b>{' '}
                                sinh viên sai lần đầu
                                {urgent.trap && (
                                    <>
                                        , trong đó <b className="font-mono font-extrabold text-ink-foreground">{urgent.trap.count}</b> bạn chọn cùng đáp án “{urgent.trap.text}”
                                    </>
                                )}
                            </p>
                            <small className="mt-2 block truncate text-[12.5px] text-ink-foreground/70">
                                {urgent.review.course?.title} · {urgent.review.lesson.shortTitle ?? urgent.review.lesson.title} · câu ở {formatTime(urgent.question.pauseAt)}
                            </small>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-3">
                            <span aria-hidden className="block transition-transform duration-200 ease-out group-hover:scale-[1.03] group-focus-within:scale-[1.03]">
                                <span className="tier-1-bob inline-flex h-[52px] items-center rounded-[14px] bg-ink-foreground px-[26px] text-base font-extrabold text-brand-ink shadow-card">Sửa câu hỏi →</span>
                            </span>
                            <Link
                                to={`/teacher/review/${urgent.review.lesson.id}?t=${urgent.question.pauseAt}`}
                                className="pointer-events-auto relative z-10 text-sm font-bold text-ink-foreground/85 underline-offset-[3px] transition hover:underline focus-visible:underline focus-visible:outline-none"
                            >
                                Xem đoạn <span className="font-mono">{formatTime(urgent.question.pauseAt)}</span>
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            <section aria-labelledby="pending-title" className="mt-9">
                <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h2 id="pending-title" className="text-[22px] font-black tracking-tight text-strong">
                        Chờ duyệt <span className="ml-1 font-mono text-base font-extrabold text-brand-ink">{rows.length}</span>
                    </h2>
                </div>
                {rows.length === 0 ? (
                    <p className="rounded-[20px] border border-border bg-card px-6 py-5 text-[15px] text-foreground shadow-card">
                        Không còn bài nào chờ duyệt.{' '}
                        <button type="button" onClick={() => showAdd()} className="ml-1 font-bold text-brand-ink hover:underline">
                            Thêm video
                        </button>
                    </p>
                ) : (
                    <div className="rounded-[20px] border border-border bg-card px-2.5 py-1.5 shadow-card">
                        {shown.map((row) => (row.kind === 'lesson' ? <LessonRow key={row.review.lesson.id} review={row.review} /> : <TestRow key={row.test.courseId} test={row.test} />))}
                        {rows.length > MAX_ROWS && (
                            <p className="rounded-[14px] bg-muted/60 px-4 py-3 text-[13.5px] text-muted-foreground [&]:mt-1">
                                +{rows.length - MAX_ROWS} việc khác chờ duyệt ·{' '}
                                <Link to="/teacher/library" className="font-bold text-strong underline underline-offset-[3px]">
                                    Xem trong Bài giảng
                                </Link>
                            </p>
                        )}
                    </div>
                )}
            </section>

            {published.length > 0 && (
                <details className="group mt-8">
                    <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-strong [&::-webkit-details-marker]:hidden">
                        Đã xuất bản tuần này · {published.length} bài <span className="text-xs transition-transform duration-fast group-open:rotate-180">▾</span>
                    </summary>
                    <ul className="mt-3 rounded-[20px] border border-border bg-muted/50 p-1.5">
                        {published.map((r) => (
                            <li key={r.lesson.id} className="[&+&]:border-t [&+&]:border-border">
                                <Link to={`/teacher/review/${r.lesson.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3.5 py-3 transition duration-200 ease-out hover:bg-card focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
                                <span className="min-w-0">
                                    <b title={r.lesson.title} className="block truncate text-[14.5px] font-semibold text-muted-foreground">{r.lesson.title}</b>
                                    <small title={r.course?.title} className="block truncate text-xs text-muted-foreground">{r.course?.title}</small>
                                </span>
                                <span aria-hidden className={outlineBtn}>
                                    Xem
                                </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    )
}

const rowCls = 'grid grid-cols-[84px_minmax(0,1fr)_150px_112px] items-center gap-5 rounded-[14px] px-3.5 py-4 [&+&]:border-t [&+&]:border-border max-md:grid-cols-[minmax(0,1fr)_auto]'

function Label({ children }: { children: React.ReactNode }) {
    return <span className="w-fit rounded-md bg-muted px-2 py-1 text-[11.5px] font-bold text-strong max-md:hidden">{children}</span>
}

function LessonRow({ review: r }: { review: LessonReview }) {
    const editing = r.state === 'editing'
    return (
        <Link to={`/teacher/review/${r.lesson.id}`} className={`${rowCls} ${rowLinkCls}`}>
            <Label>Bài giảng</Label>
            <span className="min-w-0">
                <b title={r.lesson.title} className="block truncate text-[16.5px] font-bold leading-snug text-strong">{r.lesson.title}</b>
                <small title={r.course?.title} className="mt-1 block truncate text-[13px] text-muted-foreground">
                    {r.course?.title} · {editing ? 'đang duyệt dở' : 'AI vừa tạo xong'}
                </small>
            </span>
            <span className="max-md:hidden">
                <span className="font-mono text-[13px] font-bold text-strong">
                    {r.done}/{r.total} mục
                </span>
                <i aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
                    <u className="block h-full rounded-full bg-success-bright no-underline" style={{ width: `${pct(r.done, r.total)}%` }} />
                </i>
            </span>
            <span aria-hidden className={`${ctaCls} justify-self-end`}>
                {editing ? 'Duyệt tiếp' : 'Bắt đầu'}
            </span>
        </Link>
    )
}

function TestRow({ test: t }: { test: PendingTest }) {
    return (
        <Link to={`/teacher/test/${t.courseId}`} className={`${rowCls} ${rowLinkCls}`}>
            <Label>Kiểm tra khóa</Label>
            <span className="min-w-0">
                <b className="block truncate text-[16.5px] font-bold leading-snug text-strong">Kiểm tra cuối khóa</b>
                <small title={t.courseTitle} className="mt-1 block truncate text-[13px] text-muted-foreground">
                    {t.courseTitle} · Bản nháp AI soạn{t.missing > 0 ? ` · còn ${t.missing} khái niệm chưa có câu` : ''}
                </small>
            </span>
            <span className="font-mono text-[13px] font-bold text-muted-foreground max-md:hidden">{t.count} câu · bản nháp</span>
            <span aria-hidden className={`${ctaCls} justify-self-end`}>
                Soạn đề
            </span>
        </Link>
    )
}
