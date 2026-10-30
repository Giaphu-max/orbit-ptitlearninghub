import { Link, Navigate } from 'react-router-dom'
import { useAddDialog } from '@/components/teacher/add-dialog-state'
import { TEACHER_PROFILE } from '@/data/teacher-notes'
import { findUrgent, pct, useAllStats, useLessonReviews, type LessonReview } from '@/lib/teacher'
import type { PendingTest } from '@/lib/test-sets'
import { usePendingReviewTasks } from '@/components/teacher/use-pending-review-tasks'
import { formatTime } from '@/lib/youtube'
import { useOrbitStore } from '@/store/useOrbitStore'

const MAX_ROWS = 3

function dateLabel() {
    const d = new Date()
    const w = d.toLocaleDateString('vi-VN', { weekday: 'long' })
    return `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
            <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h1 className="text-[34px] font-black leading-tight tracking-tight text-strong">Việc cần làm</h1>
                <p className="text-sm text-muted-foreground">
                    Chào {TEACHER_PROFILE.honorific} {TEACHER_PROFILE.name} · {dateLabel()}
                </p>
            </header>

            {urgent && (
                <section aria-labelledby="urgent-label" className="relative mt-6 overflow-hidden rounded-[20px] border border-brand-100 bg-card shadow-[0_18px_40px_-26px_rgb(var(--brand-600)/0.55)]">
                    <i aria-hidden className="absolute inset-y-0 left-0 w-[5px] bg-brand-600" />
                    <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 py-6 pl-9 pr-8">
                        <div className="min-w-0 flex-1 basis-[420px]">
                            <p id="urgent-label" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
                                <i aria-hidden className="h-2 w-2 rounded-full bg-brand-600" /> Cần sửa ngay
                            </p>
                            <h2 className="mt-2.5 text-2xl font-black leading-snug tracking-tight text-strong">Câu hỏi đang làm nhiều sinh viên hiểu sai</h2>
                            <blockquote className="mt-3 text-[17px] leading-snug text-foreground">“{urgent.question.prompt}”</blockquote>
                            <p className="mt-3 text-[15px] leading-relaxed text-foreground">
                                <b className="font-mono font-extrabold text-brand-ink">
                                    {urgent.wrong}/{urgent.total}
                                </b>{' '}
                                sinh viên sai lần đầu
                                {urgent.trap && (
                                    <>
                                        , trong đó <b className="font-mono font-extrabold text-brand-ink">{urgent.trap.count}</b> bạn chọn cùng đáp án “{urgent.trap.text}”
                                    </>
                                )}
                            </p>
                            <small className="mt-2 block truncate text-[13px] text-muted-foreground">
                                {urgent.review.course?.title} · {urgent.review.lesson.shortTitle ?? urgent.review.lesson.title} · câu ở {formatTime(urgent.question.pauseAt)}
                            </small>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-3">
                            <Link
                                to={`/teacher/review/${urgent.review.lesson.id}?item=q:${urgent.question.id}`}
                                className="surface-red tier-1-bob inline-flex h-14 items-center rounded-[14px] px-[26px] text-[17px] font-extrabold text-ink-foreground shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                            >
                                Sửa câu hỏi →
                            </Link>
                            <Link to={`/teacher/review/${urgent.review.lesson.id}?t=${urgent.question.pauseAt}`} className="text-sm font-bold text-muted-foreground transition hover:text-strong">
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
                    {rows.length > 0 && <small className="text-[12.5px] text-muted-foreground">Bài đang dở lên trước</small>}
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
                            <li key={r.lesson.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3.5 py-3 [&+&]:border-t [&+&]:border-border">
                                <span className="min-w-0">
                                    <b title={r.lesson.title} className="block truncate text-[14.5px] font-semibold text-muted-foreground">{r.lesson.title}</b>
                                    <small title={r.course?.title} className="block truncate text-xs text-muted-foreground">{r.course?.title}</small>
                                </span>
                                <Link to={`/teacher/review/${r.lesson.id}`} className={outlineBtn}>
                                    Xem
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
        <div className={rowCls}>
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
            <Link to={`/teacher/review/${r.lesson.id}`} className={`${outlineBtn} justify-self-end`}>
                {editing ? 'Duyệt tiếp' : 'Bắt đầu'}
            </Link>
        </div>
    )
}

function TestRow({ test: t }: { test: PendingTest }) {
    return (
        <div className={rowCls}>
            <Label>Test chương</Label>
            <span className="min-w-0">
                <b className="block text-[16.5px] font-bold leading-snug text-strong">Test cuối chương · {t.courseTitle}</b>
                <small className="mt-1 block text-[13px] text-muted-foreground">
                    {t.courseTitle} · Bản nháp AI soạn{t.missing > 0 ? ` · còn ${t.missing} khái niệm chưa có câu` : ''}
                </small>
            </span>
            <span className="font-mono text-[13px] font-bold text-muted-foreground max-md:hidden">{t.count} câu · bản nháp</span>
            <Link to={`/teacher/test/${t.courseId}`} className={`${outlineBtn} justify-self-end`}>
                Soạn đề
            </Link>
        </div>
    )
}
